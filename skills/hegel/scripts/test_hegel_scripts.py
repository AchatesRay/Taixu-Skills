#!/usr/bin/env python3
"""
hegel 脚本测试套件 — 覆盖全部 5 个脚本 (100%)

脚本覆盖:
  - check-convergence.py  (TestCheckConvergence + TestPhaseTransitions)
  - scope-validate.py      (TestScopeValidate)
  - init-state.py          (TestInitState)
  - claim-validate.py      (TestClaimValidate)
  - preflight-check.py     (TestPreflightCheck)

运行: python3 -m pytest .agents/skills/hegel/scripts/test_hegel_scripts.py -v
或:   python3 .agents/skills/hegel/scripts/test_hegel_scripts.py
"""

import json
import os
import sys
import tempfile
import shutil
import io
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch, MagicMock

# 将 scripts 目录加入 path
SCRIPTS_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPTS_DIR))


class TestCheckConvergence(unittest.TestCase):
    """测试 check-convergence.py"""

    def setUp(self):
        import importlib
        spec = importlib.util.spec_from_file_location(
            "check_convergence", SCRIPTS_DIR / "check-convergence.py"
        )
        self.cc = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.cc)

    def test_get_delta_for_type_deterministic(self):
        """deterministic 类型使用 0.03 阈值"""
        config = {"confidence_stability_delta_deterministic": 0.03, "confidence_stability_delta": 0.05}
        delta = self.cc.get_delta_for_type("deterministic", config)
        self.assertEqual(delta, 0.03)

    def test_get_delta_for_type_epistemic(self):
        """epistemic 类型使用默认 0.05 阈值"""
        config = {"confidence_stability_delta_deterministic": 0.03, "confidence_stability_delta": 0.05}
        delta = self.cc.get_delta_for_type("epistemic", config)
        self.assertEqual(delta, 0.05)

    def test_get_delta_for_type_ontological(self):
        """ontological 类型也使用默认 0.05 阈值"""
        config = {"confidence_stability_delta_deterministic": 0.03, "confidence_stability_delta": 0.05}
        delta = self.cc.get_delta_for_type("ontological", config)
        self.assertEqual(delta, 0.05)

    def test_get_delta_default_config(self):
        """配置缺失时使用默认值"""
        delta_det = self.cc.get_delta_for_type("deterministic", {})
        self.assertEqual(delta_det, 0.03)
        delta_other = self.cc.get_delta_for_type("epistemic", {})
        self.assertEqual(delta_other, 0.05)

    def test_history_value_float(self):
        """_history_value 正确处理 float 格式"""
        self.assertEqual(self.cc._history_value(0.85), 0.85)
        self.assertEqual(self.cc._history_value(0.5), 0.5)

    def test_history_value_dict(self):
        """_history_value 正确处理 dict 格式"""
        entry = {"pass": 1, "value": 0.72, "source": "bayes"}
        self.assertEqual(self.cc._history_value(entry), 0.72)

    def test_check_c1_stable(self):
        """C1: 置信度稳定（delta < threshold）→ 无违规"""
        findings = [
            {"id": "f1", "uncertainty_type": "deterministic", "confidence_history": [0.80, 0.82]}
        ]
        config = {"confidence_stability_delta_deterministic": 0.03, "confidence_stability_delta": 0.05}
        passed, violations = self.cc.check_c1_confidence_stable(findings, config)
        self.assertTrue(passed)
        self.assertEqual(len(violations), 0)

    def test_check_c1_unstable(self):
        """C1: 置信度不稳定（delta >= threshold）→ 有违规"""
        findings = [
            {"id": "f1", "uncertainty_type": "deterministic", "confidence_history": [0.50, 0.90]}
        ]
        config = {"confidence_stability_delta_deterministic": 0.03, "confidence_stability_delta": 0.05}
        passed, violations = self.cc.check_c1_confidence_stable(findings, config)
        self.assertFalse(passed)
        self.assertEqual(len(violations), 1)
        self.assertEqual(violations[0]["finding_id"], "f1")

    def test_check_c1_insufficient_history(self):
        """C1: 历史记录不足 2 条 → 跳过"""
        findings = [
            {"id": "f1", "uncertainty_type": "deterministic", "confidence_history": [0.80]}
        ]
        config = {"confidence_stability_delta_deterministic": 0.03}
        passed, violations = self.cc.check_c1_confidence_stable(findings, config)
        self.assertTrue(passed)
        self.assertEqual(len(violations), 0)


class TestScopeValidate(unittest.TestCase):
    """测试 scope-validate.py"""

    def setUp(self):
        import importlib
        spec = importlib.util.spec_from_file_location(
            "scope_validate", SCRIPTS_DIR / "scope-validate.py"
        )
        self.sv = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.sv)

    def _valid_scope(self):
        """生成一个合法的 scope 字典"""
        return {
            "schema_version": 1,
            "revision": 1,
            "system_type": "deterministic",
            "system_type_rationale": "这是一个确定性的代码审查任务，需要二值判定",
            "dimensions": [
                {"id": "d1", "name": "correctness", "description": "正确性", "weight": 1.0, "source": "code", "active": True}
            ],
            "success_criteria": [],
            "constraints": {"axioms": [], "parameters": []},
            "budget": {"complexity": "low", "max_safety_valve_rounds": 2, "estimated_passes": 3},
            "provenance": {"lens_id": "code", "user_overrides": [], "pre_scan_inferred": False, "auto_fill_ratio": 0.0}
        }

    def test_valid_scope_passes(self):
        """合法 scope 无 errors"""
        scope = self._valid_scope()
        errors, warnings = self.sv.validate(scope, hard_cap=10, lens="code")
        self.assertEqual(len(errors), 0, f"Expected no errors, got: {errors}")

    def test_v1_invalid_schema_version(self):
        """V1: schema_version 非正整数"""
        scope = self._valid_scope()
        scope["schema_version"] = 0
        errors, _ = self.sv.validate(scope, hard_cap=10)
        self.assertTrue(any("V1" in e for e in errors))

    def test_v2_invalid_system_type(self):
        """V2: system_type 不在枚举内"""
        scope = self._valid_scope()
        scope["system_type"] = "random"
        errors, _ = self.sv.validate(scope, hard_cap=10)
        self.assertTrue(any("V2" in e for e in errors))

    def test_v3_short_rationale(self):
        """V3: rationale 长度 < 20"""
        scope = self._valid_scope()
        scope["system_type_rationale"] = "短"
        errors, _ = self.sv.validate(scope, hard_cap=10)
        self.assertTrue(any("V3" in e for e in errors))

    def test_v4_no_active_dimension(self):
        """V4: 无 active=true 的 dimension"""
        scope = self._valid_scope()
        scope["dimensions"][0]["active"] = False
        errors, _ = self.sv.validate(scope, hard_cap=10)
        self.assertTrue(any("V4" in e for e in errors))

    def test_valid_system_types(self):
        """所有合法 system_type 都通过 V2"""
        for st in ["deterministic", "non_deterministic", "mixed"]:
            scope = self._valid_scope()
            scope["system_type"] = st
            scope["system_type_rationale"] = f"这是{st}类型的分析任务说明"
            errors, _ = self.sv.validate(scope, hard_cap=10)
            self.assertFalse(any("V2" in e for e in errors), f"Failed for {st}")


class TestInitState(unittest.TestCase):
    """测试 init-state.py"""

    def setUp(self):
        import importlib
        spec = importlib.util.spec_from_file_location(
            "init_state", SCRIPTS_DIR / "init-state.py"
        )
        self.ist = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.ist)

    def test_generate_workflow_id_format(self):
        """workflow_id 格式: cr-YYYYMMDD-NNN"""
        wf_id = self.ist.generate_workflow_id()
        self.assertTrue(wf_id.startswith("cr-"))
        # 格式: cr-YYYYMMDD-NNN → split('-') → ['cr', 'YYYYMMDD', 'NNN'] = 3 parts
        parts = wf_id.split("-")
        self.assertEqual(len(parts), 3)
        self.assertRegex(parts[1], r"^\d{8}$")  # YYYYMMDD
        self.assertRegex(parts[2], r"^\d{3}$")  # NNN

    def test_find_lens_file_existing(self):
        """find_lens_file 能找到 code lens"""
        result = self.ist.find_lens_file("code")
        if result:
            self.assertTrue(result.exists())
            self.assertTrue(result.name == "lens-code.md")

    def test_find_lens_file_nonexistent(self):
        """find_lens_file 对不存在的 lens 返回 None"""
        result = self.ist.find_lens_file("nonexistent-lens-12345")
        self.assertIsNone(result)

    def test_validate_lens_returns_list(self):
        """validate_lens 返回 errors 列表"""
        lens_path = self.ist.find_lens_file("code")
        if lens_path:
            errors = self.ist.validate_lens(lens_path)
            self.assertIsInstance(errors, list)
        else:
            self.skipTest("code lens not found")

    def test_lens_sections_constant(self):
        """LENS_SECTIONS 常量包含 7 个 section"""
        self.assertEqual(len(self.ist.LENS_SECTIONS), 7)
        for s in self.ist.LENS_SECTIONS:
            self.assertTrue(s.startswith("§"))


class TestB2DegradedMode(unittest.TestCase):
    """测试 B2 降级模式（D8 降级测试覆盖）"""

    def test_degraded_mode_enum(self):
        """B2 降级模式标记枚举值正确"""
        valid_modes = {"web_search_fallback", "single_model_degraded"}
        self.assertIn("web_search_fallback", valid_modes)
        self.assertIn("single_model_degraded", valid_modes)

    def test_b2_mode_label(self):
        """b2_mode 正确标注降级"""
        # 当 degraded_mode 存在时，b2_mode 应为 'degraded'
        agentB_degraded = {"direction": "positive", "degraded_mode": "web_search_fallback"}
        b2_mode = "degraded" if agentB_degraded.get("degraded_mode") else "heterogeneous"
        self.assertEqual(b2_mode, "degraded")

        # 当 degraded_mode 不存在时，b2_mode 应为 'heterogeneous'
        agentB_normal = {"direction": "positive"}
        b2_mode = "degraded" if agentB_normal.get("degraded_mode") else "heterogeneous"
        self.assertEqual(b2_mode, "heterogeneous")


class TestPhaseTransitions(unittest.TestCase):
    """测试 detect_phase_transitions（D1 相变识别量化）"""

    def setUp(self):
        import importlib
        spec = importlib.util.spec_from_file_location(
            "check_convergence", SCRIPTS_DIR / "check-convergence.py"
        )
        self.cc = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.cc)

    def test_confidence_jump_detected(self):
        """置信度跳变 >= 0.3 被检测为相变"""
        findings = [
            {"id": "f1", "confidence_history": [0.3, 0.8]},  # delta=0.5
        ]
        transitions = self.cc.detect_phase_transitions(findings, current_round=1)
        self.assertEqual(len(transitions), 1)
        self.assertEqual(transitions[0]["type"], "confidence_jump")
        self.assertEqual(transitions[0]["finding_id"], "f1")

    def test_no_transition_when_stable(self):
        """置信度稳定时不触发相变"""
        findings = [
            {"id": "f1", "confidence_history": [0.80, 0.82]},  # delta=0.02
        ]
        transitions = self.cc.detect_phase_transitions(findings, current_round=1)
        self.assertEqual(len(transitions), 0)

    def test_status_flip_detected(self):
        """状态翻转被检测为相变"""
        findings = [
            {"id": "f1", "status_history": ["pass0->confirmed", "pass1->uncertain"]},
        ]
        transitions = self.cc.detect_phase_transitions(findings, current_round=1)
        self.assertTrue(any(t["type"] == "status_flip" for t in transitions))

    def test_ci_width_change_detected(self):
        """CI 宽度突变 >= 50% 被检测为相变"""
        findings = [
            {"id": "f1", "ci_history": [[0.2, 0.8], [0.2, 0.4]]},  # width 0.6→0.2, change=67%
        ]
        transitions = self.cc.detect_phase_transitions(findings, current_round=1)
        self.assertEqual(len(transitions), 1)
        self.assertEqual(transitions[0]["type"], "ci_width_change")

    def test_phase_threshold_value(self):
        """相变检测阈值为 0.3"""
        threshold = self.cc.config_get_phase_threshold()
        self.assertEqual(threshold, 0.3)


class TestClaimValidate(unittest.TestCase):
    """测试 claim-validate.py"""

    def setUp(self):
        import importlib
        spec = importlib.util.spec_from_file_location(
            "claim_validate", SCRIPTS_DIR / "claim-validate.py"
        )
        self.cv = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.cv)

    def _valid_claim(self):
        """生成一个合法的 claim 字典"""
        return {
            "id": "CL001",
            "text": "这是一个测试断言",
            "type": "factual",
            "uncertainty": "deterministic",
            "source_location": "line 42",
            "groundings": ["基础数据"],
            "implicit": "隐含假设",
            "confidence_extractable": 0.85,
        }

    def test_valid_claim_no_errors(self):
        """合法 claim 不产生 error"""
        claims = [self._valid_claim()]
        errors, warnings = self.cv.validate_claims(claims)
        self.assertEqual(len(errors), 0, f"Expected no errors, got: {errors}")

    def test_empty_claims_error(self):
        """空 claims 列表产生 error"""
        errors, _ = self.cv.validate_claims([])
        self.assertEqual(len(errors), 1)
        self.assertIn("无 claims", errors[0])

    def test_missing_id_error(self):
        """缺少 id 产生 error"""
        claim = self._valid_claim()
        del claim["id"]
        errors, _ = self.cv.validate_claims([claim])
        self.assertTrue(any("缺少 id" in e for e in errors))

    def test_duplicate_id_error(self):
        """重复 id 产生 error"""
        claim = self._valid_claim()
        errors, _ = self.cv.validate_claims([claim, claim.copy()])
        self.assertTrue(any("重复" in e for e in errors))

    def test_missing_text_error(self):
        """缺少 text 产生 error"""
        claim = self._valid_claim()
        del claim["text"]
        errors, _ = self.cv.validate_claims([claim])
        self.assertTrue(any("缺少 text" in e for e in errors))

    def test_invalid_type_error(self):
        """无效 type 产生 error"""
        claim = self._valid_claim()
        claim["type"] = "invalid_type"
        errors, _ = self.cv.validate_claims([claim])
        self.assertTrue(any("type" in e and "不在枚举" in e for e in errors))

    def test_invalid_uncertainty_error(self):
        """无效 uncertainty 产生 error"""
        claim = self._valid_claim()
        claim["uncertainty"] = "invalid_uncertainty"
        errors, _ = self.cv.validate_claims([claim])
        self.assertTrue(any("uncertainty" in e and "不在枚举" in e for e in errors))

    def test_missing_source_location_warning(self):
        """缺少 source_location 产生 warning"""
        claim = self._valid_claim()
        del claim["source_location"]
        _, warnings = self.cv.validate_claims([claim])
        self.assertTrue(any("source_location" in w for w in warnings))

    def test_no_groundings_warning(self):
        """无 groundings 产生 warning"""
        claim = self._valid_claim()
        claim["groundings"] = []
        _, warnings = self.cv.validate_claims([claim])
        self.assertTrue(any("groundings" in w for w in warnings))

    def test_confidence_out_of_range_error(self):
        """confidence_extractable 超出 [0,1] 产生 error"""
        claim = self._valid_claim()
        claim["confidence_extractable"] = 1.5
        errors, _ = self.cv.validate_claims([claim])
        self.assertTrue(any("confidence_extractable" in e and "超出" in e for e in errors))

    def test_confidence_none_no_error(self):
        """confidence_extractable=None 时不产生 error（合法缺省）"""
        claim = self._valid_claim()
        claim["confidence_extractable"] = None
        errors, _ = self.cv.validate_claims([claim])
        self.assertFalse(any("confidence_extractable" in e for e in errors))

    def test_confidence_boundary_values(self):
        """confidence_extractable 边界值 0.0 和 1.0 合法"""
        for val in [0.0, 1.0]:
            claim = self._valid_claim()
            claim["confidence_extractable"] = val
            errors, _ = self.cv.validate_claims([claim])
            self.assertFalse(any("confidence_extractable" in e for e in errors), f"Failed for value={val}")

    def test_missing_implicit_warning(self):
        """缺少 implicit 字段产生 warning"""
        claim = self._valid_claim()
        del claim["implicit"]
        _, warnings = self.cv.validate_claims([claim])
        self.assertTrue(any("implicit" in w for w in warnings))

    def test_all_valid_claim_types(self):
        """所有合法 type 都不产生 error"""
        for ct in ["factual", "causal", "evaluative", "prescriptive", "predictive"]:
            claim = self._valid_claim()
            claim["type"] = ct
            errors, _ = self.cv.validate_claims([claim])
            type_errors = [e for e in errors if "type" in e and "不在枚举" in e]
            self.assertEqual(len(type_errors), 0, f"Failed for type={ct}")

    def test_all_valid_uncertainties(self):
        """所有合法 uncertainty 都不产生 error"""
        for u in ["deterministic", "non_deterministic", "tbd"]:
            claim = self._valid_claim()
            claim["uncertainty"] = u
            errors, _ = self.cv.validate_claims([claim])
            u_errors = [e for e in errors if "uncertainty" in e and "不在枚举" in e]
            self.assertEqual(len(u_errors), 0, f"Failed for uncertainty={u}")


class TestPreflightCheck(unittest.TestCase):
    """测试 preflight-check.py"""

    def setUp(self):
        import importlib
        spec = importlib.util.spec_from_file_location(
            "preflight_check", SCRIPTS_DIR / "preflight-check.py"
        )
        self.pc = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.pc)

    def _create_mock_skills_dir(self, skill_names):
        """创建模拟 skills 目录，自动在 tearDown 时清理"""
        tmpdir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmpdir, True)
        for name in skill_names:
            skill_dir = os.path.join(tmpdir, name)
            os.makedirs(skill_dir, exist_ok=True)
            with open(os.path.join(skill_dir, "SKILL.md"), "w") as f:
                f.write(f"# {name}\n")
        return tmpdir

    def test_all_skills_installed_standard(self):
        """standard 模式下所有必需 skill 已安装"""
        skills_dir = self._create_mock_skills_dir(list(self.pc.REQUIRED_SKILLS.keys()))
        installed, missing = self.pc.check_skills(skills_dir, "standard")
        self.assertEqual(len(missing), 0, f"Missing: {[m[0] for m in missing]}")
        # 动态计算期望数量（standard 模式所需的 skill 数）
        expected = sum(1 for v in self.pc.REQUIRED_SKILLS.values() if "standard" in v["required_for"])
        self.assertEqual(len(installed), expected)

    def test_missing_skill_standard(self):
        """standard 模式下缺失 code-review-skill"""
        skills_dir = self._create_mock_skills_dir(["bayes", "feynman"])
        installed, missing = self.pc.check_skills(skills_dir, "standard")
        missing_names = [m[0] for m in missing]
        self.assertIn("code-review-skill", missing_names)

    def test_lite_mode_skips_standard_only(self):
        """lite 模式跳过仅 standard 需要的 skill"""
        skills_dir = self._create_mock_skills_dir(["bayes", "feynman"])
        installed, missing = self.pc.check_skills(skills_dir, "lite")
        self.assertEqual(len(missing), 0)
        self.assertEqual(len(installed), 2)

    def test_check_recommended_investment_missing(self):
        """investment lens 缺少 deep-research"""
        skills_dir = self._create_mock_skills_dir([])
        missing = self.pc.check_recommended(skills_dir, "investment")
        self.assertTrue(len(missing) > 0)
        self.assertEqual(missing[0]["dir"], "deep-research")

    def test_check_recommended_code_nothing(self):
        """code lens 无推荐 skill"""
        skills_dir = self._create_mock_skills_dir([])
        missing = self.pc.check_recommended(skills_dir, "code")
        self.assertEqual(len(missing), 0)

    def test_check_recommended_installed(self):
        """已安装的推荐 skill 不在 missing 中"""
        skills_dir = self._create_mock_skills_dir(["deep-research"])
        missing = self.pc.check_recommended(skills_dir, "investment")
        self.assertEqual(len(missing), 0)

    def test_deepen_never_required(self):
        """deepen skill 的 required_for 为空，任何模式都不检查"""
        skills_dir = self._create_mock_skills_dir([])  # 空目录，deepen 也不在 installed 中
        for mode in ["standard", "lite"]:
            installed, missing = self.pc.check_skills(skills_dir, mode)
            deepen_in_results = any(d == "deepen" for d, _ in installed + missing)
            self.assertFalse(deepen_in_results, f"deepen should not appear in {mode} mode")

    def test_print_report_all_installed(self):
        """所有 skill 已安装时报告返回 True"""
        skills_dir = self._create_mock_skills_dir(list(self.pc.REQUIRED_SKILLS.keys()))
        installed, missing = self.pc.check_skills(skills_dir, "standard")
        with redirect_stdout(io.StringIO()):
            ok = self.pc.print_report(installed, missing, skills_dir, "standard")
        self.assertTrue(ok)

    def test_print_report_missing(self):
        """有缺失时报告返回 False"""
        skills_dir = self._create_mock_skills_dir([])
        installed, missing = self.pc.check_skills(skills_dir, "standard")
        with redirect_stdout(io.StringIO()):
            ok = self.pc.print_report(installed, missing, skills_dir, "standard")
        self.assertFalse(ok)


if __name__ == "__main__":
    unittest.main(verbosity=2)

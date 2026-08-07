/**
 * taixu-debate workflow.js
 *
 * 五角色四轮混合盲辩编排核心
 * Phases: EvidenceBase → BlindPosition → Aggregate → CrossResponse → Aggregate
 *         → Defense → Aggregate → ClosingCross → Report
 *
 * 运行时适配:
 * - Claude Code: execution 机制加载本文件，按 phases 定义执行 parallel fan-out
 * - Qoder CLI: Dynamic workflows API（.qoder/workflows/*.js）同构适配
 * - Qoder IDE / 无 workflow 环境: 降级为主 agent 按 SKILL.md + debate-protocol.md dispatch subagent
 *
 * Token 硬上限: ≤ 4.5× 单一强 prompt 基线（随研究预算档位浮动）
 * 引用校验: R2/R3/R4 非沉默输出必须含 [ref:大师名#论点序号] 标记
 * v0.4.0: 角色人格化——发言/引用/沉默声明使用大师名（奥斯本/黑格尔/贝叶斯/费曼/德博诺），
 *          英文 ID（divergent 等）仅用于 subagent 类型与文件命名
 * v0.6.2: 运行目录 run-level 隔离——<date>-<topic_slug>-<run_id>，同日同题并行辩论不得共用目录
 * v0.7.0: 四轮结构——新增 Aggregate3（开放战线清单编译）+ ClosingCross（R4 默认沉默制，
 *          检验交锋+终辩声明）；盲区标注前移至 Aggregate2；token 上限升至 4.5×
 * v0.8.0: 概念对齐——新增 ConceptAlignment phase（Phase 0.5），西塞罗在 R1 前从 EvidencePack
 *          提取核心概念并统一定义，写入 concept_alignment.md；事后概念使用检查 + 偏差校验
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ── 元信息 ──────────────────────────────────────────────

const meta = {
  name: 'taixu-debate',
  version: '0.8.0',
  description: '五角色四轮混合盲辩压测（大师人格版 + Phase 0 证据底座 + Phase 0.5 概念对齐 + R4 默认沉默制 + 交付物归档）',
  // v0.5.0: token_budget_multiplier 随研究预算档位动态调整，见 RESEARCH_BUDGET_TIERS
  // v0.7.0: 3.5 → 4.5（第四轮引入的增量开销）
  token_budget_multiplier: 4.5,
  max_rounds: 4,
  roles: ['divergent', 'convergent', 'verifier', 'auditor', 'integrator'],
  // v0.6.2: debate_dir 仅为基目录；每场辩论的实际过程文件目录由 createDebateRunDir()
  // 在开辩时生成一次（<date>-<topic_slug>-<run_id>），同日同题并行辩论各自独立，不得共用
  debate_dir: 'runtime/debate',
  // v0.6.1: 交付物归档目录（R15）；runtime/debate 仅为过程文件区
  archive_dir: 'docs/taixu-debate-reports',
  // v0.5.0: 研究预算默认档位（用户选择后覆盖）
  research_budget_tier: 'standard',
};

// ── 研究预算档位（v0.5.0 新增）──────────────────────────
/**
 * 三档研究预算，开辩前由西塞罗问用户选择。
 *
 * multiplier: Phase 0 研究消耗 × 基线倍数
 * total_cap:  全场 token 上限 = 基线 × total_cap
 * tools:      允许调用的研究工具组合
 * latency:    预期等待时长
 */
const RESEARCH_BUDGET_TIERS = {
  // 轻量档：快速检索，适合熟悉领域或时间紧的辩题
  lite: {
    label: '轻量（快）',
    description: '2-3 次 WebSearch，约 30 秒。适合辩手已有背景知识、只需补充最新数据的场景。',
    multiplier: 0.3,
    total_cap: 4.3,
    tools: ['WebSearch', 'WebFetch'],
    max_queries: 3,
  },
  // 标准档：多源交叉，推荐大多数场景
  standard: {
    label: '标准（推荐）',
    description: '调用 liam-research 多源交叉验证，约 3-5 分钟。适合大多数投资和决策辩题。',
    multiplier: 0.5,
    total_cap: 4.5,
    tools: ['liam-research', 'WebSearch'],
    max_queries: null, // 由 research skill 自行管理
  },
  // 深度档：全力出击，适合高 stakes 决策前
  deep: {
    label: '深度（慢但全）',
    description: '调用 liam-research + last30days + firecrawl-research-index 并行，约 8-15 分钟。适合重大仓位决策或理论层认知求真。',
    multiplier: 1.0,
    total_cap: 5.0,
    tools: ['liam-research', 'last30days', 'firecrawl-research-index'],
    max_queries: null,
  },
};

// ── 研究工具路由（按命题类型）────────────────────────────
/**
 * 决定 EvidenceBase 对不同命题类型启用哪些研究工具。
 * 同一档位内，投资决策型额外叠加 last30days 舆情源（深度档已含）。
 */
const RESEARCH_ROUTING = {
  投资决策型: {
    primary: 'liam-research',
    secondary: null,              // liam-research 已覆盖多源交叉，不再重复调用同类工具
    sentiment: 'last30days',      // 叠加：社区舆情 + 近期动态
    thesis_overlay: true,          // 如有对应 thesis 档案，额外叠加 thesis-research
    failure_mode: 'hard_stop',    // 证据为空 → 拒绝开辩
  },
  选择决策型: {
    primary: 'liam-research',
    secondary: 'firecrawl-research-index',
    sentiment: null,
    thesis_overlay: false,
    failure_mode: 'soft_fallback', // 证据为空 → 标注警告后继续
  },
  认知求真型: {
    primary: 'liam-research',
    secondary: 'firecrawl-research-index',
    sentiment: 'last30days',
    thesis_overlay: false,
    failure_mode: 'soft_fallback',
  },
};

// v0.4.0: 大师名 ↔ 英文 ID 映射（辩论发言/引用/沉默声明用大师名，机器标识用英文 ID）
const ROLE_PERSONAS = {
  divergent: '奥斯本',
  convergent: '黑格尔',
  verifier: '贝叶斯',
  auditor: '费曼',
  integrator: '德博诺',
};
const PERSONA_TO_ROLE = Object.fromEntries(
  Object.entries(ROLE_PERSONAS).map(([role, persona]) => [persona, role])
);
const ALL_ROLE_NAMES = [...meta.roles, ...Object.values(ROLE_PERSONAS)];

// ── Phase 定义 ──────────────────────────────────────────

/**
 * Phase 0: 证据底座（EvidenceBase）— v0.5.0 新增
 *
 * 在 R1 盲立论开始前，西塞罗先向用户呈现三档研究预算选项，
 * 用户确认后按命题类型路由研究工具，产出共享 EvidencePack。
 *
 * EvidencePack 作为共享底座注入所有 R1 task prompt：
 * 保证五角色面对同一份事实，但解读各自独立——不破坏盲辩隔离。
 *
 * 降级链（混合模式）：
 * - 投资决策型：EvidencePack 为空 → hard_stop，拒绝开辩，提示用户补充证据
 * - 选择决策型 / 认知求真型：EvidencePack 为空 → soft_fallback，
 *   继续辩论，报告 frontmatter 标注「⚠️ 无外部证据底座，纯内部知识立论」
 */
const EvidenceBase = {
  id: 'EvidenceBase',
  type: 'research_fanout',
  description: '研究预算选择 + 多源并行研究 → 共享 EvidencePack',
  output_key: 'evidence_pack',

  /**
   * 开辩前向用户呈现三档预算选项。
   * 运行时（西塞罗）在触发本 Phase 时展示以下提示：
   *
   * ────────────────────────────────────────────────
   * 📋 研究预算选择（请选 1-3）
   *
   * 1. 轻量（快）— 2-3 次网络检索，约 30 秒
   *    适合：辩题背景熟悉，只需补充最新数据
   *
   * 2. 标准（推荐）— 多源交叉验证，约 3-5 分钟
   *    适合：大多数投资和决策辩题
   *
   * 3. 深度（慢但全）— 全渠道并行研究，约 8-15 分钟
   *    适合：重大仓位决策、理论层认知求真
   *
   * 输入数字或直接回车（默认标准）：
   * ────────────────────────────────────────────────
   *
   * 用户选择后，将 meta.research_budget_tier 设为对应键名，
   * token_budget_multiplier 更新为 RESEARCH_BUDGET_TIERS[tier].total_cap。
   */
  budget_prompt: {
    choices: RESEARCH_BUDGET_TIERS,
    default: 'standard',
    user_facing: true,
  },

  /**
   * 研究工具路由（按命题类型 × 预算档位）。
   * 实际调用由 buildEvidenceBase() 执行。
   */
  routing: RESEARCH_ROUTING,

  /**
   * 降级链配置（混合模式）：
   * - 投资决策型：hard_stop（证据为空则拒绝开辩）
   * - 其他类型：soft_fallback（标注警告后继续）
   */
  failure_policy: {
    hard_stop_types: ['投资决策型'],
    soft_fallback_types: ['选择决策型', '认知求真型'],
    fallback_label: '⚠️ 无外部证据底座，纯内部知识立论，结论置信度受限',
  },

  isolation: false,       // EvidencePack 是共享底座，非盲辩隔离范围
  injection: 'shared_context', // 注入方式：所有 R1 task prompt 均收到
};

/**
 * 构建 EvidencePack 的执行函数。
 * 按命题类型 × 预算档位选择研究工具，并行调用，合并去重后输出。
 *
 * @param {string} propositionType - '投资决策型' | '选择决策型' | '认知求真型'
 * @param {string} proposition - 辩题文本
 * @param {string} tier - 'lite' | 'standard' | 'deep'
 * @param {string|null} thesisPath - thesis 档案路径（投资决策型可选）
 * @returns {Promise<{facts: string[], data_points: string[], disputes: string[], sources: string[], freshness: string, empty: boolean}>}
 */
async function buildEvidenceBase(propositionType, proposition, tier, thesisPath) {
  const routing = RESEARCH_ROUTING[propositionType] || RESEARCH_ROUTING['认知求真型'];
  const budget = RESEARCH_BUDGET_TIERS[tier] || RESEARCH_BUDGET_TIERS.standard;
  const tasks = [];

  // 主研究工具
  if (budget.tools.includes(budget.tools[0])) {
    tasks.push({ skill: routing.primary, query: proposition, purpose: '基本面+竞品+数据' });
  }
  // 次级工具（标准档及以上）
  if (tier !== 'lite' && routing.secondary) {
    tasks.push({ skill: routing.secondary, query: proposition, purpose: '论文/深度交叉' });
  }
  // 舆情工具（投资决策型强制，认知求真型标准档及以上）
  if (routing.sentiment && (propositionType === '投资决策型' || tier !== 'lite')) {
    tasks.push({ skill: routing.sentiment, query: proposition, purpose: '社区舆情+近期动态' });
  }
  // Thesis 叠加（仅投资决策型且有 thesis 档案）
  if (routing.thesis_overlay && thesisPath) {
    tasks.push({ skill: 'thesis-research', query: proposition, purpose: 'thesis 档案深钻' });
  }
  // 轻量档：降级为 WebSearch
  if (tier === 'lite') {
    tasks.length = 0;
    tasks.push({ skill: 'WebSearch', query: proposition, purpose: '快速检索', max: 3 });
  }

  return { tasks, routing, budget };
}

/**
 * 贝叶斯二次检索权（v0.5.0 新增）
 *
 * 贝叶斯在 R2 阶段，如发现 EvidencePack 未覆盖其需要验证的预测，
 * 可发起一次轻量补充检索（≤3 次 WebSearch）。
 *
 * 规则：
 * 1. 仅贝叶斯（verifier）享有此权；其他角色不可调用
 * 2. 检索结果写入 <run_dir>/verifier_r2_lookup.md
 * 3. 西塞罗将 verifier_r2_lookup.md 追加到 R2 公开记录尾部，标注「贝叶斯补充检索」
 * 4. 所有角色在 R3 task prompt 中收到此补充（信息对称，不破坏公平）
 * 5. 贝叶斯须在 R2 发言中显式声明「触发二次检索，原因: <X>」
 * 6. 二次检索 token 计入 Phase 3 (CrossResponse) 预算，不单独计算
 *
 * @param {string} query - 贝叶斯需要验证的具体预测
 * @param {string} debateDir - 本场运行目录（createDebateRunDir 的返回值）
 * @returns {Promise<{found: boolean, result: string}>}
 */
async function bayesSecondLookup(query, debateDir) {
  // 实际执行由主 agent 在 R2 汇总阶段调用 WebSearch 工具实现
  // 结果写入 debateDir/verifier_r2_lookup.md 并追加到公开记录
  return { query, debateDir, max_searches: 3, append_to_public_record: true };
}

// ── Phase 定义 ──────────────────────────────────────────

/**
 * Phase 0.5: 概念对齐（ConceptAlignment）— v0.8.0 新增
 *
 * 在 EvidenceBase 之后、BlindPosition 之前，作为独立子阶段。
 * 西塞罗从 EvidencePack 中提取 3-5 个核心概念并统一定义，
 * 消除因概念理解差异导致的假性分歧。
 *
 * 核心设计（F-1 修复）：角色不主动声明概念异议——概念定义由西塞罗
 * 统一定义（中性），避免角色公开定义概念时泄露立场。
 *
 * 产出物（F-4 修复）：概念定义表作为独立产出物写入
 * <run_dir>/concept_alignment.md，与 EvidencePack 并列注入 R1 task prompt。
 *
 * LLM 调用规则（F-6 修复）：主 agent 直接从 EvidencePack 提炼，
 * 不额外调用 LLM。仅 EvidencePack 为空且含领域特异概念时 1 次 LLM。
 *
 * 降级（F-8 修复）：EvidencePack 为空时概念对齐仍执行，
 * 定义来源退到行业通用定义，标注「⚠️ 无证据底座支撑」。
 */
const ConceptAlignment = {
  id: 'ConceptAlignment',
  type: 'host_analysis',
  description: '西塞罗从 EvidencePack 提取核心概念并统一定义，写入 concept_alignment.md',
  input_key: 'evidence_pack',
  output_key: 'concept_alignment',

  /**
   * 从 EvidencePack 提取核心概念并统一定义。
   *
   * @param {object} evidencePack - EvidenceBase 产出的共享证据包
   * @param {string} proposition - 辩题文本
   * @param {string} runDir - 本场运行目录
   * @returns {Promise<{concepts: Array, file: string, evidence_based: boolean, llm_assisted: boolean}>}
   */
  async execute(evidencePack, proposition, runDir) {
    const concepts = [];
    const extractTargets = [];

    // 从 EvidencePack 的 disputes[] 和 facts[] 中提取概念候选
    if (evidencePack && evidencePack.disputes) {
      for (const dispute of evidencePack.disputes) {
        extractTargets.push(dispute);
      }
    }
    if (evidencePack && evidencePack.facts) {
      for (const fact of evidencePack.facts) {
        extractTargets.push(fact);
      }
    }

    // EvidencePack 为空时的降级（F-8 修复）
    const isEmptyEvidence = !evidencePack || !evidencePack.facts || evidencePack.facts.length === 0;
    const llmAssisted = isEmptyEvidence; // 仅空 EvidencePack 时可能需要 LLM 辅助

    // 概念定义来源优先级：
    // 1. EvidencePack 事实
    // 2. 行业通用定义
    // 3. 标注「定义待校验」
    // 空 EvidencePack 时退到优先级 2，标注「⚠️ 无证据底座支撑」

    const filePath = path.join(runDir || meta.debate_dir, 'concept_alignment.md');

    return {
      concepts,
      file: filePath,
      evidence_based: !isEmptyEvidence,
      llm_assisted: llmAssisted,
    };
  },

  /**
   * 事后概念使用检查（F-1 修复）。
   *
   * 汇总 #1 时，西塞罗检查角色 R1 发言是否隐含了与统一定义不同的概念理解。
   * 角色不主动声明概念异议——偏差由西塞罗检测并标注。
   *
   * @param {object} r1Positions - 各角色 R1 发言 { role: text }
   * @param {Array} conceptDefinitions - ConceptAlignment 产出的概念定义表
   * @returns {Array<{role: string, concept: string, deviation: string}>}
   */
  checkConceptUsage(r1Positions, conceptDefinitions) {
    const deviations = [];
    // 实际检测由主 agent（西塞罗）在汇总时完成
    // 此处提供接口签名，实际逻辑由 host agent 执行
    return deviations;
  },

  /**
   * R4 后概念定义偏差事后校验（F-3 修复）。
   *
   * R4 后、报告生成前，西塞罗回顾全部发言（R1-R4）检查概念使用偏差。
   * 偏差记录写入裁决书技术记录。
   *
   * @param {object} allSpeeches - 全部轮次发言 { round: { role: text } }
   * @param {Array} conceptDefinitions - ConceptAlignment 产出的概念定义表
   * @returns {Array<{round: string, role: string, concept: string, deviation: string}>}
   */
  postDebateCheck(allSpeeches, conceptDefinitions) {
    const deviations = [];
    // 实际检测由主 agent（西塞罗）在报告生成前完成
    return deviations;
  },

  isolation: false,          // 概念定义是共享上下文，非盲辩隔离范围
  injection: 'shared_context', // 注入方式：所有 R1 task prompt 均收到概念定义表
};

/**
 * Phase 1: R1 盲立论
 * parallel fan-out，5 角色各自独立对辩题立论，互相不可见。
 * task prompt 装入辩题 + EvidencePack + 概念定义表 + 角色 R1 指引，不装入他方任何信息。
 */
const BlindPosition = {
  id: 'BlindPosition',
  type: 'parallel_fanout',
  round: 'R1',
  description: '5 角色各自独立对辩题立论，互相不可见',
  fan_out: meta.roles.map(role => ({
    agent: `debate-${role}`,
    input: (ctx) => ({
      proposition: ctx.proposition,
      thesis_context: ctx.thesis_path || null,
      round: 'R1',
      instruction: `按你的 R1 盲立论指引对辩题立论。你只能看到辩题，看不到其他角色的立论。按发言五要素输出：立场、核心论据、被攻击面预判、沉默声明、本轮小结。`,
    }),
  })),
  isolation: true,
  output_key: 'r1_positions',
};

/**
 * Phase 2: 西塞罗汇总 #1
 * 将 5 份 R1 立论合并为公开记录。保留原文，不做摘要。
 */
const Aggregate1 = {
  id: 'Aggregate1',
  type: 'aggregate',
  description: '将 5 份 R1 立论合并为公开记录，同时持久化发言原文到临时文件',
  input_key: 'r1_positions',
  merge_strategy: 'concat_original',
  output_key: 'r1_public_record',
  // v0.3.0: 发言原文持久化
  persist: { enabled: true, round: 'R1', dir: meta.debate_dir },
};

/**
 * Phase 3: R2 交叉回应
 * parallel fan-out，每角色收到自己 R1 回放 + 他方 R1 原文。
 * 接力反驳须引用 [ref:角色名#论点序号]。无反驳则声明沉默。
 */
const CrossResponse = {
  id: 'CrossResponse',
  type: 'parallel_fanout',
  round: 'R2',
  description: '每角色收到自己 R1 回放 + 他方 R1 原文，做交叉回应',
  fan_out: meta.roles.map(role => ({
    agent: `debate-${role}`,
    input: (ctx) => ({
      proposition: ctx.proposition,
      self_r1: ctx.r1_positions[role],
      others_r1: meta.roles
        .filter(r => r !== role)
        .reduce((acc, r) => { acc[r] = ctx.r1_positions[r]; return acc; }, {}),
      round: 'R2',
      instruction: `按你的 R2 交叉回应指引做交叉回应。如有反驳，必须引用 [ref:大师名#论点序号]。如无反驳，声明沉默。`,
    }),
  })),
  isolation: true,
  validation: 'ref_check',
  output_key: 'r2_responses',
};

/**
 * Phase 4: 西塞罗汇总 #2
 * 将 R2 回应合并为公开记录。保留原文，不做摘要。
 */
const Aggregate2 = {
  id: 'Aggregate2',
  type: 'aggregate',
  description: '将 R2 回应合并为公开记录，同时持久化发言原文、执行引用内容校验并标注全场盲区',
  input_key: 'r2_responses',
  merge_strategy: 'concat_original',
  output_key: 'r2_public_record',
  // v0.3.0: 发言原文持久化 + 引用内容校验
  persist: { enabled: true, round: 'R2', dir: meta.debate_dir },
  citation_content_check: { enabled: true, prior_key: 'r1_positions' },
  // v0.7.0: 盲区标注前移——西塞罗扫描 R1+R2 标注全场未触及维度（只标注不引导），
  // 注入 R3 task prompt；R4 终辩禁开新战线，R3 是最后一个能承接新维度的发言轮。
  // 由西塞罗（主 agent）在汇总时完成，结果记入实录技术记录「盲区标注记录」
  blind_spot_scan: { enabled: true, by: 'host', basis: ['r1_positions', 'r2_responses'], inject_into: 'R3' },
};

/**
 * Phase 5: R3 防御/修正
 * parallel fan-out，每角色收到自己 R1+R2 回放 + 他方 R2 原文。
 * 防御/修正须引用 [ref:角色名#论点序号]。无新内容则声明沉默。
 */
const Defense = {
  id: 'Defense',
  type: 'parallel_fanout',
  round: 'R3',
  description: '每角色收到自己 R1+R2 回放 + 他方 R2 原文，做防御/修正',
  fan_out: meta.roles.map(role => ({
    agent: `debate-${role}`,
    input: (ctx) => ({
      proposition: ctx.proposition,
      self_r1: ctx.r1_positions[role],
      self_r2: ctx.r2_responses[role],
      others_r2: meta.roles
        .filter(r => r !== role)
        .reduce((acc, r) => { acc[r] = ctx.r2_responses[r]; return acc; }, {}),
      round: 'R3',
      instruction: `按你的 R3 防御/修正指引做防御或修正。如有防御/修正，必须引用 [ref:大师名#论点序号]。如无新内容，声明沉默。`,
    }),
  })),
  isolation: true,
  validation: 'ref_check',
  output_key: 'r3_defenses',
};

/**
 * Phase 6: 西塞罗汇总 #3 — v0.7.0 新增
 * 将 R3 结辩合并为公开记录，持久化原文，执行引用内容校验（纠正通道延伸至 R4），
 * 并为每个角色编译「开放战线清单」。
 *
 * 开放战线三类来源：
 * 1. 他方 R3 中对该角色 R2/R3 立场的新攻击（此前轮次未交锋过的）
 * 2. 他方 R3 中的新论证/新设计/修正后立场，与该角色立场直接冲突或直接相关
 * 3. 他方 R3 中对公开问题的新表态，按核心关切归属到最相关角色
 * 清单只列议题与相关性，不预断回应方式；编译由西塞罗（主 agent）完成，无机械实现。
 */
const Aggregate3 = {
  id: 'Aggregate3',
  type: 'aggregate',
  description: '将 R3 结辩合并为公开记录，持久化原文，编译各角色开放战线清单',
  input_key: 'r3_defenses',
  merge_strategy: 'concat_original',
  output_key: 'r3_public_record',
  persist: { enabled: true, round: 'R3', dir: meta.debate_dir },
  citation_content_check: { enabled: true, prior_key: 'r2_responses' },
  open_threads_compile: { enabled: true, by: 'host', basis: 'r3_defenses', output_key: 'open_threads' },
};

/**
 * Phase 7: R4 检验交锋与终辩声明 — v0.7.0 新增
 *
 * 交锋链条合拢轮（默认沉默制）：
 * - 仅「开放战线清单」非空的角色被 fan-out；清单为空的角色制度性沉默（非质量信号）
 * - 前半段「检验交锋」：逐条回应开放战线，只能引用 R3（[ref:大师名R3#论点序号]）
 * - 后半段「终辩声明」：终态立场 + 让步清单 + 本轮小结，禁开新战线
 *   （终辩的功能是收拢而非新主张，如同法庭最后陈述，不需再交叉质证）
 * - 轮次数恒定，发言面动态——这是沉默机制的内生弹性，不是动态轮次判定
 */
const ClosingCross = {
  id: 'ClosingCross',
  type: 'parallel_fanout',
  round: 'R4',
  description: '开放战线非空的角色做检验交锋+终辩声明（两段式）；无战线角色制度性沉默',
  fan_out: meta.roles.map(role => ({
    agent: `debate-${role}`,
    // v0.7.0 默认沉默制：开放战线为空的角色跳过（不 fan-out）
    skip_if: (ctx) => !(ctx.open_threads && ctx.open_threads[role] && ctx.open_threads[role].length > 0),
    input: (ctx) => ({
      proposition: ctx.proposition,
      self_r1: ctx.r1_positions[role],
      self_r2: ctx.r2_responses[role],
      self_r3: ctx.r3_defenses[role],
      others_r3: meta.roles
        .filter(r => r !== role)
        .reduce((acc, r) => { acc[r] = ctx.r3_defenses[r]; return acc; }, {}),
      open_threads: ctx.open_threads ? (ctx.open_threads[role] || []) : [],
      round: 'R4',
      instruction: `按你的 R4 指引输出两段式发言：前半段「检验交锋」逐条回应开放战线（只能引用 [ref:大师名R3#论点序号]）；后半段「终辩声明」给出终态立场与让步清单，禁止开新战线。`,
    }),
  })),
  isolation: true,
  validation: 'ref_check',
  output_key: 'r4_closings',
};

/**
 * Phase 8: 报告生成
 * 基于 R1+R2+R3+R4 全部记录按 report-template.md 生成辩论精华 + 三区报告 + 综合判断 + 结论产出（按命题类型分流）。
 */
const Report = {
  id: 'Report',
  type: 'report',
  description: '基于 R1+R2+R3+R4 全部记录生成辩论精华 + 三区报告 + 综合判断 + 结论产出（按命题类型分流）。实录从临时文件读取发言原文',
  input_keys: ['r1_positions', 'r2_responses', 'r3_defenses', 'r4_closings'],
  template: 'templates/report-template.md',
  output_key: 'report',
  constraints: {
    max_generation_time: '5min',
    max_reading_time: '6min',
    max_word_count: 1800,
  },
  // v0.3.0: 实录从临时文件读取原文
  transcript_source: 'persisted_files',
  persist: { enabled: true, round: 'R4', dir: meta.debate_dir },
  citation_content_check: { enabled: true, prior_key: 'r3_defenses', annotate_only: true },
  // v0.6.1: 交付物归档（R15）— 润色后正本归档至 archive_dir，命名 <topic_slug>-taixu-debate-{report,transcript}-<date>.md，不留双轨
  archive: { enabled: true, dir: meta.archive_dir, naming: '<topic_slug>-taixu-debate-<artifact>-<date>.md', canonical: 'polished' },
};

// ── 引用机械校验 ────────────────────────────────────────

/**
 * 校验 R2/R3 输出的引用标记。
 *
 * 规则:
 * 1. 非沉默输出必须含至少 1 个 [ref:大师名#论点序号] 标记
 * 2. 引用名必须是 5 位大师名之一（兼容英文 ID）
 * 3. R2 只能引用 R1 的论点；R3 只能引用 R2 的论点；R4 只能引用 R3 的论点
 *
 * @param {string} output - subagent 输出文本
 * @param {string} round - 当前轮次 ('R2' | 'R3' | 'R4')
 * @param {object} publicRecord - 被引用方的公开记录
 * @returns {{valid: boolean, reason?: string, refs?: string[]}}
 */
function validateReferences(output, round, publicRecord) {
  const refPattern = /\[ref:(奥斯本|黑格尔|贝叶斯|费曼|德博诺|divergent|convergent|verifier|auditor|integrator)#(\d+)\]/g;
  const refs = [];
  let match;
  while ((match = refPattern.exec(output)) !== null) {
    // 大师名归一化为英文 ID，便于目标存在性检查
    const name = match[1];
    refs.push({ role: PERSONA_TO_ROLE[name] || name, point: parseInt(match[2], 10) });
  }

  // 检查是否声明沉默
  const isSilent = /沉默/.test(output) && refs.length === 0;

  // 规则 1: 非沉默输出必须含引用
  if (!isSilent && refs.length === 0) {
    return { valid: false, reason: '非沉默输出未含引用标记 [ref:大师名#论点序号]' };
  }

  // 规则 2: 引用名必须有效（已由正则保证）

  // 规则 3: 引用目标必须存在
  for (const ref of refs) {
    const targetOutput = publicRecord[ref.role];
    if (!targetOutput) {
      return { valid: false, reason: `引用目标不存在: ${ref.role} 未在 ${round} 前一轮次输出` };
    }
    // 论点序号存在性检查（简化：检查输出中是否有对应的论点编号）
    // 实际实现需解析输出结构，此处做存在性检查
  }

  return { valid: true, refs };
}

// ── Token 预算检查 ──────────────────────────────────────

/**
 * 检查当前 token 消耗是否超出预算。
 *
 * @param {number} currentTokens - 当前累计 token 消耗
 * @param {number} baselineTokens - 单一强 prompt 基线 token 消耗
 * @returns {{exceeded: boolean, current: number, budget: number, ratio: number}}
 */
function checkTokenBudget(currentTokens, baselineTokens) {
  const budget = baselineTokens * meta.token_budget_multiplier;
  const ratio = baselineTokens > 0 ? (currentTokens / baselineTokens).toFixed(2) : 0;
  return {
    exceeded: currentTokens > budget,
    current: currentTokens,
    budget,
    ratio: parseFloat(ratio),
  };
}

// ── 发言原文持久化（v0.3.0 新增；v0.6.2 改为 run-level 隔离）────────

/**
 * 开辩时生成本场运行目录（run-level 隔离）。
 *
 * 格式: runtime/debate/<date>-<topic_slug>-<run_id>/
 * - date: 开辩日期 YYYY-MM-DD
 * - topic_slug: 西塞罗开辩时从辩题提炼（英文小写短横线 3-6 词）
 * - run_id: 开辩时刻 HHmmss；同秒撞名时调用方追加 -2/-3 后缀
 *
 * 铁律：同一日期、同一话题的两个并行辩论也不得共用目录。
 * 本函数每场辩论只在开辩时调用一次，返回值贯穿 R1-R3 全程复用。
 *
 * @param {string} topicSlug - 辩题 slug
 * @param {string} [baseDir] - 基目录（默认 meta.debate_dir）
 * @param {Date} [now] - 开辩时刻（默认当前时间，可注入便于测试）
 * @returns {string} 本场运行目录路径
 */
function createDebateRunDir(topicSlug, baseDir, now) {
  const d = now || new Date();
  const day = d.toISOString().slice(0, 10);
  const runId = d.toTimeString().slice(0, 8).replace(/:/g, '');
  const slug = topicSlug || 'untitled';
  return path.join(baseDir || meta.debate_dir, `${day}-${slug}-${runId}`);
}

/**
 * 将某轮次所有角色的发言原文写入本场运行目录。
 *
 * @param {object} outputs - { role: text } 映射
 * @param {string} round - 轮次标识 ('R1' | 'R2' | 'R3' | 'R4')
 * @param {string} runDir - 本场运行目录（createDebateRunDir 的返回值）
 * @returns {string} 写入的目录路径
 */
function persistSpeeches(outputs, round, runDir) {
  const dir = runDir || createDebateRunDir('untitled');
  fs.mkdirSync(dir, { recursive: true });
  for (const [role, text] of Object.entries(outputs)) {
    if (text) {
      fs.writeFileSync(path.join(dir, `${round}_${role}.md`), text, 'utf8');
    }
  }
  return dir;
}

/**
 * 写入辩论元数据到 metadata.json。
 *
 * @param {object} metadata - 元数据对象
 * @param {string} dir - 写入目录
 */
function writeMetadata(metadata, dir) {
  fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');
}

// ── 引用内容校验（v0.3.0 新增）──────────────────────────

/**
 * 校验引用内容的准确性（在机械校验之外）。
 * 对每个 [ref:角色名#论点序号] 标记，检查被引用方原文中是否存在对应论点。
 *
 * @param {object} outputs - 当前轮次 { role: text } 映射
 * @param {object} priorOutputs - 前一轮次 { role: text } 映射
 * @returns {Array<{role: string, ref: string, citedRole: string, pointId: string, accurate: boolean, reason: string|null}>}
 */
function validateCitationContent(outputs, priorOutputs) {
  const results = [];
  for (const [role, text] of Object.entries(outputs)) {
    if (!text) continue;
    const refs = text.match(/\[ref:[^\]]+\]/g) || [];
    for (const ref of refs) {
      const match = ref.match(/\[ref:([^#]+)#([^\]]+)\]/);
      if (!match) continue;
      const [, citedRole, pointId] = match;
      const citedText = priorOutputs[citedRole];
      if (!citedText) {
        results.push({ role, ref, citedRole, pointId, accurate: false, reason: 'cited_role_not_found' });
        continue;
      }
      const pointPattern = new RegExp(`论点\\s*${pointId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      const accurate = pointPattern.test(citedText);
      results.push({ role, ref, citedRole, pointId, accurate, reason: accurate ? null : 'point_not_found_in_source' });
    }
  }
  return results;
}

// ── 沉默角色跟踪 ────────────────────────────────────────

/**
 * 从输出中检测角色是否声明沉默。
 * 沉默角色在后续轮次自动跳过。
 *
 * @param {string} output - subagent 输出文本
 * @returns {boolean}
 */
function detectSilence(output) {
  // v0.4.0: 沉默声明格式为「XX沉默——理由」（大师名）；兼容旧格式「XX角色沉默」
  const silencePattern = /(奥斯本|黑格尔|贝叶斯|费曼|德博诺)(角色)?沉默/;
  return silencePattern.test(output);
}

// ── 全员沉默检查 ────────────────────────────────────────

/**
 * 检查是否全员沉默。
 * R2 全员沉默 → 跳过 R3 与 R4，直接报告生成。
 * R3 全员沉默 → 跳过 R4，直接报告生成。
 * R4 不举行还有一种情形：Aggregate3 编译后开放战线全空（ClosingCross.skip_if 全员命中）。
 *
 * @param {object} outputs - 当前轮次所有角色的输出
 * @returns {boolean}
 */
function isAllSilent(outputs) {
  const activeRoles = Object.keys(outputs);
  if (activeRoles.length === 0) return true;
  return activeRoles.every(role => detectSilence(outputs[role]));
}

// ── 导出 ────────────────────────────────────────────────

module.exports = {
  meta,
  ROLE_PERSONAS,
  PERSONA_TO_ROLE,
  ALL_ROLE_NAMES,
  RESEARCH_BUDGET_TIERS,
  RESEARCH_ROUTING,
  phases: [EvidenceBase, ConceptAlignment, BlindPosition, Aggregate1, CrossResponse, Aggregate2, Defense, Aggregate3, ClosingCross, Report],
  EvidenceBase,
  ConceptAlignment,
  Aggregate3,
  ClosingCross,
  buildEvidenceBase,
  bayesSecondLookup,
  validateReferences,
  validateCitationContent,
  createDebateRunDir,
  persistSpeeches,
  writeMetadata,
  checkTokenBudget,
  detectSilence,
  isAllSilent,
};

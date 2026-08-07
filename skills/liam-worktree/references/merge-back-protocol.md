# Merge-Back Protocol（worktree → 主线回流协议）

回流是 worktree 生命周期最脆弱的一环。实测教训（2026-07-27/29，P1-2 回流三连败）：merge 被主检出区两天堆积的 cron 脏文件阻断；cherry-pick 在守护进程竞态窗口内连败三次；最终靠逐文件 checkout 手术恢复。本协议把这条血泪路径编码为标准流程。

## ① 回流预检（三查，缺一不合）

```bash
# 1. 锁检查：index.lock 存在则等待（活锁看 size>0 且 age 短；死锁 0 字节 + 无 git 写进程才可清）
ls -la .git/index.lock 2>/dev/null

# 2. 租约检查：主检出区有他人活跃租约 → 等待或协调，不抢
python3 scripts/git/session_lease.py check

# 3. 目标文件脏检查：本分支改动的文件在主检出区是否有未提交改动
for f in $(git diff --name-only <主线>...<worktree分支>); do git status --short -- "$f"; done
```

三查全绿才进 ②。目标文件脏 → 先弄清是谁的改动（他人进行中工作不许覆盖），归档或等收口。

## ② 首选路径：merge --no-ff

```bash
git merge --no-ff <worktree分支> -m "merge: <主题>（<分支> → <主线>）"
```

成功 → 跳到 ④。失败 → 读完整报错（别只看 tail，"Merge with strategy ort failed" 前面列了被挡文件），按 ③ 降级。

## ③ 降级阶梯（一级不行降一级，禁止跳级恢复）

1. **cherry-pick**：分支只有少量 commit 时 `git cherry-pick <sha>`。适合主线已大幅前进、merge base 脏的场景。
2. **逐文件手术**（cherry-pick 也被竞态挡住时）：
   - 新增文件与独占文件：先验主线无漂移（`git diff --quiet <基点> HEAD -- <file>`），再 `git checkout <sha> -- <files>`
   - **共享追加型文件（CHANGELOG.md 等）禁止整文件 checkout**——会吞掉主线新增条目。从源 commit 抽出本任务条目段，程序化插入当前文件的锚点位置
   - 手术后 commit message 注明"手术式恢复 <原sha>"，保留可追溯性

## ④ 回流后验证

- 关键交付文件在主线 HEAD 上存在（ls + grep 锚点）
- skill 类改动：三平台副本 md5 一致
- 本分支 commit 数与回流内容对账（`git log <基点>..<分支> --oneline`）

## ⑤ 清理纪律

- **验证通过前不删分支**——分支是唯一的恢复源（实测：merge 失败后链式命令误删分支，靠对象库 sha 捡回）
- 清理命令禁止与回流命令写在同一条链式命令里（`&&` 链在中段失败时后段仍可能执行，`| tail` 会吞退出码）
- worktree 目录含 hook 同步产生的脏文件属正常；确认无本任务残留（`git status --short | grep <本任务路径>` 为空）才 `--force` 删除

## 常见借口对照表

| 借口 | 现实 |
|------|------|
| "merge 报错太长，tail 一下看结论就行" | 被挡文件清单在前段。看不到清单就不知道挡路的是谁的工作 |
| "cherry-pick 失败就直接 checkout 整个文件" | CHANGELOG 类共享文件整体覆盖 = 吞掉别人条目。追加型文件只能做条目级插入 |
| "回流成功了，顺手把分支删了" | 验证在删除之前。链式命令里验证和删除同链，失败也删 |
| "主检出区那些脏文件反正不是我的，覆盖就覆盖" | 他人进行中工作。覆盖即静默数据丢失，正是本协议要防的事故 |

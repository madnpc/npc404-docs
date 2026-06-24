# scripts

## sync-skills.mjs —— 技能上游同步

检测 `skills/` 下每个本地技能对应的**上游源文件**是否更新。只有上游版本（`upstreamDir` 的最新 commit SHA）变化时才提示，并把上游 diff 暂存好，供你（或 Claude 会话）手动做本地化改写。

脚本**不调用 AI、不自动改写 `skills/`、不自动提交**。零依赖，仅用 Node 内置能力（需 Node 18+，依赖系统 `git` 做 diff）。

唯一需要提交的产物是 `state.json`（版本记录）——里面的 commit SHA 已唯一确定那份上游内容，对照基线在 `check` 时按两个 SHA 现抓现 diff，不落库。

设计依据见 [`docs/specs/2026-06-24-skill-upstream-sync-spec.md`](../docs/specs/2026-06-24-skill-upstream-sync-spec.md)。

### 命令

```bash
# 首次引导:抓取当前上游做 baseline、记录版本 SHA（可只跑单个技能）
node scripts/sync-skills.mjs init [skill]

# 检测上游变化（默认命令）。变化的会下载最新原文，与 baseline 算 diff 暂存到 .skill-sync/diffs/
node scripts/sync-skills.mjs check [skill]

# 本地化改写完成后:把 incoming 提升为新 baseline，推进版本号
node scripts/sync-skills.mjs accept <skill>
node scripts/sync-skills.mjs accept --all

# 查看各技能当前记录的版本与待 review 状态
node scripts/sync-skills.mjs status
```

### 典型流程

1. `check` —— 看哪些技能上游变了、变了什么（`.skill-sync/diffs/<skill>.diff`）。
2. 对照 diff，把上游变更重新本地化（中文改写）写回 `skills/<skill>/`。
3. `accept <skill>` —— 锁定版本，baseline 更新到最新上游。

### 文件说明

| 路径 | 是否提交 | 说明 |
| --- | --- | --- |
| `sync.config.json` | ✅ | 技能 → 上游仓库/分支/文件 的映射表 |
| `state.json` | ✅ | 版本记录（每个技能上次同步的 commit SHA + 时间），唯一需提交的产物 |
| `.skill-sync/` | ❌ gitignore | 纯临时:`incoming/`（最新原文）、`diffs/`（上游 diff）、`old/`（diff 时现抓的旧版，用完即删） |

### 环境变量

- `GITHUB_TOKEN`（可选）—— 提高 GitHub API 限流额度。未认证为 60 次/小时，对 7 个技能足够，限流时再设置。

### 新增 / 调整被跟踪的技能

编辑 `sync.config.json`:每个技能配置 `repo`、`branch`、`upstreamDir`（上游目录前缀，版本以它的最新 commit 为准）、`localDir`、`files`（要跟踪的文件，相对 `upstreamDir`）。改完对新技能跑一次 `init`。

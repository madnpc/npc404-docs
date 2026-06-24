# npc404 Skills

《末日NPC都不太正常》的项目级 Agent Skills 仓库。这里仅维护可复用的工作流技能；每个技能都位于 `skills/<skill-name>/SKILL.md`，并通过 front matter 的 description 提供中英文触发关键词。

## Agent skills

[`skills/`](skills/) 保存供协作代理调用的本地技能引用；它们是工作流约束和方法论，不是游戏设计文档。

| 技能 | 适用时机与中文关键词 | 主要参考 |
| --- | --- | --- |
| `brainstorming` | 编码前梳理模糊想法；分段验证设计后保存设计文档：想法不清楚、需求探索、需求澄清、功能设计、方案设计、规格说明。 | [obra/superpowers](https://github.com/obra/superpowers/tree/main) |
| `codebase-design` | 方向明确后设计模块边界与接口：代码库设计、模块设计、接口设计、模块边界、可测试性。 | [mattpocock/skills](https://github.com/mattpocock/skills) |
| `planning-with-files-zh` | 复杂实施或跨会话工作；规划保存于 `docs/.planning/<plan-id>/`：任务规划、复杂实现、实施计划、多步骤规划、进度跟踪。 | [othmanadi/planning-with-files](https://github.com/othmanadi/planning-with-files) |
| `diagnosing-bugs` | 故障与性能问题诊断：修 Bug、排查问题、报错、测试失败、性能回归。 | [mattpocock/skills](https://github.com/mattpocock/skills) |
| `tdd` | 高风险逻辑或需要回归保护的改动：测试驱动开发、先写测试、红绿重构、回归测试、集成测试。 | [mattpocock/skills](https://github.com/mattpocock/skills) |
| `karpathy-guidelines` | 编码、审查或重构时的通用约束：避免过度设计、最小改动、明确假设、可验证目标。 | [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) |
| `handoff` | 将未完成工作移交给新的代理或会话：工作交接、上下文交接、任务移交。 | [mattpocock/skills](https://github.com/mattpocock/skills) |

### 引用来源

本目录的技能以这些开源项目为参考与改编来源；修改本地版本时，应保留归属并在需要时对照上游更新。

- [obra/superpowers](https://github.com/obra/superpowers/tree/main)
- [mattpocock/skills](https://github.com/mattpocock/skills)
- [othmanadi/planning-with-files](https://github.com/othmanadi/planning-with-files)
- [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)

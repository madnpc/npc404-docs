# 《末日NPC都不太正常》技术方案

> 文档版本：v0.2  
> 当前阶段：可开工技术基线  
> 核心方向：AI 文字生存、异常 NPC、服务端权威结算、本地剧情体验、多人共享时间线  
> 适用仓库：`npc404-docs`、`npc404`、`npc404-web`

---

## 1. 项目概述

《末日NPC都不太正常》是一款末日题材 AI 文字生存游戏。

玩家通过自然语言或预设选项行动，在资源紧缺、感染威胁和人际崩坏中求生。游戏的核心张力不只是“外部怪物很危险”，而是“身边的 NPC 都有不稳定的执念、秘密、误判和过度反应”。NPC 由可组合的 Markdown Skills、权威世界事实和异常机制共同驱动。

第一版目标不是开放世界，而是一个短局、高密度、可验证的故事生存系统：

- 单局 10 到 15 回合。
- 地点固定在废弃社区诊所。
- 两名核心 NPC。
- 至少一个隐藏秘密。
- 至少一次 NPC 异常触发。
- 至少两个结局。
- 规则引擎能够在没有 AI 的情况下完成基础结算。

---

## 2. 当前仓库分工

当前本地存在三个 Git 仓库，建议分工如下：

```text
npc404-docs
文档、技术方案、剧情设定、事件表、协议草案、Skill 写作规范。

npc404
游戏服务端、规则核心、Agent Worker、数据库 Schema、共享 contracts。

npc404-web
玩家端 Web、房间界面、剧情阅读与输入、本地 IndexedDB 存档、后续管理端。
```

第一阶段不再新建更多仓库。除非出现独立部署、独立权限或独立团队维护需求，否则 Agent Worker 和规则核心先放在 `npc404` 内。

---

## 3. 核心设计原则

### 3.1 AI 不拥有最终世界解释权

AI 可以：

- 理解玩家输入。
- 生成 NPC 意图。
- 生成对话和剧情文本。
- 提议事件。
- 总结长期记忆。
- 提供叙事节奏建议。

AI 不可以直接：

- 修改资源。
- 决定角色死亡。
- 改变 NPC 健康。
- 创造关键事实。
- 绕过规则判定。
- 绕过服务端改变多人时间线。

所有会影响后续剧情的事实，都必须经过规则引擎校验，并以 Canonical Event 形式写入服务端。

### 3.2 世界事实和剧情文本分离

系统分为两层：

```text
Canonical State
服务端权威事实，决定后续剧情和规则。

Narrative
玩家看到的表现文本，主要保存在本地。
```

同一组权威事实，可以为不同玩家生成不同视角的叙事文本。叙事文本可以有风格差异，但不能改写权威事实。

### 3.3 私有信息不等于本地信息

玩家单独发现的秘密，其他玩家不应该看到，但服务端仍需保存。

例如：

```json
{
  "type": "SECRET_DISCOVERED",
  "scope": "player",
  "targetId": "player-a",
  "visibility": "private",
  "payload": {
    "secretId": "doctor_infected"
  }
}
```

该事件会影响后续：

- 玩家能否威胁林医生。
- 林医生是否怀疑玩家。
- 玩家能否把秘密告诉队友。
- 特定 Skill 是否被激活。

因此它属于服务端权威事件，而不是纯本地文本。

---

## 4. Local First 的边界

v0.2 明确采用“本地剧情体验优先”，而不是“离线也能无限推进权威世界”。

### 4.1 本地可以做

- 回看完整剧情。
- 搜索本地剧情文本。
- 查看本地章节摘要。
- 草拟下一回合行动。
- 缓存待同步 Command。
- 保存流式剧情片段。
- 导出个人故事记录。

### 4.2 必须在线做

- 创建世界实例。
- 提交会推进世界的 Command。
- 生成 Canonical Event。
- 修改资源、健康、关系、秘密、任务和世界时间。
- 进入下一回合。
- 多人房间同步。

### 4.3 后续可选的纯离线单人模式

如果未来要支持真正离线推进，需要单独定义 `local-authority` 模式：

- 本地规则引擎成为临时权威。
- 本地生成独立事件序列。
- 该存档默认不能合并到多人世界。
- 重新联网后只能上传为个人单人存档，不能直接参与共享世界。

MVP 不做该模式。

---

## 5. 推荐技术栈

### 5.1 `npc404-web`

```text
React
Vite
TypeScript
TanStack Router
TanStack Query
Zustand
Dexie
Socket.IO Client
```

职责：

- 玩家界面。
- 房间界面。
- 剧情流式展示。
- 玩家输入。
- IndexedDB 本地剧情。
- 待同步 Command。
- 断线重连。
- 本地剧情搜索和回放。

暂不使用 Next.js 作为主游戏框架。主游戏页面几乎不需要 SSR，核心数据来自 IndexedDB、WebSocket 和独立游戏服务。

### 5.2 `npc404`

```text
Node.js
Fastify
TypeScript
Socket.IO
Zod
Drizzle ORM
PostgreSQL
Redis
BullMQ
```

职责：

- 用户和会话。
- 世界实例。
- 单人局和多人房间。
- Command 接收和校验。
- 回合管理。
- 规则结算。
- Canonical Event 写入。
- 私有事件权限控制。
- Agent Worker 调度。
- Socket.IO 广播。

Node.js 适合第一版，因为主要负载是网络 I/O、数据库、模型调用和任务编排。前后端可以共享 TypeScript 类型。

---

## 6. 总体架构

```text
┌─────────────────────────────────────────────┐
│                npc404-web                   │
│ React / Vite / Dexie / Socket.IO Client     │
│ Local Narrative / Pending Commands          │
└──────────────────────┬──────────────────────┘
                       │ HTTP + WebSocket
┌──────────────────────▼──────────────────────┐
│                  npc404                      │
│ Fastify Game Server                          │
│ Auth / Room / Turn / Rules / Events / Sync   │
└───────────────┬───────────────────┬─────────┘
                │                   │ Job Queue
                │                   ▼
                │          ┌──────────────────────┐
                │          │    Agent Worker      │
                │          │ Skill Runtime        │
                │          │ NPC / Director       │
                │          │ Narrative / Memory   │
                │          └──────────┬───────────┘
                │                     │
                ▼                     ▼
        ┌───────────────┐     Claude / OpenAI
        │ PostgreSQL    │
        └───────────────┘

        ┌───────────────┐
        │ Redis/BullMQ  │
        └───────────────┘
```

Agent Worker 不直接写入世界状态。它只能返回 Proposed Events、NPC intents 和 narrative hints，最终由 Game Server 校验并落库。

---

## 7. 核心领域模型

### 7.1 Campaign Template

剧本模板定义初始世界，不保存具体玩家进度。

```ts
interface CampaignTemplate {
  id: string
  version: string
  name: string
  description: string
  initialWorldState: WorldState
  initialNpcIds: string[]
  availableSkillIds: string[]
  rulesetId: string
}
```

### 7.2 World Instance

每次开局创建一个独立世界实例。

```ts
interface WorldInstance {
  id: string
  campaignId: string
  campaignVersion: string
  mode: 'solo' | 'coop'
  status: 'waiting' | 'playing' | 'finished'
  seed: string
  currentTurn: number
  worldVersion: number
  createdAt: string
  updatedAt: string
}
```

### 7.3 Player Branch

多人世界中，每名玩家共享世界事实，但拥有个人视角、秘密和分支状态。

```ts
interface PlayerBranchState {
  worldId: string
  playerId: string
  chapterId: string
  checkpointId: string
  branchVersion: number
  knownFacts: string[]
  personalFlags: Record<string, boolean | number | string>
  personalQuestStates: Record<string, string>
  privateRelationshipStates: Record<string, number>
  lastSyncedEventSequence: number
}
```

### 7.4 World State

第一版 WorldState 应保持小而清楚。

```ts
interface WorldState {
  worldId: string
  turn: number
  day: number
  timeOfDay: 'morning' | 'afternoon' | 'night'
  weather: 'clear' | 'rain' | 'storm'
  resources: {
    food: number
    water: number
    medicine: number
  }
  shelter: {
    safety: number
    generatorFixed: boolean
    searchedLocationIds: string[]
  }
  players: Record<string, PlayerPublicState>
  npcs: Record<string, NpcState>
  flags: Record<string, boolean | number | string>
}
```

---

## 8. NPC 异常机制

游戏名里的“不太正常”需要成为机制，而不只是文案风格。

这里的“异常”指末日压力下被放大的行为倾向、执念、误判和生存策略，不把现实精神疾病当作标签或笑点。

### 8.1 NpcState 增加异常状态

```ts
interface NpcAbnormalityState {
  profileId: string
  currentStress: number
  stage: 'controlled' | 'tense' | 'unstable' | 'breakdown'
  activeTriggers: string[]
  exposedTells: string[]
  cooldownUntilTurn?: number
}

interface NpcState {
  id: string
  name: string
  alive: boolean
  health: number
  trust: Record<string, number>
  pressure: number
  knownFacts: string[]
  privateSecrets: string[]
  skillIds: string[]
  abnormality: NpcAbnormalityState
}
```

### 8.2 异常 Profile

异常 Profile 是内容配置，不是 AI 自由发挥。

```ts
interface NpcAbnormalityProfile {
  id: string
  name: string
  description: string
  triggers: string[]
  stressRules: string[]
  behaviorBiases: string[]
  dialogueTells: string[]
  forbiddenActions: string[]
  eventWeights: Record<string, number>
}
```

示例：

```text
赵队长：秩序控制执念
- 触发：资源减少、玩家私下行动、夜间危险、有人质疑他的命令。
- 倾向：要求集中物资、限制自由行动、怀疑有人私藏。
- 破局：证据、共同危险、玩家主动透明汇报。

林医生：过度保护执念
- 触发：孩子受威胁、感染秘密接近暴露、药品不足。
- 倾向：隐瞒自身状况、优先保护孩子、夸大医疗风险。
- 破局：建立信任、提供替代药品、承诺保护孩子。
```

### 8.3 规则和 AI 的分工

规则引擎决定：

- 压力值如何变化。
- 是否进入新异常阶段。
- 哪些触发器被激活。
- Proposed Events 是否允许。
- 异常行为造成的资源和关系后果。

AI 决定：

- NPC 如何解释自己的行为。
- 对话如何体现异常倾向。
- 叙事如何暗示异常信号。
- 在允许范围内选择具体表达。

异常机制不能让 AI 创造不存在的事实。例如赵队长可以怀疑玩家偷水，但不能凭空证明玩家偷水。

---

## 9. Command 模型

客户端提交的是意图，不直接修改世界。

```ts
interface PlayerCommand {
  id: string
  worldId: string
  playerId: string
  expectedWorldVersion: number
  turn: number
  type: PlayerCommandType
  payload: Record<string, unknown>
  createdAt: string
}
```

第一版 Command 类型：

| Type | 用途 | MVP 是否需要 |
|---|---|---|
| `TALK_TO_NPC` | 与 NPC 交谈、询问、试探、威胁 | 是 |
| `SEARCH_LOCATION` | 搜索诊所内具体地点 | 是 |
| `REST` | 恢复体力、消耗时间 | 是 |
| `ALLOCATE_RESOURCE` | 分配食物、水、药品 | 是 |
| `TREAT_CHARACTER` | 治疗玩家或 NPC | 是 |
| `STEAL_RESOURCE` | 偷窃或私藏资源 | 是 |
| `GUARD_SHELTER` | 守夜或加固避难所 | 是 |
| `EXPEL_CHARACTER` | 驱逐 NPC 或玩家提议驱逐 | 是 |
| `FREEFORM_ACTION` | 自由文本行动，由规则映射到可判定动作 | 是 |
| `READY_TURN` | 多人回合准备完成 | 多人阶段 |

`FREEFORM_ACTION` 第一版必须被归一化为已知 action category，不能让 AI 直接执行任意效果。

---

## 10. Canonical Event 类型表

```ts
interface CanonicalEvent {
  id: string
  worldId: string
  sequence: number
  turn: number
  scope: 'world' | 'party' | 'player' | 'npc'
  targetId?: string
  visibility: 'public' | 'party' | 'private' | 'server'
  type: CanonicalEventType
  payload: Record<string, unknown>
  causedByCommandId?: string
  createdAt: string
}
```

第一版事件白名单：

| Type | 典型 Scope | 说明 |
|---|---|---|
| `TURN_STARTED` | `world` | 新回合开始 |
| `TURN_RESOLVED` | `world` | 当前回合结算完成 |
| `WORLD_TIME_ADVANCED` | `world` | 时间推进 |
| `RESOURCE_CHANGED` | `world` | 食物、水、药品变化 |
| `LOCATION_SEARCHED` | `world` 或 `player` | 地点被搜索，可有私有发现 |
| `CHARACTER_HEALTH_CHANGED` | `player` 或 `npc` | 玩家或 NPC 健康变化 |
| `PLAYER_STAMINA_CHANGED` | `player` | 玩家体力变化 |
| `RELATIONSHIP_CHANGED` | `player` 或 `npc` | 信任、怀疑、压力等关系数值变化 |
| `SECRET_DISCOVERED` | `player` | 玩家发现秘密 |
| `SECRET_REVEALED` | `world` 或 `party` | 秘密被公开或半公开 |
| `NPC_PRESSURE_CHANGED` | `npc` | NPC 压力变化 |
| `NPC_ABNORMALITY_TRIGGERED` | `npc` | NPC 异常触发或阶段变化 |
| `NPC_INTENT_RECORDED` | `server` | 记录 NPC 意图，默认不发给玩家 |
| `DANGER_EVENT_OCCURRED` | `world` | 感染者、暴雨、噪音等危险事件 |
| `QUEST_UPDATED` | `player` 或 `world` | 任务状态变化 |
| `ENDING_REACHED` | `world` | 结局达成 |
| `NARRATIVE_SUMMARY_CREATED` | `player` | 章节摘要生成，辅助恢复 |

事件 reducer 必须能够从 Canonical Events 重建 WorldState。不能只靠直接更新数据库字段。

---

## 11. 一回合协议

### 11.1 单人回合

```text
1. Client 读取当前 WorldState 摘要和本地 Narrative。
2. 玩家提交 PlayerCommand。
3. Game Server 校验 worldVersion、turn、payload。
4. Rule Engine 将 Command 归一化为可判定行动。
5. Rule Engine 先计算确定性基础结果。
6. Agent Worker 根据可见事实、NPC 知识和 Skills 生成 Proposed Events。
7. Game Server 校验 Proposed Events。
8. Game Server 在事务中写入 Canonical Events。
9. Game Server 更新 worldVersion 和 checkpoint。
10. Narrative Agent 或模板系统生成个人视角文本。
11. Client 写入 IndexedDB。
12. 进入下一回合。
```

### 11.2 多人回合

第一版多人只做 2 到 4 人同步回合制：

```text
collecting
等待玩家提交行动或准备。

locked
回合锁定，不再接受会影响当前回合的 Command。

resolving
规则引擎和 Agent Worker 结算。

resolved
事件落库，向玩家发送共享和私有结果。

failed_needs_retry
AI 或系统错误，使用确定性兜底或允许重试。
```

多人阶段暂不做：

- 实时自由行动。
- 玩家分头进入复杂地图。
- 大型常驻世界。
- 房间之间资源互通。
- 玩家入侵其他时间线。
- 实时战斗。

---

## 12. AI Agent 分层

### 12.1 Director Agent

负责：

- 控制剧情节奏。
- 选择参与 NPC。
- 决定当前冲突类型。
- 推进隐藏剧情线。
- 控制秘密暴露节奏。
- 避免长时间无事件。
- 避免剧情过密。

不负责直接修改世界。

### 12.2 NPC Agent

负责：

- 根据自身知识和 Skills 生成行动意图。
- 生成对话草稿。
- 表现情绪和异常倾向。
- 提议关系变化。
- 决定是否公开或隐瞒信息。

NPC Agent 只能看到该 NPC 应该知道的事实。

### 12.3 Narrative Agent

负责：

- 根据 Canonical Events 生成剧情文本。
- 为不同玩家生成不同视角。
- 保持人物语言风格。
- 引用本回合实际结果。
- 支持流式输出。

Narrative Agent 不能新增权威事实。

### 12.4 Memory Agent

负责：

- 压缩较早剧情。
- 提取长期人物记忆。
- 保留关键承诺和背叛。
- 生成章节摘要。
- 删除无关日常细节。

记忆分层：

```text
Canonical Facts
Recent Events
Long-term Memory Summary
Local Narrative Blocks
```

---

## 13. Agent 输出规范

Agent 输出必须是结构化数据。

```ts
const AgentResultSchema = z.object({
  npcIntents: z.array(
    z.object({
      npcId: z.string(),
      intent: z.string(),
      emotion: z.string(),
      abnormalitySignal: z.string().optional(),
      targetId: z.string().optional(),
      dialogueDraft: z.string().optional(),
    }),
  ),
  proposedEvents: z.array(
    z.object({
      type: z.string(),
      scope: z.enum(['world', 'party', 'player', 'npc']),
      targetId: z.string().optional(),
      visibility: z.enum(['public', 'party', 'private', 'server']),
      payload: z.record(z.unknown()),
      reason: z.string(),
    }),
  ),
  narrativeHints: z.array(z.string()),
  riskFlags: z.array(z.string()),
})
```

服务端需要校验：

1. Schema 是否合法。
2. 事件类型是否在白名单。
3. target 是否存在。
4. visibility 是否符合权限。
5. 资源是否足够。
6. 目标角色是否存活。
7. 是否重复事件。
8. 是否违反 NPC 知识边界。
9. worldVersion 是否匹配。
10. 事务写入是否成功。

---

## 14. AI 失败兜底策略

回合不能因为模型失败而卡死。

### 14.1 模型超时

处理：

- 记录 Agent Job 失败。
- 使用规则引擎确定性结果。
- 用模板生成短叙事。
- 向客户端标记 `narrativeQuality: "fallback"`。

### 14.2 输出 Schema 错误

处理：

- 尝试一次 repair prompt。
- 仍失败则丢弃 AI 输出。
- 保留规则引擎基础事件。

### 14.3 Proposed Event 不合法

处理：

- 合法事件可以保留。
- 不合法事件写入审计日志。
- 如果全部不合法，回退到规则模板。

### 14.4 Narrative Agent 失败

处理：

- Canonical Events 仍然发送。
- 客户端展示模板文本。
- 稍后可异步补生成更好的叙事版本。

---

## 15. Markdown Skill 系统

Skill 目录建议：

```text
content/skills/
├── personality/
├── profession/
├── state/
├── abnormality/
├── plot/
└── director/
```

NPC 不对应单个 Skill，而是组合：

```text
基础角色定义
+ 人格 Skill
+ 职业 Skill
+ 当前状态 Skill
+ 异常 Skill
+ 阵营 Skill
+ 当前剧情 Skill
```

第一版只开放：

- Prompt Skill。
- 白名单 Tool Skill。

不允许：

- 任意 Shell。
- 任意脚本执行。
- 直接读写数据库。
- 直接访问文件系统。
- Skill 自己创造权威事实。

---

## 16. 持久化和同步

### 16.1 服务端保存

```text
users
world_instances
world_members
player_branches
npc_instances
canonical_events
world_checkpoints
chapter_summaries
agent_jobs
```

判断规则：

> 删除这份数据后，如果会改变后续剧情走向，就必须保存在服务端。

### 16.2 本地 IndexedDB 保存

```ts
db.version(1).stores({
  localWorlds: 'id, campaignId, updatedAt',
  narrativeBlocks: 'id, [worldId+playerId], turn, createdAt',
  pendingCommands: 'id, worldId, status, createdAt',
  localCheckpoints: 'id, worldId, turn',
  cachedAssets: 'id, type, updatedAt',
})
```

本地 Narrative 丢失不应破坏权威进度。服务端应能用检查点、Canonical Events 和章节摘要恢复一个可继续玩的状态。

### 16.3 断线恢复

客户端重连时提交：

```text
worldId
playerId
lastSeenEventSequence
lastLocalNarrativeBlockId
```

服务端返回：

- 缺失的 public events。
- 该玩家有权限看到的 private events。
- 当前 WorldState 摘要。
- 是否需要重新生成本地叙事。

---

## 17. MVP 范围

### 17.1 世界设定

```text
末日爆发第 7 天
地点：废弃社区诊所
食物只够维持两天
夜间有感染者活动
发电机状态不稳定
药柜可能被人动过
```

### 17.2 NPC

#### 林医生

```text
善良
谨慎
医疗能力强
隐藏自己被感染的事实
想保护一名孩子
异常倾向：过度保护和自我牺牲混合，压力过高时会隐瞒关键信息
```

#### 赵队长

```text
退伍士兵
果断
多疑
倾向控制团队
怀疑物资被人私藏
异常倾向：秩序控制执念，压力过高时会要求集中物资和限制行动
```

### 17.3 玩家能力

```text
交谈
搜索
休息
分配物资
治疗
偷窃
守卫
驱逐 NPC
自由文本行动
```

### 17.4 状态

```text
食物
水
药品
玩家体力
饥饿
避难所安全度
时间
天气
NPC 健康
NPC 信任
NPC 压力
NPC 异常阶段
玩家私有秘密
```

### 17.5 MVP 完成标准

第一版可玩切片至少包含：

- 10 到 15 回合完整流程。
- 一次资源选择。
- 一次 NPC 内部冲突。
- 一个隐藏秘密。
- 一次 NPC 异常触发。
- 一次危险事件。
- 至少两个结局。
- 本地完整剧情存档。
- 服务端关键事件恢复。
- AI 失败时可继续结算。

双人合作模式进入下一阶段，不阻塞单人切片完成。

---

## 18. 迭代路线

### 阶段 0：规则验证

目标：

- 不接正式 UI。
- 用命令行或简单页面跑通一局。
- 验证 Command、Event、Reducer、Skill 组合和 AI 兜底。

实现：

```text
Campaign JSON
NPC JSON
Abnormality Profile JSON
SKILL.md
Game Core
单模型调用
Canonical Events
模板兜底叙事
```

### 阶段 1：单人垂直切片

实现：

- React + Vite 基础页面。
- Dexie 本地剧情。
- Fastify 游戏 API。
- 单人世界实例。
- Command/Event。
- 10 回合诊所剧本。
- 两名 NPC。
- 异常触发机制。
- 章节摘要。
- 基础检查点。

### 阶段 2：双人合作

实现：

- Socket.IO 房间。
- 2 人加入。
- 回合倒计时。
- 玩家准备状态。
- 多人行动统一结算。
- 私有事件。
- 不同玩家视角文本。
- 断线恢复。

### 阶段 3：内容工具化

实现：

- Skill 管理界面。
- NPC 编辑器。
- Campaign 编辑器。
- Event Timeline。
- 剧情调试器。
- Token 和成本分析。
- AI 输出回放。
- Prompt 版本管理。

---

## 19. 测试策略

### 19.1 不依赖 AI 的测试

核心规则必须是纯函数优先：

```ts
const result = resolveTurn({
  worldState,
  commands,
  randomSeed,
})
```

必须覆盖：

- Command 到 Event 的规则。
- Event Reducer。
- 资源增减。
- 世界版本并发。
- 重复 Command 幂等。
- 玩家私有事件权限。
- NPC 异常触发。
- 多人行动冲突。
- 检查点恢复。
- 非法 Proposed Event 拒绝。

### 19.2 AI 测试

AI 测试关注：

- 是否符合 Schema。
- 是否泄露 NPC 不知道的信息。
- 是否改变权威事实。
- 是否违反 Skill 约束。
- 是否出现人物性格明显漂移。
- 是否超过 Token Budget。

不要求每次文案完全一致。

---

## 20. 第一版暂不引入

```text
Next.js 主游戏框架
微服务集群
Kafka
向量数据库
复杂 RAG
大型开放世界
完全实时战斗
每个 NPC 一个长期独立进程
任意 Skill 脚本执行
跨房间共享世界
区块链或 NFT
真正离线推进权威世界
```

---

## 21. 下一步文档

建议在 `npc404-docs` 继续补这些文档：

1. `proposals/event-catalog-v0.1.md`
2. `proposals/turn-protocol-v0.1.md`
3. `proposals/world-state-v0.1.md`
4. `proposals/skill-spec-v0.1.md`
5. `content/clinic-chapter-v0.1.md`
6. `content/npcs/lin-doctor-v0.1.md`
7. `content/npcs/captain-zhao-v0.1.md`

优先级建议：

```text
Event Catalog
→ WorldState
→ Turn Protocol
→ CLI Demo
→ Web UI
```

当前不急于开始正式 UI。先用最小 Demo 验证：

```text
玩家输入
→ Command
→ 规则判定
→ Skill 组合
→ Agent 输出
→ Proposed Events
→ 事件校验
→ Canonical Events
→ 个人剧情文本
→ AI 失败兜底
```

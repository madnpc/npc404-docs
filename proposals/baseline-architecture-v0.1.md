# Baseline Architecture v0.1

> Project: 《末日NPC都不太正常》  
> Scope: extensible baseline architecture after feasibility demo  
> Strategy: modular monolith, event-sourced game core, solo vertical slice first  
> Status: design baseline

---

## 1. Goal

The feasibility demo proved the basic loop:

```text
web action
→ Node API
→ server-owned state resolution
→ fallback narrative
→ web event feedback and animation
```

The next architecture step should not add many gameplay features. It should make the project harder to paint into a corner.

This baseline optimizes for:

- A reliable authoritative event stream.
- A reusable pure game core.
- Character stats that can support HP, attack, defense, stamina, survival pressure, and later combat.
- AI as an optional assistant, not the world authority.
- A frontend that can grow beyond one large `App.tsx`.
- Postgres, multiplayer, Agent Worker, and Skill Runtime as natural next steps.

First implementation target:

```text
single-player vertical slice
canonical events
in-memory repository
fallback agent
basic character stats
damage/heal reducers
HTTP API
web game page
```

---

## 2. Non-Goals

This baseline does not require the first implementation to include:

- Real multiplayer rooms.
- Socket.IO turn sync.
- PostgreSQL persistence.
- Redis or BullMQ.
- Real model calls.
- Full Markdown Skill Runtime.
- Authentication.
- Complete combat system.
- Content editor.
- MCP server.

Those capabilities should have clean extension points, but they should not block the first architecture pass.

---

## 3. Repository Roles

```text
npc404-docs
Architecture, proposals, content specs, gameplay design, event catalog, Skill specs.

npc404
Authoritative runtime: Fastify server, application use cases, game core, events, rules, persistence ports, agent ports.

npc404-web
Player experience: game UI, local narrative storage, API client, animations, future room UI.
```

Runtime request path:

```text
npc404-web
→ HTTP
→ npc404 server
→ application use case
→ game-core rules
→ event append
→ reduced WorldState
→ visible DTO + narrative
→ npc404-web UI and local narrative
```

MCP remains a future developer/content tooling surface. It must not sit in the player runtime path.

---

## 4. Core Principles

### 4.1 Events Are Authority

Canonical Events are the source of truth for facts that affect future gameplay.

`WorldState` is derived from:

```text
checkpoint + canonical events after checkpoint
```

Snapshots/checkpoints are caches. They improve loading speed, but they do not replace the event log.

### 4.2 AI Cannot Commit Facts

AI may generate:

- NPC intent.
- Narrative hints.
- Dialogue drafts.
- Proposed events.
- Memory summaries.

AI may not directly:

- Change HP.
- Kill characters.
- Modify resources.
- Reveal secrets.
- Advance turns.
- Write Canonical Events.

Every AI proposal must pass schema validation, permission checks, rules checks, and event whitelist checks before it can become a Canonical Event.

### 4.3 Game Core Is Pure

`game-core` must not import:

- Fastify.
- Database clients.
- AI SDKs.
- environment variables.
- filesystem APIs.
- HTTP clients.

It receives plain data and returns plain data.

### 4.4 Solo First, Multiplayer Ready

The first implementation is single-player. Still, these fields must exist from the start:

- `worldVersion`
- `event.sequence`
- `command.expectedWorldVersion`
- `event.visibility`
- `event.scope`
- repository append conflict handling

Later multiplayer should change turn collection and room synchronization, not the fundamental event model.

### 4.5 NPC Abnormality Is a System, Not the Whole Game

The main game should feel like post-apocalyptic survival RPG with abnormal NPC behavior as a social risk layer.

It should support:

- HP and damage.
- attack and defense.
- stamina and fatigue.
- medicine and healing.
- hunger, infection, sanity later.
- NPC pressure and abnormality triggers.

The project should not become only a "rules-horror" text simulator.

---

## 5. Server Architecture

Recommended `npc404` structure:

```text
src/
├── contracts/
│   ├── commands.ts
│   ├── events.ts
│   ├── dto.ts
│   └── errors.ts
├── game-core/
│   ├── state/
│   │   ├── world-state.ts
│   │   ├── character-state.ts
│   │   └── status-effect.ts
│   ├── events/
│   │   ├── event-catalog.ts
│   │   ├── event-schemas.ts
│   │   └── reducer.ts
│   ├── commands/
│   │   ├── command-schemas.ts
│   │   └── normalize-command.ts
│   └── rules/
│       ├── resolve-turn.ts
│       ├── combat-rules.ts
│       ├── resource-rules.ts
│       └── abnormality-rules.ts
├── application/
│   ├── create-world.ts
│   ├── get-world-view.ts
│   ├── submit-command.ts
│   ├── get-events-after.ts
│   └── ports/
│       ├── world-repository.ts
│       ├── agent-port.ts
│       ├── id-generator.ts
│       └── clock.ts
├── infrastructure/
│   ├── config/
│   ├── persistence/
│   │   ├── in-memory-world-repository.ts
│   │   └── postgres-world-repository.ts
│   ├── agent/
│   │   ├── fallback-agent.ts
│   │   └── model-agent.ts
│   └── security/
│       └── log-redaction.ts
├── server/
│   ├── http/
│   │   ├── routes/
│   │   └── error-handler.ts
│   └── socket/
└── main.ts
```

### 5.1 Dependency Direction

Allowed dependency direction:

```text
server
→ application
→ game-core / contracts / application ports

infrastructure
→ application ports
→ contracts

game-core
→ contracts
```

Disallowed:

```text
game-core → infrastructure
game-core → server
game-core → process.env
application → Fastify request/response
contracts → implementation modules
```

This keeps the rules engine reusable for:

- HTTP server.
- future Socket.IO flow.
- CLI simulation.
- MCP developer tooling.
- content debugging tools.

---

## 6. Contracts

`contracts` contains shared shapes and schema definitions that both server and web can eventually use.

### 6.1 PlayerCommand

Commands are player intent, not results.

```ts
interface PlayerCommandBase {
  id: string
  worldId: string
  actorId: string
  turn: number
  expectedWorldVersion: number
  createdAt: string
}
```

Initial command types:

```text
TALK_TO_NPC
SEARCH_LOCATION
ALLOCATE_RESOURCE
TREAT_CHARACTER
GUARD_SHELTER
ATTACK_CHARACTER
FREEFORM_ACTION
```

`FREEFORM_ACTION` must be normalized into a known action category before rules resolution. AI may help interpret free text, but the final normalized command must be validated by code.

### 6.2 CanonicalEvent

```ts
interface CanonicalEvent {
  id: string
  worldId: string
  sequence: number
  turn: number
  type: CanonicalEventType
  scope: 'world' | 'player' | 'npc' | 'server'
  visibility: 'public' | 'private' | 'server'
  targetId?: string
  payload: Record<string, unknown>
  causedByCommandId?: string
  createdAt: string
}
```

Initial event catalog:

```text
WORLD_CREATED
TURN_STARTED
TURN_RESOLVED
WORLD_TIME_ADVANCED
RESOURCE_CHANGED
LOCATION_SEARCHED
CHARACTER_DAMAGED
CHARACTER_HEALED
CHARACTER_DIED
STATUS_EFFECT_APPLIED
STATUS_EFFECT_REMOVED
RELATIONSHIP_CHANGED
SECRET_DISCOVERED
NPC_PRESSURE_CHANGED
NPC_ABNORMALITY_TRIGGERED
DANGER_EVENT_OCCURRED
ENDING_REACHED
```

### 6.3 Error Shape

```ts
interface ApiError {
  code:
    | 'WORLD_NOT_FOUND'
    | 'VERSION_CONFLICT'
    | 'INVALID_COMMAND'
    | 'FORBIDDEN'
    | 'AGENT_FAILED'
    | 'INTERNAL_ERROR'
  message: string
  retryable: boolean
}
```

Routes should return stable error codes. The web app should not depend on internal exception messages.

---

## 7. Game State

### 7.1 WorldState

`WorldState` is the reduced state for rules, not the raw database record.

```ts
interface WorldState {
  id: string
  campaignId: string
  campaignVersion: string
  mode: 'solo' | 'coop'
  status: 'playing' | 'finished'
  turn: number
  worldVersion: number
  day: number
  timeOfDay: 'morning' | 'afternoon' | 'night'
  locationId: string
  resources: ResourceState
  characters: Record<string, CharacterState>
  locations: Record<string, LocationState>
  flags: Record<string, boolean | number | string>
}
```

### 7.2 CharacterState

Players, NPCs, and enemies share one character model.

```ts
interface CharacterState {
  id: string
  kind: 'player' | 'npc' | 'enemy'
  name: string
  alive: boolean
  locationId: string

  stats: {
    hp: number
    maxHp: number
    attack: number
    defense: number
    stamina: number
    maxStamina: number
    hunger?: number
    infection?: number
    sanity?: number
  }

  statusEffects: StatusEffect[]
  relationships?: Record<string, number>
  knownFacts?: string[]
  abnormality?: NpcAbnormalityState
}
```

First implementation should actively use:

```text
hp
maxHp
attack
defense
stamina
maxStamina
```

`hunger`, `infection`, and `sanity` are optional fields for future survival systems.

### 7.3 StatusEffect

```ts
interface StatusEffect {
  id: string
  type: 'bleeding' | 'infected' | 'hungry' | 'exhausted' | 'panicked' | 'guarding'
  stacks: number
  remainingTurns?: number
  sourceId?: string
}
```

Status effects should be changed through events:

```text
STATUS_EFFECT_APPLIED
STATUS_EFFECT_REMOVED
```

### 7.4 NPC Abnormality

```ts
interface NpcAbnormalityState {
  profileId: string
  currentStress: number
  stage: 'controlled' | 'tense' | 'unstable' | 'breakdown'
  activeTriggers: string[]
  exposedTells: string[]
  cooldownUntilTurn?: number
}
```

Abnormality affects:

- command interpretation.
- NPC intent.
- relationship changes.
- resource conflict likelihood.
- narrative style.

It should not bypass HP, resource, or death rules.

---

## 8. Turn Resolution Flow

Single-player first implementation:

```text
POST /worlds/:worldId/commands
→ validate route body
→ load world + checkpoint + events
→ reduce WorldState
→ check viewer can control actor
→ check expectedWorldVersion
→ normalize command
→ game-core.resolveTurn
→ optional AgentPort.generateTurn
→ validate proposed events
→ append canonical events with optimistic version
→ reduce new state
→ save checkpoint
→ build WorldStateView
→ return visible events + narrative
```

`resolveTurn` should return:

```ts
interface ResolveTurnResult {
  events: CanonicalEventDraft[]
  narrativeHints: string[]
  screenEffects: ScreenEffect[]
}
```

It should not write to repositories.

### 8.1 Damage and Healing

Damage should be represented as events, not direct field mutation in routes.

```json
{
  "type": "CHARACTER_DAMAGED",
  "targetId": "player-a",
  "payload": {
    "amount": 3,
    "damageType": "bite",
    "sourceId": "infected-001"
  }
}
```

Healing:

```json
{
  "type": "CHARACTER_HEALED",
  "targetId": "lin-doctor",
  "payload": {
    "amount": 2,
    "sourceItemId": "medicine"
  }
}
```

Death:

```text
If reducer or rules detect hp <= 0, rules emit CHARACTER_DIED.
The frontend never decides death.
```

### 8.2 Screen Effects

Screen effects are UI hints derived from events:

```ts
type ScreenEffect =
  | { type: 'shake'; intensity: 'light' | 'heavy' }
  | { type: 'flash'; tone: 'danger' | 'hope' | 'infection' }
  | { type: 'transition'; name: 'choice-switch' | 'turn-resolved' }
```

Mapping examples:

```text
DANGER_EVENT_OCCURRED      -> heavy shake
CHARACTER_DAMAGED          -> light shake
NPC_ABNORMALITY_TRIGGERED  -> light shake + danger flash
SECRET_DISCOVERED          -> infection flash
ENDING_REACHED             -> turn-resolved transition
```

The web app should not infer major effects from narrative text.

---

## 9. Application Layer

Initial use cases:

```text
createWorld(campaignId, playerId)
getWorldView(worldId, viewerId)
submitCommand(worldId, command, viewerId)
getEventsAfter(worldId, sequence, viewerId)
resetWorld(worldId)   # dev only
```

### 9.1 WorldRepository Port

```ts
interface WorldRepository {
  createWorld(input: CreateWorldInput): Promise<WorldRecord>
  getWorld(worldId: string): Promise<WorldRecord | null>
  getEvents(worldId: string, options: EventQuery): Promise<CanonicalEvent[]>
  appendEvents(input: AppendEventsInput): Promise<AppendEventsResult>
  getLatestCheckpoint(worldId: string): Promise<WorldCheckpoint | null>
  saveCheckpoint(input: SaveCheckpointInput): Promise<void>
}
```

`appendEvents` must support optimistic concurrency:

```text
appendEvents(worldId, events, expectedWorldVersion)
```

If the version does not match, return `VERSION_CONFLICT`.

### 9.2 AgentPort

```ts
interface AgentPort {
  generateTurn(input: AgentTurnInput): Promise<AgentTurnResult>
}
```

First implementation:

```text
FallbackAgent
- no model call
- deterministic template narrative
- returns no unsafe event changes
```

Future implementation:

```text
ModelAgent
- OpenAI / Claude adapter
- returns ProposedEvents, npcIntents, narrativeHints
- never writes Canonical Events
```

### 9.3 Infrastructure Adapters

First implementation:

```text
InMemoryWorldRepository
FallbackAgent
SystemClock
RandomIdGenerator
```

Future replacements:

```text
PostgresWorldRepository
BullMQAgentWorkerClient
SecureModelAgent
DeterministicSeededRandom
```

Application code should not change when those adapters are swapped.

---

## 10. Persistence Design

### 10.1 First Real Database Tables

When Postgres is introduced, start with:

```text
users
world_instances
world_members
player_branches
canonical_events
world_checkpoints
agent_jobs
```

Do not immediately create many state-specific tables for resources, characters, relationships, and locations. The event log plus checkpoint JSON is enough for the first production slice.

### 10.2 canonical_events

```text
id
world_id
sequence
turn
type
scope
visibility
target_id
payload_json
caused_by_command_id
created_at
```

Required indexes:

```text
(world_id, sequence)
(world_id, turn)
(world_id, type)
(world_id, target_id)
```

### 10.3 world_checkpoints

```text
id
world_id
event_sequence
world_version
state_json
created_at
```

Checkpoint policy:

```text
save every N turns
save after major events
save before ending
```

### 10.4 Migration Path

```text
Phase 1: InMemoryWorldRepository
Phase 2: Postgres event log + JSON checkpoints
Phase 3: query-optimized projections for admin/debug
Phase 4: analytics and leaderboard tables if needed
```

---

## 11. AI and Secret Safety

### 11.1 Environment Variables

Server-only:

```text
OPENAI_API_KEY
ANTHROPIC_API_KEY
```

Never add:

```text
VITE_OPENAI_API_KEY
VITE_ANTHROPIC_API_KEY
```

The web app may receive:

```json
{
  "configured": true,
  "provider": "openai"
}
```

It must never receive actual key values.

### 11.2 Log Redaction

Redact:

```text
authorization
cookie
apiKey
OPENAI_API_KEY
ANTHROPIC_API_KEY
model request headers
```

Agent audit logs should default to:

```text
provider
model
latency
token usage
schema pass/fail
proposed event count
error code
```

Full prompts and raw model responses should only be stored under an explicit local development switch. They must not go to production logs by default.

### 11.3 Proposed Event Validation

Validation stages:

```text
schema validation
event type whitelist
target existence check
visibility and permission check
resource availability check
character alive check
NPC knowledge boundary check
duplicate event check
world version check
```

Invalid AI output should not fail the whole turn if deterministic rules already produced a valid result. It should fall back to template narrative.

---

## 12. HTTP API Baseline

First architecture API:

```text
GET  /health
POST /worlds
GET  /worlds/:worldId
POST /worlds/:worldId/commands
GET  /worlds/:worldId/events?afterSequence=0
POST /dev/worlds/:worldId/reset
```

### 12.1 POST /worlds

Creates a solo world for the selected campaign.

Input:

```json
{
  "campaignId": "clinic-v1"
}
```

Output:

```json
{
  "worldId": "world_...",
  "worldVersion": 1,
  "view": {}
}
```

### 12.2 POST /worlds/:worldId/commands

Submits one solo command and resolves immediately.

Input:

```json
{
  "commandId": "cmd_...",
  "actorId": "player-a",
  "expectedWorldVersion": 3,
  "type": "SEARCH_LOCATION",
  "payload": {
    "locationId": "pharmacy"
  }
}
```

Output:

```json
{
  "worldVersion": 4,
  "turn": 2,
  "events": [],
  "view": {},
  "narrative": {},
  "screenEffects": []
}
```

### 12.3 GET /worlds/:worldId/events

Supports reconnect and future sync:

```text
GET /worlds/world_123/events?afterSequence=44
```

The server filters events by viewer permission.

---

## 13. Web Architecture

Recommended `npc404-web` structure:

```text
src/
├── app/
│   ├── App.tsx
│   ├── providers.tsx
│   └── routes.tsx
├── features/
│   └── game/
│       ├── pages/
│       │   └── GamePage.tsx
│       ├── components/
│       │   ├── NarrativePanel.tsx
│       │   ├── ActionBar.tsx
│       │   ├── WorldStatus.tsx
│       │   ├── CharacterPanel.tsx
│       │   ├── NpcPanel.tsx
│       │   └── EventTimeline.tsx
│       ├── hooks/
│       │   ├── useWorldSession.ts
│       │   └── useScreenEffects.ts
│       └── store/
│           └── gameStore.ts
├── lib/
│   ├── api/
│   │   ├── client.ts
│   │   └── gameApi.ts
│   ├── local-db/
│   │   └── narrativeDb.ts
│   └── animation/
│       └── eventEffects.ts
├── components/
│   └── ui/
└── styles.css
```

### 13.1 State Layers

Server state:

```text
WorldStateView
availableActions
visibleEvents
```

Eventually managed by TanStack Query.

Client session state:

```text
selected action
is resolving
open panels
current world id
active screen effects
```

Eventually managed by Zustand.

Local narrative:

```text
full narrative blocks
stream chunks
player input history
local chapter summaries
```

Eventually managed by Dexie.

The current demo may keep simple React state until the `/worlds/*` API is introduced.

### 13.2 API Client Boundary

Components should not call `fetch` directly.

Expose:

```ts
createWorld(input)
loadWorld(worldId)
submitCommand(worldId, input)
syncEvents(worldId, afterSequence)
```

### 13.3 UI Component Boundary

Keep shadcn-style primitives in:

```text
components/ui
```

Keep game-aware components in:

```text
features/game/components
```

Example:

```text
ui/Button does not know what a command is.
ActionBar knows command labels, disabled states, and selected action.
```

---

## 14. Migration From Current Demo

Current demo files:

```text
npc404/src/demoGame.ts
npc404/src/app.ts
npc404-web/src/App.tsx
npc404-web/src/lib/demo-api.ts
```

Suggested migration:

```text
1. Copy demo state types into game-core/state and generalize names.
2. Move demo action ids into contracts/commands.
3. Move event ids into contracts/events and game-core/events.
4. Extract reducer from direct mutation logic.
5. Implement createWorld and submitCommand use cases.
6. Add /worlds routes next to /demo routes.
7. Update web to use gameApi over /worlds routes.
8. Split App.tsx into feature components.
9. Remove /demo routes after /worlds demo reaches parity.
```

The current demo is valuable as a reference slice. It should not become the permanent architecture.

---

## 15. First Implementation Scope

First implementation should include:

- `contracts` for minimal commands, events, DTOs, and errors.
- `game-core` WorldState, CharacterState, StatusEffect.
- event schemas for the first event catalog.
- reducer for resources, damage, healing, death, NPC pressure, and turn resolution.
- command schemas and normalization.
- `resolveTurn` for a small clinic scenario.
- `application` use cases.
- `InMemoryWorldRepository`.
- `FallbackAgent`.
- `/worlds/*` HTTP API.
- web `features/game` split.
- HP, attack, defense, stamina display.
- event-driven screen effects.

First implementation should not include:

- real model calls.
- Postgres.
- multiplayer room flow.
- full Skill Runtime.
- complex enemy AI.
- inventory equipment system.
- authentication.

---

## 16. Later Expansion Path

### 16.1 Postgres

Replace `InMemoryWorldRepository` with `PostgresWorldRepository`.

The application layer should remain unchanged.

### 16.2 Agent Worker

Replace direct `FallbackAgent` with an adapter that submits jobs to BullMQ.

The application layer still calls `AgentPort`.

### 16.3 Multiplayer

Add:

```text
world_members
room state
turn collecting/locked/resolving states
Socket.IO rooms
private event fanout
timeout resolution
```

Do not change Canonical Event fundamentals.

### 16.4 Content System

Add:

```text
campaign loader
NPC definition loader
abnormality profile loader
Skill registry
event catalog docs
content validation CLI
```

The rule core should consume validated content data, not raw Markdown.

### 16.5 MCP Tooling

Optional developer tools:

```text
simulateTurn
inspectWorldState
validateEvent
checkSkillConflicts
generateNpcDraft
```

MCP must remain outside player runtime.

---

## 17. Verification Strategy

The user-facing demo can remain lightweight, but the architecture should make core behavior easy to verify.

Recommended minimum checks after implementation:

```text
pnpm build
event reducer examples
submit command happy path
version conflict path
AI key not exposed in public config
manual browser smoke test
```

Core rules should eventually have small tests because combat, death, resources, and event reducers are easy to regress.

---

## 18. Implementation Order

Recommended order:

1. Create server module folders and move current demo code behind new boundaries.
2. Define `contracts` for commands, events, DTOs, and errors.
3. Define `WorldState`, `CharacterState`, and `StatusEffect`.
4. Implement event reducer.
5. Implement `resolveTurn` with current clinic actions plus damage/heal support.
6. Add `WorldRepository` port and `InMemoryWorldRepository`.
7. Add `createWorld`, `getWorldView`, `submitCommand`, and `getEventsAfter`.
8. Add `/worlds/*` routes.
9. Split web into `features/game`.
10. Update web API client to use `/worlds/*`.
11. Add character stat UI.
12. Keep `/demo/*` until new flow reaches parity, then remove it.

This order preserves the working demo while creating the real architecture beside it.

---

## 19. Open Decisions For Later

These are intentionally deferred:

- Auth provider.
- Whether content lives in repo, database, or both.
- Exact model provider abstraction.
- Whether first Postgres deploy uses Drizzle migrations immediately.
- How much narrative text is stored server-side.
- Whether combat is deterministic only or includes seeded randomness.
- How long local narrative blocks are retained in IndexedDB.

The baseline does not need these answers before the first architecture implementation.

# Demo Feasibility Plan v0.1

> Scope: prove the first playable loop for 《末日NPC都不太正常》.

## Goal

Build a minimal full-stack demo that verifies:

- The player can submit a turn from the browser.
- The Node server owns world state and turn resolution.
- AI API keys stay server-side.
- The game can continue without a configured AI key by using fallback narrative.
- The web UI can express major events with screen-level animation.

## Server

Repository: `npc404`

- Use Node.js, TypeScript, Fastify, and Zod.
- Keep demo state in memory.
- Expose:
  - `GET /health`
  - `GET /demo/state`
  - `POST /demo/reset`
  - `POST /demo/turn`
- Read API keys only from environment variables:
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
- Never send API key values to the client.
- Return `ai.configured: boolean` so the web app can show whether real AI is available.
- Use deterministic fallback narrative when no key is configured.

## Web

Repository: `npc404-web`

- Use Vite, React, TypeScript, Tailwind, and shadcn-style local UI components.
- First screen is the playable game surface, not a landing page.
- Show:
  - world status,
  - current narrative,
  - available actions,
  - event log,
  - AI configuration status.
- Use CSS animations for:
  - major event screen shake,
  - option selection transition,
  - narrative entry transition.

## Demo Gameplay

Fixed setting:

- Day 7 after outbreak.
- Abandoned community clinic.
- Food, water, medicine, safety, generator status.
- NPCs: Lin Doctor and Captain Zhao.

Initial available actions:

- Talk to Lin Doctor.
- Search the pharmacy.
- Give medicine to the child.
- Guard the shelter.

The server returns:

- updated state,
- canonical-ish demo events,
- narrative text,
- major event flag for animation.

## Out of Scope

- Database.
- Auth.
- Real multiplayer.
- BullMQ worker.
- shadcn CLI registry integration.
- Real model calls.
- MCP server.

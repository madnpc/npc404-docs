---
name: brainstorming
description: "适用于编写代码前梳理模糊想法、比较方案并形成设计文档。Activates before writing code. Refines rough ideas through questions, explores alternatives, presents design in sections for validation, and saves a design document. 中文关键词：想法不清楚、需求澄清、方案发散、方案对比、取舍分析、决策、规格说明。"
---

# Brainstorming

Turn an unclear request into a shared decision and a concise decision spec.

## Scope

Do only these things:

- Clarify the need, intended outcome, constraints, and success criteria.
- Expand 2–3 genuinely distinct directions when alternatives matter.
- Compare trade-offs and recommend a direction when the evidence supports one.
- Help the user make or confirm the decision.
- Write the confirmed decision as one spec.

## Hard boundaries

Do not:

- Create an implementation plan, task breakdown, checklist, or task file.
- Invoke `writing-plans`, `planning-with-files-zh`, or any implementation skill.
- Write, edit, generate, or execute production code.
- Start a visual companion, server, or other auxiliary workflow.
- Commit changes or continue into implementation after the spec is complete.

The only project file this skill may create or edit is the decision spec described below.

## Conversation

1. Ask one focused question at a time until the decision is well framed. Prefer concrete choices when they genuinely reduce ambiguity.
2. State the assumptions and constraints that matter. Surface unknowns instead of silently filling them in.
3. Offer 2–3 viable directions only when a real choice remains. For each, explain the primary benefit, primary cost, and the condition under which it is the better choice.
4. Recommend one direction, or explicitly say that the decision needs more information. Do not invent certainty.
5. Iterate until the user confirms a direction or asks to stop.

## Design validation

Before writing the spec, present the design in small sections and validate each section with the user:

1. **Scope and outcome** — the goal, success criteria, and exclusions.
2. **Design and behavior** — the chosen direction, user-visible behavior, and constraints.
3. **Trade-offs and risks** — alternatives rejected, accepted costs, and unresolved questions.

Revise any section the user does not validate. Do not proceed to the spec until the design is confirmed.

## Spec

After the user confirms a direction, write one spec to `docs/specs/YYYY-MM-DD-<topic>-spec.md`. Respect a user-provided path instead.

Keep it decision-focused:

1. **Goal and context** — what problem or opportunity matters.
2. **Decision** — the chosen direction and why it fits.
3. **Requirements and constraints** — observable outcomes, rules, and non-negotiables.
4. **Alternatives considered** — the meaningful options and the trade-offs that ruled them in or out.
5. **Out of scope** — what this decision deliberately does not cover.
6. **Open questions** — unresolved items that need an answer before implementation.

Do not include implementation steps, task assignments, code structure, file-by-file edits, or estimates.

## Spec self-review

Before finalizing, remove placeholders and resolve contradictions. Check that the decision, requirements, trade-offs, scope, and open questions agree with one another. Use [spec-document-reviewer-prompt.md](spec-document-reviewer-prompt.md) only when an independent spec review is explicitly permitted.

## Final response

Once the spec is written and reviewed, output only this decision summary. Do not add a plan, implementation steps, code, or a handoff.

## Decision Summary

- **Decision:** …
- **Why:** …
- **Trade-offs accepted:** …
- **Open questions:** …
- **Spec:** …

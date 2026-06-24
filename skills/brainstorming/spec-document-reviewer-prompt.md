# Spec Document Reviewer Prompt Template

Use this template only when an independent review of a decision spec is explicitly permitted.

**Purpose:** Verify that the spec is complete, consistent, and clear enough for the next workflow to use.

**Dispatch after:** The spec is written to `docs/specs/`.

```
Review the following decision spec for completeness and internal consistency.

**Spec to review:** [SPEC_FILE_PATH]

## What to check

| Category | What to look for |
| --- | --- |
| Completeness | TODOs, placeholders, missing decision, scope, or open questions |
| Consistency | Contradictory requirements, constraints, or trade-offs |
| Clarity | Ambiguity likely to lead to the wrong implementation |
| Scope | Multiple unrelated decisions or unrequested expansion |
| YAGNI | Over-engineering or requirements without a stated need |

Only flag issues that would materially affect later work. Do not suggest implementation plans or code.

## Output format

## Spec Review

**Status:** Approved | Issues Found

**Issues (if any):**
- [Section]: [specific issue] — [why it matters]

**Recommendations (advisory):**
- [suggestion]
```

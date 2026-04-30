---
description: Generate a step-by-step implementation plan for building the Poopyhead app from the repository roadmap and rules.
---

Create a step-by-step implementation plan for an autonomous coding agent to build the Poopyhead app.

Use [POOPYHEAD_IMPLEMENTATION_PLAN.txt](../../planning/POOPYHEAD_IMPLEMENTATION_PLAN.txt) as the roadmap and [INITIAL_PLAN.txt](../../planning/INITIAL_PLAN.txt) as the rules source. Treat [INITIAL_PLAN.txt](../../planning/INITIAL_PLAN.txt) as the authoritative source for gameplay behavior, edge cases, and rule precedence.

Output a plan that is:
- Ordered from foundation to finish
- Broken into small, atomic steps
- Explicit about dependencies between steps
- Written so another agent can execute it without guessing
- Focused on the MVP first, with later nice-to-haves separated out

For each step, include:
- Goal
- Why it exists
- Files or subsystems likely to change
- Exact implementation actions
- Validation or test to run
- Stop condition before moving to the next step

Also include:
- Assumptions
- Open questions
- Known rule ambiguities from [INITIAL_PLAN.txt](../../planning/INITIAL_PLAN.txt)
- Risks that could cause rework
- A short milestone summary

Constraints:
- Do not write code
- Do not skip validation
- Keep the plan realistic for one agent to execute incrementally
- If a rule conflict or missing detail blocks planning, ask only the minimum necessary clarifying question

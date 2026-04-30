---
description: Execute the Poopyhead implementation plan one step at a time with validation after each change.
---

Execute the Poopyhead implementation plan step by step.

First, read and follow the implementation plan produced from [POOPYHEAD_IMPLEMENTATION_PLAN.txt](../../planning/POOPYHEAD_IMPLEMENTATION_PLAN.txt) and [INITIAL_PLAN.txt](../../planning/INITIAL_PLAN.txt). Treat [INITIAL_PLAN.txt](../../planning/INITIAL_PLAN.txt) as the authoritative source for gameplay behavior, edge cases, and rule precedence.

Work with the following constraints:
- Complete only one plan step at a time
- Make the smallest possible change needed for the current step
- Run a focused validation immediately after each change
- Stop if validation fails, the current step is ambiguous, or a rule conflict appears
- Do not widen scope until the current step passes validation
- Do not skip ahead to later milestones
- Prefer server-authoritative logic and preserve existing behavior unless the step explicitly changes it

For each step, report:
- What you are changing
- Why this step matters
- Which files or subsystems are affected
- What validation you ran
- Whether the step passed or failed
- What the next step is

If the plan is missing required detail for the current step, ask the minimum necessary clarifying question before editing anything.

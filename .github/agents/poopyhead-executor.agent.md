---
description: "Use when you need an autonomous coding agent to execute the Poopyhead implementation plan one step at a time with validation after each change."
name: "Poopyhead Executor"
tools: [read, search, edit, execute, todo]
user-invocable: true
---

You are the Poopyhead implementation executor.

Your job is to carry out the Poopyhead implementation plan incrementally using the repository roadmap and rules.

Always treat [INITIAL_PLAN.txt](../planning/INITIAL_PLAN.txt) as the authoritative source for gameplay behavior, edge cases, and rule precedence.
Use [POOPYHEAD_IMPLEMENTATION_PLAN.txt](../planning/POOPYHEAD_IMPLEMENTATION_PLAN.txt) as the implementation roadmap.

## Constraints
- Complete only one plan step at a time.
- Make the smallest possible change needed for the current step.
- Run a focused validation immediately after each change.
- Stop if validation fails, the current step is ambiguous, or a rule conflict appears.
- Do not widen scope until the current step passes validation.
- Do not skip ahead to later milestones.
- Preserve existing behavior unless the current step explicitly changes it.

## Approach
1. Read the current plan step and identify the narrowest files or subsystems involved.
2. Make the smallest safe edit needed to satisfy that step.
3. Validate the change immediately with the cheapest relevant check.
4. If validation passes, report the result and move to the next step.
5. If anything is ambiguous or fails, stop and ask the minimum necessary clarifying question.

## Output Format
For each step, report:
- What you are changing
- Why this step matters
- Which files or subsystems are affected
- What validation you ran
- Whether the step passed or failed
- What the next step is

## Poopyhead MVP Implementation Plan

### Scope Basis
- Authoritative gameplay behavior and precedence come from [INITIAL_PLAN.txt](../planning/INITIAL_PLAN.txt).
- Delivery roadmap and stack direction come from [POOPYHEAD_IMPLEMENTATION_PLAN.txt](../planning/POOPYHEAD_IMPLEMENTATION_PLAN.txt).
- This plan is ordered for one executor agent to implement incrementally with validation at each stage.

### Ordered Steps

1. Lock Rule Canon
- Goal: Create a definitive, testable rule specification with precedence.
- Rationale: Prevent downstream rework from ambiguous rule interactions.
- Affected: Game rules module, validation layer, tests.
- Actions:
  - Define precise behavior for 2 (reset wildcard), 3 (invisible wildcard), 7 (seven-or-under), 8 (stackable skip), optional 10 bomb, and mandatory 4+ consecutive-value bomb.
  - Define precedence: bomb resolution overrides special effects when both could apply.
  - Define zone order and restrictions: hand first, then table face-up, then blind.
  - Define pickup outcomes for hand/table/blind failures exactly per rules.
- Validation:
  - Rule matrix maps every statement in [INITIAL_PLAN.txt](../planning/INITIAL_PLAN.txt) to one behavior entry.
  - No unresolved conflicts in precedence.
- Stop condition: Signed-off rule matrix with no TODOs.

2. Define Canonical Server State
- Goal: Establish one authoritative game state schema.
- Rationale: Engine, socket events, and UI all depend on stable state contracts.
- Affected: Backend state store, socket payload contracts, frontend store adapters.
- Actions:
  - Model deck(s), players, zones, pile history, turn index, direction, active constraints, skip counters, bomb option flag, timer settings, reconnect metadata.
  - Include fields required for card legality hints and opponent card-count visibility.
- Validation:
  - State can represent setup, active play, pickup events, bomb extra-turn, and game end.
- Stop condition: Schema fully supports all required gameplay states.

3. Implement Setup and Deal Logic
- Goal: Build game initialization and starting conditions.
- Rationale: Incorrect setup invalidates all gameplay correctness.
- Affected: Game creation service, deck/deal engine.
- Actions:
  - Implement deck scaling rule when player count exceeds multiples of 5.
  - Implement hand size rule: 4 cards each when player count is a multiple of 5, else 5 cards.
  - Deal 3 blind cards per player.
  - Implement face-up table selection workflow (player chooses best 3 from hand), then draw 3 replacements.
  - Implement first-player determination rules from [INITIAL_PLAN.txt](../planning/INITIAL_PLAN.txt).
- Validation:
  - Scenario tests for player counts 2 through 10, including multiple-of-5 boundaries.
- Stop condition: Deterministic, valid initial game state across test matrix.

4. Implement Move Validation and Turn Resolution
- Goal: Enforce legal action checks and core card-play outcomes.
- Rationale: This is the primary correctness boundary.
- Affected: Validator, turn engine.
- Actions:
  - Validate turn ownership, card ownership, playable zone, and pile-comparison legality.
  - Implement stacking same-value cards from legal source.
  - Implement 2/3 wildcard legality at any time.
  - Implement 7 seven-or-under constraint and release condition.
  - Implement 8 skip stacking and turn advancement behavior.
- Validation:
  - Unit tests for legal/illegal plays across normal and special states.
- Stop condition: All validator paths and resolver outcomes pass test suite.

5. Implement Bomb and Precedence Semantics
- Goal: Resolve optional 10 bomb and mandatory 4+ consecutive-value bomb correctly.
- Rationale: Highest-risk rules due to interaction complexity.
- Affected: Pile evaluator, turn continuation logic, draw/replenish logic.
- Actions:
  - Detect top-run consecutive value count for mandatory bomb triggers.
  - Apply bomb precedence over special-card effects.
  - Clear pile, grant same-player extra turn, enforce replenishment before extra-turn play.
  - Respect lobby option for 10 bomb enablement.
- Validation:
  - Sequence tests including mixed special cards and bomb-trigger edge cases.
- Stop condition: Bomb outcomes match rules in all tested scenarios.

6. Implement Pickup, Zone Transitions, and Endgame
- Goal: Enforce pickup behavior and determine final loser.
- Rationale: Zone-specific pickup differences are easy to misapply.
- Affected: Failure resolution, lifecycle manager.
- Actions:
  - Hand failure pickup behavior.
  - Table failure pickup behavior including attempted table card returning to hand.
  - Blind-card reveal behavior and visibility to all players.
  - End condition: one player left with cards is Poopyhead.
- Validation:
  - Case matrix for hand/table/blind fail states and game-end transitions.
- Stop condition: All pickup paths and loser detection are correct.

7. Add Realtime Multiplayer Core
- Goal: Enable lobby creation/join and synchronized play via realtime transport.
- Rationale: Required MVP multiplayer behavior.
- Affected: Lobby service, socket gateway, room manager.
- Actions:
  - Implement create/join by lobby code.
  - Bind games to room channels.
  - Process action events server-authoritatively and broadcast updated state.
  - Return explicit rejection reasons for illegal actions.
- Validation:
  - Multi-client integration tests: join, legal move, illegal move, sync consistency.
- Stop condition: 2 to 5 clients remain state-consistent under active play.

8. Add Reconnect, Refresh Persistence, and Leave Handling
- Goal: Preserve continuity across browser refresh and transient disconnects.
- Rationale: Explicit MVP requirement.
- Affected: Session identity, reconnect flow, client persistence.
- Actions:
  - Persist minimal browser identity and last game reference.
  - Re-associate returning player and resend current authoritative state.
  - Apply long grace period behavior for disconnects in turn-based sessions.
  - Handle leave events without corrupting ongoing game.
- Validation:
  - Tests for refresh mid-turn, reconnect after temporary loss, and leave-during-game.
- Stop condition: Players can refresh/rejoin and continue valid gameplay.

9. Build Mobile-First Play UI
- Goal: Deliver clear, touch-friendly gameplay on mobile browsers.
- Rationale: Primary target platform is mobile web.
- Affected: Frontend game board, hand/table/pile components, selectors.
- Actions:
  - Build responsive layout for phone-first usage.
  - Highlight exactly which cards are playable.
  - Show other players’ remaining card counts clearly.
  - Add lightweight animations for card play and turn transitions.
- Validation:
  - Manual QA on iOS Safari and Android Chrome, including small-screen usability.
- Stop condition: End-to-end game is playable on mobile with clear move guidance.

10. Implement Rematch Loop
- Goal: Support replay with the same lobby participants.
- Rationale: Explicit MVP requirement.
- Affected: Lobby lifecycle, game reset orchestration.
- Actions:
  - Add rematch readiness flow.
  - Reset game state while retaining lobby membership.
  - Recompute first player based on latest Poopyhead status rules.
- Validation:
  - Full game completion followed by rematch without reconnecting.
- Stop condition: Consecutive games run correctly in one lobby.

11. Add MVP Security and Abuse Controls
- Goal: Add practical protections for sockets and lobby endpoints.
- Rationale: Realtime systems are abuse-prone without guardrails.
- Affected: Middleware, socket input validation, observability.
- Actions:
  - Rate-limit create/join/reconnect attempts.
  - Validate and cap payload sizes.
  - Add per-IP connection safeguards.
  - Log suspicious behavior and key game actions.
- Validation:
  - Negative tests for malformed payloads, brute-force code guessing, reconnect spam.
- Stop condition: Common abuse vectors are blocked and visible in logs.

12. Execute Release Validation Gate
- Goal: Confirm correctness, reliability, and mobile usability before launch.
- Rationale: Final integration defects appear across boundaries.
- Affected: Test harness, QA checklist.
- Actions:
  - Run full rule scenario suite from locked rule matrix.
  - Run multiplayer soak checks and reconnect stress checks.
  - Run mobile network-throttle checks.
  - Verify MVP checklist alignment with [POOPYHEAD_IMPLEMENTATION_PLAN.txt](../planning/POOPYHEAD_IMPLEMENTATION_PLAN.txt).
- Validation:
  - All critical scenarios pass with no blocking defects.
- Stop condition: MVP release candidate accepted.

### Dependencies
1. Step 1 must finish before Steps 2 through 6.
2. Step 2 is required before Steps 4 through 9.
3. Step 3 is required before Steps 4 through 6.
4. Steps 4 through 6 are required before Step 7.
5. Step 7 is required before Steps 8 through 10.
6. Step 11 should start during Step 7 and finish before Step 12.
7. Step 12 is the final gate.

### MVP vs Nice-to-Haves

MVP
1. Lobby create/join.
2. Rule-correct multiplayer turns and pile logic.
3. Real-time synchronized UI updates.
4. Endgame loser detection.
5. Replay in same lobby.
6. Playable-card guidance.
7. Opponent remaining card counts.
8. Leave/disconnect handling.
9. Refresh persistence and reconnect continuity.
10. Mobile-first usability baseline.

Nice-to-Haves
1. Public matchmaking lobbies.
2. Rankings and leaderboard system.
3. Clubs/groups features.
4. Tutorial mode.
5. AI replacement player and timer-expiry auto-move.
6. Spectator mode for finished players.
7. Advanced messaging-style off-page play integrations.

### Assumptions and Ambiguities
1. Assumption: MVP off-page play is handled via PWA notifications, not direct messaging platform gameplay.
2. Ambiguity: Formal algorithm for “best 3 cards” placement is player choice unless specified otherwise.
3. Ambiguity: Exact skip-wrap behavior with stacked 8s and changing active-player set requires explicit test cases.
4. Ambiguity: Source of “most recently Poopyhead” when no historical records exist.
5. Ambiguity: Disconnect abandonment threshold and AI replacement timing are post-MVP unless mandated.

### Rework Risks
1. Rule precedence misunderstandings, especially bomb interactions.
2. Late schema changes affecting both socket payloads and frontend rendering.
3. Identity/reconnect edge cases causing duplicate player binding.
4. Client-only legality hints diverging from server-authoritative validation.
5. Broadcast payload strategy causing performance or sync drift.

### Milestones
1. Foundation complete: Steps 1 through 3.
2. Engine correctness complete: Steps 4 through 6.
3. Multiplayer continuity complete: Steps 7 through 10.
4. Hardened release readiness complete: Steps 11 through 12.
"use strict";
/**
 * Canonical Server State Schema
 *
 * This document defines the authoritative game state structure that both
 * backend and frontend must conform to. All game logic, socket events, and
 * UI state derivation depend on this schema.
 *
 * Version: 1.0 (Step 2: Locked)
 * Last Updated: 2026-04-27
 * Status: Authoritative - Supports all required gameplay states from RULE_CANON.md
 */
// ============================================================================
// VALIDATION STATE REQUIREMENTS
// ============================================================================
/*
 * The canonical state must support the following game scenarios without
 * loss of information or ambiguity:
 *
 * [ ] Setup phase: 2-10 players joining lobby
 * [ ] Deal: Cards dealt to hand, table visible, table blind
 * [ ] Normal play: Player plays card(s), pile updated, hand replenished
 * [ ] Wildcard play: 2/3 played at any time
 * [ ] 7 constraint: Next player forced to play 7-or-under
 * [ ] 8 stacking: Multiple 8s stack, skip count accumulates
 * [ ] Consecutive bomb: 4+ same-value cards trigger bomb
 * [ ] 10 bomb: If enabled, 10 clears pile
 * [ ] Pickup (hand): Hand card fails pile, must pickup
 * [ ] Pickup (table): Table face-up fails pile, must pickup + return card
 * [ ] Pickup (blind): Blind card fails pile, must pickup + return blind
 * [ ] Extra turn: After bomb, player plays again (state resets to allow any card)
 * [ ] Blind reveal: All players see blind card even if fails
 * [ ] Player disconnect: Grace period, reconnection, state resync
 * [ ] Player reconnect: Last game reference, current state resync
 * [ ] Game end: 1 player remains with cards (Poopyhead)
 * [ ] Rematch: Same lobby, new game, first player determined by history
 */
// ============================================================================
// SCHEMA SIGN-OFF
// ============================================================================
/*
 * Canonical Server State Status: LOCKED
 * Supports all required gameplay states: Yes
 * Contracts defined for all socket events: Yes
 * Derivations support UI rendering: Yes
 * Ready for Step 3 (Setup and Deal Logic): Yes
 */
//# sourceMappingURL=GAME_STATE_SCHEMA.js.map
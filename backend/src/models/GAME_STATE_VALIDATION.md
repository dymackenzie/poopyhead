# Canonical Server State - Validation Checklist

**Purpose:** Verify that GameState schema supports all required gameplay scenarios.

**Status:** LOCKED - Ready for implementation

---

## Scenario Coverage

### Setup & Initialization
- [x] State can represent lobby creation (setup phase)
- [x] State supports 2-10 players joining
- [x] Player identity fields support guests and authenticated users
- [x] Lobby code stored and accessible
- [x] Creation metadata (createdBy, createdAt) captured

### Deal Logic
- [x] Players array supports multiple players
- [x] Each player has hand, tableCardsVisible, tableCardsBlind zones
- [x] Deck field can store full deck before deal
- [x] Card identity (id, rank, suit, deckIndex) supports multi-deck scenarios
- [x] Deck replenishment path (deck → hand replacement) supported

### Normal Play
- [x] currentPlayerIndex tracks whose turn it is
- [x] playPile tracks cards played in round
- [x] Card.value supports ranking comparison (4-14)
- [x] Turn timing (turnStartedAt) captured
- [x] Play sequence (turnIndex) tracked

### Wildcard Play
- [x] Card.isWildcard flag identifies 2, 3, 10, bomb-eligible cards
- [x] Wildcard play at any time supported (no zone constraint)
- [x] Card.specialType field categorizes special effects

### Special Card Effects
- [x] Card 2 (Reset): Card.specialType = 'reset' captured
- [x] Card 3 (Invisible): Card.specialType = 'invisible' captured
- [x] Card 7 (7-or-under): Card.specialType = 'sevenOrUnder' captured
- [x] Card 8 (Skip): Card.specialType = 'skip' captured
- [x] Card 10 (Bomb): Card.specialType = 'bomb' captured
- [x] activeConstraints.sevenOrUnder tracks 7-constraint state
- [x] activeConstraints.skipCount accumulates stacked 8s
- [x] activeConstraints.sevenCardUnderneath tracks card under 3

### 7 Constraint & Release
- [x] sevenOrUnder boolean indicates active constraint
- [x] Release condition derivable (next player played 7-or-under or wildcard)
- [x] Constraint applies only to next eligible player

### 8 Stacking & Skip Resolution
- [x] skipCount field accumulates multiple 8s
- [x] playOrder field supports turn-order calculation with wrapping
- [x] Direction field (clockwise/counterclockwise) used for wrap calculation
- [x] Skip wrap-around (back to originating player) supported

### Bomb Detection & Resolution
- [x] pileHistory tracks previous plays for consecutive-bomb detection
- [x] pileHistory.cardsPlayed captures cards for run-counting
- [x] pileHistory.bombTriggered flags bomb occurrence
- [x] bombOption flag indicates bomb eligibility for turn
- [x] specialRules.bombEnabled controls 10-bomb availability
- [x] postBomb: Extra turn granted by extra_turn in pileHistory

### Pickup Scenarios
- [x] pileHistory.pickupOccurred tracks reason (handFail/tableFail/blindFail)
- [x] Pickup payload can be reconstructed from state history
- [x] Card played from table stored for Rule 4 penalty (return card to hand)
- [x] Blind cards revealed to all players (pileHistory captures this)

### Constraints & Precedence
- [x] Bomb takes precedence: bombTriggered prevents special-effect application
- [x] Multiple skips wrap correctly using playOrder + direction
- [x] Special card stacking (2+2, 3+3, 8+8) supported via Card[] arrays

### Player Disconnection & Reconnect
- [x] isConnected flag tracks player socket state
- [x] connectedAt timestamp for last connection
- [x] reconnectMetadata.graceEndTime defines grace period
- [x] reconnectMetadata.reconnectDeadline for auto-loss
- [x] gameId persists across disconnect
- [x] Player position preserved for rejoin

### Player State Visibility
- [x] Other players' card counts derivable (hand, tableVisible, tableBlind sizes)
- [x] Current player's hand visible (playableCards in ComputedGameState)
- [x] Table cards visible to all players
- [x] Blind cards NOT visible until played

### Game End
- [x] status field tracks game phase (ended)
- [x] endedAt timestamp recorded
- [x] pileHistory supports final turn reconstruction
- [x] Single remaining player identified as loser
- [x] Player position supports ranking tiebreaker

### Rematch
- [x] All players remain in game object
- [x] Player.poopyheadCount preserved for next first-player determination
- [x] code can be reused or regenerated
- [x] status resets to 'setup' for new game

---

## Computed State Coverage

**ComputedGameState** provides derived information for:

- [x] playableCards: Identifies which cards current player can play (for UI hints)
- [x] topRunCount & topRunValue: Bomb detection (4+ consecutive same-value)
- [x] isBombImminent: UI warning if one more card triggers bomb
- [x] nextPlayerId: Turn hint (accounting for skips)
- [x] playersByCardCount: Opponent visibility (card counts)
- [x] sevenConstraintActive: UI constraint indicator
- [x] bombOptionAvailable: UI bomb hint
- [x] currentPlayer: Convenience reference

---

## Socket Event Coverage

### Client → Server Events
- [x] playCard: Card play with bomb option
- [x] playerReady: Setup phase readiness
- [x] joinLobby: Lobby code, username, user ID
- [x] createLobby: Lobby creation with options
- [x] startGame: Play direction selection
- [x] rejoinGame: Reconnection with session token

### Server → Client Broadcasts
- [x] gameStateUpdated: Full state + computed state
- [x] turnChanged: Current player, timer info
- [x] cardPlayed: Play details, bomb/constraint results
- [x] playerPickedUp: Pickup details and new card count
- [x] playerJoined: New player notification with state
- [x] playerLeft: Disconnection notification
- [x] gameEnded: Final ranking and loser
- [x] playableCardsUpdated: Hints for UI
- [x] bombTriggered: Bomb details
- [x] constraintApplied: Constraint details
- [x] blindCardRevealed: Blind card visibility
- [x] error: Rejection reasons (INVALID_MOVE, NOT_YOUR_TURN, etc.)

---

## Data Consistency Checks

| Check | Supported | Notes |
|-------|-----------|-------|
| Hand + Table + Blind cards all accounted for | | Card IDs tracked across zones |
| Deck card count matches game setup | | deckIndex + rank+suit unique per deck |
| No card duplicates across zones | | Card.id unique globally |
| Player count matches playOrder length | | playOrder array derived from players array |
| currentPlayerIndex within bounds | | Validation required but schema supports |
| Turn sequence history auditable | | pileHistory provides full audit trail |
| Pile state reconstructable from history | | pileHistoryEntry.pileStateAfter captures state |

---

## Edge Cases Handled

| Edge Case | Schema Support | Notes |
|-----------|---|---|
| Multi-deck scenarios (6+ players) | | Card.deckIndex distinguishes decks |
| Wrapping skips (8s loop back to originating player) | | playOrder + direction + currentPlayerIndex |
| Consecutive bombs with mixed card types | | pileHistory tracks exact cards played |
| 3 underneath 2 (both wildcards) | | sevenCardUnderneath in activeConstraints |
| Blind card reveal on failure | | blindCardRevealed event + pileHistory |
| Partial hand during deck depletion | | Hand size can be <4 or <5 after deck empty |
| Player disconnect mid-turn | | isConnected + reconnectMetadata grace period |
| Multiple bombs in one turn (bomb + bomb on extra turn) | | pileHistory tracks each bomb separately |

---

## Implementation Readiness

| Component | Ready | Notes |
|-----------|-------|-------|
| TypeScript interfaces | | All types defined |
| Socket event contracts | | Client and server sides specified |
| Validation fields | | Fields support all rule checks |
| Audit trail | | pileHistory provides full reconstruction |
| Reconnection support | | Identity + grace period + state resync |
| UI derivations | | ComputedGameState supports rendering |

---

## Sign-Off

| Item | Status |
|------|--------|
| All required gameplay scenarios supported | Yes |
| No missing fields | Yes |
| Socket contracts complete | Yes |
| Validation audit trail included | Yes |
| Ready for Step 3 (Setup and Deal Logic) | Yes |

**Validation Approved:** 2026-04-27  
**Validator:** Step 2 Executor  
**Next Step:** Step 3 - Implement Setup and Deal Logic

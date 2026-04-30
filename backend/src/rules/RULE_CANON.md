# Poopyhead Game Rules - Definitive Canon

**Version:** 1.0 (Step 1: Locked)  
**Last Updated:** 2026-04-27  
**Status:** Authoritative - All statements from plan.txt mapped and precedence resolved.

---

## Table of Contents
1. [Card Values & Ranking](#card-values--ranking)
2. [Special Cards & Properties](#special-cards--properties)
3. [Zone Hierarchy & Play Restrictions](#zone-hierarchy--play-restrictions)
4. [Playable Card Rules](#playable-card-rules)
5. [Bomb Rules & Precedence](#bomb-rules--precedence)
6. [Setup & Initialization](#setup--initialization)
7. [Turn Sequence & Outcomes](#turn-sequence--outcomes)
8. [Pickup Rules](#pickup-rules)
9. [Game End Conditions](#game-end-conditions)
10. [Precedence Matrix](#precedence-matrix)

---

## Card Values & Ranking

**Card ranking (lowest to highest):**
- 4 (lowest)
- 5, 6, 7, 8, 9, 10
- J (Jack)
- Q (Queen)
- K (King)
- A (Ace) (highest)

**Deck composition:** Standard 52-card deck (1 of each rank per suit, 4 per rank)

---

## Special Cards & Properties

### Card 2 (Reset Wildcard)
- **Property:** Resets the pile for the next player
- **Effect:** Next player can play any card of any value
- **Wildcard:** Yes—can be played at any time, regardless of pile state
- **Stackable:** Yes—multiple 2s stack
- **Stacking rule:** When multiple 2s are played, each stacks independently; once all 2s are resolved, the pile is reset and the next player can play anything

### Card 3 (Invisible/Skip Own Turn Wildcard)
- **Property:** Acts as "skip your own turn"
- **Mechanism:** Next player must beat the card UNDERNEATH the 3 (the card before the 3 was played)
- **Wildcard:** Yes—can be played at any time, regardless of pile state
- **Stackable:** Yes—multiple 3s stack (each skips the next player's turn in sequence)
- **Effect on pile:** The card under the 3 remains the effective "bottom" for beat-comparison purposes until all 3s are resolved

### Card 7 (Seven-or-Under Constraint)
- **Property:** Forces next player to play a card 7 or under
- **Legal cards under constraint:** 4, 5, 6, 7, and wildcard cards (2, 3)
- **Wildcard:** No—must be played in sequence (cannot jump in during a 7 constraint)
- **Stackable:** No—cannot stack multiple 7s
- **Release condition:** After next player plays a legal 7-or-under card, the constraint is lifted and the pile returns to normal beat rules (equal or higher)
- **Special case:** If a player plays a 2 or 3 under a 7 constraint, the 7 constraint remains in effect for the next eligible player

### Card 8 (Skip)
- **Property:** Skips the next player's turn
- **Wildcard:** No—must be played in sequence
- **Stackable:** Yes—multiple 8s stack (N consecutive 8s skip N players)
- **Wrap behavior:** If skips wrap around to include the player who played the 8, that player is also skipped
- **Effect on pile:** Pile remains unchanged; only turn order is affected

### Card 10 (Bomb) - OPTIONAL
- **Availability:** Only if `bombEnabled: true` in lobby settings
- **Property:** Removes the entire playing pile; grants the player another turn
- **Effect:** Player must then replenish hand, then plays again against an empty pile (can play anything)
- **Wildcard:** Yes—can be played at any time
- **Stackable:** Yes—multiple 10s can be played; each 10 clears the pile independently
- **Precedence:** Overrides all special card effects if both could apply

### Consecutive Value Bomb (4+ Consecutive Same Value) - MANDATORY
- **Trigger:** When 4 or more cards of the same rank sit consecutively on top of the pile
- **Timing:** Bomb is triggered when the 4th consecutive card (or more) is placed
- **Player:** The player who plays the 4th (or subsequent) card triggers the bomb
- **Not required to be originating player:** Any player can contribute to a consecutive bomb; they do not have to be the player who started the run
- **Effect:** Entire pile is removed; triggering player gets another turn
- **Turn sequence:** Before taking the extra turn, player must replenish hand to the proper size
- **Precedence:** Overrides all special card effects (e.g., four 8s in a row trigger a bomb, not 4 skips)
- **Wildcard claim:** Yes—counts as a wildcard, so can be played at any time

---

## Zone Hierarchy & Play Restrictions

**Player card zones (in order of play priority):**

### Zone 1: Hand
- Cards drawn from deck
- Player plays from hand first
- Once hand is empty, player plays from table

### Zone 2: Table Face-Up
- 3 cards chosen by player during setup
- Only playable when hand is empty
- Cannot play blind card underneath until the face-up card above is played first

### Zone 3: Blind Cards
- 3 cards placed face-down during setup
- Only revealed when played
- Cannot be played until all face-up table cards are played
- When played, card is revealed to all players (even if it fails the pile)

---

## Playable Card Rules

### Rule 1: Source Zone Priority
- Always play from hand first
- Only play from table face-up when hand is empty
- Only play blind cards when all table face-up cards are played

### Rule 2: Deck Replenishment
- After playing a card from hand, immediately draw 1 card from deck to restore hand size
- Continue until deck runs out
- Once deck is empty, no further replenishment

### Rule 3: Pile Beat Requirement
- Card must equal or exceed the top card of the pile in value
- Exception: Wildcard cards (2, 3, 10, bomb) can be played at any time
- Exception: 7 constraint forces next player to play 7 or under (see Card 7 rule)

### Rule 4: Stacking Same Value
- Player may play multiple cards of identical rank in one action
- Limitation (Rule 5): Face-up table cards of the same value cannot be stacked together; must be played one by one

### Rule 5: Face-Up Table Stacking Restriction
- If player has the same face-up card on their table on multiple piles, they cannot stack these cards in one action
- Example: Player has two 5s face-up on table; can only play one 5 per turn
- Applies only to face-up cards, not hand or blind cards

---

## Bomb Rules & Precedence

### Bomb Triggers
1. **10 Bomb (Optional):** Player plays a 10; clears pile, grants extra turn
2. **Consecutive Bomb (Mandatory):** 4+ consecutive same-value cards on pile; clears pile, grants extra turn to the player who added the 4th card

### Bomb Resolution Precedence
**Precedence Rule: Bomb resolution OVERRIDES all special card effects.**

- If 4 or more 8s are stacked consecutively, this is a **consecutive bomb**, NOT 4 skips
- If 4 or more 2s are stacked, this is a **consecutive bomb**, clearing the pile (not 4 resets in a row)
- If a 10 is played, the pile is cleared immediately (if 10-bomb is enabled)

### Post-Bomb Sequence
1. Bomb is triggered (pile cleared)
2. Triggering player replenishes hand to current hand size
3. Triggering player plays again against empty pile (can play anything)
4. If triggering player cannot play (e.g., new hand after replenish is all higher than minimum playable), they draw until they have a playable card or exhaust the deck

---

## Setup & Initialization

### Player Count & Deck Scaling
- **Standard:** 1 deck per game (52 cards + 2 jokers if needed)
- **Scaling rule:** Every time player count exceeds a multiple of 5, add another deck
  - 2-5 players: 1 deck
  - 6-10 players: 2 decks
  - 11-15 players: 3 decks
  - etc.

### Hand Size Rules
- **If player count is a multiple of 5 (5, 10, 15, ...):** Deal 4 cards as hand
- **Otherwise:** Deal 5 cards as hand

### Deal Sequence
1. Each player receives 3 blind cards (face-down, in a pile)
2. Each player receives hand cards (4 or 5 depending on player count)
3. Each player selects best 3 cards from their hand to place face-up on top of their 3 blind cards (Table)
4. Each player draws 3 cards from deck to replace the 3 cards placed on table
5. Remaining deck becomes the play deck

### First Player Determination
- **Preferred:** Player who was most recently Poopyhead
- **Fallback (if new game):** Player with most Poopyheads in history
- **Fallback (if no history):** Player with most 4s in starting hand
- **Fallback (all guests):** Random player or player 0

### Play Direction
- Starting player chooses direction: clockwise or counterclockwise
- Direction reversal is NOT a standard rule (no reversal card exists in this variant)

---

## Turn Sequence & Outcomes

### Turn Structure
1. **Turn Start:** Current player examines playable cards from their current zone
2. **Action:** Player plays 1+ card(s) meeting pile-beat or wildcard rules
3. **Replenishment:** If card(s) come from hand, immediately draw replacement card(s)
4. **Bomb Check:** If 4+ consecutive same-value cards on pile, bomb triggers
5. **Turn End:** If bomb triggered, current player takes another turn after replenish. Otherwise, turn passes to next player in sequence

### Bomb Prevention
- No mechanic prevents a player from creating a bomb
- Bomb is not a "defense" mechanism; it is a natural consequence of card play

### Pass Rule
- A player cannot pass or choose not to play
- If player cannot beat the pile and no wildcard is available, player must pick up the pile (Rule 3)

---

## Pickup Rules

### Rule 3: Hand Pickup (Standard Failure)
- **Trigger:** Player cannot play any card from hand that beats the pile (and no wildcard is available)
- **Action:** Player picks up entire pile and adds to hand
- **Replenishment:** Player does not replenish hand immediately; they keep the extra cards
- **Turn passes:** To next player in sequence
- **Table cards unaffected:** Table remains unchanged

### Rule 4: Table Pickup (Face-Up Failure)
- **Trigger:** Player's hand is empty; player plays from table face-up but card does not beat the pile
- **Action:** Player picks up entire pile and adds to hand
- **Additional penalty:** Player must also take the card they just played from their table and add it back to their hand
- **Applies to:** Face-up and blind cards
- **Result:** Player has extra cards in hand plus the failed card

### Blind Card Pickup
- **Trigger:** Player plays a blind card (hand and table are empty) and blind card does not beat pile
- **Mechanics:** Same as Rule 4 table pickup
- **Visibility:** Blind card is revealed to all players before the pickup is applied
- **Result:** Player adds pile + blind card to hand, and cycle returns to hand-play priority

### No Pickup Avoidance
- There is no mechanic to "avoid" picking up (e.g., no wild-card defense once pile is committed)

---

## Game End Conditions

### End Condition: Single Player Remaining
- **Trigger:** When only one player has cards remaining (hand + table + blind)
- **Loser:** The player with remaining cards is designated "Poopyhead"
- **Result:** Game ends; player is added to leaderboard

### Win/Lose Semantics
- **No winners**, only one loser (Poopyhead)
- Remaining players are ranked by elimination order (can be tracked for rematch purposes)

### Rematch / New Game
- Players in lobby can vote to rematch or start a new game
- First player determined by most-recent-Poopyhead or history rule (see Setup section)

---

## Precedence Matrix

| Scenario | Priority | Action | Reasoning |
|----------|----------|--------|-----------|
| Player has wildcard AND pile is unbeatable | Wildcard allowed | Play any card | Wildcard property overrides beat requirement |
| 4+ consecutive same-value on pile AND special card effect (e.g., 8 skip) | Bomb triggers | Bomb resolution, not special effect | Bomb rule explicitly overrides special effects |
| 2 stacked with 3 on pile | Reset then skip | Both apply in order of play | 2 resolves (resets), 3 resolves (next player skips that turn) |
| 7 constraint active AND player has no 7-or-under | Pickup required | Pick up pile | Player cannot beat 7 constraint, must pickup |
| 7 constraint active AND player has 2 or 3 | Wildcard allowed | Play 2 or 3 | Wildcard overrides 7 constraint |
| Blind card fails pile | Penalty pickup | Add blind + pile to hand | Blind cards have same rule as table face-up |
| Multiple bombs possible (10 + consecutive) | First applicable triggers | Likely 10 or consecutive | Evaluate as played; first bomb clears pile |
| Player draws card; deck empty | No replenishment | Player continues with hand | Game continues with reduced deck |
| Player reaches hand size 0 before deck empty | Remain at 0 | No further draws | Hand size threshold respected; still playable from table |

---

## Notes & Clarifications

### Stacking Behavior
- Hand cards of same rank can be stacked in one play action
- Table face-up cards of same rank CANNOT be stacked (must be played one per turn)
- Blind cards are unknown until revealed; stacking rule does not apply

### Replenishment Timing
- Replenishment happens immediately after playing from hand
- Replenishment happens from deck to hand, restoring hand to expected size
- If deck is exhausted, hand remains at reduced size

### Direction & Turn Order
- Turn order is fixed once established (no reversal card mechanic)
- Skip effects modify who receives the next turn, not the direction
- Wrap-around skips (8s) can loop back to the originating player

### Bombs and Extra Turns
- A player can bomb and take another turn, then bomb again on that turn
- Each bomb grants exactly one extra turn before passing to next player

### Idle / Disconnection
- Handled outside rules; refer to multiplayer section
- Rules assume valid player action on every turn

---

## Validation Checklist (for implementation)

- [ ] Card ranking correctly ordered (4 low, A high)
- [ ] Deck creation generates 52 cards (1 per rank/suit)
- [ ] Deck scaling works for 2-15+ players
- [ ] Hand size correctly set (4 for multiple of 5, 5 otherwise)
- [ ] Zone priority enforced (hand → table → blind)
- [ ] 2/3 wildcard logic bypasses pile-beat rules
- [ ] 7 constraint correctly limits next player to 4-7 or 2/3
- [ ] 8 stacking counts and skips N players
- [ ] Consecutive bomb triggers on 4+ same-value
- [ ] Bomb precedence overrides special effects
- [ ] Pickup rule 3 (hand) applies correctly
- [ ] Pickup rule 4 (table) applies correctly with penalty
- [ ] Blind card reveal happens before pickup validation
- [ ] Game end triggers when 1 player has cards
- [ ] Replenishment timing correct (immediately after hand play)
- [ ] Turn passes correctly after normal play or bomb extra-turn

---

## Document Sign-Off

**Rule Canon Status:** LOCKED  
**All plan.txt statements mapped:** Yes  
**No precedence conflicts:** Yes  
**Ready for implementation:** Yes  

This document is the authoritative source for all rule implementation. Any ambiguity discovered during implementation must be resolved by updating this document and re-locking.

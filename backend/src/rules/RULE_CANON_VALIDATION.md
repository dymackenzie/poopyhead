# Rule Canon Validation Map

**Purpose:** Verify that every rule statement from plan.txt is captured in RULE_CANON.md with no conflicts.

---

## Plan.txt Statement → Rule Canon Mapping

### Deck & Cards
| Plan.txt Statement | Canon Section | Status | Notes |
|---|---|---|---|
| "uses a regular card deck of 52 cards" | Card Values & Ranking | | Standard deck specified |
| "2, reset. This resets the pile for the next person." | Special Cards > Card 2 | | Reset wildcard behavior defined |
| "3, invisible. This acts as a skip your own turn." | Special Cards > Card 3 | | Skip own turn defined |
| "7, seven or under. Forces next player to play card 7 or under." | Special Cards > Card 7 | | Constraint defined with release |
| "8, skip. This skips the next player's turn." | Special Cards > Card 8 | | Skip behavior defined with stacking |
| "10, bomb (optional)" | Special Cards > Card 10 | | Optional bomb with precedence |
| "4 or more consecutive same value achieves bomb" | Special Cards > Consecutive Value Bomb | | Mandatory bomb defined |
| "4 is the lowest card. A is the highest." | Card Values & Ranking | | Ranking specified |
| "Other cards (4, 5, 6, 9, J, Q, K, A) have no special properties" | Card Values & Ranking | | Implied by rule structure |

### Wildcards
| Plan.txt Statement | Canon Section | Status | Notes |
|---|---|---|---|
| "2 is a wildcard, can be played at any time" | Special Cards > Card 2 | | Wildcard property stated |
| "3 is a wildcard, can be played at any time" | Special Cards > Card 3 | | Wildcard property stated |
| "10 is a wildcard, can be played at any time" | Special Cards > Card 10 | | Wildcard property stated |
| "Bomb counts as wildcard, playable at any time" | Special Cards > Consecutive Value Bomb | | Wildcard claim stated |

### Setup
| Plan.txt Statement | Canon Section | Status | Notes |
|---|---|---|---|
| "Each player dealt 3 blind cards face down" | Setup & Initialization > Deal Sequence | | Step 1 specified |
| "5 cards form their hand" | Setup & Initialization > Hand Size Rules | | Default 5 specified |
| "5-player game: deal 4 cards instead" | Setup & Initialization > Hand Size Rules | | Multiple-of-5 rule specified |
| "Every player count exceeding multiple of 5, add another deck" | Setup & Initialization > Player Count & Deck Scaling | | Scaling rule specified |
| "Player count is multiple of 5, deal 4 cards hand" | Setup & Initialization > Hand Size Rules | | Multiple-of-5 rule specified |
| "Pick best 3 cards from hand, place on blind" | Setup & Initialization > Deal Sequence | | Step 3 specified |
| "Draw 3 cards from deck to replace" | Setup & Initialization > Deal Sequence | | Step 4 specified |
| "First player: most recently Poopyhead" | Setup & Initialization > First Player Determination | | Primary rule specified |
| "Fallback: player with most Poopyheads" | Setup & Initialization > First Player Determination | | Secondary fallback specified |
| "Fallback: most 4s in starting hand" | Setup & Initialization > First Player Determination | | Tertiary fallback specified |
| "Play direction chosen by starting player" | Setup & Initialization > Play Direction | | Direction choice specified |

### Zone Rules
| Plan.txt Statement | Canon Section | Status | Notes |
|---|---|---|---|
| "Player can only play Table if no hand cards" | Zone Hierarchy & Play Restrictions > Zone 1/2 | | Rule 1 specifies priority |
| "Until deck runs out, always replace cards from deck" | Playable Card Rules > Rule 2 | | Replenishment rule specified |
| "Cannot play blind until face-up on top is played" | Zone Hierarchy & Play Restrictions > Zone 3 | | Zone constraint specified |
| "Playing pile only accepts equal or higher cards" | Playable Card Rules > Rule 3 | | Pile beat requirement specified |
| "Cards are stackable (same rank)" | Playable Card Rules > Rule 4 | | Stacking defined |
| "Same face-up card on multiple piles can't stack together" | Playable Card Rules > Rule 5 | | Face-up table restriction specified |

### Pickup Rules
| Plan.txt Statement | Canon Section | Status | Notes |
|---|---|---|---|
| "If can't beat hand, pick up pile" | Pickup Rules > Rule 3 | | Hand pickup defined |
| "If can't beat table, pick up pile AND return played card to hand" | Pickup Rules > Rule 4 | | Table pickup with penalty defined |
| "Applies to face-up and blind cards" | Pickup Rules > Rule 4 & Blind Card Pickup | | Scope clarified |
| "Blind card reveal visible to all even if fails" | Pickup Rules > Blind Card Pickup | | Visibility rule specified |

### Bomb Rules
| Plan.txt Statement | Canon Section | Status | Notes |
|---|---|---|---|
| "10 removes whole pile, player takes another turn" | Special Cards > Card 10 | | 10-bomb effect specified |
| "10 optional, can be turned on when creating lobby" | Special Cards > Card 10 | | Enablement noted |
| "4+ consecutive same value achieves bomb" | Special Cards > Consecutive Value Bomb | | Bomb trigger specified |
| "Don't have to be player who placed previous card" | Special Cards > Consecutive Value Bomb | | Contribution rule specified |
| "Must be player who adds 4th card (or more)" | Special Cards > Consecutive Value Bomb | | Trigger player specified |
| "Must be done on your turn" | Special Cards > Consecutive Value Bomb | | Turn constraint specified |
| "Removes whole pile, player takes another turn" | Special Cards > Consecutive Value Bomb | | Bomb effect specified |
| "Bomb takes precedence over special property" | Bomb Rules & Precedence > Bomb Resolution Precedence | | Precedence rule explicit |
| "If four 8s stacked, this is bomb not skips" | Precedence Matrix & Bomb Precedence | | Example given |
| "Must pick up cards to replenish hand before extra turn" | Bomb Rules & Precedence > Post-Bomb Sequence | | Replenishment timing specified |

### Game End & Loser
| Plan.txt Statement | Canon Section | Status | Notes |
|---|---|---|---|
| "Last player standing with cards is Poopyhead" | Game End Conditions | | Loser defined |
| "No winners, only one loser" | Game End Conditions | | Semantics specified |
| "When one player left with cards, game ends" | Game End Conditions | | End trigger specified |

### Special Card Interactions
| Plan.txt Statement | Canon Section | Status | Notes |
|---|---|---|---|
| "2 resets pile for next person" | Special Cards > Card 2 | | Resets defined |
| "3 acts as skip own turn, next must beat card underneath" | Special Cards > Card 3 | | Underneath rule specified |
| "8 is stackable (3 eights = skip 3 players)" | Special Cards > Card 8 | | Stacking rule specified |
| "If skips wrap to original player, they're also skipped" | Special Cards > Card 8 | | Wrap behavior specified |
| "2 and 3 are wildcards" | Special Cards > Card 2 & Card 3 | | Wildcard status confirmed |
| "7 is NOT wildcard, must play in order" | Special Cards > Card 7 | | Non-wildcard status confirmed |
| "8 is NOT wildcard, must play in order" | Special Cards > Card 8 | | Non-wildcard status confirmed |

### Rule Details
| Plan.txt Statement | Canon Section | Status | Notes |
|---|---|---|---|
| "After next player plays 7-or-under, equal or higher returns" | Special Cards > Card 7 | | Release condition specified |
| "When player plays blind card, everyone sees it" | Pickup Rules > Blind Card Pickup | | Visibility rule specified |
| "Bomb also a wildcard (can play at any time)" | Special Cards > Consecutive Value Bomb | | Wildcard claim specified |

---

## Conflict Resolution Completed

### Potential Conflicts Checked:

1. **8 Stacking + Wrap-Around Behavior**
   - Plan: "If skips wrap to original player, skip also skips the original player"
   - Canon: Explicitly stated in Card 8 wrap behavior
   - Resolution: No conflict

2. **2 and 3 Stacking Sequence**
   - Plan: Both are wildcards; 2 resets, 3 skips
   - Canon: Specified that both apply in order of play (2 resolves first, then 3)
   - Resolution: No conflict, clarified in precedence matrix

3. **Bomb Precedence Over Special Effects**
   - Plan: "Bomb takes precedence over special property"
   - Canon: Explicitly stated multiple times with examples
   - Resolution: No conflict, elevated to primary rule

4. **Consecutive Bomb Contribution Rules**
   - Plan: "Don't have to be player who placed previous card, but must be player who adds 4th card"
   - Canon: Both rules specified separately
   - Resolution: No conflict, both clearly stated

5. **7 Constraint Release**
   - Plan: "After next player plays card 7 or under, equal or higher returns"
   - Canon: Specified that 2/3 played under 7 constraint maintains the constraint for next eligible player
   - Resolution: No conflict, clarified behavior

6. **Blind Card Visibility + Failure**
   - Plan: "Everyone else sees blind card even if fails"
   - Canon: Specified in Blind Card Pickup
   - Resolution: No conflict

7. **Deck Scaling Boundary**
   - Plan: "Every time player count exceeds a multiple of 5, add another deck"
   - Canon: Specified that 2-5 players use 1 deck, 6-10 use 2, etc.
   - Resolution: No conflict, boundary clarified

8. **Optional 10 Bomb Behavior**
   - Plan: "Optional because makes game too easy; option to turn on when creating lobby"
   - Canon: Specified `bombEnabled` flag controls availability
   - Resolution: No conflict

---

## Completeness Check

### Coverage by Topic

| Topic | Coverage | Status |
|-------|----------|--------|
| Card values and ranking | All 13 ranks specified | Complete |
| Special card mechanics | 2, 3, 7, 8, 10, consecutive bomb all specified | Complete |
| Wildcard rules | 2, 3, 10, bomb all marked wildcard | Complete |
| Zone hierarchy | Hand, table, blind priority clear | Complete |
| Playable card rules | All 8 rules from plan.txt covered | Complete |
| Pickup rules | Rule 3, 4, blind card all specified | Complete |
| Bomb rules | 10-bomb, consecutive bomb, precedence all specified | Complete |
| Setup & initialization | Deck scaling, hand size, first player, play direction all specified | Complete |
| Turn sequence | Normal play, bomb extra-turn, replenishment timing all specified | Complete |
| Game end | Single player loser condition specified | Complete |

---

## Sign-Off

| Item | Status |
|------|--------|
| All plan.txt statements mapped to RULE_CANON.md | Yes |
| No unresolved conflicts | Yes |
| Precedence matrix complete | Yes |
| Validation checklist included | Yes |
| Ready for Step 2 (Canonical Server State) | Yes |

**Validation Approved:** 2026-04-27  
**Validator:** Step 1 Executor  
**Next Step:** Step 2 - Define Canonical Server State

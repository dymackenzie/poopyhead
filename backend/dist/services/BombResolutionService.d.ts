/**
 * Bomb Resolution Service
 *
 * Handles bomb mechanics according to RULE_CANON:
 * - 10-bomb (optional): Clears pile, grants extra turn
 * - Consecutive bomb (mandatory): 4+ same-value cards clear pile, grants extra turn
 * - PRECEDENCE RULE: Bomb resolution overrides all special card effects
 *
 * Post-bomb sequence:
 * 1. Bomb is triggered (pile cleared)
 * 2. Triggering player replenishes hand to proper size
 * 3. Triggering player plays again against empty pile
 */
import { Card } from './DeckService';
export interface BombDetectionInput {
    cardsPlayed: Card[];
    pileBeforePlay: Card[];
    pileAfterPlay: Card[];
    bombEnabled: boolean;
}
export interface BombResolution {
    bombTriggered: boolean;
    bombType?: 'tenBomb' | 'consecutiveBomb';
    clearedPile: boolean;
    extraTurnGranted: boolean;
    extraTurnPlayerId: string;
}
/**
 * Determines if a bomb has been triggered and what type.
 * RULE_CANON: "Bomb also a wildcard... [can be played] at any time"
 *
 * Precedence check:
 * 1. Check for 10-bomb (if bombEnabled)
 * 2. Check for consecutive bomb (4+ same value)
 * 3. Apply bomb PRECEDENCE: if both could apply, bomb resolution overrides special effects
 */
export declare function detectBomb(input: BombDetectionInput): BombResolution;
/**
 * Determines the consequence of a bomb trigger.
 * RULE_CANON precedence: "Bomb takes precedence over special property"
 *
 * Example: "If four 8s are played, this is a Bomb, NOT four skips"
 * Example: "If four 2s are played, this is a Bomb, NOT four resets"
 */
export interface BombPrecedenceContext {
    bombTriggered: boolean;
    bombType?: 'tenBomb' | 'consecutiveBomb';
    constraintFromCards?: 'reset' | 'sevenOrUnder' | 'skip' | 'invisible';
    specialCardOnTop?: Card;
}
export interface BombPrecedenceResult {
    appliedBomb: boolean;
    appliedConstraint: boolean;
    constraintType?: string;
    pileCleared: boolean;
    extraTurnGranted: boolean;
    explanation: string;
}
export declare function evaluateBombPrecedence(context: BombPrecedenceContext): BombPrecedenceResult;
/**
 * Handles post-bomb replenishment.
 * RULE_CANON: "When the player plays a Bomb of any sort, they must pick up
 * cards to replenish their hand before playing their turn again."
 */
export interface BombReplenishmentInput {
    playerHand: Card[];
    expectedHandSize: number;
    deck: Card[];
}
export interface BombReplenishmentOutput {
    replenishedHand: Card[];
    cardsDrawn: Card[];
    remainingDeck: Card[];
    needsToPlayAgain: boolean;
}
export declare function replenishHandAfterBomb(input: BombReplenishmentInput): BombReplenishmentOutput;
/**
 * Checks if a card can be played against an empty pile (after bomb).
 * RULE_CANON: "This player now plays against an empty pile, meaning they can
 * play whatever they want."
 */
export declare function canPlayAgainstEmptyPile(card: Card, pile: Card[]): boolean;
/**
 * Special case: If player cannot play after replenishment, they draw until
 * they can or exhaust deck.
 */
export interface ContinuedDrawInput {
    playerHand: Card[];
    deck: Card[];
    pile: Card[];
}
export interface ContinuedDrawOutput {
    finalHand: Card[];
    cardsDrawn: Card[];
    remainingDeck: Card[];
    canPlay: boolean;
}
export declare function continuedDrawUntilPlayable(input: ContinuedDrawInput): ContinuedDrawOutput;
/**
 * Validates that a bomb has correctly cleared the pile and granted extra turn.
 * Used in testing to ensure bomb mechanics are correct.
 */
export declare function validateBombOutcome(bombTriggered: boolean, pileAfterBomb: Card[], extraTurnGranted: boolean): {
    valid: boolean;
    reason?: string;
};
//# sourceMappingURL=BombResolutionService.d.ts.map
/**
 * Move Validator Service
 *
 * Validates card plays according to RULE_CANON.
 * Checks turn ownership, card ownership, zone priority, pile legality, and special effects.
 *
 * This is the primary correctness boundary for the game engine.
 */
import { Card } from './DeckService';
export interface ValidationContext {
    playerId: string;
    cardIds: string[];
    playerHand: Card[];
    playerTableVisible: Card[];
    playerTableBlind: Card[];
    currentPile: Card[];
    isPlayerTurn: boolean;
    activeConstraints: {
        sevenOrUnder: boolean;
        skipCount: number;
    };
}
export interface ValidationResult {
    valid: boolean;
    reason?: string;
    cardsToPlay?: Card[];
    sourceZone?: 'hand' | 'table' | 'blind';
}
/**
 * Primary validation function.
 * Performs all legal-move checks in order.
 */
export declare function validateMove(context: ValidationContext): ValidationResult;
/**
 * Checks if the top of the pile has 4+ consecutive same-value cards.
 * Returns count and whether bomb triggers.
 */
export declare function checkConsecutiveBomb(pile: Card[]): {
    isBomb: boolean;
    runCount: number;
};
/**
 * Evaluates what constraint (if any) should be applied after the play.
 */
export interface ConstraintEvaluation {
    constraint?: 'reset' | 'sevenOrUnder' | 'skip' | 'invisible' | 'bomb';
    skipCount?: number;
    cardUnderneath?: Card;
}
export declare function evaluateConstraint(cardsPlayed: Card[], oldPile: Card[], newPile: Card[]): ConstraintEvaluation;
/**
 * Determines pickup requirement if player cannot play.
 */
export declare function evaluatePickup(playerHand: Card[], playerTableVisible: Card[], playerTableBlind: Card[], currentPile: Card[], activeConstraints: {
    sevenOrUnder: boolean;
}): 'none' | 'hand' | 'table' | 'blind';
//# sourceMappingURL=MoveValidatorService.d.ts.map
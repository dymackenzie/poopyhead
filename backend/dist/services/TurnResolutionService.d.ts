/**
 * Turn Resolution Service
 *
 * Handles the outcome of a valid card play:
 * - Updates pile state
 * - Applies constraints (reset, 7-or-under, skip, bomb)
 * - Determines next turn or extra turn
 * - Returns new game state deltas
 */
import { Card } from './DeckService';
import { ConstraintEvaluation } from './MoveValidatorService';
export interface TurnResolutionInput {
    playerId: string;
    cardsPlayed: Card[];
    sourceZone: 'hand' | 'table' | 'blind';
    currentPile: Card[];
    currentPlayerIndex: number;
    playerCount: number;
    playOrder: string[];
    direction: 'clockwise' | 'counterclockwise';
    activeConstraints: {
        sevenOrUnder: boolean;
        skipCount: number;
    };
    bombEnabled: boolean;
}
export interface TurnResolutionOutput {
    newPile: Card[];
    nextPlayerIndex: number;
    nextPlayerId: string;
    extraTurn: boolean;
    extraTurnGrantedBy: string;
    constraintApplied: ConstraintEvaluation;
    bombTriggered: boolean;
    bombType?: '10-bomb' | 'consecutive-bomb';
    newConstraints: {
        sevenOrUnder: boolean;
        skipCount: number;
        cardUnderneath?: Card;
    };
}
/**
 * Resolves a turn: applies card play, determines next player, applies constraints.
 */
export declare function resolveTurn(input: TurnResolutionInput): TurnResolutionOutput;
/**
 * Determines if a player can play any card (for bomb extra-turn).
 */
export declare function canPlayAnyCard(pile: Card[]): boolean;
/**
 * After bomb resolution, player must replenish hand before extra turn.
 * This function calculates how many cards player needs to draw.
 */
export declare function calculateReplenishmentNeeded(playerHand: Card[], expectedHandSize: number): number;
//# sourceMappingURL=TurnResolutionService.d.ts.map
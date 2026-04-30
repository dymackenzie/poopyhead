/**
 * Pickup & Zone Transition Service
 *
 * Handles pickup scenarios according to RULE_CANON:
 * - Rule 3: Hand pickup (standard failure)
 * - Rule 4: Table pickup (face-up failure) with penalty
 * - Blind card pickup with visibility to all players
 * - Zone transitions (hand → table → blind)
 * - Game end condition (1 player remaining)
 */
import { Card } from './DeckService';
export type PickupReason = 'handFail' | 'tableFail' | 'blindFail';
/**
 * Determines if a player must pick up based on their zones and ability to play.
 */
export interface PickupCheckInput {
    playerHand: Card[];
    playerTableVisible: Card[];
    playerTableBlind: Card[];
    currentPile: Card[];
    activeConstraints: {
        sevenOrUnder: boolean;
        skipCount: number;
        cardUnderneath?: Card;
    };
}
export interface PickupCheckOutput {
    mustPickup: boolean;
    reason?: PickupReason;
    explanation: string;
}
/**
 * Determines if player must pick up based on RULE_CANON.
 * Checks zones in order: hand → table → blind.
 */
export declare function checkPickupRequired(input: PickupCheckInput): PickupCheckOutput;
/**
 * Resolves pickup outcome based on which zone card was played from.
 */
export interface PickupResolutionInput {
    playedCard: Card;
    sourceZone: 'hand' | 'table' | 'blind';
    currentPile: Card[];
    playerHand: Card[];
    playerTableVisible: Card[];
    playerTableBlind: Card[];
}
export interface PickupResolutionOutput {
    pickupRequired: boolean;
    reason?: PickupReason;
    cardsPickedUp: Card[];
    penaltyCard?: Card;
    newHand: Card[];
    newTableVisible: Card[];
    newTableBlind: Card[];
    explanation: string;
}
/**
 * Resolves what happens when a card play fails to beat pile.
 *
 * RULE_CANON:
 * - Rule 3: Hand failure → pick up pile only
 * - Rule 4: Table failure → pick up pile + return played card to hand
 * - Blind failure → pick up pile + return blind card to hand
 */
export declare function resolvePickup(input: PickupResolutionInput): PickupResolutionOutput;
/**
 * Determines if blind card should be revealed to all players.
 * RULE_CANON: "When a player plays a blind card, everyone else sees what the
 * blind card was, even if the blind card doesn't beat the playing pile."
 */
export interface BlindCardRevealInput {
    blindCard: Card;
    wasPlayed: boolean;
    wasPickedUp: boolean;
}
export interface BlindCardRevealOutput {
    reveal: boolean;
    visibleToAll: boolean;
    explanation: string;
}
export declare function shouldRevealBlindCard(input: BlindCardRevealInput): BlindCardRevealOutput;
/**
 * Zone transition: When player plays all face-up table cards, they can now play blind.
 * RULE_CANON: "The player cannot play their blind cards until the face-up card on
 * top is played."
 */
export interface ZoneTransitionCheckInput {
    playerHand: Card[];
    playerTableVisible: Card[];
    playerTableBlind: Card[];
}
export interface ZoneTransitionOutput {
    activeZone: 'hand' | 'table' | 'blind' | 'none';
    canPlayFrom: ('hand' | 'table' | 'blind')[];
    explanation: string;
}
export declare function determineActiveZone(input: ZoneTransitionCheckInput): ZoneTransitionOutput;
/**
 * Game end condition: One player left with cards.
 * RULE_CANON: "The last player standing with cards remaining is Poopyhead."
 */
export interface GameEndCheckInput {
    players: Array<{
        playerId: string;
        username: string;
        handCount: number;
        tableVisibleCount: number;
        tableBlindCount: number;
    }>;
}
export interface GameEndCheckOutput {
    gameEnded: boolean;
    loserId?: string;
    loserUsername?: string;
    playersWithCards: number;
    explanation: string;
}
export declare function checkGameEnd(input: GameEndCheckInput): GameEndCheckOutput;
/**
 * Tracks elimination order for final rankings.
 */
export interface EliminationRecord {
    playerId: string;
    username: string;
    eliminatedAtRank: number;
}
export declare function recordElimination(playerId: string, username: string, currentEliminationOrder: EliminationRecord[]): EliminationRecord;
//# sourceMappingURL=PickupService.d.ts.map
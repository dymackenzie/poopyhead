/**
 * Deal Service
 *
 * Handles game setup: dealing cards, determining first player, initializing game state.
 * Follows RULE_CANON: Hand size rules, deal sequence, first-player determination.
 */
import { Card } from './DeckService';
/**
 * Determines hand size based on player count.
 * RULE_CANON: "If player count is a multiple of 5, deal 4 cards. Otherwise, deal 5 cards."
 */
export declare function calculateHandSize(playerCount: number): number;
/**
 * Result of the deal sequence.
 */
export interface DealResult {
    playerHands: Card[][];
    playerTables: Card[][];
    playerTableVisible: Card[][];
    playerTableBlind: Card[][];
    remainingDeck: Card[];
    handSize: number;
}
/**
 * Executes full deal sequence:
 * 1. Deal 3 blind cards to each player
 * 2. Deal hand cards (4 or 5 based on player count)
 * 3. Player selects best 3 from hand (this is player choice via UI—we expose those cards separately)
 * 4. Return result with remaining deck
 */
export declare function dealGame(deck: Card[], playerCount: number): DealResult;
/**
 * Player selection info for first-player determination.
 */
export interface PlayerSelectionInfo {
    playerId: string;
    username: string;
    fourCountInHand: number;
    poopyheadCount: number;
    isGuest: boolean;
}
/**
 * Determines first player based on RULE_CANON precedence:
 * 1. Player who was most recently Poopyhead (not applicable for new game)
 * 2. Player with most Poopyheads in history
 * 3. Player with most 4s in starting hand
 * 4. (Fallback) First player in list / random
 */
export declare function determineFirstPlayer(players: PlayerSelectionInfo[]): {
    playerId: string;
    reason: string;
};
/**
 * Counts 4s in a hand (for first-player tiebreaker).
 */
export declare function countFoursInHand(hand: Card[]): number;
//# sourceMappingURL=DealService.d.ts.map
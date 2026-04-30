/**
 * Deck Service
 *
 * Handles deck creation, shuffling, and multi-deck scaling.
 * Follows RULE_CANON: Deck scaling by player count, proper card representation.
 */
export type Rank = '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2' | '3';
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export interface Card {
    id: string;
    rank: Rank;
    suit: Suit;
    deckIndex: number;
    value: number;
    isWildcard: boolean;
    isSpecial: boolean;
    specialType?: 'reset' | 'invisible' | 'sevenOrUnder' | 'skip' | 'bomb';
}
/**
 * Determines number of decks needed based on player count.
 * RULE_CANON: "Every time player count exceeds a multiple of 5, add another deck"
 *
 * 2-5 players: 1 deck
 * 6-10 players: 2 decks
 * 11-15 players: 3 decks
 * etc.
 */
export declare function calculateDeckCount(playerCount: number): number;
/**
 * Creates full deck for game based on player count.
 * Shuffles using Fisher-Yates for uniform random distribution.
 */
export declare function createDeck(playerCount: number): Card[];
/**
 * Fisher-Yates shuffle algorithm.
 * Ensures uniform random distribution.
 */
export declare function shuffle(cards: Card[]): Card[];
/**
 * Draws N cards from deck.
 * Mutates deck array by removing cards.
 * Returns cards in order drawn.
 */
export declare function drawCards(deck: Card[], count: number): Card[];
/**
 * Counts occurrences of specific rank in hand.
 * Used for first-player tiebreaker (most 4s in starting hand).
 */
export declare function countRankInHand(hand: Card[], rank: Rank): number;
/**
 * Card comparison for beat validation.
 * Returns true if card beats previous (value >= previous value).
 * Special cards (wildcards) have no inherent beat value.
 */
export declare function cardBeats(card: Card, previousCard: Card): boolean;
//# sourceMappingURL=DeckService.d.ts.map
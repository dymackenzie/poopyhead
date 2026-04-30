/**
 * Deck Service
 *
 * Handles deck creation, shuffling, and multi-deck scaling.
 * Follows RULE_CANON: Deck scaling by player count, proper card representation.
 */
import { v4 as uuid } from 'uuid';
const RANK_ORDER = ['4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '3'];
const SUIT_ORDER = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANK_VALUES = {
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
    'J': 11,
    'Q': 12,
    'K': 13,
    'A': 14,
    '2': 2,
    '3': 3,
};
const SPECIAL_CARD_TYPES = {
    '2': 'reset',
    '3': 'invisible',
    '7': 'sevenOrUnder',
    '8': 'skip',
    '10': 'bomb',
    '4': null,
    '5': null,
    '6': null,
    '9': null,
    'J': null,
    'Q': null,
    'K': null,
    'A': null,
};
/**
 * Determines number of decks needed based on player count.
 * RULE_CANON: "Every time player count exceeds a multiple of 5, add another deck"
 *
 * 2-5 players: 1 deck
 * 6-10 players: 2 decks
 * 11-15 players: 3 decks
 * etc.
 */
export function calculateDeckCount(playerCount) {
    if (playerCount < 2)
        throw new Error('Player count must be at least 2');
    if (playerCount > 100)
        throw new Error('Player count must be 100 or fewer');
    // Formula: Math.ceil(playerCount / 5) = number of full or partial groups of 5
    return Math.ceil(playerCount / 5);
}
/**
 * Creates a single standard 52-card deck.
 * Cards are created in rank order for deterministic shuffling.
 */
function createSingleDeck(deckIndex) {
    const deck = [];
    for (const rank of RANK_ORDER) {
        for (const suit of SUIT_ORDER) {
            const value = RANK_VALUES[rank];
            const specialType = SPECIAL_CARD_TYPES[rank];
            const isSpecial = specialType !== null;
            const isWildcard = ['2', '3', '10'].includes(rank);
            deck.push({
                id: uuid(),
                rank,
                suit,
                deckIndex,
                value,
                isWildcard,
                isSpecial,
                specialType: specialType || undefined,
            });
        }
    }
    return deck;
}
/**
 * Creates full deck for game based on player count.
 * Shuffles using Fisher-Yates for uniform random distribution.
 */
export function createDeck(playerCount) {
    const deckCount = calculateDeckCount(playerCount);
    const allCards = [];
    // Create multiple decks
    for (let i = 0; i < deckCount; i++) {
        allCards.push(...createSingleDeck(i));
    }
    // Fisher-Yates shuffle
    return shuffle(allCards);
}
/**
 * Fisher-Yates shuffle algorithm.
 * Ensures uniform random distribution.
 */
export function shuffle(cards) {
    const deck = [...cards];
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}
/**
 * Draws N cards from deck.
 * Mutates deck array by removing cards.
 * Returns cards in order drawn.
 */
export function drawCards(deck, count) {
    if (deck.length < count) {
        throw new Error(`Cannot draw ${count} cards from deck with ${deck.length} cards`);
    }
    return deck.splice(0, count);
}
/**
 * Counts occurrences of specific rank in hand.
 * Used for first-player tiebreaker (most 4s in starting hand).
 */
export function countRankInHand(hand, rank) {
    return hand.filter(c => c.rank === rank).length;
}
/**
 * Card comparison for beat validation.
 * Returns true if card beats previous (value >= previous value).
 * Special cards (wildcards) have no inherent beat value.
 */
export function cardBeats(card, previousCard) {
    if (card.isWildcard)
        return true;
    if (previousCard.isWildcard)
        return true; // Cannot compare to wildcard
    return card.value >= previousCard.value;
}
//# sourceMappingURL=DeckService.js.map
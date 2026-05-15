/**
 * Deck Service
 * 
 * Handles deck creation, shuffling, and multi-deck scaling.
 * Follows RULE_CANON: Deck scaling by player count, proper card representation.
 */

import { v4 as uuid } from 'uuid';

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

const RANK_ORDER: Rank[] = ['4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '3'];
const SUIT_ORDER: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

const RANK_VALUES: Record<Rank, number> = {
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

const SPECIAL_CARD_TYPES: Record<Rank, 'reset' | 'invisible' | 'sevenOrUnder' | 'skip' | 'bomb' | null> = {
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
export function calculateDeckCount(playerCount: number): number {
  if (playerCount < 2) throw new Error('Player count must be at least 2');
  if (playerCount > 100) throw new Error('Player count must be 100 or fewer');
  
  // Formula: Math.ceil(playerCount / 5) = number of full or partial groups of 5
  return Math.ceil(playerCount / 5);
}

/**
 * Creates a single standard 52-card deck.
 * Cards are created in rank order for deterministic shuffling.
 */
function createSingleDeck(deckIndex: number): Card[] {
  const deck: Card[] = [];
  
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
export function createDeck(playerCount: number): Card[] {
  const deckCount = calculateDeckCount(playerCount);
  const allCards: Card[] = [];
  
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
export function shuffle(cards: Card[]): Card[] {
  const deck = [...cards];
  
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  return deck;
}


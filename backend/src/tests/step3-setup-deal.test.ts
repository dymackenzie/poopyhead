/**
 * Setup & Deal Logic Tests
 * 
 * Validates RULE_CANON requirements:
 * - Deck scaling by player count
 * - Hand size rules
 * - Deal sequence
 * - First player determination
 */

import { describe, expect, it } from 'vitest';
import {
  calculateDeckCount,
  createDeck,
  drawCards,
  countRankInHand,
  shuffle,
} from '../services/DeckService';
import {
  calculateHandSize,
  dealGame,
  determineFirstPlayer,
  countFoursInHand,
  PlayerSelectionInfo,
} from '../services/DealService';

describe('Step 3: Setup and Deal Logic', () => {
  
  describe('Deck Scaling (RULE_CANON)', () => {
    it('should require 1 deck for 2-5 players', () => {
      for (let p = 2; p <= 5; p++) {
        expect(calculateDeckCount(p)).toBe(1);
      }
    });
    
    it('should require 2 decks for 6-10 players', () => {
      for (let p = 6; p <= 10; p++) {
        expect(calculateDeckCount(p)).toBe(2);
      }
    });
    
    it('should require 3 decks for 11-15 players', () => {
      for (let p = 11; p <= 15; p++) {
        expect(calculateDeckCount(p)).toBe(3);
      }
    });
    
    it('should throw for invalid player counts', () => {
      expect(() => calculateDeckCount(0)).toThrow();
      expect(() => calculateDeckCount(1)).toThrow();
      expect(() => calculateDeckCount(101)).toThrow();
    });
  });
  
  describe('Deck Creation', () => {
    it('should create correct number of cards for 1 deck', () => {
      const deck = createDeck(2);
      expect(deck.length).toBe(52);
    });
    
    it('should create correct number of cards for 2 decks', () => {
      const deck = createDeck(6);
      expect(deck.length).toBe(104);
    });
    
    it('should have unique card IDs', () => {
      const deck = createDeck(2);
      const ids = new Set(deck.map(c => c.id));
      expect(ids.size).toBe(deck.length);
    });
    
    it('should have correct special card types', () => {
      const deck = createDeck(2);
      
      const twos = deck.filter(c => c.rank === '2');
      expect(twos.every(c => c.specialType === 'reset')).toBe(true);
      expect(twos.every(c => c.isWildcard)).toBe(true);
      
      const threes = deck.filter(c => c.rank === '3');
      expect(threes.every(c => c.specialType === 'invisible')).toBe(true);
      expect(threes.every(c => c.isWildcard)).toBe(true);
      
      const sevens = deck.filter(c => c.rank === '7');
      expect(sevens.every(c => c.specialType === 'sevenOrUnder')).toBe(true);
      expect(sevens.every(c => !c.isWildcard)).toBe(true);
      
      const eights = deck.filter(c => c.rank === '8');
      expect(eights.every(c => c.specialType === 'skip')).toBe(true);
      expect(eights.every(c => !c.isWildcard)).toBe(true);
      
      const tens = deck.filter(c => c.rank === '10');
      expect(tens.every(c => c.specialType === 'bomb')).toBe(true);
      expect(tens.every(c => c.isWildcard)).toBe(true);
    });
    
    it('should shuffle deck (not in original order)', () => {
      const deck1 = createDeck(2);
      const deck2 = createDeck(2);
      
      // Very unlikely to get same order twice (p < 10^-50)
      const same = deck1.every((c, i) => c.id === deck2[i].id);
      expect(same).toBe(false);
    });
  });
  
  describe('Hand Size Rules (RULE_CANON)', () => {
    it('should deal 4 cards for multiple of 5 players', () => {
      expect(calculateHandSize(5)).toBe(4);
      expect(calculateHandSize(10)).toBe(4);
      expect(calculateHandSize(15)).toBe(4);
    });
    
    it('should deal 5 cards for non-multiple of 5 players', () => {
      expect(calculateHandSize(2)).toBe(5);
      expect(calculateHandSize(3)).toBe(5);
      expect(calculateHandSize(4)).toBe(5);
      expect(calculateHandSize(6)).toBe(5);
      expect(calculateHandSize(7)).toBe(5);
      expect(calculateHandSize(8)).toBe(5);
      expect(calculateHandSize(9)).toBe(5);
      expect(calculateHandSize(11)).toBe(5);
    });
  });
  
  describe('Deal Sequence', () => {
    it('should deal correct cards for 2-player game (5-card hand)', () => {
      const deck = createDeck(2);
      const result = dealGame(deck, 2);

      // Each player is dealt 5 hand cards; the first 3 become their face-up table
      // cards and are removed from the hand.  Final hand = 5 - 3 = 2 cards.
      expect(result.playerHands.length).toBe(2);
      expect(result.playerHands[0].length).toBe(2);
      expect(result.playerHands[1].length).toBe(2);

      expect(result.playerTableVisible.length).toBe(2);
      expect(result.playerTableVisible[0].length).toBe(3);
      expect(result.playerTableVisible[1].length).toBe(3);

      expect(result.playerTableBlind.length).toBe(2);
      expect(result.playerTableBlind[0].length).toBe(3);
      expect(result.playerTableBlind[1].length).toBe(3);

      // Cards consumed per player: 5 hand + 3 blind = 8.  2 players = 16 total.
      // Remaining: 52 - 16 = 36.  Hand and tableVisible share no card IDs.
      expect(result.remainingDeck.length).toBe(36);
      expect(result.handSize).toBe(5);

      // Verify no card ID appears in both hand and tableVisible for any player
      for (let i = 0; i < 2; i++) {
        const handIds = new Set(result.playerHands[i].map(c => c.id));
        const visibleIds = result.playerTableVisible[i].map(c => c.id);
        expect(visibleIds.every(id => !handIds.has(id))).toBe(true);
      }
    });
    
    it('should deal correct cards for 5-player game (4-card hand)', () => {
      const deck = createDeck(5);
      const result = dealGame(deck, 5);

      expect(result.playerHands.length).toBe(5);
      // 4 dealt - 3 moved to tableVisible = 1 remaining in hand
      expect(result.playerHands.every(h => h.length === 1)).toBe(true);
      expect(result.handSize).toBe(4);

      // Cards consumed per player: 4 hand + 3 blind = 7.  5 players = 35 total.
      // Remaining: 52 - 35 = 17
      expect(result.remainingDeck.length).toBe(17);
    });

    it('should deal correct cards for 10-player game (2 decks, 4-card hand)', () => {
      const deck = createDeck(10);
      expect(deck.length).toBe(104);

      const result = dealGame(deck, 10);

      expect(result.playerHands.length).toBe(10);
      // 4 dealt - 3 moved to tableVisible = 1 remaining in hand
      expect(result.playerHands.every(h => h.length === 1)).toBe(true);
      expect(result.handSize).toBe(4);

      // Cards consumed per player: 4 hand + 3 blind = 7.  10 players = 70 total.
      // Remaining: 104 - 70 = 34
      expect(result.remainingDeck.length).toBe(34);
    });
    
    it('should not allow deal with insufficient cards', () => {
      // Create deck but with not enough cards
      const smallDeck = Array(10).fill({
        id: '1',
        rank: '4' as const,
        suit: 'hearts' as const,
        deckIndex: 0,
        value: 4,
        isWildcard: false,
        isSpecial: false,
      });
      
      expect(() => dealGame(smallDeck, 5)).toThrow();
    });
  });
  
  describe('First Player Determination', () => {
    it('should select player with most Poopyheads', () => {
      const players: PlayerSelectionInfo[] = [
        { playerId: 'p1', username: 'Alice', fourCountInHand: 1, poopyheadCount: 2, isGuest: false },
        { playerId: 'p2', username: 'Bob', fourCountInHand: 1, poopyheadCount: 5, isGuest: false },
        { playerId: 'p3', username: 'Charlie', fourCountInHand: 1, poopyheadCount: 3, isGuest: false },
      ];
      
      const result = determineFirstPlayer(players);
      expect(result.playerId).toBe('p2');
    });
    
    it('should tiebreak most Poopyheads with most 4s in hand', () => {
      const players: PlayerSelectionInfo[] = [
        { playerId: 'p1', username: 'Alice', fourCountInHand: 2, poopyheadCount: 5, isGuest: false },
        { playerId: 'p2', username: 'Bob', fourCountInHand: 4, poopyheadCount: 5, isGuest: false },
        { playerId: 'p3', username: 'Charlie', fourCountInHand: 1, poopyheadCount: 5, isGuest: false },
      ];
      
      const result = determineFirstPlayer(players);
      expect(result.playerId).toBe('p2');
    });
    
    it('should use most 4s in hand if no Poopyheads', () => {
      const players: PlayerSelectionInfo[] = [
        { playerId: 'p1', username: 'Alice', fourCountInHand: 1, poopyheadCount: 0, isGuest: false },
        { playerId: 'p2', username: 'Bob', fourCountInHand: 3, poopyheadCount: 0, isGuest: false },
        { playerId: 'p3', username: 'Charlie', fourCountInHand: 2, poopyheadCount: 0, isGuest: false },
      ];
      
      const result = determineFirstPlayer(players);
      expect(result.playerId).toBe('p2');
    });
    
    it('should select first player if tie on all criteria', () => {
      const players: PlayerSelectionInfo[] = [
        { playerId: 'p1', username: 'Alice', fourCountInHand: 1, poopyheadCount: 0, isGuest: false },
        { playerId: 'p2', username: 'Bob', fourCountInHand: 1, poopyheadCount: 0, isGuest: false },
        { playerId: 'p3', username: 'Charlie', fourCountInHand: 1, poopyheadCount: 0, isGuest: false },
      ];
      
      const result = determineFirstPlayer(players);
      expect(['p1', 'p2', 'p3']).toContain(result.playerId);
    });
  });
  
  describe('Card Utilities', () => {
    it('should count 4s in hand correctly', () => {
      const hand = [
        { rank: '4' as const, suit: 'hearts' as const, id: '1', deckIndex: 0, value: 4, isWildcard: false, isSpecial: false },
        { rank: '4' as const, suit: 'diamonds' as const, id: '2', deckIndex: 0, value: 4, isWildcard: false, isSpecial: false },
        { rank: '5' as const, suit: 'clubs' as const, id: '3', deckIndex: 0, value: 5, isWildcard: false, isSpecial: false },
        { rank: '4' as const, suit: 'spades' as const, id: '4', deckIndex: 0, value: 4, isWildcard: false, isSpecial: false },
      ];
      
      expect(countFoursInHand(hand)).toBe(3);
    });
  });
  
});

describe('Step 3 Validation Checklist', () => {
  it('should pass all setup scenarios', () => {
    // Scenario: 2-player game
    const scenario2 = dealGame(createDeck(2), 2);
    expect(scenario2.playerHands.length).toBe(2);
    expect(scenario2.playerTableVisible.length).toBe(2);
    
    // Scenario: 5-player game
    const scenario5 = dealGame(createDeck(5), 5);
    expect(scenario5.playerHands.length).toBe(5);
    expect(scenario5.handSize).toBe(4);
    
    // Scenario: 10-player game (2 decks)
    const scenario10 = dealGame(createDeck(10), 10);
    expect(scenario10.playerHands.length).toBe(10);
  });
});

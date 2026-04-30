/**
 * Bomb Resolution Tests
 * 
 * Validates RULE_CANON bomb mechanics:
 * - 10-bomb (optional) clears pile, grants extra turn
 * - Consecutive bomb (4+ same-value) clears pile, grants extra turn
 * - PRECEDENCE: Bomb overrides all special effects
 * - Post-bomb sequence: Replenish → Extra turn against empty pile
 */

import { describe, expect, it } from 'vitest';
import {
  detectBomb,
  evaluateBombPrecedence,
  replenishHandAfterBomb,
  validateBombOutcome,
} from '../services/BombResolutionService';

describe('Step 5: Bomb Resolution and Precedence', () => {
  
  // Helper to create test cards
  const createCard = (rank: string, suit: string = 'hearts', id: string = 'c1') => ({
    id,
    rank: rank as any,
    suit: suit as any,
    deckIndex: 0,
    value: { '4': 4, '5': 5, '7': 7, '8': 8, '10': 10, 'A': 14, '2': 2, '3': 3 }[rank] as number,
    isWildcard: ['2', '3', '10'].includes(rank),
    isSpecial: ['2', '3', '7', '8', '10'].includes(rank),
    specialType: { '2': 'reset', '3': 'invisible', '7': 'sevenOrUnder', '8': 'skip', '10': 'bomb' }[rank] as any,
  });
  
  describe('10-Bomb Detection (Optional)', () => {
    it('should detect 10-bomb when enabled', () => {
      const result = detectBomb({
        cardsPlayed: [createCard('10')],
        pileBeforePlay: [createCard('7')],
        pileAfterPlay: [createCard('7'), createCard('10')],
        bombEnabled: true,
      });
      
      expect(result.bombTriggered).toBe(true);
      expect(result.bombType).toBe('tenBomb');
      expect(result.clearedPile).toBe(true);
      expect(result.extraTurnGranted).toBe(true);
    });
    
    it('should not detect 10-bomb when disabled', () => {
      const result = detectBomb({
        cardsPlayed: [createCard('10')],
        pileBeforePlay: [createCard('7')],
        pileAfterPlay: [createCard('7'), createCard('10')],
        bombEnabled: false,
      });
      
      expect(result.bombTriggered).toBe(false);
      expect(result.bombType).toBeUndefined();
    });
  });
  
  describe('Consecutive Bomb Detection (Mandatory)', () => {
    it('should not detect bomb with 3 consecutive cards', () => {
      const result = detectBomb({
        cardsPlayed: [createCard('5')],
        pileBeforePlay: [
          createCard('5', 'hearts', 'c1'),
          createCard('5', 'diamonds', 'c2'),
        ],
        pileAfterPlay: [
          createCard('5', 'hearts', 'c1'),
          createCard('5', 'diamonds', 'c2'),
          createCard('5', 'clubs', 'c3'),
        ],
        bombEnabled: false,
      });
      
      expect(result.bombTriggered).toBe(false);
    });
    
    it('should detect bomb with exactly 4 consecutive cards', () => {
      const result = detectBomb({
        cardsPlayed: [createCard('5')],
        pileBeforePlay: [
          createCard('5', 'hearts', 'c1'),
          createCard('5', 'diamonds', 'c2'),
          createCard('5', 'clubs', 'c3'),
        ],
        pileAfterPlay: [
          createCard('5', 'hearts', 'c1'),
          createCard('5', 'diamonds', 'c2'),
          createCard('5', 'clubs', 'c3'),
          createCard('5', 'spades', 'c4'),
        ],
        bombEnabled: false,
      });
      
      expect(result.bombTriggered).toBe(true);
      expect(result.bombType).toBe('consecutiveBomb');
    });
    
    it('should detect bomb with 5+ consecutive cards', () => {
      const result = detectBomb({
        cardsPlayed: [createCard('7', 'diamonds', 'c4'), createCard('7', 'clubs', 'c5')],
        pileBeforePlay: [
          createCard('7', 'hearts', 'c1'),
          createCard('7', 'spades', 'c2'),
          createCard('7', 'hearts', 'c3'),
        ],
        pileAfterPlay: [
          createCard('7', 'hearts', 'c1'),
          createCard('7', 'spades', 'c2'),
          createCard('7', 'hearts', 'c3'),
          createCard('7', 'diamonds', 'c4'),
          createCard('7', 'clubs', 'c5'),
        ],
        bombEnabled: false,
      });
      
      expect(result.bombTriggered).toBe(true);
      expect(result.bombType).toBe('consecutiveBomb');
    });
  });
  
  describe('PRECEDENCE: Bomb Overrides Special Effects', () => {
    it('should trigger bomb instead of 4 skips (4 eights)', () => {
      const result = evaluateBombPrecedence({
        bombTriggered: true,
        bombType: 'consecutiveBomb',
        constraintFromCards: 'skip',
        specialCardOnTop: createCard('8'),
      });
      
      expect(result.appliedBomb).toBe(true);
      expect(result.appliedConstraint).toBe(false);
      expect(result.pileCleared).toBe(true);
      expect(result.extraTurnGranted).toBe(true);
    });
    
    it('should trigger bomb instead of 4 resets (4 twos)', () => {
      const result = evaluateBombPrecedence({
        bombTriggered: true,
        bombType: 'consecutiveBomb',
        constraintFromCards: 'reset',
        specialCardOnTop: createCard('2'),
      });
      
      expect(result.appliedBomb).toBe(true);
      expect(result.appliedConstraint).toBe(false);
      expect(result.pileCleared).toBe(true);
    });
    
    it('should trigger bomb instead of 4 invisibles (4 threes)', () => {
      const result = evaluateBombPrecedence({
        bombTriggered: true,
        bombType: 'consecutiveBomb',
        constraintFromCards: 'invisible',
        specialCardOnTop: createCard('3'),
      });
      
      expect(result.appliedBomb).toBe(true);
      expect(result.appliedConstraint).toBe(false);
      expect(result.pileCleared).toBe(true);
    });
    
    it('should apply constraint when no bomb', () => {
      const result = evaluateBombPrecedence({
        bombTriggered: false,
        constraintFromCards: 'skip',
        specialCardOnTop: createCard('8'),
      });
      
      expect(result.appliedBomb).toBe(false);
      expect(result.appliedConstraint).toBe(true);
      expect(result.constraintType).toBe('skip');
      expect(result.pileCleared).toBe(false);
    });
  });
  
  describe('Post-Bomb Sequence: Replenishment', () => {
    it('should replenish hand to expected size', () => {
      const deck = [
        createCard('7', 'hearts', 'c1'),
        createCard('8', 'diamonds', 'c2'),
        createCard('9', 'clubs', 'c3'),
      ];
      
      const hand = [createCard('2')];
      
      const result = replenishHandAfterBomb({
        playerHand: hand,
        expectedHandSize: 5,
        deck,
      });
      
      expect(result.replenishedHand.length).toBe(4); // 1 + 3 drawn
      expect(result.cardsDrawn.length).toBe(3);
      expect(result.remainingDeck.length).toBe(0);
      expect(result.needsToPlayAgain).toBe(true);
    });
    
    it('should not replenish if already at expected size', () => {
      const deck = [createCard('7', 'hearts', 'c1')];
      
      const hand = [
        createCard('2'),
        createCard('3'),
        createCard('4'),
        createCard('5'),
        createCard('6'),
      ];
      
      const result = replenishHandAfterBomb({
        playerHand: hand,
        expectedHandSize: 5,
        deck,
      });
      
      expect(result.replenishedHand.length).toBe(5);
      expect(result.cardsDrawn.length).toBe(0);
      expect(result.remainingDeck.length).toBe(1);
    });
    
    it('should handle deck depletion during replenishment', () => {
      const deck = [createCard('7', 'hearts', 'c1')]; // Only 1 card left
      
      const hand = [createCard('2')];
      
      const result = replenishHandAfterBomb({
        playerHand: hand,
        expectedHandSize: 5,
        deck,
      });
      
      expect(result.replenishedHand.length).toBe(2); // 1 + 1 drawn
      expect(result.cardsDrawn.length).toBe(1);
      expect(result.remainingDeck.length).toBe(0);
    });
  });
  
  describe('Post-Bomb Sequence: Extra Turn Against Empty Pile', () => {
    it('should validate bomb outcome (pile cleared + extra turn)', () => {
      const valid = validateBombOutcome(
        true, // bombTriggered
        [], // emptyPile
        true // extraTurnGranted
      );
      
      expect(valid.valid).toBe(true);
    });
    
    it('should reject if bomb did not clear pile', () => {
      const invalid = validateBombOutcome(
        true,
        [createCard('5')], // pile not cleared
        true
      );
      
      expect(invalid.valid).toBe(false);
      expect(invalid.reason).toContain('pile');
    });
    
    it('should reject if bomb did not grant extra turn', () => {
      const invalid = validateBombOutcome(
        true,
        [],
        false // extraTurnGranted = false
      );
      
      expect(invalid.valid).toBe(false);
      expect(invalid.reason).toContain('extra turn');
    });
    
    it('should pass if no bomb', () => {
      const valid = validateBombOutcome(
        false,
        [createCard('5')],
        false
      );
      
      expect(valid.valid).toBe(true);
    });
  });
  
  describe('Consecutive Bomb Contribution Rules', () => {
    it('should detect bomb regardless of who contributed previous cards', () => {
      // Pile has 3 fives from different players
      // Player 4 adds the 4th five
      // Bomb still triggers for player 4
      const result = detectBomb({
        cardsPlayed: [createCard('5', 'spades', 'c4')],
        pileBeforePlay: [
          createCard('5', 'hearts', 'c1'),
          createCard('5', 'diamonds', 'c2'),
          createCard('5', 'clubs', 'c3'),
        ],
        pileAfterPlay: [
          createCard('5', 'hearts', 'c1'),
          createCard('5', 'diamonds', 'c2'),
          createCard('5', 'clubs', 'c3'),
          createCard('5', 'spades', 'c4'),
        ],
        bombEnabled: false,
      });
      
      expect(result.bombTriggered).toBe(true);
      expect(result.bombType).toBe('consecutiveBomb');
    });
  });
  
  describe('Step 5 Validation Checklist', () => {
    it('should correctly resolve all bomb scenarios', () => {
      // Scenario 1: 10-bomb when enabled
      const bomb10 = detectBomb({
        cardsPlayed: [createCard('10')],
        pileBeforePlay: [createCard('A')],
        pileAfterPlay: [createCard('A'), createCard('10')],
        bombEnabled: true,
      });
      expect(bomb10.bombTriggered).toBe(true);
      expect(bomb10.bombType).toBe('tenBomb');
      
      // Scenario 2: Consecutive bomb overrides 10 disabled
      const consec = detectBomb({
        cardsPlayed: [createCard('7')],
        pileBeforePlay: [
          createCard('7', 'hearts', 'c1'),
          createCard('7', 'diamonds', 'c2'),
          createCard('7', 'clubs', 'c3'),
        ],
        pileAfterPlay: [
          createCard('7', 'hearts', 'c1'),
          createCard('7', 'diamonds', 'c2'),
          createCard('7', 'clubs', 'c3'),
          createCard('7', 'spades', 'c4'),
        ],
        bombEnabled: false,
      });
      expect(consec.bombTriggered).toBe(true);
      expect(consec.bombType).toBe('consecutiveBomb');
    });
  });
  
});

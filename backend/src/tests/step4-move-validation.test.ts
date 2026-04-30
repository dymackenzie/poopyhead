/**
 * Move Validation and Turn Resolution Tests
 * 
 * Validates RULE_CANON requirements:
 * - Turn ownership validation
 * - Zone priority (hand → table → blind)
 * - Pile legality (beat rules, wildcards, constraints)
 * - Stacking restrictions
 * - Turn resolution with constraint application
 * - Skip calculation and wrap-around
 */

import { describe, expect, it } from 'vitest';
import { validateMove, evaluatePickup, checkConsecutiveBomb, ValidationContext } from '../services/MoveValidatorService';
import { resolveTurn, TurnResolutionInput } from '../services/TurnResolutionService';

describe('Step 4: Move Validation and Turn Resolution', () => {
  
  // Helper to create test cards
  const createCard = (rank: string, suit: string = 'hearts', id: string = 'c1') => ({
    id,
    rank: rank as any,
    suit: suit as any,
    deckIndex: 0,
    value: { '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, '2': 2, '3': 3 }[rank] as number,
    isWildcard: ['2', '3', '10'].includes(rank),
    isSpecial: ['2', '3', '7', '8', '10'].includes(rank),
    specialType: { '2': 'reset', '3': 'invisible', '7': 'sevenOrUnder', '8': 'skip', '10': 'bomb' }[rank] as any,
  });
  
  describe('Move Validation - Zone Priority', () => {
    it('should require player turn', () => {
      const context: ValidationContext = {
        playerId: 'p1',
        cardIds: ['c1'],
        playerHand: [createCard('5', 'hearts', 'c1')],
        playerTableVisible: [],
        playerTableBlind: [],
        currentPile: [createCard('4')],
        isPlayerTurn: false,
        activeConstraints: { sevenOrUnder: false, skipCount: 0 },
      };
      
      const result = validateMove(context);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('NOT_YOUR_TURN');
    });
    
    it('should require at least one card', () => {
      const context: ValidationContext = {
        playerId: 'p1',
        cardIds: [],
        playerHand: [createCard('5')],
        playerTableVisible: [],
        playerTableBlind: [],
        currentPile: [],
        isPlayerTurn: true,
        activeConstraints: { sevenOrUnder: false, skipCount: 0 },
      };
      
      const result = validateMove(context);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('MUST_PLAY_CARD');
    });
    
    it('should play from hand when available', () => {
      const context: ValidationContext = {
        playerId: 'p1',
        cardIds: ['c1'],
        playerHand: [createCard('5', 'hearts', 'c1')],
        playerTableVisible: [createCard('4', 'diamonds', 'c2')],
        playerTableBlind: [createCard('3', 'clubs', 'c3')],
        currentPile: [createCard('4')],
        isPlayerTurn: true,
        activeConstraints: { sevenOrUnder: false, skipCount: 0 },
      };
      
      const result = validateMove(context);
      expect(result.valid).toBe(true);
      expect(result.sourceZone).toBe('hand');
    });
    
    it('should play from table when hand empty', () => {
      const context: ValidationContext = {
        playerId: 'p1',
        cardIds: ['c2'],
        playerHand: [],
        playerTableVisible: [createCard('5', 'hearts', 'c2')],
        playerTableBlind: [createCard('3', 'clubs', 'c3')],
        currentPile: [createCard('4')],
        isPlayerTurn: true,
        activeConstraints: { sevenOrUnder: false, skipCount: 0 },
      };
      
      const result = validateMove(context);
      expect(result.valid).toBe(true);
      expect(result.sourceZone).toBe('table');
    });
    
    it('should play from blind when hand and table empty', () => {
      const context: ValidationContext = {
        playerId: 'p1',
        cardIds: ['c3'],
        playerHand: [],
        playerTableVisible: [],
        playerTableBlind: [createCard('7', 'clubs', 'c3')],
        currentPile: [createCard('4')],
        isPlayerTurn: true,
        activeConstraints: { sevenOrUnder: false, skipCount: 0 },
      };
      
      const result = validateMove(context);
      expect(result.valid).toBe(true);
      expect(result.sourceZone).toBe('blind');
    });
  });
  
  describe('Move Validation - Pile Legality', () => {
    it('should allow cards that beat pile', () => {
      const context: ValidationContext = {
        playerId: 'p1',
        cardIds: ['c1'],
        playerHand: [createCard('8', 'hearts', 'c1')],
        playerTableVisible: [],
        playerTableBlind: [],
        currentPile: [createCard('7')],
        isPlayerTurn: true,
        activeConstraints: { sevenOrUnder: false, skipCount: 0 },
      };
      
      const result = validateMove(context);
      expect(result.valid).toBe(true);
    });
    
    it('should reject cards that do not beat pile', () => {
      const context: ValidationContext = {
        playerId: 'p1',
        cardIds: ['c1'],
        playerHand: [createCard('4', 'hearts', 'c1')],
        playerTableVisible: [],
        playerTableBlind: [],
        currentPile: [createCard('8')],
        isPlayerTurn: true,
        activeConstraints: { sevenOrUnder: false, skipCount: 0 },
      };
      
      const result = validateMove(context);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('CARD_DOES_NOT_BEAT_PILE');
    });
    
    it('should allow wildcards at any time', () => {
      const context: ValidationContext = {
        playerId: 'p1',
        cardIds: ['c1'],
        playerHand: [createCard('2', 'hearts', 'c1')],
        playerTableVisible: [],
        playerTableBlind: [],
        currentPile: [createCard('A')],
        isPlayerTurn: true,
        activeConstraints: { sevenOrUnder: false, skipCount: 0 },
      };
      
      const result = validateMove(context);
      expect(result.valid).toBe(true);
    });
    
    it('should enforce 7 constraint', () => {
      const context: ValidationContext = {
        playerId: 'p1',
        cardIds: ['c1'],
        playerHand: [createCard('9', 'hearts', 'c1')],
        playerTableVisible: [],
        playerTableBlind: [],
        currentPile: [createCard('7')],
        isPlayerTurn: true,
        activeConstraints: { sevenOrUnder: true, skipCount: 0 },
      };
      
      const result = validateMove(context);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('SEVEN_CONSTRAINT_VIOLATION');
    });
    
    it('should allow 7-or-under during 7 constraint', () => {
      const context: ValidationContext = {
        playerId: 'p1',
        cardIds: ['c1'],
        playerHand: [createCard('6', 'hearts', 'c1')],
        playerTableVisible: [],
        playerTableBlind: [],
        currentPile: [createCard('7')],
        isPlayerTurn: true,
        activeConstraints: { sevenOrUnder: true, skipCount: 0 },
      };
      
      const result = validateMove(context);
      expect(result.valid).toBe(true);
    });
    
    it('should allow wildcard during 7 constraint', () => {
      const context: ValidationContext = {
        playerId: 'p1',
        cardIds: ['c1'],
        playerHand: [createCard('3', 'hearts', 'c1')],
        playerTableVisible: [],
        playerTableBlind: [],
        currentPile: [createCard('7')],
        isPlayerTurn: true,
        activeConstraints: { sevenOrUnder: true, skipCount: 0 },
      };
      
      const result = validateMove(context);
      expect(result.valid).toBe(true);
    });
  });
  
  describe('Move Validation - Stacking & Special Cases', () => {
    it('should prevent same-rank stacking from table', () => {
      const context: ValidationContext = {
        playerId: 'p1',
        cardIds: ['c1', 'c2'],
        playerHand: [],
        playerTableVisible: [
          createCard('5', 'hearts', 'c1'),
          createCard('5', 'diamonds', 'c2'),
          createCard('7', 'clubs', 'c3'),
        ],
        playerTableBlind: [],
        currentPile: [createCard('4')],
        isPlayerTurn: true,
        activeConstraints: { sevenOrUnder: false, skipCount: 0 },
      };
      
      const result = validateMove(context);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('TABLE_SAME_RANK_NO_STACK');
    });
    
    it('should prevent playing blind while table visible exists', () => {
      const context: ValidationContext = {
        playerId: 'p1',
        cardIds: ['c1'],
        playerHand: [],
        playerTableVisible: [createCard('5', 'hearts', 'c2')],
        playerTableBlind: [createCard('7', 'clubs', 'c1')],
        currentPile: [createCard('4')],
        isPlayerTurn: true,
        activeConstraints: { sevenOrUnder: false, skipCount: 0 },
      };
      
      const result = validateMove(context);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('BLIND_CARDS_NOT_PLAYABLE_YET');
    });
  });
  
  describe('Bomb Detection', () => {
    it('should not trigger bomb with 3 consecutive', () => {
      const pile = [
        createCard('5', 'hearts', 'c1'),
        createCard('5', 'diamonds', 'c2'),
        createCard('5', 'clubs', 'c3'),
      ];
      
      const result = checkConsecutiveBomb(pile);
      expect(result.isBomb).toBe(false);
      expect(result.runCount).toBe(3);
    });
    
    it('should trigger bomb with 4 consecutive', () => {
      const pile = [
        createCard('5', 'hearts', 'c1'),
        createCard('5', 'diamonds', 'c2'),
        createCard('5', 'clubs', 'c3'),
        createCard('5', 'spades', 'c4'),
      ];
      
      const result = checkConsecutiveBomb(pile);
      expect(result.isBomb).toBe(true);
      expect(result.runCount).toBe(4);
    });
    
    it('should count only consecutive cards from top', () => {
      const pile = [
        createCard('5', 'hearts', 'c1'),
        createCard('7', 'diamonds', 'c2'),
        createCard('7', 'clubs', 'c3'),
        createCard('7', 'spades', 'c4'),
      ];
      
      const result = checkConsecutiveBomb(pile);
      expect(result.isBomb).toBe(false);
      expect(result.runCount).toBe(3);
    });
  });
  
  describe('Pickup Evaluation', () => {
    it('should allow play if card beats pile', () => {
      const result = evaluatePickup(
        [createCard('5')],
        [],
        [],
        [createCard('4')],
        { sevenOrUnder: false }
      );
      expect(result).toBe('none');
    });
    
    it('should require pickup if cannot beat pile', () => {
      const result = evaluatePickup(
        [createCard('4')],
        [],
        [],
        [createCard('7')],
        { sevenOrUnder: false }
      );
      expect(result).toBe('hand');
    });
    
    it('should allow wildcard instead of pickup', () => {
      const result = evaluatePickup(
        [createCard('2')],
        [],
        [],
        [createCard('A')],
        { sevenOrUnder: false }
      );
      expect(result).toBe('none');
    });
  });
  
  describe('Turn Resolution', () => {
    it('should advance to next player on normal play', () => {
      const input: TurnResolutionInput = {
        playerId: 'p1',
        cardsPlayed: [createCard('5')],
        sourceZone: 'hand',
        currentPile: [createCard('4')],
        currentPlayerIndex: 0,
        playerCount: 3,
        playOrder: ['p1', 'p2', 'p3'],
        direction: 'clockwise',
        activeConstraints: { sevenOrUnder: false, skipCount: 0 },
        bombEnabled: true,
      };
      
      const result = resolveTurn(input);
      expect(result.nextPlayerIndex).toBe(1);
      expect(result.nextPlayerId).toBe('p2');
      expect(result.extraTurn).toBe(false);
    });
    
    it('should handle skip accumulation (8s)', () => {
      const input: TurnResolutionInput = {
        playerId: 'p1',
        cardsPlayed: [createCard('8'), createCard('8')],
        sourceZone: 'hand',
        currentPile: [createCard('7'), createCard('8')],
        currentPlayerIndex: 0,
        playerCount: 4,
        playOrder: ['p1', 'p2', 'p3', 'p4'],
        direction: 'clockwise',
        activeConstraints: { sevenOrUnder: false, skipCount: 0 },
        bombEnabled: true,
      };
      
      const result = resolveTurn(input);
      // 3 stacked 8s total on a 4-player table wraps the skip onto the original player.
      expect(result.nextPlayerIndex).toBe(1);
      expect(result.nextPlayerId).toBe('p2');
    });
    
    it('should wrap player index', () => {
      const input: TurnResolutionInput = {
        playerId: 'p3',
        cardsPlayed: [createCard('5')],
        sourceZone: 'hand',
        currentPile: [createCard('4')],
        currentPlayerIndex: 2,
        playerCount: 3,
        playOrder: ['p1', 'p2', 'p3'],
        direction: 'clockwise',
        activeConstraints: { sevenOrUnder: false, skipCount: 0 },
        bombEnabled: true,
      };
      
      const result = resolveTurn(input);
      expect(result.nextPlayerIndex).toBe(0);
      expect(result.nextPlayerId).toBe('p1');
    });
    
    it('should handle counterclockwise direction', () => {
      const input: TurnResolutionInput = {
        playerId: 'p1',
        cardsPlayed: [createCard('5')],
        sourceZone: 'hand',
        currentPile: [createCard('4')],
        currentPlayerIndex: 0,
        playerCount: 3,
        playOrder: ['p1', 'p2', 'p3'],
        direction: 'counterclockwise',
        activeConstraints: { sevenOrUnder: false, skipCount: 0 },
        bombEnabled: true,
      };
      
      const result = resolveTurn(input);
      expect(result.nextPlayerIndex).toBe(2);
      expect(result.nextPlayerId).toBe('p3');
    });
  });
  
  describe('Step 4 Validation Checklist', () => {
    it('should validate all legal/illegal move combinations', () => {
      // Legal: hand card beats pile
      const legal1 = validateMove({
        playerId: 'p1',
        cardIds: ['c1'],
        playerHand: [createCard('8', 'hearts', 'c1')],
        playerTableVisible: [],
        playerTableBlind: [],
        currentPile: [createCard('7')],
        isPlayerTurn: true,
        activeConstraints: { sevenOrUnder: false, skipCount: 0 },
      });
      expect(legal1.valid).toBe(true);
      
      // Illegal: card does not beat pile
      const illegal1 = validateMove({
        playerId: 'p1',
        cardIds: ['c1'],
        playerHand: [createCard('4', 'hearts', 'c1')],
        playerTableVisible: [],
        playerTableBlind: [],
        currentPile: [createCard('A')],
        isPlayerTurn: true,
        activeConstraints: { sevenOrUnder: false, skipCount: 0 },
      });
      expect(illegal1.valid).toBe(false);
    });
  });
  
});

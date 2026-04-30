/**
 * Pickup & Zone Transition Tests
 * 
 * Validates RULE_CANON requirements:
 * - Rule 3: Hand pickup (no penalty)
 * - Rule 4: Table pickup (with penalty)
 * - Blind pickup (with visibility)
 * - Zone transitions (hand → table → blind)
 * - Game end condition (1 player left)
 */

import { describe, expect, it } from 'vitest';
import {
  checkPickupRequired,
  resolvePickup,
  shouldRevealBlindCard,
  determineActiveZone,
  checkGameEnd,
  recordElimination,
  type EliminationRecord,
} from '../services/PickupService';

describe('Step 6: Pickup, Zone Transitions, and Endgame', () => {
  
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
  
  describe('Pickup Check - Rule 3 (Hand Failure)', () => {
    it('should require pickup if no hand cards beat pile', () => {
      const result = checkPickupRequired({
        playerHand: [createCard('4'), createCard('5')],
        playerTableVisible: [],
        playerTableBlind: [],
        currentPile: [createCard('A')],
        activeConstraints: { sevenOrUnder: false, skipCount: 0 },
      });
      
      expect(result.mustPickup).toBe(true);
      expect(result.reason).toBe('handFail');
    });
    
    it('should not require pickup if hand card beats pile', () => {
      const result = checkPickupRequired({
        playerHand: [createCard('4'), createCard('K')],
        playerTableVisible: [],
        playerTableBlind: [],
        currentPile: [createCard('5')],
        activeConstraints: { sevenOrUnder: false, skipCount: 0 },
      });
      
      expect(result.mustPickup).toBe(false);
    });
    
    it('should allow wildcard to beat pile', () => {
      const result = checkPickupRequired({
        playerHand: [createCard('2')],
        playerTableVisible: [],
        playerTableBlind: [],
        currentPile: [createCard('A')],
        activeConstraints: { sevenOrUnder: false, skipCount: 0 },
      });
      
      expect(result.mustPickup).toBe(false);
    });
    
    it('should enforce 7-constraint in pickup check', () => {
      const result = checkPickupRequired({
        playerHand: [createCard('8'), createCard('9')],
        playerTableVisible: [],
        playerTableBlind: [],
        currentPile: [createCard('7')],
        activeConstraints: { sevenOrUnder: true, skipCount: 0 },
      });
      
      expect(result.mustPickup).toBe(true);
      expect(result.reason).toBe('handFail');
    });
    
    it('should allow 7-or-under when constraint active', () => {
      const result = checkPickupRequired({
        playerHand: [createCard('6')],
        playerTableVisible: [],
        playerTableBlind: [],
        currentPile: [createCard('7')],
        activeConstraints: { sevenOrUnder: true, skipCount: 0 },
      });
      
      expect(result.mustPickup).toBe(false);
    });
  });
  
  describe('Pickup Resolution - Rule 3 (Hand)', () => {
    it('should resolve hand pickup without penalty', () => {
      const result = resolvePickup({
        playedCard: createCard('4', 'hearts', 'c1'),
        sourceZone: 'hand',
        currentPile: [createCard('7'), createCard('A')],
        playerHand: [createCard('4', 'hearts', 'c1')],
        playerTableVisible: [],
        playerTableBlind: [],
      });
      
      expect(result.pickupRequired).toBe(true);
      expect(result.reason).toBe('handFail');
      expect(result.cardsPickedUp.length).toBe(2);
      expect(result.penaltyCard).toBeUndefined();
      expect(result.newHand.length).toBe(3); // 1 + pile (2 cards)
    });
  });
  
  describe('Pickup Resolution - Rule 4 (Table)', () => {
    it('should resolve table pickup with penalty (return card to hand)', () => {
      const playedCard = createCard('5', 'hearts', 'c1');
      
      const result = resolvePickup({
        playedCard,
        sourceZone: 'table',
        currentPile: [createCard('7'), createCard('A')],
        playerHand: [createCard('2')],
        playerTableVisible: [playedCard],
        playerTableBlind: [],
      });
      
      expect(result.pickupRequired).toBe(true);
      expect(result.reason).toBe('tableFail');
      expect(result.cardsPickedUp.length).toBe(2);
      expect(result.penaltyCard).toEqual(playedCard);
      expect(result.newHand.length).toBe(4); // 1 + 2 (pile) + 1 (penalty card)
      expect(result.newTableVisible.length).toBe(0); // Card removed from table
    });
  });
  
  describe('Pickup Resolution - Blind Card', () => {
    it('should resolve blind pickup with penalty (return card to hand)', () => {
      const blindCard = createCard('7', 'clubs', 'c1');
      
      const result = resolvePickup({
        playedCard: blindCard,
        sourceZone: 'blind',
        currentPile: [createCard('A'), createCard('K')],
        playerHand: [],
        playerTableVisible: [],
        playerTableBlind: [blindCard],
      });
      
      expect(result.pickupRequired).toBe(true);
      expect(result.reason).toBe('blindFail');
      expect(result.penaltyCard).toEqual(blindCard);
      expect(result.newHand.length).toBe(3); // 2 (pile) + 1 (blind penalty)
      expect(result.newTableBlind.length).toBe(0); // Card removed from blind
    });
  });
  
  describe('Blind Card Reveal', () => {
    it('should reveal blind card when played', () => {
      const result = shouldRevealBlindCard({
        blindCard: createCard('7'),
        wasPlayed: true,
        wasPickedUp: true,
      });
      
      expect(result.reveal).toBe(true);
      expect(result.visibleToAll).toBe(true);
    });
    
    it('should keep blind card hidden when not played', () => {
      const result = shouldRevealBlindCard({
        blindCard: createCard('7'),
        wasPlayed: false,
        wasPickedUp: false,
      });
      
      expect(result.reveal).toBe(false);
      expect(result.visibleToAll).toBe(false);
    });
  });
  
  describe('Zone Transitions', () => {
    it('should play from hand when available', () => {
      const result = determineActiveZone({
        playerHand: [createCard('4'), createCard('5')],
        playerTableVisible: [createCard('7')],
        playerTableBlind: [createCard('K')],
      });
      
      expect(result.activeZone).toBe('hand');
      expect(result.canPlayFrom).toEqual(['hand']);
    });
    
    it('should transition to table when hand empty', () => {
      const result = determineActiveZone({
        playerHand: [],
        playerTableVisible: [createCard('4'), createCard('7')],
        playerTableBlind: [createCard('K')],
      });
      
      expect(result.activeZone).toBe('table');
      expect(result.canPlayFrom).toEqual(['table']);
    });
    
    it('should transition to blind when hand and table empty', () => {
      const result = determineActiveZone({
        playerHand: [],
        playerTableVisible: [],
        playerTableBlind: [createCard('K'), createCard('Q')],
      });
      
      expect(result.activeZone).toBe('blind');
      expect(result.canPlayFrom).toEqual(['blind']);
    });
    
    it('should indicate no cards when all zones empty', () => {
      const result = determineActiveZone({
        playerHand: [],
        playerTableVisible: [],
        playerTableBlind: [],
      });
      
      expect(result.activeZone).toBe('none');
      expect(result.canPlayFrom).toEqual([]);
    });
  });
  
  describe('Game End Condition', () => {
    it('should end game when 1 player has cards', () => {
      const result = checkGameEnd({
        players: [
          { playerId: 'p1', username: 'Alice', handCount: 0, tableVisibleCount: 0, tableBlindCount: 0 },
          { playerId: 'p2', username: 'Bob', handCount: 2, tableVisibleCount: 0, tableBlindCount: 0 },
          { playerId: 'p3', username: 'Charlie', handCount: 0, tableVisibleCount: 0, tableBlindCount: 0 },
        ],
      });
      
      expect(result.gameEnded).toBe(true);
      expect(result.loserId).toBe('p2');
      expect(result.loserUsername).toBe('Bob');
    });
    
    it('should continue game when multiple players have cards', () => {
      const result = checkGameEnd({
        players: [
          { playerId: 'p1', username: 'Alice', handCount: 1, tableVisibleCount: 0, tableBlindCount: 0 },
          { playerId: 'p2', username: 'Bob', handCount: 2, tableVisibleCount: 0, tableBlindCount: 0 },
          { playerId: 'p3', username: 'Charlie', handCount: 0, tableVisibleCount: 0, tableBlindCount: 0 },
        ],
      });
      
      expect(result.gameEnded).toBe(false);
      expect(result.playersWithCards).toBe(2);
    });
    
    it('should identify loser with table cards', () => {
      const result = checkGameEnd({
        players: [
          { playerId: 'p1', username: 'Alice', handCount: 0, tableVisibleCount: 0, tableBlindCount: 0 },
          { playerId: 'p2', username: 'Bob', handCount: 0, tableVisibleCount: 1, tableBlindCount: 0 },
          { playerId: 'p3', username: 'Charlie', handCount: 0, tableVisibleCount: 0, tableBlindCount: 0 },
        ],
      });
      
      expect(result.gameEnded).toBe(true);
      expect(result.loserId).toBe('p2');
    });
    
    it('should identify loser with blind cards', () => {
      const result = checkGameEnd({
        players: [
          { playerId: 'p1', username: 'Alice', handCount: 0, tableVisibleCount: 0, tableBlindCount: 0 },
          { playerId: 'p2', username: 'Bob', handCount: 0, tableVisibleCount: 0, tableBlindCount: 0 },
          { playerId: 'p3', username: 'Charlie', handCount: 0, tableVisibleCount: 0, tableBlindCount: 2 },
        ],
      });
      
      expect(result.gameEnded).toBe(true);
      expect(result.loserId).toBe('p3');
      expect(result.loserUsername).toBe('Charlie');
    });
  });
  
  describe('Elimination Tracking', () => {
    it('should track first elimination', () => {
      const result = recordElimination('p1', 'Alice', []);
      
      expect(result.playerId).toBe('p1');
      expect(result.username).toBe('Alice');
      expect(result.eliminatedAtRank).toBe(1);
    });
    
    it('should track second elimination', () => {
      const eliminated = [recordElimination('p1', 'Alice', [])];
      const result = recordElimination('p2', 'Bob', eliminated);
      
      expect(result.eliminatedAtRank).toBe(2);
    });
    
    it('should track multiple eliminations in order', () => {
      let eliminationOrder: EliminationRecord[] = [];
      
      eliminationOrder.push(recordElimination('p1', 'Alice', eliminationOrder));
      expect(eliminationOrder[0].eliminatedAtRank).toBe(1);
      
      eliminationOrder.push(recordElimination('p2', 'Bob', eliminationOrder));
      expect(eliminationOrder[1].eliminatedAtRank).toBe(2);
      
      eliminationOrder.push(recordElimination('p3', 'Charlie', eliminationOrder));
      expect(eliminationOrder[2].eliminatedAtRank).toBe(3);
    });
  });
  
  describe('Step 6 Validation Checklist', () => {
    it('should validate all pickup scenarios', () => {
      // Scenario 1: Hand pickup (Rule 3)
      const hand1 = resolvePickup({
        playedCard: createCard('4'),
        sourceZone: 'hand',
        currentPile: [createCard('A')],
        playerHand: [createCard('4')],
        playerTableVisible: [],
        playerTableBlind: [],
      });
      expect(hand1.reason).toBe('handFail');
      expect(hand1.penaltyCard).toBeUndefined();
      
      // Scenario 2: Table pickup (Rule 4)
      const table = resolvePickup({
        playedCard: createCard('5'),
        sourceZone: 'table',
        currentPile: [createCard('A')],
        playerHand: [],
        playerTableVisible: [createCard('5')],
        playerTableBlind: [],
      });
      expect(table.reason).toBe('tableFail');
      expect(table.penaltyCard?.rank).toBe('5');
      
      // Scenario 3: Game end
      const gameEnd = checkGameEnd({
        players: [
          { playerId: 'p1', username: 'Alice', handCount: 0, tableVisibleCount: 0, tableBlindCount: 0 },
          { playerId: 'p2', username: 'Bob', handCount: 1, tableVisibleCount: 0, tableBlindCount: 0 },
        ],
      });
      expect(gameEnd.gameEnded).toBe(true);
    });
  });
  
});

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
export function checkPickupRequired(input: PickupCheckInput): PickupCheckOutput {
  const topCard = input.currentPile[input.currentPile.length - 1];
  
  if (!topCard) {
    // No pile to beat (shouldn't happen, but safe fallback)
    return { mustPickup: false, explanation: 'Empty pile; any card allowed' };
  }
  
  // Check if player has cards in hand
  if (input.playerHand.length > 0) {
    // Player must play from hand; check if any can beat pile
    const canPlay = input.playerHand.some(c => canBeatPile(c, topCard, input.activeConstraints));
    
    if (input.activeConstraints.sevenOrUnder) {
      const canPlay7OrUnder = input.playerHand.some(c => c.isWildcard || c.value <= 7);
      if (canPlay7OrUnder) {
        return { mustPickup: false, explanation: 'Can play 7-or-under from hand' };
      }
    }

    if (!canPlay) {
      return {
        mustPickup: true,
        reason: 'handFail',
        explanation: 'No cards in hand can beat pile; must pick up entire pile',
      };
    }

    return { mustPickup: false, explanation: 'Can play from hand' };
  }
  
  // Hand empty; check table
  if (input.playerTableVisible.length > 0) {
    // Player must play from table; any face-up card might fail
    // (We don't know which card they'll play, so we return false here;
    // failure is determined after play attempt)
    return { mustPickup: false, explanation: 'Can play from table (will check after play)' };
  }
  
  // Table empty; check blind
  if (input.playerTableBlind.length > 0) {
    // Player must play blind; might fail
    return { mustPickup: false, explanation: 'Can play blind card (will check after play)' };
  }
  
  // No cards at all (shouldn't happen in game)
  return { mustPickup: false, explanation: 'No cards to play' };
}

/**
 * Checks if a card can beat the top of pile given active constraints.
 */
function canBeatPile(card: Card, topCard: Card, constraints: { sevenOrUnder: boolean }): boolean {
  // Wildcard always beats
  if (card.isWildcard) return true;
  
  // 7-constraint active?
  if (constraints.sevenOrUnder && card.value > 7) return false;
  
  // Normal beat rule
  return card.value >= topCard.value;
}

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
  cardsPickedUp: Card[]; // Pile + penalty card (if applicable)
  penaltyCard?: Card; // Card played that failed (for table/blind)
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
export function resolvePickup(input: PickupResolutionInput): PickupResolutionOutput {
  const topCard = input.currentPile[input.currentPile.length - 1];
  
  // Check if card beats pile
  const beats = input.playedCard.isWildcard || input.playedCard.value >= topCard.value;
  
  if (beats) {
    // No pickup needed
    return {
      pickupRequired: false,
      cardsPickedUp: [],
      newHand: input.playerHand,
      newTableVisible: input.playerTableVisible,
      newTableBlind: input.playerTableBlind,
      explanation: 'Card beats pile; no pickup required',
    };
  }
  
  // Pickup required
  const cardsPickedUp = [...input.currentPile];
  let newHand = [...input.playerHand];
  let newTableVisible = [...input.playerTableVisible];
  let newTableBlind = [...input.playerTableBlind];
  let penaltyCard: Card | undefined;
  let reason: PickupReason = 'handFail';
  let explanation: string = '';
  
  if (input.sourceZone === 'hand') {
    // Rule 3: Hand failure
    // Add pile to hand; player keeps extra cards (no replenishment)
    newHand.push(...cardsPickedUp);
    reason = 'handFail';
    explanation = 'Card from hand failed; picked up entire pile';
  } else if (input.sourceZone === 'table') {
    // Rule 4: Table failure
    // Add pile to hand + return played card to hand
    penaltyCard = input.playedCard;
    newHand.push(...cardsPickedUp);
    newHand.push(penaltyCard);
    
    // Remove played card from table
    newTableVisible = input.playerTableVisible.filter(c => c.id !== input.playedCard.id);
    
    reason = 'tableFail';
    explanation = 'Card from table failed; picked up pile + returned card to hand';
  } else if (input.sourceZone === 'blind') {
    // Blind card failure
    // Add pile to hand + return blind card to hand
    penaltyCard = input.playedCard;
    newHand.push(...cardsPickedUp);
    newHand.push(penaltyCard);
    
    // Remove played card from blind
    newTableBlind = input.playerTableBlind.filter(c => c.id !== input.playedCard.id);
    
    reason = 'blindFail';
    explanation = 'Blind card failed; picked up pile + returned card to hand';
  }
  
  return {
    pickupRequired: true,
    reason,
    cardsPickedUp,
    penaltyCard,
    newHand,
    newTableVisible,
    newTableBlind,
    explanation,
  };
}

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

export function shouldRevealBlindCard(input: BlindCardRevealInput): BlindCardRevealOutput {
  // Blind cards are ALWAYS revealed when played
  if (input.wasPlayed) {
    return {
      reveal: true,
      visibleToAll: true,
      explanation: 'Blind card revealed to all players (played)',
    };
  }
  
  return {
    reveal: false,
    visibleToAll: false,
    explanation: 'Card not played; remains blind',
  };
}

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

export function determineActiveZone(input: ZoneTransitionCheckInput): ZoneTransitionOutput {
  if (input.playerHand.length > 0) {
    return {
      activeZone: 'hand',
      canPlayFrom: ['hand'],
      explanation: 'Hand has cards; must play from hand',
    };
  }
  
  if (input.playerTableVisible.length > 0) {
    return {
      activeZone: 'table',
      canPlayFrom: ['table'],
      explanation: 'Hand empty; must play from table face-up',
    };
  }
  
  if (input.playerTableBlind.length > 0) {
    return {
      activeZone: 'blind',
      canPlayFrom: ['blind'],
      explanation: 'Hand and table empty; must play blind card',
    };
  }
  
  return {
    activeZone: 'none',
    canPlayFrom: [],
    explanation: 'No cards remaining (player is eliminated)',
  };
}

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

export function checkGameEnd(input: GameEndCheckInput): GameEndCheckOutput {
  const playersWithCards = input.players.filter(
    p => p.handCount > 0 || p.tableVisibleCount > 0 || p.tableBlindCount > 0
  );
  
  if (playersWithCards.length === 1) {
    const loser = playersWithCards[0];
    return {
      gameEnded: true,
      loserId: loser.playerId,
      loserUsername: loser.username,
      playersWithCards: 1,
      explanation: `Game ended! ${loser.username} is Poopyhead.`,
    };
  }
  
  return {
    gameEnded: false,
    playersWithCards: playersWithCards.length,
    explanation: `${playersWithCards.length} players with cards; game continues`,
  };
}

/**
 * Tracks elimination order for final rankings.
 */
export interface EliminationRecord {
  playerId: string;
  username: string;
  eliminatedAtRank: number; // 1 = first out, 2 = second out, etc.
}

export function recordElimination(
  playerId: string,
  username: string,
  currentEliminationOrder: EliminationRecord[]
): EliminationRecord {
  return {
    playerId,
    username,
    eliminatedAtRank: currentEliminationOrder.length + 1,
  };
}

/**
 * Move Validator Service
 * 
 * Validates card plays according to RULE_CANON.
 * Checks turn ownership, card ownership, zone priority, pile legality, and special effects.
 * 
 * This is the primary correctness boundary for the game engine.
 */

import { Card } from './DeckService';

export interface ValidationContext {
  playerId: string;
  cardIds: string[];
  playerHand: Card[];
  playerTableVisible: Card[];
  playerTableBlind: Card[];
  currentPile: Card[];
  isPlayerTurn: boolean;
  activeConstraints: {
    sevenOrUnder: boolean;
    skipCount: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  cardsToPlay?: Card[];
  sourceZone?: 'hand' | 'table' | 'blind';
}

/**
 * Primary validation function.
 * Performs all legal-move checks in order.
 */
export function validateMove(context: ValidationContext): ValidationResult {
  // Rule 0: Is it this player's turn?
  if (!context.isPlayerTurn) {
    return { valid: false, reason: 'NOT_YOUR_TURN' };
  }
  
  // Rule 0: Must play at least one card
  if (context.cardIds.length === 0) {
    return { valid: false, reason: 'MUST_PLAY_CARD' };
  }
  
  // Rule 0: Card count limit (can't play more cards than in any zone)
  const maxPlayable = Math.max(
    context.playerHand.length,
    context.playerTableVisible.length,
    context.playerTableBlind.length
  );
  if (context.cardIds.length > maxPlayable) {
    return { valid: false, reason: 'TOO_MANY_CARDS' };
  }
  
  // Resolve which cards are being played
  let cardsToPlay: Card[] = [];
  let sourceZone: 'hand' | 'table' | 'blind' = 'hand';

  if (
    context.playerHand.length === 0 &&
    context.playerTableVisible.length > 0 &&
    context.playerTableBlind.length > 0 &&
    context.cardIds.some(cardId => context.playerTableBlind.some(card => card.id === cardId))
  ) {
    return { valid: false, reason: 'BLIND_CARDS_NOT_PLAYABLE_YET' };
  }
  
  // Rule 1: Play from hand first, then table, then blind
  if (context.playerHand.length > 0) {
    sourceZone = 'hand';
    cardsToPlay = findCardsInZone(context.cardIds, context.playerHand);
  } else if (context.playerTableVisible.length > 0) {
    sourceZone = 'table';
    cardsToPlay = findCardsInZone(context.cardIds, context.playerTableVisible);
  } else if (context.playerTableBlind.length > 0) {
    sourceZone = 'blind';
    cardsToPlay = findCardsInZone(context.cardIds, context.playerTableBlind);
  }
  
  // Verify all cards found
  if (cardsToPlay.length !== context.cardIds.length) {
    return { valid: false, reason: 'CARD_NOT_FOUND_IN_SOURCE_ZONE' };
  }
  
  // Rule 3 & 7: Check pile legality
  const pileValidation = validatePileLegality(cardsToPlay, context.currentPile, context.activeConstraints);
  if (!pileValidation.valid) {
    return pileValidation;
  }
  
  // Rule 5: Face-up table cards of same rank cannot stack
  if (sourceZone === 'table') {
    const sameRankCount = countSameRank(cardsToPlay);
    if (sameRankCount > 1 && cardsToPlay.length > 1) {
      return { valid: false, reason: 'TABLE_SAME_RANK_NO_STACK' };
    }
  }
  
  // Rule 6: Cannot play blind if face-up not empty
  if (sourceZone === 'blind' && context.playerTableVisible.length > 0) {
    return { valid: false, reason: 'BLIND_CARDS_NOT_PLAYABLE_YET' };
  }
  
  return {
    valid: true,
    cardsToPlay,
    sourceZone,
  };
}

/**
 * Finds cards by ID in a zone.
 */
function findCardsInZone(cardIds: string[], zone: Card[]): Card[] {
  const found: Card[] = [];
  
  for (const id of cardIds) {
    const card = zone.find(c => c.id === id);
    if (card) {
      found.push(card);
    }
  }
  
  return found;
}

/**
 * Validates pile legality according to RULE_CANON.
 * - Cards must beat top of pile (equal or higher value)
 * - OR be wildcards (2, 3, 10, bomb)
 * - UNLESS 7 constraint active (must play 7 or under, or wildcard)
 */
function validatePileLegality(
  cardsToPlay: Card[],
  currentPile: Card[],
  activeConstraints: { sevenOrUnder: boolean; skipCount: number }
): ValidationResult {
  // Empty pile: any card is legal
  if (currentPile.length === 0) {
    return { valid: true };
  }
  
  const topCard = currentPile[currentPile.length - 1];
  
  // Check each card being played
  for (const card of cardsToPlay) {
    // Wildcards always legal
    if (card.isWildcard) {
      continue;
    }
    
    // 7 constraint active?
    if (activeConstraints.sevenOrUnder) {
      // Must play 7 or under (or wildcard, which is already checked)
      if (card.value > 7) {
        return { valid: false, reason: 'SEVEN_CONSTRAINT_VIOLATION' };
      }
      continue;
    }
    
    // Normal pile beat rule
    if (card.value < topCard.value) {
      return { valid: false, reason: 'CARD_DOES_NOT_BEAT_PILE' };
    }
  }
  
  return { valid: true };
}

/**
 * Counts how many cards have same rank in the array.
 */
function countSameRank(cards: Card[]): number {
  if (cards.length === 0) return 0;
  const rank = cards[0].rank;
  return cards.filter(c => c.rank === rank).length;
}

/**
 * Checks if the top of the pile has 4+ consecutive same-value cards.
 * Returns count and whether bomb triggers.
 */
export function checkConsecutiveBomb(pile: Card[]): { isBomb: boolean; runCount: number } {
  if (pile.length === 0) {
    return { isBomb: false, runCount: 0 };
  }

  let runCount = 1;
  const topCard = pile[pile.length - 1];
  
  // Count consecutive same-value cards from top backwards
  for (let i = pile.length - 2; i >= 0; i--) {
    if (pile[i].rank === topCard.rank) {
      runCount++;
    } else {
      break;
    }
  }
  
  const isBomb = runCount >= 4;
  return { isBomb, runCount };
}

/**
 * Evaluates what constraint (if any) should be applied after the play.
 */
export interface ConstraintEvaluation {
  constraint?: 'reset' | 'sevenOrUnder' | 'skip' | 'invisible' | 'bomb';
  skipCount?: number;
  cardUnderneath?: Card;
}

export function evaluateConstraint(
  cardsPlayed: Card[],
  oldPile: Card[],
  newPile: Card[]
): ConstraintEvaluation {
  // Check for 4+ consecutive (bomb takes precedence)
  const bombCheck = checkConsecutiveBomb(newPile);
  if (bombCheck.isBomb) {
    return { constraint: 'bomb' };
  }
  
  // Check what special cards were played (last card matters for constraint)
  const topCard = newPile[newPile.length - 1];
  
  if (topCard.specialType === 'reset') {
    return { constraint: 'reset' };
  }
  
  if (topCard.specialType === 'invisible') {
    // 3 skips the next player; they must beat the card underneath
    const cardUnderneath = newPile.length > 1 ? newPile[newPile.length - 2] : undefined;
    return {
      constraint: 'invisible',
      cardUnderneath,
    };
  }
  
  if (topCard.specialType === 'sevenOrUnder') {
    return { constraint: 'sevenOrUnder' };
  }
  
  if (topCard.specialType === 'skip') {
    // Count stacked 8s
    let skipCount = 1;
    for (let i = newPile.length - 2; i >= 0; i--) {
      if (newPile[i].specialType === 'skip') {
        skipCount++;
      } else {
        break;
      }
    }
    return { constraint: 'skip', skipCount };
  }
  
  if (topCard.specialType === 'bomb') {
    return { constraint: 'bomb' };
  }
  
  return {};
}

/**
 * Determines pickup requirement if player cannot play.
 */
export function evaluatePickup(
  playerHand: Card[],
  playerTableVisible: Card[],
  playerTableBlind: Card[],
  currentPile: Card[],
  activeConstraints: { sevenOrUnder: boolean }
): 'none' | 'hand' | 'table' | 'blind' {
  // No pickup if can play
  if (playerHand.length > 0) {
    // Check if any card beats pile
    const canBeat = playerHand.some(c =>
      c.isWildcard || c.value >= (currentPile[currentPile.length - 1]?.value || 0)
    );
    
    if (canBeat) return 'none';
    
    // Check 7 constraint
    if (activeConstraints.sevenOrUnder) {
      const canPlay7OrUnder = playerHand.some(c => c.isWildcard || c.value <= 7);
      if (canPlay7OrUnder) return 'none';
    }
    
    // Cannot play from hand: must pickup
    return 'hand';
  }
  
  if (playerTableVisible.length > 0) {
    // Must pickup from table if cannot beat
    return 'table';
  }
  
  if (playerTableBlind.length > 0) {
    // Blind cards: must play but might fail
    return 'blind';
  }
  
  return 'none';
}

/**
 * Move Validator Service
 * 
 * Validates card plays according to RULE_CANON.
 * Checks turn ownership, card ownership, zone priority, pile legality, and special effects.
 * 
 * This is the primary correctness boundary for the game engine.
 */

import { Card } from './DeckService';
import { pileEffectiveTop } from './pileUtils';

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
  bombEnabled: boolean;
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

  // Rule 1: Zone priority — hand → table/exposed-blind → covered-blind
  if (context.playerHand.length > 0) {
    sourceZone = 'hand';
    cardsToPlay = findCardsInZone(context.cardIds, context.playerHand);
  } else {
    const isBlindAttempt = context.cardIds.some(id =>
      context.playerTableBlind.some(c => c.id === id)
    );
    // A blind slot is exposed when blind count exceeds visible count
    // (meaning at least one blind card has no visible card on top)
    const hasExposedBlind = context.playerTableBlind.length > context.playerTableVisible.length;

    if (isBlindAttempt) {
      if (context.playerTableVisible.length > 0 && !hasExposedBlind) {
        // Every blind slot still has a visible card — must clear visible first
        return { valid: false, reason: 'BLIND_CARDS_NOT_PLAYABLE_YET' };
      }
      sourceZone = 'blind';
      cardsToPlay = findCardsInZone(context.cardIds, context.playerTableBlind);
    } else if (context.playerTableVisible.length > 0) {
      sourceZone = 'table';
      cardsToPlay = findCardsInZone(context.cardIds, context.playerTableVisible);
    } else if (context.playerTableBlind.length > 0) {
      sourceZone = 'blind';
      cardsToPlay = findCardsInZone(context.cardIds, context.playerTableBlind);
    }
  }
  
  // Verify all cards found
  if (cardsToPlay.length !== context.cardIds.length) {
    return { valid: false, reason: 'CARD_NOT_FOUND_IN_SOURCE_ZONE' };
  }

  // Blind card flips always proceed regardless of pile rank — fail outcome handled by GameManager
  if (sourceZone === 'blind') {
    return { valid: true, cardsToPlay, sourceZone };
  }

  // Table visible plays also always proceed — fail-pickup handled by GameManager
  if (sourceZone === 'table') {
    // Rule 5: Face-up table cards of same rank cannot stack
    const sameRankCount = countSameRank(cardsToPlay);
    if (sameRankCount > 1 && cardsToPlay.length > 1) {
      return { valid: false, reason: 'TABLE_SAME_RANK_NO_STACK' };
    }
    return { valid: true, cardsToPlay, sourceZone };
  }

  // Rule 4: Multiple cards played from hand must all share the same rank
  if (cardsToPlay.length > 1 && sourceZone === 'hand') {
    const firstRank = cardsToPlay[0].rank;
    if (!cardsToPlay.every(c => c.rank === firstRank)) {
      return { valid: false, reason: 'MIXED_RANKS_NOT_ALLOWED' };
    }
  }

  // Rule 3 & 7: Check pile legality (hand zone only at this point)
  const pileValidation = validatePileLegality(cardsToPlay, context.currentPile, context.activeConstraints, context.bombEnabled);
  if (!pileValidation.valid) {
    return pileValidation;
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
 * - OR be wildcards (2, 3, 10-when-bomb-enabled)
 * - UNLESS 7 constraint active (must play 7 or under, or wildcard)
 * - Rank 3 ("invisible") is transparent: look through consecutive 3s to find the effective top card
 */
function validatePileLegality(
  cardsToPlay: Card[],
  currentPile: Card[],
  activeConstraints: { sevenOrUnder: boolean; skipCount: number },
  bombEnabled: boolean
): ValidationResult {
  // Empty pile: any card is legal
  if (currentPile.length === 0) {
    return { valid: true };
  }

  // RULE_CANON: rank 3 is "invisible" — look through consecutive 3s on top to find
  // the effective card that must be beaten.
  const topCard = pileEffectiveTop(currentPile);
  // If the entire pile is 3s, treat it as an empty pile (any card is legal)
  if (!topCard) {
    return { valid: true };
  }

  // Check each card being played
  for (const card of cardsToPlay) {
    // RULE_CANON: rank 10 is only a wildcard when bombEnabled is true;
    // otherwise it is a normal card subject to rank rules.
    const isEffectiveWildcard = card.isWildcard && (card.specialType !== 'bomb' || bombEnabled);
    if (isEffectiveWildcard) {
      continue;
    }

    // 7 constraint active?
    if (activeConstraints.sevenOrUnder) {
      // Must play 7 or under (or wildcard, already handled)
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
    // Count only 8s played in THIS turn (stacking multiple 8s from hand).
    // Do NOT count 8s from previous turns that remain in the pile.
    const skipCount = cardsPlayed.filter(c => c.specialType === 'skip').length;
    return { constraint: 'skip', skipCount: Math.max(1, skipCount) };
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

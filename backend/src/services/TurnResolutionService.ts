/**
 * Turn Resolution Service
 * 
 * Handles the outcome of a valid card play:
 * - Updates pile state
 * - Applies constraints (reset, 7-or-under, skip, bomb)
 * - Determines next turn or extra turn
 * - Returns new game state deltas
 */

import { Card } from './DeckService';
import { evaluateConstraint, ConstraintEvaluation, checkConsecutiveBomb } from './MoveValidatorService';

export interface TurnResolutionInput {
  playerId: string;
  cardsPlayed: Card[];
  sourceZone: 'hand' | 'table' | 'blind';
  currentPile: Card[];
  currentPlayerIndex: number;
  playerCount: number;
  playOrder: string[];
  direction: 'clockwise' | 'counterclockwise';
  activeConstraints: {
    sevenOrUnder: boolean;
    skipCount: number;
  };
  bombEnabled: boolean;
}

export interface TurnResolutionOutput {
  newPile: Card[];
  nextPlayerIndex: number;
  nextPlayerId: string;
  extraTurn: boolean;
  extraTurnGrantedBy: string;
  constraintApplied: ConstraintEvaluation;
  bombTriggered: boolean;
  bombType?: '10-bomb' | 'consecutive-bomb';
  newConstraints: {
    sevenOrUnder: boolean;
    skipCount: number;
    cardUnderneath?: Card;
  };
}

/**
 * Resolves a turn: applies card play, determines next player, applies constraints.
 */
export function resolveTurn(input: TurnResolutionInput): TurnResolutionOutput {
  // Add cards to pile
  const newPile = [...input.currentPile, ...input.cardsPlayed];
  
  // Evaluate constraint applied by these cards
  const constraintApplied = evaluateConstraint(input.cardsPlayed, input.currentPile, newPile);
  
  // Check for bomb
  let extraTurn = false;
  let bombTriggered = false;
  let bombType: '10-bomb' | 'consecutive-bomb' | undefined;
  
  const isPlayedBomb = input.cardsPlayed.some(c => c.specialType === 'bomb' && input.bombEnabled);
  const consecutiveBombCheck = checkConsecutiveBomb(newPile);
  
  if (isPlayedBomb && input.bombEnabled) {
    bombTriggered = true;
    bombType = '10-bomb';
    extraTurn = true;
  } else if (consecutiveBombCheck.isBomb) {
    bombTriggered = true;
    bombType = 'consecutive-bomb';
    extraTurn = true;
  }
  
  // Bomb takes precedence: if bomb, ignore other constraints
  let newConstraints = {
    sevenOrUnder: false,
    skipCount: 0,
    cardUnderneath: undefined as Card | undefined,
  };
  
  if (bombTriggered) {
    // Bomb clears all constraints and returns to extra turn
    newConstraints = { sevenOrUnder: false, skipCount: 0, cardUnderneath: undefined };
  } else {
    // Apply constraint from play
    if (constraintApplied.constraint === 'reset') {
      // RULE_CANON: A 2 (reset) resets the pile entirely; sevenOrUnder does NOT persist
      // through a reset — it acts like an empty pile for the next player.
      newConstraints = { sevenOrUnder: false, skipCount: 0, cardUnderneath: undefined };
    } else if (constraintApplied.constraint === 'sevenOrUnder') {
      newConstraints = { sevenOrUnder: true, skipCount: 0, cardUnderneath: undefined };
    } else if (constraintApplied.constraint === 'skip') {
      // Skip: accumulates if multiple 8s stacked
      newConstraints = {
        sevenOrUnder: false,
        skipCount: constraintApplied.skipCount || 1,
        cardUnderneath: undefined,
      };
    } else if (constraintApplied.constraint === 'invisible') {
      // Invisible (3): next player must beat card underneath
      // Maintain current constraints but mark 3 as applied
      newConstraints = {
        sevenOrUnder: input.activeConstraints.sevenOrUnder,
        skipCount: 0,
        cardUnderneath: constraintApplied.cardUnderneath,
      };
    } else {
      // No special constraint: normal card played — release sevenOrUnder constraint.
      // RULE_CANON: constraint only persists when 2 or 3 is played under it.
      newConstraints = {
        sevenOrUnder: false,
        skipCount: 0,
        cardUnderneath: undefined,
      };
    }
  }
  
  // Determine next player
  let nextPlayerIndex: number;
  
  if (extraTurn) {
    // Extra turn: current player plays again
    nextPlayerIndex = input.currentPlayerIndex;
  } else if (newConstraints.skipCount > 0) {
    // Skip constraint: advance by skipCount + 1 (skip N players, land on N+1th)
    nextPlayerIndex = advancePlayerIndex(
      input.currentPlayerIndex,
      newConstraints.skipCount + 1,
      input.playerCount,
      input.direction
    );

    // Clear skip count after resolving
    newConstraints.skipCount = 0;
  } else {
    // Normal: advance to next player
    nextPlayerIndex = advancePlayerIndex(
      input.currentPlayerIndex,
      1,
      input.playerCount,
      input.direction
    );
  }
  
  const nextPlayerId = input.playOrder[nextPlayerIndex];
  
  return {
    newPile,
    nextPlayerIndex,
    nextPlayerId,
    extraTurn,
    extraTurnGrantedBy: input.playerId,
    constraintApplied,
    bombTriggered,
    bombType,
    newConstraints,
  };
}

/**
 * Advances player index by count, wrapping around.
 */
export function advancePlayerIndex(
  currentIndex: number,
  count: number,
  playerCount: number,
  direction: 'clockwise' | 'counterclockwise'
): number {
  const delta = direction === 'clockwise' ? count : -count;
  const newIndex = (currentIndex + delta) % playerCount;
  return newIndex < 0 ? newIndex + playerCount : newIndex;
}

/**
 * Determines if a player can play any card (for bomb extra-turn).
 */
export function canPlayAnyCard(pile: Card[]): boolean {
  return pile.length === 0;
}

/**
 * After bomb resolution, player must replenish hand before extra turn.
 * This function calculates how many cards player needs to draw.
 */
export function calculateReplenishmentNeeded(
  playerHand: Card[],
  expectedHandSize: number
): number {
  return Math.max(0, expectedHandSize - playerHand.length);
}

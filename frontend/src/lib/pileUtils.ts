/**
 * Pile utility functions for the frontend.
 * Mirror of backend/src/services/pileUtils.ts.
 */

import type { GameCard } from '../types/game';

/**
 * Returns the effective top card of the pile, skipping transparent rank-3
 * ("invisible") cards from the top. Returns null if the pile is empty or
 * consists entirely of 3s (treated as an empty pile — any card is legal).
 */
export function pileEffectiveTop(pile: GameCard[]): GameCard | null {
  let index = pile.length - 1;
  while (index >= 0 && pile[index].rank === '3') {
    index--;
  }
  return index >= 0 ? pile[index] : null;
}

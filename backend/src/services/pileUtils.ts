/**
 * Pile utility functions shared across backend services.
 */

import { Card } from './DeckService.js';

/**
 * Returns the effective top card of the pile, skipping transparent rank-3
 * ("invisible") cards from the top. Returns null if the pile is empty or
 * consists entirely of 3s (treated as an empty pile — any card is legal).
 */
export function pileEffectiveTop(pile: Card[]): Card | null {
  let index = pile.length - 1;
  while (index >= 0 && pile[index].specialType === 'invisible') {
    index--;
  }
  return index >= 0 ? pile[index] : null;
}

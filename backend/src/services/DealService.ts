/**
 * Deal Service
 * 
 * Handles game setup: dealing cards, determining first player, initializing game state.
 * Follows RULE_CANON: Hand size rules, deal sequence, first-player determination.
 */

import { Card, Rank } from './DeckService';

/**
 * Determines hand size based on player count.
 * RULE_CANON: "If player count is a multiple of 5, deal 4 cards. Otherwise, deal 5 cards."
 */
export function calculateHandSize(playerCount: number): number {
  if (playerCount % 5 === 0) {
    return 4;
  }
  return 5;
}

/**
 * Result of the deal sequence.
 */
export interface DealResult {
  playerHands: Card[][];           // hand[i] = player i's hand
  playerTables: Card[][];          // table[i] = player i's 6 table cards (3 visible + 3 blind)
  playerTableVisible: Card[][];    // tableVisible[i] = player i's face-up table cards
  playerTableBlind: Card[][];      // tableBlind[i] = player i's blind table cards
  remainingDeck: Card[];           // Cards left after deal
  handSize: number;                // Hand size used for all players
}

/**
 * Executes full deal sequence:
 * 1. Deal 3 blind cards to each player
 * 2. Deal hand cards (4 or 5 based on player count)
 * 3. Player selects best 3 from hand (this is player choice via UI—we expose those cards separately)
 * 4. Return result with remaining deck
 */
export function dealGame(deck: Card[], playerCount: number): DealResult {
  if (playerCount < 2 || playerCount > 100) {
    throw new Error('Invalid player count');
  }
  
  const handSize = calculateHandSize(playerCount);
  const blindCardsPerPlayer = 3;
  const tableVisiblePerPlayer = 3;
  const totalCardsNeeded = (handSize + blindCardsPerPlayer) * playerCount;
  
  if (deck.length < totalCardsNeeded) {
    throw new Error(
      `Insufficient cards in deck: need ${totalCardsNeeded}, have ${deck.length}`
    );
  }
  
  const playerHands: Card[][] = [];
  const playerTableBlind: Card[][] = [];
  const playerTableVisible: Card[][] = [];
  
  let deckCopy = [...deck];
  
  // Step 1: Deal 3 blind cards to each player
  for (let i = 0; i < playerCount; i++) {
    const blind = deckCopy.splice(0, blindCardsPerPlayer);
    playerTableBlind.push(blind);
  }
  
  // Step 2: Deal hand cards to each player
  for (let i = 0; i < playerCount; i++) {
    const hand = deckCopy.splice(0, handSize);
    playerHands.push(hand);
  }
  
  // Step 3: Player selects best 3 from hand (UI responsibility)
  // For the server-side deal contract, we expose the selected visible cards
  // without mutating the dealt hand. The table cards remain available for UI
  // and later placement workflows.
  for (let i = 0; i < playerCount; i++) {
    const tableVisible = playerHands[i].slice(0, tableVisiblePerPlayer);
    playerTableVisible.push(tableVisible);
  }
  
  // Combine table cards (visible + blind for reconstruction)
  const playerTables = playerTableVisible.map((vis, i) => [...vis, ...playerTableBlind[i]]);
  
  return {
    playerHands,
    playerTables,
    playerTableVisible,
    playerTableBlind,
    remainingDeck: deckCopy,
    handSize,
  };
}

/**
 * Player selection info for first-player determination.
 */
export interface PlayerSelectionInfo {
  playerId: string;
  username: string;
  fourCountInHand: number;
  poopyheadCount: number;
  isGuest: boolean;
}

/**
 * Determines first player based on RULE_CANON precedence:
 * 1. Player who was most recently Poopyhead (not applicable for new game)
 * 2. Player with most Poopyheads in history
 * 3. Player with most 4s in starting hand
 * 4. (Fallback) First player in list / random
 */
export function determineFirstPlayer(
  players: PlayerSelectionInfo[]
): { playerId: string; reason: string } {
  if (players.length === 0) {
    throw new Error('Cannot determine first player from empty player list');
  }
  
  // Fallback: most 4s in hand
  let bestPlayer = players[0];
  let bestFourCount = players[0].fourCountInHand;
  let reason = 'most 4s in starting hand';
  
  // Check for most Poopyheads
  const maxPoopyheadCount = Math.max(...players.map(p => p.poopyheadCount));
  if (maxPoopyheadCount > 0) {
    const poopyheadCandidates = players.filter(p => p.poopyheadCount === maxPoopyheadCount);
    
    if (poopyheadCandidates.length === 1) {
      bestPlayer = poopyheadCandidates[0];
      reason = 'most Poopyheads in history';
    } else {
      // Tiebreak with most 4s
      bestPlayer = poopyheadCandidates.reduce((best, curr) =>
        curr.fourCountInHand > best.fourCountInHand ? curr : best
      );
      reason = 'tied for most Poopyheads, won tiebreak with most 4s';
    }
  } else {
    // All have 0 Poopyheads (new game); use most 4s
    bestPlayer = players.reduce((best, curr) =>
      curr.fourCountInHand > best.fourCountInHand ? curr : best
    );
  }
  
  return {
    playerId: bestPlayer.playerId,
    reason,
  };
}

/**
 * Counts 4s in a hand (for first-player tiebreaker).
 */
export function countFoursInHand(hand: Card[]): number {
  return hand.filter(c => c.rank === '4').length;
}

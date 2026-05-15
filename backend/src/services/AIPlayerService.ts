import type { GameInstance } from './GameManager.js';

const AI_NAMES = [
  'Caleb', 'Marco', 'Matthew', 'Connor', 'Evan',
  'Curtis', 'Boen', 'Ben', 'Zach', 'Shane',
  'Nathan', 'Ethan', 'Josh', 'Sam', 'Jeremy',
];

export function pickAIName(usedNames: string[] = []): string {
  const available = AI_NAMES.filter(n => !usedNames.includes(n));
  const pool = available.length > 0 ? available : AI_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export const AI_RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

/**
 * Returns the ordered list of card ID groups the AI should try, in rank order.
 * Each group contains the IDs of same-rank cards the AI would play together.
 *
 * For the blind zone, returns a single group with the first blind card.
 * For the table zone, at most one card per rank (no stacking).
 * For the hand zone, all same-rank cards grouped together.
 */
export function buildAIRankGroups(game: GameInstance, playerId: string): Array<string[]> {
  const player = game.players.find(p => p.id === playerId);
  if (!player) return [];

  // Blind zone: only option is to flip the first blind card
  if (player.hand.length === 0 && player.tableVisible.length === 0 && player.tableBlind.length > 0) {
    return [[player.tableBlind[0].id]];
  }

  const isTableZone = player.hand.length === 0 && player.tableVisible.length > 0;
  const candidates = player.hand.length > 0 ? player.hand : player.tableVisible;
  const rankGroups: Record<string, string[]> = {};
  for (const card of candidates) {
    rankGroups[card.rank] = rankGroups[card.rank] || [];
    // Table cards can't stack same-rank — only keep one card per rank group in table zone
    if (!isTableZone || rankGroups[card.rank].length === 0) {
      rankGroups[card.rank].push(card.id);
    }
  }

  return AI_RANK_ORDER.filter(r => rankGroups[r]).map(r => rankGroups[r]);
}

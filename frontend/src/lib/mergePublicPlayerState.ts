/**
 * Merges server-broadcast public player state (card counts, visible table)
 * into the lobby player list stored in the Zustand store.
 *
 * The server never sends opponent hand cards; it sends counts and visible
 * table arrays instead. This helper applies that public view onto the full
 * lobby player objects that the client keeps for display.
 */

import type { GamePlayer } from '../store';
import type { GameCard } from '../types/game';

interface PublicPlayer {
  id: string;
  cardsInHand: number;
  tableVisible: GameCard[];
  tableBlindCount: number;
}

/**
 * Returns a new lobbyPlayers array with card-count fields merged in from the
 * public player list emitted by the server.
 */
export function mergePublicPlayerState(
  lobbyPlayers: GamePlayer[],
  publicPlayers: PublicPlayer[]
): GamePlayer[] {
  return lobbyPlayers.map((player) => {
    const pub = publicPlayers.find((p) => p.id === player.id);
    if (!pub) return player;
    return {
      ...player,
      cardsInHand: pub.cardsInHand,
      tableVisible: pub.tableVisible,
      tableBlindCount: pub.tableBlindCount,
    };
  });
}

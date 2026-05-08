/**
 * Game Store (Zustand)
 * 
 * Manages client-side game state for React components.
 */

import { create } from 'zustand';
import type { GameCard, GameStatePatch, LobbyPlayer, LobbySettings } from './types/game';

export type GamePlayer = LobbyPlayer;

export type GameStatus = 'lobby' | 'playing' | 'ended' | 'rematch';

export interface BlindReveal {
  card: GameCard;
  success: boolean;
  slotIndex: number;
}

export interface GameState {
  // Connection & Session
  connected: boolean;
  sessionId?: string;
  currentPlayerId?: string;

  // Lobby
  lobbyCode?: string;
  lobbyPlayers: GamePlayer[];
  canStartGame: boolean;

  // Game
  gameId?: string;
  gameStatus: GameStatus;
  /** Current game phase within an active game */
  phase: 'swapping' | 'playing';
  /** How many players have submitted their swap selection */
  swappedCount: number;
  /** Total players in the current game (for swap progress display) */
  totalPlayers: number;
  hand: GameCard[];
  tableCards: GameCard[];
  blindCards: GameCard[];
  playPile: GameCard[];
  bombEnabled: boolean;
  currentPlayerUsername?: string;
  /** Player ID of whoever's turn it currently is */
  currentTurnPlayerId?: string;
  playableCards: string[];
  deckCount: number;
  activeConstraints: { sevenOrUnder: boolean; skipCount: number };
  /** Set when a blind card is played — triggers in-place reveal at the slot */
  blindReveal: BlindReveal | null;
  /** Tracks which slot index the currently-selected blind card occupies */
  pendingBlindSlotIndex: number | null;
  /** Set true when any player picks up the pile — triggers fly animation */
  pickupAnimation: boolean;
  /** Player ID of whoever picked up the pile (for directional animation) */
  pickupPlayerId: string | null;
  /** Set true momentarily when a bomb clears the pile */
  bombAnimation: boolean;

  // Endgame
  loserId?: string;
  loserTableCards: GameCard[];
  loserBlindCards: GameCard[];

  // Actions
  connect: () => void;
  disconnect: () => void;
  createLobby: (username: string, settings: LobbySettings) => void;
  joinLobby: (code: string, username: string) => void;
  setReady: (ready: boolean) => void;
  startGame: (direction: 'clockwise' | 'counterclockwise') => void;
  playCards: (cardIds: string[]) => void;
  updateGameState: (state: Partial<GameState> | GameStatePatch) => void;
  updatePlayableCards: (cardIds: string[]) => void;
  setGameStatus: (status: GameStatus) => void;
}

export const useGameStore = create<GameState>((set) => ({
  // Initial state
  connected: false,
  lobbyPlayers: [],
  canStartGame: false,
  gameStatus: 'lobby',
  phase: 'swapping',
  swappedCount: 0,
  totalPlayers: 0,
  hand: [],
  tableCards: [],
  blindCards: [],
  playPile: [],
  bombEnabled: true,
  playableCards: [],
  deckCount: 0,
  activeConstraints: { sevenOrUnder: false, skipCount: 0 },
  blindReveal: null,
  pendingBlindSlotIndex: null,
  pickupAnimation: false,
  pickupPlayerId: null,
  bombAnimation: false,
  loserTableCards: [],
  loserBlindCards: [],

  // Actions
  connect: () => set({ connected: true }),
  disconnect: () => set({ connected: false }),

  createLobby: (_username: string, _settings: LobbySettings) => {
    set({ lobbyCode: 'ABC123' }); // Placeholder
  },

  joinLobby: (code: string, _username: string) => {
    set({ lobbyCode: code });
  },

  setReady: (_ready: boolean) => {
    // Emit to server
  },

  startGame: (_direction: 'clockwise' | 'counterclockwise') => {
    set({ gameStatus: 'playing' });
  },

  playCards: (_cardIds: string[]) => {
    // Emit to server
  },

  updateGameState: (state: Partial<GameState> | GameStatePatch) => {
    set(state);
  },

  updatePlayableCards: (cardIds: string[]) => {
    set({ playableCards: cardIds });
  },

  setGameStatus: (status: GameStatus) => {
    set({ gameStatus: status });
  },
}));

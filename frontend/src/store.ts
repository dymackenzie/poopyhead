/**
 * Game Store (Zustand)
 * 
 * Manages client-side game state for React components.
 */

import { create } from 'zustand';
import type { GameCard, GameStatePatch, LobbyPlayer, LobbySettings } from './types/game';

export type GamePlayer = LobbyPlayer;

export type GameStatus = 'lobby' | 'playing' | 'ended' | 'rematch';

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
  hand: GameCard[];
  tableCards: GameCard[];
  blindCards: GameCard[];
  playPile: GameCard[];
  currentPlayerUsername?: string;
  playableCards: string[];

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
  hand: [],
  tableCards: [],
  blindCards: [],
  playPile: [],
  playableCards: [],

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

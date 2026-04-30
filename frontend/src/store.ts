/**
 * Game Store (Zustand)
 * 
 * Manages client-side game state for React components.
 */

import { create } from 'zustand';

export interface GamePlayer {
  id: string;
  username: string;
  cardsRemaining: number;
  isCurrentPlayer: boolean;
  isConnected: boolean;
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
  gameStatus: 'lobby' | 'playing' | 'ended' | 'rematch';
  hand: any[];
  tableCards: any[];
  blindCards: any[];
  playPile: any[];
  currentPlayerUsername?: string;
  playableCards: string[]; // Card IDs that can be played

  // Actions
  connect: () => void;
  disconnect: () => void;
  createLobby: (username: string, settings: Record<string, any>) => void;
  joinLobby: (code: string, username: string) => void;
  setReady: (ready: boolean) => void;
  startGame: (direction: 'clockwise' | 'counterclockwise') => void;
  playCards: (cardIds: string[]) => void;
  updateGameState: (state: Partial<GameState>) => void;
  updatePlayableCards: (cardIds: string[]) => void;
  setGameStatus: (status: 'lobby' | 'playing' | 'ended' | 'rematch') => void;
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

  createLobby: (_username: string, _settings: Record<string, any>) => {
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

  updateGameState: (state: Partial<GameState>) => {
    set(state);
  },

  updatePlayableCards: (cardIds: string[]) => {
    set({ playableCards: cardIds });
  },

  setGameStatus: (status: 'lobby' | 'playing' | 'ended' | 'rematch') => {
    set({ gameStatus: status });
  },
}));

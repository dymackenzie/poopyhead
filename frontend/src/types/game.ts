export interface GameCard {
  id: string;
  rank: string;
  suit: string;
}

export interface LobbyPlayer {
  id: string;
  username: string;
  cardsRemaining?: number;
  ready?: boolean;
  isCurrentPlayer?: boolean;
  isConnected?: boolean;
}

export interface LobbySnapshot {
  code: string;
  players: LobbyPlayer[];
}

export interface LobbySettings {
  bombEnabled: boolean;
  turnTimerSeconds: number;
}

export interface LobbyResponse {
  success: boolean;
  lobby?: LobbySnapshot;
  playerId?: string;
  reason?: string;
}

export interface ReadyResponse extends LobbyResponse {
  ready?: boolean;
  canStart?: boolean;
}

export interface GameStatePatch {
  gameId?: string;
  hand?: GameCard[];
  tableCards?: GameCard[];
  blindCards?: GameCard[];
  playPile?: GameCard[];
  currentPlayerUsername?: string;
  currentTurnPlayerId?: string;
  currentPlayerId?: string;
  lobbyPlayers?: LobbyPlayer[];
  lobbyCode?: string;
  canStartGame?: boolean;
  gameStatus?: 'lobby' | 'playing' | 'ended' | 'rematch';
  phase?: 'swapping' | 'playing';
  swappedCount?: number;
  totalPlayers?: number;
}

export interface PlayerJoinedPayload {
  lobby?: LobbySnapshot;
  playerId?: string;
}

export interface PlayerReadyPayload extends PlayerJoinedPayload {
  ready?: boolean;
  canStart?: boolean;
}

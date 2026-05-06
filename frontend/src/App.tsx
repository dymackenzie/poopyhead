/**
 * Main App Component
 */

import React, { useEffect } from 'react';
import { useGameStore } from './store';
import { initSocket } from './socketClient';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import EndgameScreen from './screens/EndgameScreen';
import './App.css';
import type { GamePlayer } from './store';
import type { LobbyResponse, PlayerJoinedPayload, PlayerReadyPayload } from './types/game';

export function App(): React.ReactElement {
  const gameStatus = useGameStore((state) => state.gameStatus);
  const connect = useGameStore((state) => state.connect);
  const updateGameState = useGameStore((state) => state.updateGameState);

  useEffect(() => {
    // Initialize socket connection
    initSocket({
      onConnect: () => {
        connect();
      },
      onPlayerJoined: (data: PlayerJoinedPayload) => {
        if (data?.lobby) {
          updateGameState({ lobbyPlayers: data.lobby.players, lobbyCode: data.lobby.code });
        }
      },
      onPlayerReady: (data: PlayerReadyPayload) => {
        if (data?.lobby) {
          updateGameState({ lobbyPlayers: data.lobby.players, lobbyCode: data.lobby.code, canStartGame: data.canStart ?? false });
        } else if (data?.playerId) {
          // fallback: update single player's ready flag
          useGameStore.setState((state) => ({
            lobbyPlayers: state.lobbyPlayers.map((player: GamePlayer) => (player.id === data.playerId ? { ...player, ready: data.ready } : player)),
            canStartGame: data.canStart ?? state.canStartGame,
          }));
        }
      },
      onLobbyCreated: (data: LobbyResponse) => {
        if (data.lobby) {
          updateGameState({ lobbyPlayers: data.lobby.players, lobbyCode: data.lobby.code });
        }
      },
      onGameStarted: (data) => {
        const dataAny = data as any;
        if (dataAny?.game) {
          const game = dataAny.game as any;
          // Read currentPlayerId from store at event time to avoid stale closure
          const { currentPlayerId } = useGameStore.getState();
          const me = game.players.find((p: any) => p.id === currentPlayerId);
          const lobbyPlayers = game.players.map((p: any) => ({ id: p.id, username: p.username, ready: true }));
          const gamePhase: 'swapping' | 'playing' = game.status === 'swapping' ? 'swapping' : 'playing';

          updateGameState({
            gameStatus: 'playing', // transition App screen to game view
            gameId: game.id,
            playPile: game.playPile,
            hand: me?.hand || [],
            tableCards: me?.tableVisible || [],
            blindCards: me?.tableBlind || [],
            lobbyPlayers,
            phase: gamePhase,
            swappedCount: (game.swappedPlayers ?? []).length,
            totalPlayers: game.players.length,
            currentPlayerUsername: dataAny.currentTurnPlayerUsername,
            currentTurnPlayerId: dataAny.currentTurnPlayerId,
          });
        } else {
          updateGameState({ gameStatus: 'playing', ...data });
        }
      },
      onSwapUpdate: (data) => {
        const dataAny = data as any;
        // Always update swap progress counters
        const patch: Partial<import('./store').GameState> = {
          swappedCount: dataAny.swappedCount ?? 0,
        };

        if (dataAny.phase === 'playing') {
          // All players have swapped — transition to playing phase
          patch.phase = 'playing';
          patch.currentPlayerUsername = dataAny.currentTurnPlayerUsername;
          patch.currentTurnPlayerId = dataAny.currentTurnPlayerId;

          // If full game state is included, refresh hand/tableCards from it
          if (dataAny.game) {
            const game = dataAny.game as any;
            const { currentPlayerId } = useGameStore.getState();
            const me = game.players.find((p: any) => p.id === currentPlayerId);
            patch.hand = me?.hand || [];
            patch.tableCards = me?.tableVisible || [];
            patch.blindCards = me?.tableBlind || [];
            patch.playPile = game.playPile;
          }
        }

        useGameStore.setState(patch);
      },
      onCardPlayed: (data) => {
        const dataAny = data as any;
        const { lobbyPlayers } = useGameStore.getState();
        const nextPlayerId: string | undefined = dataAny.nextPlayerId;
        const nextPlayer = lobbyPlayers.find((p: GamePlayer) => p.id === nextPlayerId);
        useGameStore.setState({
          playPile: dataAny.pileState ?? dataAny.playPile ?? [],
          currentTurnPlayerId: nextPlayerId,
          currentPlayerUsername: nextPlayer?.username,
        });
      },
      onGameEnded: (data) => {
        // Mark losers in lobby players and transition to ended screen
        useGameStore.setState((state) => ({
          gameStatus: 'ended',
          lobbyPlayers: state.lobbyPlayers.map((player: GamePlayer) =>
            player.id === data.loserId
              ? { ...player, cardsRemaining: Number.MAX_SAFE_INTEGER }
              : player
          ),
        }));
      },
    });
  }, []);

  return (
    <div className="app">
      {gameStatus === 'lobby' && <LobbyScreen />}
      {gameStatus === 'playing' && <GameScreen />}
      {(gameStatus === 'ended' || gameStatus === 'rematch') && <EndgameScreen />}
    </div>
  );
}

export default App;

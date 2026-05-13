/**
 * Main App Component
 */

import React, { useEffect } from 'react';
import { useGameStore } from './store';
import { initSocket, resumeGame } from './socketClient';
import { supabase, authReady } from './supabase';
import { getSocket } from './socketClient';
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
  const setAuth = useGameStore((state) => state.setAuth);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setAuth({ id: session.user.id, isAnonymous: session.user.is_anonymous ?? false }, session.access_token);
      } else {
        setAuth(null, null);
      }
      if (event === 'TOKEN_REFRESHED' && session) {
        const s = getSocket();
        if (s) {
          (s as any).auth = { token: session.access_token };
          s.disconnect();
          s.connect();
        }
      }
    });

    const boot = async () => {
      await authReady;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setAuth({ id: session.user.id, isAnonymous: session.user.is_anonymous ?? false }, session.access_token);
      }
      initSocket(session?.access_token ?? null, {
      onConnect: () => {
        connect();
        // Handle ?resume=<gameId> deep link from push notification
        const params = new URLSearchParams(window.location.search);
        const resumeGameId = params.get('resume');
        if (resumeGameId) {
          window.history.replaceState({}, '', window.location.pathname);
          resumeGame(resumeGameId).then((res) => {
            if (!res.success || !res.game || !res.playerId) return;
            const game = res.game as any;
            const me = game.players?.find((p: any) => p.id === res.playerId);
            const lobbyPlayers = game.players?.map((p: any) => ({ id: p.id, username: p.username, ready: true })) ?? [];
            useGameStore.setState({
              gameStatus: 'playing',
              gameId: game.id,
              currentPlayerId: res.playerId,
              lobbyCode: game.lobbyCode,
              lobbyPlayers,
              phase: game.status === 'swapping' ? 'swapping' : 'playing',
              hand: me?.hand ?? [],
              tableCards: me?.tableVisible ?? [],
              blindCards: me?.tableBlind ?? [],
              playPile: game.playPile ?? [],
              deckCount: game.deck?.length ?? 0,
              bombEnabled: game.bombEnabled ?? true,
              activeConstraints: game.activeConstraints ?? { sevenOrUnder: false, skipCount: 0 },
              currentTurnPlayerId: game.playOrder?.[game.currentPlayerIndex],
              swappedCount: (game.swappedPlayers ?? []).length,
              totalPlayers: game.players?.length ?? 0,
            });
          });
        }
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
            bombEnabled: game.bombEnabled ?? true,
            lobbyPlayers,
            phase: gamePhase,
            swappedCount: (game.swappedPlayers ?? []).length,
            totalPlayers: game.players.length,
            currentPlayerUsername: dataAny.currentTurnPlayerUsername,
            currentTurnPlayerId: dataAny.currentTurnPlayerId,
            deckCount: game.deck?.length ?? 0,
            activeConstraints: { sevenOrUnder: false, skipCount: 0 },
            blindReveal: null,
            pickupAnimation: false,
            pickupPlayerId: null,
            bombAnimation: false,
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
          if (dataAny.deckCount !== undefined) patch.deckCount = dataAny.deckCount;

          // If full game state is included, refresh hand/tableCards from it
          if (dataAny.game) {
            const game = dataAny.game as any;
            const { currentPlayerId, lobbyPlayers } = useGameStore.getState();
            const me = game.players.find((p: any) => p.id === currentPlayerId);
            patch.hand = me?.hand || [];
            patch.tableCards = me?.tableVisible || [];
            patch.blindCards = me?.tableBlind || [];
            patch.playPile = game.playPile;

            if (dataAny.players) {
              patch.lobbyPlayers = lobbyPlayers.map((player: GamePlayer) => {
                const pub = dataAny.players.find((p: any) => p.id === player.id);
                if (!pub) return player;
                return { ...player, cardsInHand: pub.cardsInHand, tableVisible: pub.tableVisible, tableBlindCount: pub.tableBlindCount };
              });
            }
          }
        }

        useGameStore.setState(patch);
      },
      onCardPlayed: (data) => {
        const dataAny = data as any;
        const { lobbyPlayers } = useGameStore.getState();
        const nextPlayerId: string | undefined = dataAny.nextPlayerId;
        const nextPlayer = lobbyPlayers.find((p: GamePlayer) => p.id === nextPlayerId);

        const updatedLobbyPlayers = lobbyPlayers.map((player: GamePlayer) => {
          const pub = dataAny.players?.find((p: any) => p.id === player.id);
          if (!pub) return player;
          return { ...player, cardsInHand: pub.cardsInHand, tableVisible: pub.tableVisible, tableBlindCount: pub.tableBlindCount };
        });

        const patch: Partial<import('./store').GameState> = {
          playPile: dataAny.pileState ?? dataAny.playPile ?? [],
          currentTurnPlayerId: nextPlayerId,
          currentPlayerUsername: nextPlayer?.username,
          deckCount: dataAny.deckCount ?? 0,
          activeConstraints: dataAny.activeConstraints ?? { sevenOrUnder: false, skipCount: 0 },
          lobbyPlayers: updatedLobbyPlayers,
        };

        // Blind card in-place reveal — only animate on the player whose card it was
        if (dataAny.isBlindPlay === true && dataAny.revealedCard != null) {
          const { pendingBlindSlotIndex, currentPlayerId } = useGameStore.getState();
          if (dataAny.playerId === currentPlayerId) {
            patch.blindReveal = { card: dataAny.revealedCard, success: true, slotIndex: pendingBlindSlotIndex ?? 0 };
            patch.pendingBlindSlotIndex = null;
          } else {
            patch.opponentBlindReveal = { playerId: dataAny.playerId, card: dataAny.revealedCard, success: true };
          }
        }

        // Issue 8 — bomb animation: fire when the pile was just cleared by a bomb
        if (dataAny.bombCleared === true || dataAny.isBomb === true) {
          patch.bombAnimation = true;
        }

        // Card play animation: show a card flying to the pile when any player plays
        if (dataAny.cardsPlayed && dataAny.cardsPlayed.length > 0) {
          const { currentPlayerId: myId } = useGameStore.getState();
          patch.cardPlayAnimation = { fromBottom: dataAny.playerId === myId };
        }

        useGameStore.setState(patch);
      },
      onPilePicked: (data) => {
        const dataAny = data as any;
        const { lobbyPlayers } = useGameStore.getState();

        const updatedLobbyPlayers = lobbyPlayers.map((player: GamePlayer) => {
          const pub = dataAny.players?.find((p: any) => p.id === player.id);
          if (!pub) return player;
          return { ...player, cardsInHand: pub.cardsInHand, tableVisible: pub.tableVisible, tableBlindCount: pub.tableBlindCount };
        });

        const patch: Partial<import('./store').GameState> = {
          playPile: [],
          currentTurnPlayerId: dataAny.nextPlayerId,
          currentPlayerUsername: dataAny.nextPlayerUsername,
          deckCount: dataAny.deckCount ?? 0,
          activeConstraints: dataAny.activeConstraints ?? { sevenOrUnder: false, skipCount: 0 },
          lobbyPlayers: updatedLobbyPlayers,
          // Issue 3 — store who picked up so the animation can target their position
          pickupAnimation: true,
          pickupPlayerId: dataAny.playerId ?? dataAny.pickupPlayerId ?? null,
        };

        // Blind card that failed — only animate for actual blind plays (table card fails need no flip)
        if (dataAny.isBlindPlay === true && dataAny.revealedCard != null) {
          const { pendingBlindSlotIndex, currentPlayerId } = useGameStore.getState();
          if (dataAny.playerId === currentPlayerId) {
            patch.blindReveal = { card: dataAny.revealedCard, success: false, slotIndex: pendingBlindSlotIndex ?? 0 };
            patch.pendingBlindSlotIndex = null;
          } else {
            patch.opponentBlindReveal = { playerId: dataAny.playerId, card: dataAny.revealedCard, success: false };
          }
        }

        useGameStore.setState(patch);
      },
      onGameEnded: (data) => {
        // Wait for inline blind reveal to finish before transitioning
        const BLIND_TOTAL_MS = 1500;
        const { blindReveal } = useGameStore.getState();
        const applyEnded = (): void => {
          useGameStore.setState((state) => ({
            gameStatus: 'ended',
            loserId: data.loserId,
            loserTableCards: data.loserTableCards ?? [],
            loserBlindCards: data.loserBlindCards ?? [],
            lobbyPlayers: state.lobbyPlayers.map((player: GamePlayer) =>
              player.id === data.loserId
                ? { ...player, cardsRemaining: Number.MAX_SAFE_INTEGER }
                : player
            ),
          }));
        };
        if (blindReveal !== null) {
          // A blind animation is playing — delay transition until it completes
          setTimeout(applyEnded, BLIND_TOTAL_MS);
        } else {
          applyEnded();
        }
      },
      onDebugStateSync: (data) => {
        const dataAny = data as any;
        const { currentPlayerId, lobbyPlayers } = useGameStore.getState();
        const game = dataAny.game as any;
        const me = game?.players?.find((p: any) => p.id === currentPlayerId);

        const updatedLobbyPlayers = lobbyPlayers.map((player: GamePlayer) => {
          const pub = dataAny.players?.find((p: any) => p.id === player.id);
          if (!pub) return player;
          return { ...player, cardsInHand: pub.cardsInHand, tableVisible: pub.tableVisible, tableBlindCount: pub.tableBlindCount };
        });

        useGameStore.setState({
          hand: me?.hand || [],
          tableCards: me?.tableVisible || [],
          blindCards: me?.tableBlind || [],
          playPile: game?.playPile || [],
          deckCount: dataAny.deckCount ?? 0,
          currentTurnPlayerId: dataAny.currentTurnPlayerId,
          currentPlayerUsername: dataAny.currentTurnPlayerUsername,
          activeConstraints: game?.activeConstraints ?? { sevenOrUnder: false, skipCount: 0 },
          lobbyPlayers: updatedLobbyPlayers,
        });
      },
      });
    };
    boot();
    return () => subscription.unsubscribe();
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

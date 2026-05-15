/**
 * Lobby Screen
 * Home → Create/Join → Lobby waiting room
 */

import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store';
import { createLobby, joinLobby, setPlayerReady, startGame, resumeGame } from '../socketClient';
import Button from '../components/Button';
import Input from '../components/Input';
import PlayerCard from '../components/PlayerCard';
import AccountScreen from './AccountScreen';
import LeaderboardScreen from './LeaderboardScreen';
import './LobbyScreen.css';
import type { GamePlayer } from '../store';
import type { ActiveGameSummary } from '../types/game';

type LobbyMode = 'home' | 'create' | 'join' | 'account' | 'leaderboard';

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function LobbyScreen(): React.ReactElement {
  const [mode, setMode] = useState<LobbyMode>('home');
  const [username, setUsername] = useState(() => useGameStore.getState().currentPlayerDisplayName ?? '');
  const [lobbyCode, setLobbyCode] = useState('');
  const [botCount, setBotCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);

  const lobbyPlayers = useGameStore((state) => state.lobbyPlayers);
  const currentLobbyCode = useGameStore((state) => state.lobbyCode);
  const currentPlayerId = useGameStore((state) => state.currentPlayerId);
  const connected = useGameStore((state) => state.connected);
  const canStartGame = useGameStore((state) => state.canStartGame);
  const authUser = useGameStore((state) => state.authUser);
  const authToken = useGameStore((state) => state.authToken);
  const activeGames = useGameStore((state) => state.activeGames);
  const setActiveGames = useGameStore((state) => state.setActiveGames);
  const currentPlayerAvatar = useGameStore((s) => s.currentPlayerAvatar);
  const currentPlayerDisplayName = useGameStore((s) => s.currentPlayerDisplayName);

  useEffect(() => {
    if (currentPlayerDisplayName && !username) {
      setUsername(currentPlayerDisplayName);
    }
  }, [currentPlayerDisplayName]);

  useEffect(() => {
    if (mode !== 'home' || !authToken) return;
    fetch('/api/games/active', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.json())
      .then(data => setActiveGames(data.games ?? []))
      .catch(() => setActiveGames([]));
  }, [mode, authToken]);

  const me = lobbyPlayers.find((p) => p.id === currentPlayerId);
  const isHost = currentPlayerId === lobbyPlayers[0]?.id;
  const allReady = lobbyPlayers.length >= 2 && lobbyPlayers.every((p) => p.ready);
  const readyCount = lobbyPlayers.filter((p) => p.ready).length;

  const handleCreateLobby = async (): Promise<void> => {
    if (!username.trim()) { setError('Enter a username.'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await createLobby(username.trim(), { bombEnabled: false, turnTimerSeconds: 60, botCount, mode: 'async' }, currentPlayerAvatar);
      if (result.success) {
        useGameStore.setState({
          lobbyCode: result.lobby?.code,
          currentPlayerId: result.playerId,
          lobbyPlayers: result.lobby?.players || [],
        });
      } else {
        setError(result.reason || 'Failed to create game.');
      }
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinLobby = async (): Promise<void> => {
    if (!username.trim()) { setError('Enter a username.'); return; }
    if (!lobbyCode.trim() || lobbyCode.length < 4) { setError('Enter a valid lobby code.'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await joinLobby(lobbyCode.toUpperCase(), username.trim(), currentPlayerAvatar);
      if (result.success) {
        useGameStore.setState({
          lobbyCode: result.lobby?.code,
          currentPlayerId: result.playerId,
          lobbyPlayers: result.lobby?.players || [],
        });
      } else {
        setError(result.reason || 'Could not join. Check the code.');
      }
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetReady = async (): Promise<void> => {
    if (!currentLobbyCode || !currentPlayerId) return;
    await setPlayerReady(currentLobbyCode, currentPlayerId, true);
  };

  const handleStartGame = async (): Promise<void> => {
    if (!currentLobbyCode || !currentPlayerId) return;
    await startGame(currentLobbyCode, currentPlayerId, 'clockwise');
  };

  const handleBack = (): void => {
    setMode('home');
    setError('');
    setUsername(useGameStore.getState().currentPlayerDisplayName ?? '');
    setLobbyCode('');
  };

  const handleResumeGame = async (gameId: string): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const result = await resumeGame(gameId);
      if (result.success && result.game && result.playerId) {
        const game = result.game;
        const me = game.players.find((p: any) => p.id === result.playerId);
        const lobbyPlayersFromGame = game.players.map((p: any) => ({
          id: p.id,
          username: p.username,
          ready: true,
          isBot: p.isBot ?? false,
        }));
        useGameStore.setState({
          gameStatus: 'playing',
          currentPlayerId: result.playerId,
          gameId: game.id,
          lobbyCode: game.lobbyCode,
          playPile: game.playPile ?? [],
          hand: me?.hand ?? [],
          tableCards: me?.tableVisible ?? [],
          blindCards: me?.tableBlind ?? [],
          bombEnabled: game.bombEnabled ?? true,
          lobbyPlayers: lobbyPlayersFromGame,
          phase: game.status === 'swapping' ? 'swapping' : 'playing',
          swappedCount: (game.swappedPlayers ?? []).length,
          totalPlayers: game.players.length,
          currentPlayerUsername: game.players[game.currentPlayerIndex]?.username,
          currentTurnPlayerId: game.playOrder?.[game.currentPlayerIndex],
          deckCount: game.deck?.length ?? 0,
          activeConstraints: game.activeConstraints ?? { sevenOrUnder: false, skipCount: 0 },
          blindReveal: null,
          pickupAnimation: false,
          pickupPlayerId: null,
          bombAnimation: false,
        });
      } else {
        setError(result.reason === 'NOT_AUTHENTICATED'
          ? 'Sign in to resume games.'
          : result.reason === 'NOT_IN_GAME'
          ? 'You are not in that game.'
          : 'Could not resume game.');
      }
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── In a lobby ─────────────────────────────── */
  if (currentLobbyCode) {
    return (
      <div className="lobby-screen">
        <div className="lobby-panel animate-fade-in-up">
          {/* Header */}
          <div className="lobby-panel-header">
            <div className="lobby-title-row">
              <h1 className="lobby-game-title">POOPYHEAD</h1>
              <div className="lobby-connection-dot" title={connected ? 'Connected' : 'Disconnected'} data-connected={connected} />
            </div>
            <div className="lobby-code-block">
              <span className="lobby-code-label">Lobby Code</span>
              <div className="lobby-code-row">
                <span className="lobby-code-value">{currentLobbyCode}</span>
                <button
                  type="button"
                  className="lobby-code-copy"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(currentLobbyCode!);
                      setCopyFeedback(true);
                      setTimeout(() => setCopyFeedback(false), 1500);
                    } catch {
                      // ignore — older browsers
                    }
                  }}
                  aria-label="Copy lobby code"
                >
                  {copyFeedback ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <span className="lobby-code-hint">Share this with friends to join</span>
            </div>
          </div>

          {/* Player list */}
          <div className="lobby-players">
            <div className="lobby-players-header">
              <span>Players</span>
              <span className="lobby-ready-count">{readyCount}/{lobbyPlayers.length} ready</span>
            </div>
            <div className="lobby-players-list">
              {lobbyPlayers.map((player: GamePlayer, index: number) => (
                <PlayerCard
                  key={player.id}
                  name={player.username + (player.id === currentPlayerId ? ' (you)' : player.isBot ? ' (bot)' : '')}
                  meta={player.isBot ? 'AI Player' : player.ready ? 'Ready' : 'Waiting...'}
                  status={player.isBot ? 'ready' : player.ready ? 'ready' : 'waiting'}
                  highlight={player.id === currentPlayerId}
                  className="animate-slide-in"
                  style={{ animationDelay: `${index * 40}ms` }}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="lobby-actions">
            {!me?.ready && (
              <Button variant="primary" onClick={handleSetReady}>
                Ready Up
              </Button>
            )}
            {me?.ready && !isHost && (
              <div className="lobby-wait-msg">Waiting for host to start...</div>
            )}
            {isHost && (
              <Button
                variant="primary"
                onClick={handleStartGame}
                disabled={!allReady && !canStartGame}
              >
                {allReady || canStartGame ? 'Start Game' : `Waiting for players... (${readyCount}/${lobbyPlayers.length})`}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Pre-lobby screens ───────────────────────── */
  return (
    <div className="lobby-screen">
      <div className="lobby-panel animate-scale-in" style={{ position: 'relative' }}>
        {/* Account button — subtle, top-right corner of the panel */}
        {mode === 'home' && (
          <button
            className="lobby-account-btn"
            onClick={() => setMode('account')}
            aria-label="Account and sign in"
          >
            <span className="lobby-account-icon" aria-hidden="true">&#128100;</span>
          </button>
        )}

        {mode === 'account' && (
          <AccountScreen onBack={() => setMode('home')} />
        )}

        {mode === 'leaderboard' && (
          <LeaderboardScreen onBack={() => setMode('home')} />
        )}

        {mode === 'home' && (
          <div className="lobby-home animate-fade-in">
            <div className="lobby-home-top">
              <div className="lobby-card-deco" aria-hidden="true">
                <div className="lobby-deco-card lobby-deco-card--1">
                  <div className="lobby-deco-rank">A</div>
                  <div className="lobby-deco-suit">♠</div>
                </div>
                <div className="lobby-deco-card lobby-deco-card--2">
                  <div className="lobby-deco-rank">K</div>
                  <div className="lobby-deco-suit">♥</div>
                </div>
                <div className="lobby-deco-card lobby-deco-card--3">
                  <div className="lobby-deco-rank">10</div>
                  <div className="lobby-deco-suit">&#128169;</div>
                </div>
              </div>
            </div>
            <div className="lobby-home-copy">
              <p className="lobby-kicker">a card game for bad people</p>
              <h1 className="lobby-title">Poopyhead</h1>
              <p className="lobby-subtitle">Be the first to dump your cards. Last one holding the pile earns the title.</p>
            </div>
            <div className="lobby-suit-divider" aria-hidden="true">
              <span className="lobby-suit-pips">♠ ♥ ♣ ♦</span>
            </div>
            <div className="lobby-home-actions">
              <Button variant="primary" onClick={() => setMode('create')}>
                Start a Game
              </Button>
              <Button variant="secondary" onClick={() => setMode('join')}>
                Join with Code
              </Button>
              <Button variant="secondary" onClick={() => setMode('leaderboard')}>
                Leaderboard
              </Button>
            </div>
            {activeGames.length > 0 && (
              <div className="lobby-active-games">
                <p className="lobby-active-games-label">Resume a game</p>
                {activeGames.map((g: ActiveGameSummary) => (
                  <button
                    key={g.id}
                    className="lobby-active-game-card"
                    onClick={() => handleResumeGame(g.id)}
                    disabled={loading}
                  >
                    <span className="lobby-active-game-top">
                      <span className="lobby-active-game-code">{g.lobby_code}</span>
                      <span className={`lobby-active-game-status ${g.current_turn_user_id === authUser?.id ? 'your-turn' : ''}`}>
                        {g.current_turn_user_id === authUser?.id ? 'Your turn' : 'Waiting...'}
                      </span>
                      <span className="lobby-active-game-time">{timeAgo(g.last_action_at)}</span>
                    </span>
                    {g.players && g.players.length > 0 && (
                      <span className="lobby-active-game-players">
                        with {g.players.join(', ')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {error && <p className="lobby-error">{error}</p>}
            {!connected && (
              <p className="lobby-error lobby-offline">Connecting to server...</p>
            )}
          </div>
        )}

        {mode === 'create' && (
          <div className="lobby-form animate-fade-in-up">
            <button className="lobby-back-btn" onClick={handleBack} aria-label="Go back">
              <span className="back-arrow">&#8592;</span> Back
            </button>
            <h2 className="lobby-form-title">New Game</h2>
            <div className="lobby-fields">
              <Input
                id="create-username"
                label="Your Name"
                value={username}
                onChange={setUsername}
                placeholder="something embarrassing"
                autoFocus
              />
              {/* <label className="lobby-checkbox">
                <input
                  type="checkbox"
                  checked={bombEnabled}
                  onChange={(e) => setBombEnabled(e.target.checked)}
                />
                <span className="lobby-checkbox-track" />
                <span className="lobby-checkbox-label">Enable 10-Bomb rule</span>
              </label> */}
              <div className="lobby-bot-row">
                <span className="lobby-bot-label">AI Players</span>
                <div className="lobby-bot-stepper">
                  <button
                    type="button"
                    className="lobby-bot-btn"
                    onClick={() => setBotCount(c => Math.max(0, c - 1))}
                    disabled={botCount === 0}
                  >−</button>
                  <span className="lobby-bot-count">{botCount}</span>
                  <button
                    type="button"
                    className="lobby-bot-btn"
                    onClick={() => setBotCount(c => Math.min(4, c + 1))}
                    disabled={botCount === 4}
                  >+</button>
                </div>
              </div>
              {/* <label className="lobby-checkbox">
                <input
                  type="checkbox"
                  checked={gameMode === 'live'}
                  onChange={(e) => setGameMode(e.target.checked ? 'live' : 'async')}
                />
                <span className="lobby-checkbox-track" />
                <span className="lobby-checkbox-label">Live mode (bots take over on disconnect)</span>
              </label> */}
            </div>
            {error && <p className="lobby-error">{error}</p>}
            <Button variant="primary" onClick={handleCreateLobby} disabled={loading}>
              {loading ? 'Creating...' : 'Create Game'}
            </Button>
          </div>
        )}

        {mode === 'join' && (
          <div className="lobby-form animate-fade-in-up">
            <button className="lobby-back-btn" onClick={handleBack} aria-label="Go back">
              <span className="back-arrow">&#8592;</span> Back
            </button>
            <h2 className="lobby-form-title">Join Game</h2>
            <div className="lobby-fields">
              <Input
                id="join-username"
                label="Your Name"
                value={username}
                onChange={setUsername}
                placeholder="something embarrassing"
                autoFocus
              />
              <Input
                id="lobby-code"
                label="Lobby Code"
                autoCapitalize="characters"
                placeholder="e.g. ABC123"
                value={lobbyCode}
                onChange={(v) => setLobbyCode(v.toUpperCase())}
                maxLength={6}
                codeStyle
              />
            </div>
            {error && <p className="lobby-error">{error}</p>}
            <Button variant="primary" onClick={handleJoinLobby} disabled={loading}>
              {loading ? 'Joining...' : 'Join Game'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default LobbyScreen;

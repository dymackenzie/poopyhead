/**
 * Lobby Screen
 * Home → Create/Join → Lobby waiting room
 */

import React, { useState } from 'react';
import { useGameStore } from '../store';
import { createLobby, joinLobby, setPlayerReady, startGame } from '../socketClient';
import Button from '../components/Button';
import Input from '../components/Input';
import PlayerCard from '../components/PlayerCard';
import './LobbyScreen.css';
import type { GamePlayer } from '../store';

type LobbyMode = 'home' | 'create' | 'join';

export function LobbyScreen(): React.ReactElement {
  const [mode, setMode] = useState<LobbyMode>('home');
  const [username, setUsername] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [bombEnabled, setBombEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lobbyPlayers = useGameStore((state) => state.lobbyPlayers);
  const currentLobbyCode = useGameStore((state) => state.lobbyCode);
  const currentPlayerId = useGameStore((state) => state.currentPlayerId);
  const connected = useGameStore((state) => state.connected);
  const canStartGame = useGameStore((state) => state.canStartGame);

  const me = lobbyPlayers.find((p) => p.id === currentPlayerId);
  const isHost = currentPlayerId === lobbyPlayers[0]?.id;
  const allReady = lobbyPlayers.length >= 2 && lobbyPlayers.every((p) => p.ready);
  const readyCount = lobbyPlayers.filter((p) => p.ready).length;

  const handleCreateLobby = async (): Promise<void> => {
    if (!username.trim()) { setError('Enter a username.'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await createLobby(username.trim(), { bombEnabled, turnTimerSeconds: 60 });
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
      const result = await joinLobby(lobbyCode.toUpperCase(), username.trim());
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
    setUsername('');
    setLobbyCode('');
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
              <span className="lobby-code-value">{currentLobbyCode}</span>
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
                  name={player.username + (player.id === currentPlayerId ? ' (you)' : '')}
                  meta={player.ready ? 'Ready' : 'Waiting...'}
                  status={player.ready ? 'ready' : 'waiting'}
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
      <div className="lobby-panel animate-scale-in">
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
              <p className="lobby-kicker">Multiplayer Card Game</p>
              <h1 className="lobby-title">Poopyhead</h1>
              <p className="lobby-subtitle">Last one holding cards loses. Don't be the Poopyhead.</p>
            </div>
            <div className="lobby-home-actions">
              <Button variant="primary" onClick={() => setMode('create')}>
                Create Game
              </Button>
              <Button variant="secondary" onClick={() => setMode('join')}>
                Join Game
              </Button>
            </div>
            {!connected && (
              <p className="lobby-error lobby-offline">Connecting to server...</p>
            )}
          </div>
        )}

        {mode === 'create' && (
          <div className="lobby-form animate-fade-in-up">
            <button className="lobby-back-btn" onClick={handleBack} aria-label="Go back">
              &#8592; Back
            </button>
            <h2 className="lobby-form-title">New Game</h2>
            <div className="lobby-fields">
              <Input
                id="create-username"
                label="Your Name"
                value={username}
                onChange={setUsername}
                placeholder="Enter a username"
                autoFocus
              />
              <label className="lobby-checkbox">
                <input
                  type="checkbox"
                  checked={bombEnabled}
                  onChange={(e) => setBombEnabled(e.target.checked)}
                />
                <span className="lobby-checkbox-track" />
                <span className="lobby-checkbox-label">Enable 10-Bomb rule</span>
              </label>
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
              &#8592; Back
            </button>
            <h2 className="lobby-form-title">Join Game</h2>
            <div className="lobby-fields">
              <Input
                id="join-username"
                label="Your Name"
                value={username}
                onChange={setUsername}
                placeholder="Enter a username"
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

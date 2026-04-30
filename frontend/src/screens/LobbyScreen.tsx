/**
 * Lobby Screen Component
 */

import React, { useState } from 'react';
import { useGameStore } from '../store';
import { createLobby, joinLobby, setPlayerReady, startGame } from '../socketClient';
import './LobbyScreen.css';

export function LobbyScreen(): React.ReactElement {
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');
  const [username, setUsername] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [bombEnabled, setBombEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  const lobbyPlayers = useGameStore((state: any) => state.lobbyPlayers);
  const currentLobbyCode = useGameStore((state: any) => state.lobbyCode);
  const currentPlayerId = useGameStore((state: any) => state.currentPlayerId);

  const handleCreateLobby = async (): Promise<void> => {
    if (!username.trim()) return;
    setLoading(true);
    try {
      const result = await createLobby(username, { bombEnabled, turnTimerSeconds: 60 });
      if (result.success) {
        useGameStore.setState({
          lobbyCode: result.lobby?.code,
          currentPlayerId: result.playerId,
          lobbyPlayers: result.lobby?.players || [],
        });
        setMode('home');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinLobby = async (): Promise<void> => {
    if (!username.trim() || !lobbyCode.trim()) return;
    setLoading(true);
    try {
      const result = await joinLobby(lobbyCode.toUpperCase(), username);
      if (result.success) {
        useGameStore.setState({
          lobbyCode: result.lobby?.code,
          currentPlayerId: result.playerId,
          lobbyPlayers: result.lobby?.players || [],
        });
        setMode('home');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetReady = async (): Promise<void> => {
    if (!currentLobbyCode || !currentPlayerId) return;
    await setPlayerReady(currentLobbyCode, currentPlayerId, true);
  };

  const handleStartGame = async () => {
    if (!currentLobbyCode || !currentPlayerId) return;
    await startGame(currentLobbyCode, currentPlayerId, 'clockwise');
  };

  if (!currentLobbyCode) {
    return (
      <div className="lobby-screen">
        <div className="lobby-card">
          {mode === 'home' && (
            <>
              <h1>🎴 Poopyhead</h1>
              <p>A fun card game for friends!</p>
              <div className="button-group">
                <button className="button button-primary" onClick={() => setMode('create')}>
                  Create Game
                </button>
                <button className="button button-secondary" onClick={() => setMode('join')}>
                  Join Game
                </button>
              </div>
            </>
          )}

          {mode === 'create' && (
            <>
              <h2>Create New Game</h2>
              <input
                className="input"
                type="text"
                placeholder="Your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <label className="checkbox-label">
                <input type="checkbox" checked={bombEnabled} onChange={(e) => setBombEnabled(e.target.checked)} />
                Enable 10-Bomb rule
              </label>
              <button className="button button-primary" onClick={handleCreateLobby} disabled={loading}>
                {loading ? 'Creating...' : 'Create Game'}
              </button>
              <button className="button button-secondary" onClick={() => setMode('home')}>
                Back
              </button>
            </>
          )}

          {mode === 'join' && (
            <>
              <h2>Join Game</h2>
              <input
                className="input"
                type="text"
                placeholder="Your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <input
                className="input"
                type="text"
                placeholder="Game code (e.g., ABC123)"
                value={lobbyCode}
                onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                maxLength={6}
              />
              <button className="button button-primary" onClick={handleJoinLobby} disabled={loading}>
                {loading ? 'Joining...' : 'Join Game'}
              </button>
              <button className="button button-secondary" onClick={() => setMode('home')}>
                Back
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-screen">
      <div className="lobby-card">
        <h2>Game Lobby</h2>
        <p className="lobby-code">Code: <strong>{currentLobbyCode}</strong></p>

        <div className="players-list">
          <h3>Players ({lobbyPlayers.length})</h3>
          {lobbyPlayers.map((player: any) => (
            <div key={player.id} className="player-item">
              <span>{player.username}</span>
              <span className={player.ready ? 'ready' : 'not-ready'}>
                {player.ready ? '✓ Ready' : 'Waiting...'}
              </span>
            </div>
          ))}
        </div>

        <div className="button-group">
          <button className="button button-primary" onClick={handleSetReady}>
            Ready!
          </button>
          <button className="button button-primary" onClick={handleStartGame} disabled={lobbyPlayers.length < 2}>
            Start Game
          </button>
        </div>
      </div>
    </div>
  );
}

export default LobbyScreen;

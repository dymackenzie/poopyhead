/**
 * Lobby Screen Component
 */

import React, { useState } from 'react';
import { useGameStore } from '../store';
import { createLobby, joinLobby, setPlayerReady, startGame } from '../socketClient';
import Button from '../components/Button';
import Input from '../components/Input';
import PlayerCard from '../components/PlayerCard';
import './LobbyScreen.css';
import type { GamePlayer } from '../store';

export function LobbyScreen(): React.ReactElement {
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');
  const [username, setUsername] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [bombEnabled, setBombEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  const lobbyPlayers = useGameStore((state) => state.lobbyPlayers);
  const currentLobbyCode = useGameStore((state) => state.lobbyCode);
  const currentPlayerId = useGameStore((state) => state.currentPlayerId);

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
        <div className="lobby-card animate-fade-in">
          {mode === 'home' && (
            <>
              <p className="lobby-kicker">Card Game</p>
              <h1>Poopyhead</h1>
              <p className="lobby-subtitle">Create a table or join with a lobby code.</p>
              <div className="button-group">
                <Button variant="primary" onClick={() => setMode('create')}>
                  Create Game
                </Button>
                <Button variant="secondary" onClick={() => setMode('join')}>
                  Join Game
                </Button>
              </div>
            </>
          )}

          {mode === 'create' && (
            <>
              <h2>Create New Game</h2>
              <Input
                id="create-username"
                label="Username"
                value={username}
                onChange={setUsername}
                placeholder="Your username"
              />
              <label className="checkbox-label">
                <input type="checkbox" checked={bombEnabled} onChange={(e) => setBombEnabled(e.target.checked)} />
                Enable 10-Bomb rule
              </label>
              <Button variant="primary" onClick={handleCreateLobby} disabled={loading}>
                {loading ? 'Creating...' : 'Create Game'}
              </Button>
              <Button variant="secondary" onClick={() => setMode('home')}>
                Back
              </Button>
            </>
          )}

          {mode === 'join' && (
            <>
              <h2>Join Game</h2>
              <Input
                id="join-username"
                label="Username"
                value={username}
                onChange={setUsername}
                placeholder="Your username"
              />
              <Input
                id="lobby-code"
                label="Lobby Code"
                autoCapitalize="characters"
                placeholder="Game code (e.g., ABC123)"
                value={lobbyCode}
                onChange={(value) => setLobbyCode(value.toUpperCase())}
                maxLength={6}
                codeStyle
              />
              <Button variant="primary" onClick={handleJoinLobby} disabled={loading}>
                {loading ? 'Joining...' : 'Join Game'}
              </Button>
              <Button variant="secondary" onClick={() => setMode('home')}>
                Back
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-screen">
      <div className="lobby-card animate-fade-in">
        <h2>Game Lobby</h2>
        <p className="lobby-code">Code: <strong>{currentLobbyCode}</strong></p>

        <div className="players-list">
          <h3>Players ({lobbyPlayers.length})</h3>
          {lobbyPlayers.map((player: GamePlayer, index: number) => (
            <PlayerCard
              key={player.id}
              className="animate-slide-in"
              name={player.username}
              meta={player.ready ? 'Ready' : 'Waiting...'}
              status={player.ready ? 'ready' : 'waiting'}
              highlight={player.id === currentPlayerId}
              style={{ animationDelay: `${index * 25}ms` }}
            />
          ))}
        </div>

        <div className="button-group">
          <Button variant="primary" onClick={handleSetReady}>
            Ready!
          </Button>
          {currentPlayerId === lobbyPlayers[0]?.id && (
            <Button variant="primary" onClick={handleStartGame} disabled={lobbyPlayers.length < 2}>
              Start Game
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default LobbyScreen;

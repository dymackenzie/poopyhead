/**
 * Game Screen Component
 */

import React, { useState } from 'react';
import { useGameStore } from '../store';
import { playCards } from '../socketClient';
import Button from '../components/Button';
import Card from '../components/Card';
import PlayerCard from '../components/PlayerCard';
import PileDisplay from '../components/PileDisplay';
import './GameScreen.css';
import type { GameCard, LobbyPlayer } from '../types/game';

export function GameScreen(): React.ReactElement {
  const hand = useGameStore((state) => state.hand);
  const tableCards = useGameStore((state) => state.tableCards);
  const playPile = useGameStore((state) => state.playPile);
  const playableCards = useGameStore((state) => state.playableCards);
  const currentPlayerUsername = useGameStore((state) => state.currentPlayerUsername);
  const gameId = useGameStore((state) => state.gameId);
  const currentPlayerId = useGameStore((state) => state.currentPlayerId);
  const lobbyPlayers = useGameStore((state) => state.lobbyPlayers);

  const [selectedCards, setSelectedCards] = useState<string[]>([]);

  const you = lobbyPlayers.find((player: LobbyPlayer) => player.id === currentPlayerId);
  const opponents = lobbyPlayers.filter((player: LobbyPlayer) => player.id !== currentPlayerId);
  const topPileCard = playPile.length > 0 ? playPile[playPile.length - 1] : null;
  const isYourTurn = !!you && currentPlayerUsername === you.username;

  const handleSelectCard = (cardId: string): void => {
    setSelectedCards((prev: string[]) =>
      prev.includes(cardId) ? prev.filter((id: string) => id !== cardId) : [...prev, cardId]
    );
  };

  const handlePlayCards = async (): Promise<void> => {
    if (selectedCards.length === 0 || !gameId || !currentPlayerId) return;
    await playCards(gameId, currentPlayerId, selectedCards);
    setSelectedCards([]);
  };

  return (
    <div className="game-screen">
      <div className="game-header">
        <div className={`turn-pill ${isYourTurn ? 'is-active animate-turn-pulse' : ''}`}>
          {isYourTurn ? 'Your Turn' : `${currentPlayerUsername || 'Waiting'} Turn`}
        </div>
        <div className="player-rail" role="list" aria-label="Opponents">
          {opponents.map((player: LobbyPlayer, index: number) => (
            <PlayerCard
              key={player.id}
              className="opponent-chip animate-slide-in"
              name={player.username}
              meta={`${player.cardsRemaining ?? '-'} cards`}
              style={{ animationDelay: `${index * 30}ms` }}
            />
          ))}
        </div>
      </div>

      <div className="game-board">
        {/* Pile */}
        <PileDisplay
          title="Play Pile"
          count={playPile.length}
          topCard={topPileCard}
        />

        {/* Table Cards */}
        <div className="table-area">
          <div className="table-title">Table</div>
          <div className="table-cards">
            {tableCards.map((card: GameCard, idx: number) => (
              <Card key={card.id} className="table-card animate-slide-up" rank={card.rank} suit={card.suit} style={{ animationDelay: `${idx * 25}ms` }} />
            ))}
          </div>
        </div>
      </div>

      {/* Hand */}
      <div className="hand-area">
        <div className="hand-title">Your Hand ({hand.length})</div>
        <div className="hand-cards">
          {hand.map((card: GameCard, index: number) => (
            <Card
              key={card.id}
              className="hand-card animate-slide-up"
              selected={selectedCards.includes(card.id)}
              disabled={!playableCards.includes(card.id)}
              onClick={() => handleSelectCard(card.id)}
              rank={card.rank}
              suit={card.suit}
              style={{ animationDelay: `${index * 20}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="controls">
        <Button variant="primary" onClick={handlePlayCards} disabled={selectedCards.length === 0}>
          Play ({selectedCards.length})
        </Button>
        <Button variant="secondary" disabled>
          Pickup
        </Button>
      </div>
    </div>
  );
}

export default GameScreen;

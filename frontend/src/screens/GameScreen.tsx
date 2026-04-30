/**
 * Game Screen Component
 */

import React, { useState } from 'react';
import { useGameStore } from '../store';
import { playCards } from '../socketClient';
import './GameScreen.css';

export function GameScreen(): React.ReactElement {
  const hand = useGameStore((state: any) => state.hand);
  const tableCards = useGameStore((state: any) => state.tableCards);
  const playPile = useGameStore((state: any) => state.playPile);
  const playableCards = useGameStore((state: any) => state.playableCards);
  const currentPlayerUsername = useGameStore((state: any) => state.currentPlayerUsername);
  const gameId = useGameStore((state: any) => state.gameId);
  const currentPlayerId = useGameStore((state: any) => state.currentPlayerId);

  const [selectedCards, setSelectedCards] = useState<string[]>([]);

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
        <h2>Current: {currentPlayerUsername}</h2>
      </div>

      <div className="game-board">
        {/* Pile */}
        <div className="pile-area">
          <div className="pile-title">Pile ({playPile.length})</div>
          <div className="pile-display">
            {playPile.length > 0 && (
              <div className="card pile-card">
                {playPile[playPile.length - 1]?.rank} {playPile[playPile.length - 1]?.suit}
              </div>
            )}
          </div>
        </div>

        {/* Table Cards */}
        <div className="table-area">
          <div className="table-title">Table Cards</div>
          <div className="table-cards">
            {tableCards.map((card: any, idx: number) => (
              <div key={idx} className="card table-card">
                {card.rank} {card.suit}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hand */}
      <div className="hand-area">
        <div className="hand-title">Your Hand</div>
        <div className="hand-cards">
          {hand.map((card: any) => (
            <div
              key={card.id}
              className={`card hand-card ${
                selectedCards.includes(card.id) ? 'selected' : ''
              } ${!playableCards.includes(card.id) ? 'disabled' : ''}`}
              onClick={() => handleSelectCard(card.id)}
            >
              {card.rank}
              <div className="suit">{card.suit}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="controls">
        <button className="button button-primary" onClick={handlePlayCards} disabled={selectedCards.length === 0}>
          Play ({selectedCards.length})
        </button>
        <button className="button button-secondary">
          Pickup
        </button>
      </div>
    </div>
  );
}

export default GameScreen;

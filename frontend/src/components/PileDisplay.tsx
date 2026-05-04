import React from 'react';
import Card from './Card';
import './PileDisplay.css';
import type { GameCard } from '../types/game';

interface PileDisplayProps {
  title: string;
  count: number;
  topCard?: GameCard | null;
}

export function PileDisplay({ title, count, topCard }: PileDisplayProps): React.ReactElement {
  return (
    <div className="pile-area">
      <div className="pile-title">{title}</div>
      <div className="pile-display animate-card-pulse" aria-live="polite">
        {topCard ? (
          <Card key={`${topCard.id}-${count}`} rank={topCard.rank} suit={topCard.suit} className="pile-card" />
        ) : (
          <div className="pile-empty">No cards yet</div>
        )}
      </div>
      <div className="pile-count">{count} cards</div>
    </div>
  );
}

export default PileDisplay;

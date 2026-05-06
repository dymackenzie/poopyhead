import React from 'react';
import Card from './Card';
import './PileDisplay.css';
import type { GameCard } from '../types/game';

interface PileDisplayProps {
  title: string;
  count: number;
  topCard?: GameCard | null;
  /** Show stacked deck visual (for draw pile) */
  isDeck?: boolean;
}

export function PileDisplay({ title, count, topCard, isDeck = false }: PileDisplayProps): React.ReactElement {
  return (
    <div className={`ph-pile ${isDeck ? 'ph-pile--deck' : 'ph-pile--discard'}`}>
      <div className="ph-pile-label">{title}</div>
      <div className="ph-pile-slot" aria-live="polite" aria-label={`${title}: ${count} cards`}>
        {isDeck ? (
          /* Draw deck — show stacked face-down cards */
          <div className="ph-pile-deck-stack">
            {count > 2 && <div className="ph-pile-deck-card ph-pile-deck-card--3" />}
            {count > 1 && <div className="ph-pile-deck-card ph-pile-deck-card--2" />}
            {count > 0 ? (
              <Card faceDown size="md" className="ph-pile-deck-card--top" />
            ) : (
              <div className="ph-pile-empty">Empty</div>
            )}
          </div>
        ) : topCard ? (
          <Card
            key={`${topCard.id}-${count}`}
            rank={topCard.rank}
            suit={topCard.suit}
            size="md"
            className="ph-pile-top-card animate-card-pulse"
          />
        ) : (
          <div className="ph-pile-empty">Empty</div>
        )}
      </div>
      <div className="ph-pile-count">{count}</div>
    </div>
  );
}

export default PileDisplay;

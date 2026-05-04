import React from 'react';
import './PlayerCard.css';

type PlayerCardStatus = 'ready' | 'waiting' | 'neutral';

interface PlayerCardProps {
  name: string;
  meta?: string;
  status?: PlayerCardStatus;
  highlight?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function PlayerCard({
  name,
  meta,
  status = 'neutral',
  highlight = false,
  className = '',
  style,
}: PlayerCardProps): React.ReactElement {
  const statusClass = status === 'ready' ? 'is-ready' : status === 'waiting' ? 'is-waiting' : '';

  return (
    <div className={`player-card ${statusClass} ${highlight ? 'is-highlight' : ''} ${className}`.trim()} style={style}>
      <span className="player-name">{name}</span>
      {meta && <span className="player-meta">{meta}</span>}
    </div>
  );
}

export default PlayerCard;

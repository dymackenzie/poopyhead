import React from 'react';
import './PlayerCard.css';

type PlayerStatus = 'ready' | 'waiting' | 'active' | 'neutral';

interface PlayerCardProps {
  name: string;
  meta?: string;
  status?: PlayerStatus;
  highlight?: boolean;
  isActive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function PlayerCard({
  name,
  meta,
  status = 'neutral',
  highlight = false,
  isActive = false,
  className = '',
  style,
}: PlayerCardProps): React.ReactElement {
  return (
    <div
      className={[
        'ph-player-card',
        status === 'ready'   ? 'ph-player-card--ready'   : '',
        status === 'waiting' ? 'ph-player-card--waiting' : '',
        status === 'active'  ? 'ph-player-card--active'  : '',
        highlight ? 'ph-player-card--highlight' : '',
        isActive  ? 'ph-player-card--turn'      : '',
        className,
      ].filter(Boolean).join(' ')}
      style={style}
    >
      {isActive && <span className="ph-player-card-dot" aria-hidden="true" />}
      <span className="ph-player-card-name">{name}</span>
      {meta && <span className="ph-player-card-meta">{meta}</span>}
    </div>
  );
}

export default PlayerCard;

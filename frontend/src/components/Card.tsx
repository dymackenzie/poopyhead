import React from 'react';
import './Card.css';

export type CardSize = 'sm' | 'md' | 'lg';

interface CardProps {
  rank: string;
  suit: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  className?: string;
  size?: CardSize;
  style?: React.CSSProperties;
}

export function Card({
  rank,
  suit,
  selected = false,
  disabled = false,
  onClick,
  className = '',
  size = 'md',
  style,
}: CardProps): React.ReactElement {
  const resolvedClassName = [
    'card',
    'ph-card',
    `ph-card-${size}`,
    selected ? 'selected' : '',
    disabled ? 'disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={resolvedClassName} onClick={disabled ? undefined : onClick} role="button" aria-disabled={disabled} style={style}>
      <div className="card-rank">{rank}</div>
      <div className="card-suit">{suit}</div>
    </div>
  );
}

export default Card;

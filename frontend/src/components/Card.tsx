/**
 * PlayingCard Component
 *
 * Renders a proper playing card with suit/rank styling.
 * Supports face-up, face-down (card back), selected, disabled states.
 */

import React from 'react';
import './Card.css';

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

interface CardProps {
  rank?: string;
  suit?: string;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  className?: string;
  size?: CardSize;
  style?: React.CSSProperties;
  'aria-label'?: string;
}

/** Maps suit characters to colored unicode symbols */
function getSuitSymbol(suit: string): { symbol: string; isRed: boolean } {
  const s = suit?.toLowerCase() ?? '';
  if (s === 'hearts'   || s === 'h' || s === '♥') return { symbol: '♥', isRed: true };
  if (s === 'diamonds' || s === 'd' || s === '♦') return { symbol: '♦', isRed: true };
  if (s === 'spades'   || s === 's' || s === '♠') return { symbol: '♠', isRed: false };
  if (s === 'clubs'    || s === 'c' || s === '♣') return { symbol: '♣', isRed: false };
  return { symbol: suit ?? '?', isRed: false };
}

/** Normalizes rank display (11→J, 12→Q, 13→K, 14/1→A) */
function getRankDisplay(rank: string): string {
  const r = rank?.toUpperCase() ?? '';
  if (r === '11') return 'J';
  if (r === '12') return 'Q';
  if (r === '13') return 'K';
  if (r === '14' || r === '1') return 'A';
  return r;
}

/** Card back pattern — geometric cross-hatch */
function CardBack(): React.ReactElement {
  return (
    <div className="card-back-inner" aria-hidden="true">
      <div className="card-back-pattern">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="crosshatch" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="8" y2="8" stroke="rgba(255,255,255,0.08)" strokeWidth="0.75"/>
              <line x1="8" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.08)" strokeWidth="0.75"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#crosshatch)"/>
        </svg>
      </div>
      <div className="card-back-center">
        <span className="card-back-icon">&#128169;</span>
      </div>
    </div>
  );
}

export function Card({
  rank = '',
  suit = '',
  faceDown = false,
  selected = false,
  disabled = false,
  onClick,
  className = '',
  size = 'md',
  style,
  'aria-label': ariaLabel,
}: CardProps): React.ReactElement {
  const { symbol, isRed } = getSuitSymbol(suit);
  const rankDisplay = getRankDisplay(rank);
  const isClickable = !!onClick && !disabled;

  const classes = [
    'ph-card',
    `ph-card--${size}`,
    faceDown   ? 'ph-card--back'     : 'ph-card--face',
    selected   ? 'ph-card--selected' : '',
    disabled   ? 'ph-card--disabled' : '',
    isRed && !faceDown ? 'ph-card--red' : '',
    isClickable ? 'ph-card--clickable' : '',
    className,
  ].filter(Boolean).join(' ');

  const label = ariaLabel ?? (faceDown ? 'Card face down' : `${rankDisplay} of ${suit}`);

  return (
    <div
      className={classes}
      onClick={isClickable ? onClick : undefined}
      onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
      role={isClickable ? 'button' : undefined}
      aria-label={label}
      aria-disabled={disabled || undefined}
      aria-pressed={selected || undefined}
      style={style}
    >
      {faceDown ? (
        <CardBack />
      ) : (
        <>
          {/* Top-left index */}
          <div className="card-index card-index--tl">
            <span className="card-index-rank">{rankDisplay}</span>
            <span className="card-index-suit">{symbol}</span>
          </div>

          {/* Center */}
          <div className="card-center" aria-hidden="true">
            <span className="card-center-suit">{symbol}</span>
          </div>

          {/* Bottom-right index (rotated 180) */}
          <div className="card-index card-index--br" aria-hidden="true">
            <span className="card-index-rank">{rankDisplay}</span>
            <span className="card-index-suit">{symbol}</span>
          </div>
        </>
      )}
    </div>
  );
}

export default Card;

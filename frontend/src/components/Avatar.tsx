import React from 'react';
import { avatarUrl } from '../avatars';
import './Avatar.css';

interface AvatarProps {
  slug?: string;
  size?: number;
  selected?: boolean;
  onClick?: () => void;
  alt?: string;
  className?: string;
}

export function Avatar({ slug, size = 40, selected = false, onClick, alt = '', className = '' }: AvatarProps): React.ReactElement {
  const cls = ['ph-avatar', selected ? 'ph-avatar--selected' : '', className].filter(Boolean).join(' ');
  const style: React.CSSProperties = { width: size, height: size };

  if (onClick) {
    return (
      <button className={cls} style={style} onClick={onClick} type="button" aria-pressed={selected}>
        <img src={avatarUrl(slug)} alt={alt} draggable={false} />
      </button>
    );
  }
  return (
    <div className={cls} style={style}>
      <img src={avatarUrl(slug)} alt={alt} draggable={false} />
    </div>
  );
}

export default Avatar;

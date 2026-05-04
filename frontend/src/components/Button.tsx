import React from 'react';
import './Button.css';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  variant?: ButtonVariant;
  className?: string;
}

export function Button({
  children,
  onClick,
  disabled = false,
  type = 'button',
  variant = 'primary',
  className = '',
}: ButtonProps): React.ReactElement {
  return (
    <button
      type={type}
      className={`button ph-button button-${variant} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default Button;

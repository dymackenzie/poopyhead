import React from 'react';
import './Button.css';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  variant?: ButtonVariant;
  className?: string;
  fullWidth?: boolean;
}

export function Button({
  children,
  onClick,
  disabled = false,
  type = 'button',
  variant = 'primary',
  className = '',
  fullWidth = true,
}: ButtonProps): React.ReactElement {
  return (
    <button
      type={type}
      className={[
        'button',
        'ph-button',
        `button-${variant}`,
        fullWidth ? 'button--full' : 'button--auto',
        className,
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default Button;

import React from 'react';
import './Input.css';

interface InputProps {
  id: string;
  label?: string;
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  type?: 'text' | 'number' | 'password';
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  codeStyle?: boolean;
  autoFocus?: boolean;
}

export function Input({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  maxLength,
  autoCapitalize,
  codeStyle = false,
  autoFocus = false,
}: InputProps): React.ReactElement {
  return (
    <div className="ph-input-wrap">
      {label && (
        <label className="ph-input-label" htmlFor={id}>
          {label}
        </label>
      )}
      <input
        id={id}
        className={['input', 'ph-input', codeStyle ? 'ph-input--code' : ''].filter(Boolean).join(' ')}
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default Input;

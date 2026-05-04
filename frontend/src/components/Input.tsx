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
}: InputProps): React.ReactElement {
  return (
    <div className="ph-input-wrap">
      {label && (
        <label className="field-label ph-input-label" htmlFor={id}>
          {label}
        </label>
      )}
      <input
        id={id}
        className={`input ph-input ${codeStyle ? 'is-code' : ''}`.trim()}
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export default Input;

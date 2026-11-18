import { useState } from 'react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Chips wala email input.
 * Enter / comma / space / paste / blur par email chip ban jaata hai.
 */
export default function RecipientInput({ label, values, onChange, placeholder, required }) {
  const [text, setText] = useState('');
  const [bad, setBad] = useState('');

  const commit = (raw) => {
    const parts = raw
      .split(/[\s,;]+/)
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
    if (!parts.length) return;

    const next = [...values];
    let invalid = '';
    for (const p of parts) {
      if (!EMAIL_RE.test(p)) invalid = p;
      else if (!next.includes(p)) next.push(p);
    }
    onChange(next);
    setBad(invalid ? `"${invalid}" is not a valid email` : '');
    setText(invalid || '');
  };

  const onKeyDown = (e) => {
    if (['Enter', ',', ' ', ';'].includes(e.key)) {
      if (text.trim()) {
        e.preventDefault();
        commit(text);
      } else if (e.key === 'Enter') {
        e.preventDefault();
      }
    } else if (e.key === 'Backspace' && !text && values.length) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div className="field">
      <span className="label">
        {label}
        {required && <span className="req"> *</span>}
      </span>
      <div className="chips">
        {values.map((v) => (
          <span className="chip" key={v}>
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
              ×
            </button>
          </span>
        ))}
        <input
          value={text}
          placeholder={values.length ? '' : placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setBad('');
          }}
          onKeyDown={onKeyDown}
          onBlur={() => commit(text)}
          onPaste={(e) => {
            e.preventDefault();
            commit(e.clipboardData.getData('text'));
          }}
        />
      </div>
      {bad && <div className="hint error-text">{bad}</div>}
    </div>
  );
}

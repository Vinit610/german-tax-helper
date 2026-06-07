// A labelled numeric input that edits euro/number values. Keeps the raw string
// locally so the user can clear and retype freely.

import { useEffect, useState } from 'react';

interface Props {
  label: string;
  germanLabel?: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  step?: number;
  hint?: string;
}

export function NumberField({ label, germanLabel, value, onChange, suffix = '€', step, hint }: Props) {
  const [text, setText] = useState(value ? String(value) : '');

  // Keep local text in sync when the value changes from outside (e.g. parsing).
  useEffect(() => {
    setText(value ? String(value) : '');
  }, [value]);

  return (
    <label className="block">
      <span className="label">
        {label}
        {germanLabel && <span className="ml-1 font-normal text-slate-400">· {germanLabel}</span>}
      </span>
      <div className="flex items-center gap-2">
        <input
          className="input"
          inputMode="decimal"
          type="number"
          step={step}
          value={text}
          placeholder="0"
          onChange={(e) => {
            setText(e.target.value);
            const n = Number.parseFloat(e.target.value);
            onChange(Number.isFinite(n) ? n : 0);
          }}
        />
        {suffix && <span className="text-sm text-slate-400">{suffix}</span>}
      </div>
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

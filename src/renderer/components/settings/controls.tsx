import { useId, useState, type ReactNode } from 'react';

export function Group({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="group">
      {title && <h2 className="group__title">{title}</h2>}
      <div className="group__body">{children}</div>
      {footer && <p className="group__footer">{footer}</p>}
    </section>
  );
}

export function Row({ label, hint, children, stacked }: { label: string; hint?: ReactNode; children?: ReactNode; stacked?: boolean }) {
  return (
    <div className={`row${stacked ? ' row--stacked' : ''}`}>
      <div className="row__label">
        <div>{label}</div>
        {hint && <div className="row__hint">{hint}</div>}
      </div>
      {children && <div className="row__control">{children}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="toggle" onClick={() => onChange(!checked)}>
      <span className="toggle__knob" />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className="segmented__item" onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  format,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  label: string;
}) {
  return (
    <div className="slider">
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="slider__value">{format ? format(value) : value}</span>
    </div>
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <select className="select" aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TextField({
  value,
  onCommit,
  placeholder,
  type = 'text',
  label,
  monospace,
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password';
  label: string;
  monospace?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };
  return (
    <input
      id={id}
      aria-label={label}
      className={`input${monospace ? ' input--mono' : ''}`}
      type={type}
      value={shown}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

export function Button({
  children,
  onClick,
  kind = 'default',
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  kind?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
}) {
  return (
    <button type="button" className={`btn btn--${kind}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function StatusPill({ tone, children }: { tone: 'ok' | 'warn' | 'idle'; children: ReactNode }) {
  return (
    <span className={`status status--${tone}`}>
      <i />
      {children}
    </span>
  );
}

import { createPortal } from 'react-dom';
import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { AlertTriangle, Check, ChevronDown, Info, X } from 'lucide-react';
import { cx } from '../lib/cx';
import { SWATCHES, gradientCss, isHex } from '../core/colors';
import { formatNumber, parseNumber } from '../core/format';

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  full?: boolean;
  className?: string;
  children?: ReactNode;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  title?: string;
  autoFocus?: boolean;
  'aria-label'?: string;
  'aria-pressed'?: boolean;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: 'menu' | 'dialog' | 'listbox' | boolean;
  'data-autofocus'?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  loading,
  full,
  className,
  children,
  type = 'button',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cx('btn', `btn-${variant}`, `btn-${size}`, full && 'w-full', className)}
      {...rest}
    >
      {loading ? <Spinner size={size === 'lg' ? 18 : 15} /> : icon}
      {children}
      {iconRight}
    </button>
  );
}

export interface IconButtonProps {
  /** Required: it is the accessible name and the tooltip. */
  label: string;
  icon: ReactNode;
  variant?: Variant;
  size?: Size;
  active?: boolean;
  tooltip?: boolean;
  side?: 'top' | 'bottom' | 'right';
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  onPointerDown?: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  'aria-pressed'?: boolean;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: 'menu' | 'dialog' | 'listbox' | boolean;
}

const ICON_SIZES: Record<Size, string> = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = 'ghost', size = 'md', active, tooltip = true, side = 'top', className, type = 'button', ...rest },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cx('btn p-0', `btn-${variant}`, ICON_SIZES[size], active && 'bg-accent/15 text-ink', className)}
      {...rest}
    >
      {icon}
    </button>
  );
  return tooltip ? (
    <Tooltip label={label} side={side}>
      {button}
    </Tooltip>
  ) : (
    button
  );
});

export function Tooltip({ label, children, side = 'top' }: { label: string; children: ReactNode; side?: 'top' | 'bottom' | 'right' }) {
  return (
    <span className="tip" data-tip={label} data-side={side}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Layout bits                                                         */
/* ------------------------------------------------------------------ */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="eyebrow">{children}</h2>
      {aside}
    </div>
  );
}

export function Card({ className, children, solid }: { className?: string; children?: ReactNode; solid?: boolean }) {
  return <div className={cx(solid ? 'card-solid' : 'card', className)}>{children}</div>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'good' | 'bad' }) {
  const tones = {
    neutral: 'border-line/15 bg-raised/70 text-muted',
    accent: 'border-accent/40 bg-accent/15 text-ink',
    good: 'border-good/40 bg-good/10 text-good',
    bad: 'border-bad/40 bg-bad/10 text-bad',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', tones[tone])}>{children}</span>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.6rem] items-center justify-center rounded-md border border-line/20 bg-raised px-1.5 py-0.5 font-sans text-[12px] font-medium text-ink shadow-[0_1px_0_rgb(var(--line)/0.2)]">
      {children}
    </kbd>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg className="spinner" width={size} height={size} viewBox="0 0 24 24" fill="none" role="status" aria-label="Loading">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden="true" />;
}

/** Shown while a page's code is loading. */
export function PageSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading page">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="grid gap-4 pt-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  children,
  compact,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cx('flex flex-col items-center justify-center text-center', compact ? 'py-10' : 'py-16')}>
      <div
        className="mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-line/15 text-accent shadow-soft"
        style={{ background: 'linear-gradient(145deg, rgb(var(--accent) / 0.18), rgb(var(--accent2) / 0.08))' }}
      >
        {icon}
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {children && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

export function Notice({ tone = 'info', children, action }: { tone?: 'info' | 'warn' | 'error'; children: ReactNode; action?: ReactNode }) {
  const tones = {
    info: 'border-line/15 bg-raised/60',
    warn: 'border-[rgb(255_190_60/0.45)] bg-[rgb(255_190_60/0.1)]',
    error: 'border-bad/40 bg-bad/10',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm', tones[tone])}>
      <span className="mt-0.5 shrink-0 text-muted">{tone === 'info' ? <Info size={16} /> : <AlertTriangle size={16} />}</span>
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

const modalStack: symbol[] = [];

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Hide the close button in the header. */
  hideClose?: boolean;
}

const MODAL_WIDTHS = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

/** An accessible dialog: focus is trapped, Escape closes it, and it is a bottom sheet on phones. */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', hideClose }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const me = Symbol('modal');
    modalStack.push(me);
    const previous = document.activeElement as HTMLElement | null;
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';

    const focusFirst = window.setTimeout(() => {
      const root = panel.current;
      if (!root) return;
      const preferred = root.querySelector<HTMLElement>('[data-autofocus]');
      const first = preferred ?? root.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, select') ?? root.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? root).focus();
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== me) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);

    return () => {
      window.clearTimeout(focusFirst);
      document.removeEventListener('keydown', onKey, true);
      const at = modalStack.indexOf(me);
      if (at !== -1) modalStack.splice(at, 1);
      if (modalStack.length === 0) document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="overlay-in fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-[3px] sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          'sheet-in card-solid flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-b-none outline-none sm:max-h-[88dvh] sm:rounded-2xl',
          MODAL_WIDTHS[size],
        )}
      >
        {(title || !hideClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-line/10 px-5 py-4">
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="mt-0.5 text-sm text-muted">
                  {description}
                </p>
              )}
            </div>
            {!hideClose && <IconButton label="Close" size="sm" icon={<X size={18} />} onClick={onClose} tooltip={false} />}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line/10 bg-raised/30 px-5 py-3.5 safe-bottom">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink/90">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[12.5px] text-bad" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-[12.5px] text-muted">{hint}</p>
      )}
    </div>
  );
}

export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  maxLength?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  type?: 'text' | 'search' | 'url' | 'date' | 'time' | 'datetime-local' | 'number';
  'aria-label'?: string;
  onKeyDown?: (e: ReactKeyboardEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  min?: string | number;
  max?: string | number;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'search';
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput({ onChange, className, type = 'text', ...rest }, ref) {
  return <input ref={ref} type={type} className={cx('input', className)} onChange={(e) => onChange(e.target.value)} {...rest} />;
});

export function TextArea({
  value,
  onChange,
  placeholder,
  id,
  maxLength,
  rows = 3,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
  maxLength?: number;
  rows?: number;
  className?: string;
}) {
  return (
    <textarea
      id={id}
      value={value}
      rows={rows}
      maxLength={maxLength}
      placeholder={placeholder}
      className={cx('input resize-y', className)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/**
 * A number box that understands "1,234.5", "1 234,5" and a leading minus. It only
 * reports values that parse; while the text is invalid the box is marked so.
 */
export function NumberField({
  value,
  onChange,
  allowEmpty = false,
  placeholder,
  id,
  className,
  min,
  max,
  integer,
  disabled,
  ...rest
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  allowEmpty?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
  min?: number;
  max?: number;
  integer?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
  onEnter?: () => void;
  autoFocus?: boolean;
}) {
  const { onEnter, ...inputRest } = rest;
  const [text, setText] = useState(value === null ? '' : String(value));
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(value === null ? '' : String(value));
      setInvalid(false);
    }
  }, [value, focused]);

  const commit = (raw: string) => {
    setText(raw);
    if (raw.trim() === '') {
      setInvalid(!allowEmpty);
      if (allowEmpty) onChange(null);
      return;
    }
    const n = parseNumber(raw);
    const bad = n === null || (integer && !Number.isInteger(n)) || (min !== undefined && n < min) || (max !== undefined && n > max);
    setInvalid(bad);
    if (!bad && n !== null) onChange(n);
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      disabled={disabled}
      value={text}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      className={cx('input tabular-nums', invalid && 'border-bad/70 focus:border-bad focus:ring-bad/25', className)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setText(value === null ? '' : String(value));
        setInvalid(false);
      }}
      onChange={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onEnter) onEnter();
      }}
      {...inputRest}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  id,
  className,
  ...rest
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  id?: string;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div className={cx('relative', className)}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className="input appearance-none pr-9" {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={cx('flex items-center justify-between gap-4 py-2.5', disabled && 'opacity-50')}>
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-[14.5px] font-medium">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200',
          checked ? 'border-transparent' : 'border-line/20 bg-raised',
        )}
        style={checked ? { background: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent2)))' } : undefined}
      >
        <span
          className={cx(
            'absolute top-0.5 h-[22px] w-[22px] rounded-full bg-white shadow-md transition-transform duration-200',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = 'md',
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  ariaLabel: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx('inline-flex rounded-xl border border-line/15 bg-raised/60 p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'inline-flex items-center justify-center gap-1.5 rounded-[10px] font-medium transition-colors',
              size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-9 px-3.5 text-[13.5px]',
              active ? 'bg-surface text-ink shadow-soft ring-1 ring-line/15' : 'text-muted hover:text-ink',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label: string;
  format?: (value: number) => string;
}) {
  const id = useId();
  return (
    <div className="py-1.5">
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor={id} className="text-[14.5px] font-medium">
          {label}
        </label>
        <span className="text-[13px] tabular-nums text-muted">{format ? format(value) : formatNumber(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

/** Pick one of the preset colours, or any custom colour. */
export function ColorPicker({
  value,
  onChange,
  allowCustom = true,
  label = 'Colour',
}: {
  value: string;
  onChange: (value: string) => void;
  allowCustom?: boolean;
  label?: string;
}) {
  const custom = isHex(value);
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-2.5">
      {SWATCHES.map((s) => {
        const active = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={s.name}
            title={s.name}
            onClick={() => onChange(s.id)}
            className={cx(
              'grid h-8 w-8 place-items-center rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-110',
              active && 'ring-2 ring-ink',
            )}
            style={{ background: gradientCss(s.id) }}
          >
            {active && <Check size={15} className="text-white drop-shadow" strokeWidth={3} aria-hidden="true" />}
          </button>
        );
      })}
      {allowCustom && (
        <label
          className={cx(
            'relative grid h-8 w-8 cursor-pointer place-items-center overflow-hidden rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-110',
            custom && 'ring-2 ring-ink',
          )}
          style={{ background: custom ? value : 'conic-gradient(from 0deg, #ff5d5d, #ffd25d, #7dff5d, #5dffe0, #5d7dff, #d25dff, #ff5d5d)' }}
          title="Custom colour"
        >
          <span className="sr-only">Custom colour</span>
          <input
            type="color"
            value={custom ? value : '#ff8a3d'}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full opacity-0"
          />
          {custom && <Check size={15} className="text-white drop-shadow" strokeWidth={3} aria-hidden="true" />}
        </label>
      )}
    </div>
  );
}

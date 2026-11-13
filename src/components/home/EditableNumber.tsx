import { useState } from 'react';
import type { CSSProperties } from 'react';
import { formatNumber } from '../../core/format';
import { cx } from '../../lib/cx';
import { AnimatedNumber } from '../display';
import { NumberField } from '../ui';

/**
 * A big number that turns into a text box when you tap it, so you can type an exact
 * value. Enter saves, Escape or leaving the box cancels.
 */
export function EditableNumber({
  value,
  onCommit,
  label,
  className,
  style,
  disabled,
}: {
  value: number;
  onCommit: (value: number) => void;
  /** What the number is, for screen readers, e.g. "Alex's score". */
  label: string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number | null>(value);

  const save = () => {
    if (draft !== null) onCommit(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <div
        className="w-full text-center"
        style={style}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            setEditing(false);
          }
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEditing(false);
        }}
      >
        <NumberField
          autoFocus
          value={draft}
          onChange={setDraft}
          onEnter={save}
          aria-label={`New value for ${label}`}
          className={cx('num mx-auto !w-full max-w-full !bg-transparent !px-0 text-center !shadow-none', className)}
        />
        <p className="mt-1 text-[12px] text-muted">Enter to set, Esc to cancel</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      aria-label={`${label}: ${formatNumber(value)}. Tap to type a number.`}
      title="Tap to type a number"
      className={cx('num block max-w-full cursor-text select-none rounded-2xl px-2 transition-colors hover:bg-line/5', className)}
      style={style}
    >
      <AnimatedNumber value={value} />
    </button>
  );
}

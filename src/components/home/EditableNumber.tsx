import { useLayoutEffect, useRef, useState } from 'react';
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
  const host = useRef<HTMLDivElement>(null);
  const digits = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState(1);

  // Whatever size the page asked for, shrink the number until it really fits the space it is in.
  // Measuring beats guessing from the screen width, because the real column is often narrower.
  const shown = formatNumber(value);
  useLayoutEffect(() => {
    const box = host.current;
    const text = digits.current;
    if (!box || !text) return;
    const measure = () => {
      const room = box.clientWidth - 16;
      const width = text.offsetWidth;
      if (room <= 0 || width <= 0) return;
      setFit((current) => {
        const next = Math.max(0.2, Math.min(1, (current * room) / width));
        return Math.abs(next - current) < 0.01 ? current : next;
      });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const watcher = new ResizeObserver(measure);
    watcher.observe(box);
    return () => watcher.disconnect();
  }, [shown, editing, style, className]);

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
    <div ref={host} className="w-full min-w-0 text-center">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        aria-label={`${label}: ${shown}. Tap to type a number.`}
        title="Tap to type a number"
        className={cx('num inline-block max-w-full cursor-text select-none whitespace-nowrap rounded-2xl px-2 transition-colors hover:bg-line/5', className)}
        style={{ ...style, ['--num-fit' as string]: fit } as CSSProperties}
      >
        <span ref={digits} className="inline-block">
          <AnimatedNumber value={value} />
        </span>
      </button>
    </div>
  );
}

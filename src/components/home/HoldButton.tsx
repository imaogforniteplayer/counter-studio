import { useState } from 'react';
import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { useSettings } from '../../app/context';
import { useHold } from './useHold';

/** A button that counts on press and keeps counting while held. */
export function HoldButton({
  label,
  action,
  onBegin,
  className,
  style,
  children,
  hold,
  disabled,
}: {
  label: string;
  action: () => void;
  onBegin?: () => void;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** Override the "hold to count" setting (for example, never repeat a play/pause button). */
  hold?: boolean;
  disabled?: boolean;
}) {
  const settings = useSettings();
  const handlers = useHold({
    action,
    onBegin,
    hold: hold ?? settings.holdToCount,
    speed: settings.holdSpeed,
    disabled,
  });
  // Each press starts a fresh ring (a new key restarts the animation).
  const [presses, setPresses] = useState(0);
  const begin = (e: PointerEvent<HTMLElement>) => {
    if (!disabled) setPresses((n) => n + 1);
    handlers.onPointerDown(e);
  };
  return (
    <button type="button" aria-label={label} disabled={disabled} className={cx('hold-btn', className)} style={style} {...handlers} onPointerDown={begin}>
      {children}
      {presses > 0 && <span key={presses} className="ripple" aria-hidden="true" />}
    </button>
  );
}

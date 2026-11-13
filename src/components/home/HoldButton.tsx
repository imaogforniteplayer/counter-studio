import type { CSSProperties, ReactNode } from 'react';
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
  return (
    <button type="button" aria-label={label} disabled={disabled} className={className} style={style} {...handlers}>
      {children}
    </button>
  );
}

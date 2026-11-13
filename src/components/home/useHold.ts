import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';

export interface HoldOptions {
  /** Runs once on press, then repeatedly while held (if `hold` is on). */
  action: () => void;
  /** Called once at the start of every press sequence. */
  onBegin?: () => void;
  /** Repeat while the button is held down. */
  hold: boolean;
  /** Speed multiplier for repeating (0.5 slow to 3 fast). */
  speed: number;
  disabled?: boolean;
}

export interface HoldHandlers {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
  onLostPointerCapture: (e: PointerEvent<HTMLElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  onKeyUp: (e: KeyboardEvent<HTMLElement>) => void;
  onBlur: () => void;
  onClick: (e: MouseEvent<HTMLElement>) => void;
  onContextMenu: (e: MouseEvent<HTMLElement>) => void;
}

const HOLD_DELAY_MS = 400;
/** A click this soon after a pointer or key press is the same press, not a new one. */
const CLICK_GUARD_MS = 800;

/**
 * Makes a button count the instant it is pressed (pointer down, not click), and keep
 * counting, faster and faster, while it is held. A plain click with no pointer or key
 * press before it (what a screen reader sends) still counts once.
 */
export function useHold(options: HoldOptions): HoldHandlers {
  const opts = useRef(options);
  opts.current = options;
  const st = useRef({ timer: 0, active: false, n: 0, last: 0, el: null as HTMLElement | null });
  const loop = useRef<() => void>(() => undefined);

  loop.current = () => {
    const s = st.current;
    if (!s.active) return;
    opts.current.action();
    s.n += 1;
    const base = Math.max(45, 230 - s.n * 14);
    const delay = Math.max(25, base / Math.max(0.25, opts.current.speed));
    s.timer = window.setTimeout(() => loop.current(), delay);
  };

  const stop = useCallback(() => {
    const s = st.current;
    if (s.timer) {
      window.clearTimeout(s.timer);
      s.timer = 0;
    }
    s.active = false;
    s.n = 0;
    if (s.el) {
      delete s.el.dataset.pressed;
      s.el = null;
    }
  }, []);

  const start = useCallback(
    (el: HTMLElement) => {
      const o = opts.current;
      if (o.disabled) return;
      stop();
      const s = st.current;
      s.active = true;
      s.el = el;
      el.dataset.pressed = 'true';
      o.onBegin?.();
      o.action();
      if (o.hold) s.timer = window.setTimeout(() => loop.current(), HOLD_DELAY_MS);
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      st.current.last = performance.now();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture is a nicety; holding still works without it */
      }
      start(e.currentTarget);
    },
    onPointerUp: () => {
      st.current.last = performance.now();
      stop();
    },
    onPointerCancel: () => {
      st.current.last = performance.now();
      stop();
    },
    onLostPointerCapture: () => stop(),
    onKeyDown: (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if (e.repeat) return;
      st.current.last = performance.now();
      start(e.currentTarget);
    },
    onKeyUp: (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      st.current.last = performance.now();
      stop();
    },
    onBlur: () => stop(),
    onClick: () => {
      const s = st.current;
      if (s.active || performance.now() - s.last < CLICK_GUARD_MS) return;
      if (opts.current.disabled) return;
      opts.current.onBegin?.();
      opts.current.action();
    },
    onContextMenu: (e) => e.preventDefault(),
  };
}

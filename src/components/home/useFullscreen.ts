import { useCallback, useEffect, useRef, useState } from 'react';
import { dialogIsOpen } from '../../lib/shortcuts';

export interface FullscreenControl {
  active: boolean;
  enter(): void;
  exit(): void;
  toggle(): void;
}

/**
 * Full-screen counting. The counter is shown in a page-covering layer and, where the
 * browser allows it, the browser itself goes full screen too (hiding its toolbars).
 * Phones that refuse the real Fullscreen API still get the page-covering layer.
 * Dialogs keep working because they live inside the same page.
 */
export function useFullscreen(): FullscreenControl {
  const [active, setActive] = useState(false);
  const native = useRef(false);

  const enter = useCallback(() => {
    setActive(true);
    try {
      const el = document.documentElement;
      if (typeof el.requestFullscreen === 'function') {
        Promise.resolve(el.requestFullscreen())
          .then(() => {
            native.current = true;
          })
          .catch(() => {
            native.current = false;
          });
      }
    } catch {
      native.current = false;
    }
  }, []);

  const exit = useCallback(() => {
    setActive(false);
    native.current = false;
    try {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    } catch {
      /* already out */
    }
  }, []);

  const toggle = useCallback(() => {
    if (active) exit();
    else enter();
  }, [active, enter, exit]);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && native.current) {
        native.current = false;
        setActive(false);
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !dialogIsOpen()) exit();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      if (!dialogIsOpen()) document.body.style.overflow = previous;
    };
  }, [active, exit]);

  useEffect(
    () => () => {
      try {
        if (native.current && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      } catch {
        /* nothing to do */
      }
    },
    [],
  );

  return { active, enter, exit, toggle };
}

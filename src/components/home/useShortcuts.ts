import { useEffect, useRef } from 'react';
import { useDialogs, useSettings } from '../../app/context';
import type { Counter } from '../../core/types';
import { primaryDirection } from '../../core/counter';
import { dialogIsOpen, isTypingTarget } from '../../lib/shortcuts';
import { useStore } from '../../app/context';
import type { AutoCount } from './useAutoCount';
import type { Counting } from './useCounting';
import type { FullscreenControl } from './useFullscreen';
import { isSingleValue } from './shared';
import { useCounterActions } from './actions';

/** The "Counting" shortcuts from lib/shortcuts.ts. */
export function useCountingShortcuts({
  counter,
  counting,
  auto,
  fullscreen,
  onStep,
}: {
  counter: Counter;
  counting: Counting;
  auto: AutoCount;
  fullscreen: FullscreenControl;
  /** Move to the previous (-1) or next (+1) counter. */
  onStep: (delta: -1 | 1) => void;
}) {
  const store = useStore();
  const dialogs = useDialogs();
  const { shortcuts } = useSettings();
  const { reset } = useCounterActions();
  const latest = useRef({ counter, counting, auto, fullscreen, onStep, reset });
  latest.current = { counter, counting, auto, fullscreen, onStep, reset };

  useEffect(() => {
    if (!shortcuts) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target) || dialogIsOpen()) return;
      const { counter: c, counting: k, auto: a, fullscreen: fs, onStep: step, reset: doReset } = latest.current;
      const single = isSingleValue(c.mode);
      const dir = primaryDirection(c.mode);
      const onControl = e.target instanceof HTMLElement && ['BUTTON', 'A', 'SUMMARY'].includes(e.target.tagName);

      switch (e.key) {
        case ' ':
          // A focused button handles Space itself; doing it here too would count twice.
          if (onControl) return;
          if (!single) return;
          e.preventDefault();
          if (e.repeat) return;
          if (c.mode === 'interval') a.toggle();
          else {
            k.begin();
            k.bump(dir);
          }
          return;
        case 'ArrowUp':
        case '+':
        case '=':
          if (!single) return;
          e.preventDefault();
          if (!e.repeat) k.begin();
          k.bump(1);
          return;
        case 'ArrowDown':
        case '-':
        case '_':
          if (!single) return;
          e.preventDefault();
          if (!e.repeat) k.begin();
          k.bump(-1);
          return;
        case 'z':
        case 'Z':
          e.preventDefault();
          if (e.shiftKey) store.redo(c.id);
          else store.undo(c.id);
          return;
        case 'y':
        case 'Y':
          e.preventDefault();
          store.redo(c.id);
          return;
        case 'r':
        case 'R':
          e.preventDefault();
          void doReset(c);
          return;
        case 'f':
        case 'F':
          e.preventDefault();
          fs.toggle();
          return;
        case 'e':
        case 'E':
          e.preventDefault();
          dialogs.openEditor({ counterId: c.id });
          return;
        case 'a':
        case 'A':
          if (!single) return;
          e.preventDefault();
          a.toggle();
          return;
        case '[':
          e.preventDefault();
          step(-1);
          return;
        case ']':
          e.preventDefault();
          step(1);
          return;
        default:
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcuts, store, dialogs]);
}

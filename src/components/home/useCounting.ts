import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSettings, useStore, useToast } from '../../app/context';
import { feedback } from '../../lib/feedback';
import { formatNumber } from '../../core/format';
import type { ChangeKind } from '../../core/types';
import type { BumpResult } from '../../data/store';

export interface Counting {
  /** Change the main value. Handles sound, vibration, limit and goal messages. */
  bump(direction: 1 | -1, amount?: number, kind?: ChangeKind): BumpResult | null;
  /** Change one player's score or one sub-counter. */
  bumpTarget(targetId: string, direction: 1 | -1, amount?: number): BumpResult | null;
  /** Call at the start of each press so a limit message is shown once per press. */
  begin(): void;
  shaking: boolean;
  celebrating: boolean;
}

/** All the feedback around counting in one place, so every button behaves the same. */
export function useCounting(counterId: string | null): Counting {
  const store = useStore();
  const toast = useToast();
  const settings = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const toasted = useRef(false);
  const timers = useRef<number[]>([]);
  const [shaking, setShaking] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const flash = useCallback((set: (v: boolean) => void, ms: number) => {
    set(true);
    timers.current.push(window.setTimeout(() => set(false), ms));
  }, []);

  const react = useCallback(
    (result: BumpResult, direction: 1 | -1, kind?: ChangeKind) => {
      const s = settingsRef.current;
      const c = counterId ? store.getCounter(counterId) : undefined;
      if (result.hit) {
        flash(setShaking, 380);
        feedback(s, 'limit');
        if (!toasted.current) {
          toasted.current = true;
          const limit = result.hit === 'max' ? c?.max : c?.min;
          const word = result.hit === 'max' ? 'Maximum' : 'Minimum';
          toast(limit === null || limit === undefined ? `${word} reached.` : `${word} of ${formatNumber(limit)} reached.`);
        }
      } else if (kind !== 'auto') {
        feedback(s, direction > 0 ? 'tap' : 'dec');
      }
      if (result.completed) {
        flash(setCelebrating, 650);
        feedback(s, 'done');
        toast(c?.mode === 'countdown' ? 'Countdown finished.' : 'Goal reached.', 'success');
      }
    },
    [counterId, flash, store, toast],
  );

  const bump = useCallback(
    (direction: 1 | -1, amount?: number, kind?: ChangeKind) => {
      if (!counterId) return null;
      const result = store.bump(counterId, direction, amount, kind);
      if (result) react(result, direction, kind);
      return result;
    },
    [counterId, react, store],
  );

  const bumpTarget = useCallback(
    (targetId: string, direction: 1 | -1, amount?: number) => {
      if (!counterId) return null;
      const result = store.bumpTarget(counterId, targetId, direction, amount);
      if (result) react(result, direction);
      return result;
    },
    [counterId, react, store],
  );

  const begin = useCallback(() => {
    toasted.current = false;
  }, []);

  return useMemo(() => ({ bump, bumpTarget, begin, shaking, celebrating }), [bump, bumpTarget, begin, shaking, celebrating]);
}

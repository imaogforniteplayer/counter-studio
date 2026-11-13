import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../app/context';
import type { Counting } from './useCounting';

export interface AutoCount {
  running: boolean;
  start(): void;
  stop(): void;
  toggle(): void;
}

const MAX_CATCH_UP = 1000;

/**
 * Counts by itself at the counter's interval and direction while the Home screen is
 * open. It uses timestamps, so a throttled background tab catches up instead of
 * drifting. It stops at a limit or when a goal or countdown is finished.
 */
export function useAutoCount(counterId: string | null, counting: Counting): AutoCount {
  const store = useStore();
  const [running, setRunning] = useState(false);
  const countingRef = useRef(counting);
  countingRef.current = counting;

  useEffect(() => {
    setRunning(false);
  }, [counterId]);

  useEffect(() => {
    if (!running || !counterId) return undefined;
    countingRef.current.begin();
    let last = Date.now();
    const timer = window.setInterval(() => {
      const c = store.getCounter(counterId);
      if (!c || c.deletedAt !== null) {
        setRunning(false);
        return;
      }
      const interval = Math.max(50, c.intervalMs);
      const now = Date.now();
      let due = Math.floor((now - last) / interval);
      if (due <= 0) return;
      if (due > MAX_CATCH_UP) {
        due = MAX_CATCH_UP;
        last = now;
      } else {
        last += due * interval;
      }
      for (let i = 0; i < due; i++) {
        const r = countingRef.current.bump(c.intervalDirection, undefined, 'auto');
        if (!r || r.delta === 0 || r.hit || r.completed) {
          setRunning(false);
          break;
        }
      }
    }, 20);
    return () => window.clearInterval(timer);
  }, [running, counterId, store]);

  const start = useCallback(() => setRunning(true), []);
  const stop = useCallback(() => setRunning(false), []);
  const toggle = useCallback(() => setRunning((r) => !r), []);
  return { running, start, stop, toggle };
}

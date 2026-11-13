import { useEffect } from 'react';

interface Sentinel {
  release(): Promise<void>;
}
interface WakeLockApi {
  request(type: 'screen'): Promise<Sentinel>;
}

/** Keep the screen on while `active` (auto-counting, full screen). Silently does nothing if unsupported. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    const api = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock;
    if (!api) return undefined;
    let sentinel: Sentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const s = await api.request('screen');
        if (cancelled) {
          void s.release().catch(() => undefined);
          return;
        }
        if (sentinel) void sentinel.release().catch(() => undefined);
        sentinel = s;
      } catch {
        /* a wake lock is optional; the browser may refuse */
      }
    };
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (sentinel) void sentinel.release().catch(() => undefined);
    };
  }, [active]);
}

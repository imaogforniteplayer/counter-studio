import { useMemo, useSyncExternalStore } from 'react';

/**
 * A tiny hash router. Hash URLs (e.g. #/stats) work on GitHub Pages without any
 * server rewrites, survive refreshes and keep share links simple.
 */
export interface Route {
  /** Always starts with "/" and has no trailing slash (except for "/"). */
  path: string;
  query: URLSearchParams;
}

export const ROUTES = ['/', '/counters', '/templates', '/stats', '/history', '/tools', '/settings', '/import'] as const;

function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

function snapshot(): string {
  return window.location.hash;
}

export function parseHash(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const q = raw.indexOf('?');
  let path = (q === -1 ? raw : raw.slice(0, q)) || '/';
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return { path, query: new URLSearchParams(q === -1 ? '' : raw.slice(q + 1)) };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, snapshot, () => '');
  return useMemo(() => parseHash(hash), [hash]);
}

/** Build a link target, e.g. href('/history', { c: 'abc' }) -> "#/history?c=abc". */
export function href(path: string, query?: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams();
  if (query) for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
  const qs = params.toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}

export function navigate(path: string, query?: Record<string, string | null | undefined>, opts: { replace?: boolean } = {}): void {
  const target = href(path, query);
  if (opts.replace) {
    window.history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (window.location.hash !== target) {
    window.location.hash = target;
  }
}

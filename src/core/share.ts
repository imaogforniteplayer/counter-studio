import type { Counter } from './types';
import { createCounter, sanitizeCounter } from './counter';
import { isRecord } from './sanitize';

export class ShareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShareError';
  }
}

export interface ShareOptions {
  /** Include the current value (and scores) as the starting point. */
  includeValue: boolean;
  /** Include the free-text description. */
  includeDescription: boolean;
}

export const DEFAULT_SHARE_OPTIONS: ShareOptions = { includeValue: true, includeDescription: false };

/** Links longer than this are rejected on import to avoid abuse. */
export const MAX_SHARE_TOKEN = 24_000;

export interface SharePayload {
  v: 1;
  name: string;
  description?: string;
  mode: Counter['mode'];
  color: string;
  icon: string;
  startValue: number;
  value: number;
  step: number;
  min: number | null;
  max: number | null;
  goal: number | null;
  intervalMs: number;
  intervalDirection: 1 | -1;
  cardStyle: Counter['cardStyle'];
  players: { name: string; color: string; score: number }[];
  subCounters: { name: string; color: string; value: number }[];
}

/**
 * Build the data that goes into a share link. Only the counter's configuration
 * (and optionally its value and description) is included. History, folders,
 * pins, ids and timestamps never leave the device.
 */
export function buildSharePayload(c: Counter, opts: ShareOptions = DEFAULT_SHARE_OPTIONS): SharePayload {
  const payload: SharePayload = {
    v: 1,
    name: c.name,
    mode: c.mode,
    color: c.color,
    icon: c.icon,
    startValue: c.startValue,
    value: opts.includeValue ? c.value : c.startValue,
    step: c.step,
    min: c.min,
    max: c.max,
    goal: c.goal,
    intervalMs: c.intervalMs,
    intervalDirection: c.intervalDirection,
    cardStyle: c.cardStyle,
    players: c.players.map((p) => ({ name: p.name, color: p.color, score: opts.includeValue ? p.score : 0 })),
    subCounters: c.subCounters.map((s) => ({ name: s.name, color: s.color, value: opts.includeValue ? s.value : 0 })),
  };
  if (opts.includeDescription && c.description) payload.description = c.description;
  return payload;
}

/* ---------- base64url ---------- */

export function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function fromBase64Url(token: string): string {
  const padded = token.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function encodeShare(payload: SharePayload): string {
  return toBase64Url(JSON.stringify(payload));
}

/** Decode and validate a share token into a brand-new counter. */
export function counterFromShareToken(token: string, now = Date.now()): Counter {
  if (!token || token.length > MAX_SHARE_TOKEN || !/^[A-Za-z0-9_-]+$/.test(token)) {
    throw new ShareError('This share link is damaged or incomplete. Ask for a fresh link.');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fromBase64Url(token));
  } catch {
    throw new ShareError('This share link is damaged or incomplete. Ask for a fresh link.');
  }
  if (!isRecord(raw) || raw.v !== 1) {
    throw new ShareError('This share link was made by a different version of Tickwell and cannot be opened.');
  }
  const cleaned = sanitizeCounter({ ...raw, id: undefined, folderId: null, pinned: false }, now);
  if (!cleaned) throw new ShareError('This share link does not contain a counter.');
  // Re-create so that no stray fields or timestamps survive.
  return createCounter(
    {
      name: cleaned.name,
      description: cleaned.description,
      mode: cleaned.mode,
      color: cleaned.color,
      icon: cleaned.icon,
      startValue: cleaned.startValue,
      value: cleaned.value,
      step: cleaned.step,
      min: cleaned.min,
      max: cleaned.max,
      goal: cleaned.goal,
      intervalMs: cleaned.intervalMs,
      intervalDirection: cleaned.intervalDirection,
      cardStyle: cleaned.cardStyle,
      players: cleaned.players,
      subCounters: cleaned.subCounters,
    },
    now,
  );
}

/** Build a full share URL that opens the import screen of this app. */
export function buildShareUrl(c: Counter, opts: ShareOptions, pageUrl: string): string {
  const url = new URL(pageUrl);
  url.search = '';
  url.hash = `/import?d=${encodeShare(buildSharePayload(c, opts))}`;
  return url.toString();
}

/** Pull the share token out of a hash such as "#/import?d=abc". */
export function tokenFromHash(hash: string): string | null {
  const q = hash.indexOf('?');
  if (q === -1) return null;
  const params = new URLSearchParams(hash.slice(q + 1));
  return params.get('d');
}

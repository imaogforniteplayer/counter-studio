import type { BackupFile, Counter, Folder, HistoryEntry, Settings, Template } from './types';
import { sanitizeConfig, sanitizeCounter } from './counter';
import { sanitizeSettings } from './settings';
import { arr, isRecord, num, numOrNull, oneOf, str, bool } from './sanitize';
import { isValidColor } from './colors';
import { uid } from './ids';

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

export interface DataState {
  counters: Counter[];
  folders: Folder[];
  templates: Template[];
  history: HistoryEntry[];
  settings: Settings;
}

export const BACKUP_VERSION = 1;
const MAX_FILE_CHARS = 60_000_000;

export function createBackup(data: DataState, now = Date.now()): BackupFile {
  return {
    app: 'tickwell',
    version: BACKUP_VERSION,
    exportedAt: now,
    counters: data.counters,
    folders: data.folders,
    templates: data.templates.filter((t) => !t.builtin),
    history: data.history,
    settings: data.settings,
  };
}

/* ---------- hashing (for duplicate backup prevention) ---------- */

export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (isRecord(v)) {
    const keys = Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

/** 53-bit string hash (cyrb53). Not cryptographic; used only to spot identical data. */
export function hashString(s: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/** Hash of the *content* of a backup. The export time is ignored. */
export function backupHash(b: Pick<BackupFile, 'counters' | 'folders' | 'templates' | 'history' | 'settings'>): string {
  return hashString(
    stableStringify({
      counters: [...b.counters].sort((x, y) => x.id.localeCompare(y.id)),
      folders: [...b.folders].sort((x, y) => x.id.localeCompare(y.id)),
      templates: [...b.templates].sort((x, y) => x.id.localeCompare(y.id)),
      history: b.history.length > 0 ? [b.history.length, b.history[0].id, b.history[b.history.length - 1].id, hashString(stableStringify(b.history))] : [],
      settings: { ...b.settings, lastCounterId: null },
    }),
  );
}

/* ---------- sanitising ---------- */

const KINDS = ['inc', 'dec', 'set', 'reset', 'auto', 'undo', 'goal'] as const;

export function sanitizeHistoryEntry(raw: unknown): HistoryEntry | null {
  if (!isRecord(raw)) return null;
  const counterId = str(raw.counterId, 60);
  const id = str(raw.id, 60);
  if (!counterId || !id) return null;
  if (typeof raw.at !== 'number' || !Number.isFinite(raw.at)) return null;
  return {
    id,
    counterId,
    at: num(raw.at, 0, 0, 8.64e15),
    prev: num(raw.prev, 0),
    next: num(raw.next, 0),
    delta: num(raw.delta, 0),
    kind: oneOf(raw.kind, KINDS, 'set'),
    target: typeof raw.target === 'string' ? str(raw.target, 60) || null : null,
    label: typeof raw.label === 'string' ? str(raw.label, 80) || null : null,
    session: str(raw.session, 60) || 'imported',
    reverted: bool(raw.reverted, false),
  };
}

export function sanitizeFolder(raw: unknown): Folder | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id, 60);
  if (!id) return null;
  return {
    id,
    name: str(raw.name, 60, 'Folder') || 'Folder',
    color: isValidColor(raw.color) ? raw.color : 'slate',
    order: num(raw.order, 0, -1e9, 1e9),
  };
}

export function sanitizeTemplate(raw: unknown): Template | null {
  if (!isRecord(raw)) return null;
  const config = sanitizeConfig(raw.config);
  if (!config) return null;
  return {
    id: str(raw.id, 60) || uid('t'),
    name: str(raw.name, 80, 'Template') || 'Template',
    description: str(raw.description, 300),
    category: str(raw.category, 40, 'My templates') || 'My templates',
    builtin: false,
    createdAt: num(raw.createdAt, Date.now(), 0, 8.64e15),
    config,
  };
}

/** Parse and validate the text of a backup file. Throws ImportError with a helpful message. */
export function parseBackup(text: string, now = Date.now()): BackupFile {
  if (typeof text !== 'string' || text.length === 0) {
    throw new ImportError('That file is empty.');
  }
  if (text.length > MAX_FILE_CHARS) {
    throw new ImportError('That file is too large to be a Tickwell backup.');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError("That file isn't valid JSON. Choose a backup that was exported from Tickwell.");
  }
  if (!isRecord(raw) || raw.app !== 'tickwell') {
    throw new ImportError("This doesn't look like a Tickwell backup file.");
  }
  const version = numOrNull(raw.version, null);
  if (version === null || version < 1) {
    throw new ImportError('This backup has no version number, so it cannot be read safely.');
  }
  if (version > BACKUP_VERSION) {
    throw new ImportError('This backup was made by a newer version of Tickwell. Update the app and try again.');
  }

  const counters: Counter[] = [];
  const seen = new Set<string>();
  for (const item of arr(raw.counters, 5000)) {
    const c = sanitizeCounter(item, now);
    if (c && !seen.has(c.id)) {
      seen.add(c.id);
      counters.push(c);
    }
  }
  const folders: Folder[] = [];
  const folderIds = new Set<string>();
  for (const item of arr(raw.folders, 500)) {
    const f = sanitizeFolder(item);
    if (f && !folderIds.has(f.id)) {
      folderIds.add(f.id);
      folders.push(f);
    }
  }
  for (const c of counters) if (c.folderId && !folderIds.has(c.folderId)) c.folderId = null;

  const templates: Template[] = [];
  for (const item of arr(raw.templates, 500)) {
    const t = sanitizeTemplate(item);
    if (t) templates.push(t);
  }
  const history: HistoryEntry[] = [];
  const historyIds = new Set<string>();
  for (const item of arr(raw.history, 2_000_000)) {
    const h = sanitizeHistoryEntry(item);
    if (h && seen.has(h.counterId) && !historyIds.has(h.id)) {
      historyIds.add(h.id);
      history.push(h);
    }
  }
  history.sort((a, b) => a.at - b.at);

  return {
    app: 'tickwell',
    version: BACKUP_VERSION,
    exportedAt: num(raw.exportedAt, now, 0, 8.64e15),
    counters,
    folders,
    templates,
    history,
    settings: sanitizeSettings(raw.settings),
  };
}

export interface MergeResult {
  state: DataState;
  addedCounters: number;
  updatedCounters: number;
  skippedCounters: number;
  addedHistory: number;
}

/** Merge a backup into existing data without losing anything already there. */
export function mergeBackup(current: DataState, incoming: BackupFile): MergeResult {
  const counters = new Map(current.counters.map((c) => [c.id, c]));
  let addedCounters = 0;
  let updatedCounters = 0;
  let skippedCounters = 0;
  for (const c of incoming.counters) {
    const existing = counters.get(c.id);
    if (!existing) {
      counters.set(c.id, c);
      addedCounters += 1;
    } else if (c.updatedAt > existing.updatedAt) {
      counters.set(c.id, c);
      updatedCounters += 1;
    } else {
      skippedCounters += 1;
    }
  }
  const folders = new Map(current.folders.map((f) => [f.id, f]));
  for (const f of incoming.folders) if (!folders.has(f.id)) folders.set(f.id, f);

  const templates = new Map(current.templates.map((t) => [t.id, t]));
  for (const t of incoming.templates) if (!templates.has(t.id)) templates.set(t.id, t);

  const historyIds = new Set(current.history.map((h) => h.id));
  const history = [...current.history];
  let addedHistory = 0;
  for (const h of incoming.history) {
    if (!historyIds.has(h.id) && counters.has(h.counterId)) {
      history.push(h);
      historyIds.add(h.id);
      addedHistory += 1;
    }
  }
  history.sort((a, b) => a.at - b.at);

  return {
    state: {
      counters: Array.from(counters.values()),
      folders: Array.from(folders.values()),
      templates: Array.from(templates.values()),
      history,
      settings: current.settings,
    },
    addedCounters,
    updatedCounters,
    skippedCounters,
    addedHistory,
  };
}

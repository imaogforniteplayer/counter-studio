export type CounterMode = 'normal' | 'countdown' | 'goal' | 'score' | 'tally' | 'interval' | 'multi';
export type CardStyle = 'solid' | 'glass' | 'outline' | 'gradient';

export interface Player {
  id: string;
  name: string;
  score: number;
  color: string;
}

export interface SubCounter {
  id: string;
  name: string;
  value: number;
  color: string;
}

export interface Counter {
  id: string;
  name: string;
  description: string;
  mode: CounterMode;
  /** Swatch id (e.g. "ember") or a #rrggbb hex string. */
  color: string;
  /** Key into the icon registry. */
  icon: string;
  value: number;
  startValue: number;
  step: number;
  min: number | null;
  max: number | null;
  /** Target for goal mode. */
  goal: number | null;
  /** Tick length for interval mode. */
  intervalMs: number;
  /** Direction for interval mode: 1 counts up, -1 counts down. */
  intervalDirection: 1 | -1;
  players: Player[];
  subCounters: SubCounter[];
  folderId: string | null;
  pinned: boolean;
  order: number;
  cardStyle: CardStyle;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number;
  deletedAt: number | null;
}

export type ChangeKind = 'inc' | 'dec' | 'set' | 'reset' | 'auto' | 'undo' | 'goal';

export interface HistoryEntry {
  id: string;
  counterId: string;
  at: number;
  prev: number;
  next: number;
  delta: number;
  kind: ChangeKind;
  /** Player or sub-counter id when the change was not to the main value. */
  target: string | null;
  /** Human readable note (e.g. a player name). */
  label: string | null;
  session: string;
  reverted: boolean;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface CounterConfig {
  description: string;
  mode: CounterMode;
  icon: string;
  color: string;
  startValue: number;
  step: number;
  min: number | null;
  max: number | null;
  goal: number | null;
  intervalMs: number;
  intervalDirection: 1 | -1;
  cardStyle: CardStyle;
  players: { name: string; color: string }[];
  subCounters: { name: string; color: string }[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  builtin: boolean;
  createdAt: number;
  config: CounterConfig;
}

export interface Snapshot {
  value: number;
  players: Player[];
  subCounters: SubCounter[];
}

export type NumberFont = 'sans' | 'mono' | 'serif' | 'rounded' | 'condensed';
export type ButtonStyle = 'round' | 'soft' | 'pill' | 'square';
export type ThemeChoice = 'dark' | 'light' | 'system';
export type BackgroundChoice = 'none' | 'aurora' | 'grid' | 'dusk' | 'color' | 'image';
export type SoundPreset = 'click' | 'tick' | 'pop' | 'chime';

export interface Settings {
  theme: ThemeChoice;
  palette: string;
  customAccent: string | null;
  background: BackgroundChoice;
  backgroundColor: string;
  backgroundImage: string | null;
  numberFont: NumberFont;
  numberScale: number;
  buttonStyle: ButtonStyle;
  defaultCardStyle: CardStyle;
  animations: 'full' | 'reduced';
  followSystemMotion: boolean;
  compact: boolean;
  soundEnabled: boolean;
  soundPreset: SoundPreset;
  soundVolume: number;
  soundPitch: number;
  haptics: boolean;
  holdToCount: boolean;
  holdSpeed: number;
  shortcuts: boolean;
  countersView: 'grid' | 'list';
  onboardingDone: boolean;
  lastCounterId: string | null;
  quickAmounts: number[];
}

export interface BackupFile {
  app: 'tickwell';
  version: 1;
  exportedAt: number;
  counters: Counter[];
  folders: Folder[];
  templates: Template[];
  history: HistoryEntry[];
  settings: Settings;
}

export interface RestorePoint {
  id: string;
  createdAt: number;
  hash: string;
  auto: boolean;
  label: string;
  counterCount: number;
  historyCount: number;
  data: BackupFile;
}

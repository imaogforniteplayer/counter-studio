/**
 * The single source of truth for keyboard shortcuts. The Home screen implements the
 * "Counting" group, App.tsx implements the "Anywhere" group, and the help dialog
 * lists them all.
 */
export interface ShortcutInfo {
  keys: string[];
  label: string;
}

export interface ShortcutGroup {
  title: string;
  items: ShortcutInfo[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Counting',
    items: [
      { keys: ['Space'], label: 'Main button (counts up, or down in a countdown)' },
      { keys: ['↑', '+'], label: 'Increase by the step' },
      { keys: ['↓', '−'], label: 'Decrease by the step' },
      { keys: ['Z'], label: 'Undo' },
      { keys: ['Shift', 'Z'], label: 'Redo' },
      { keys: ['R'], label: 'Reset (asks first)' },
      { keys: ['F'], label: 'Full-screen counting' },
      { keys: ['E'], label: 'Edit this counter' },
      { keys: ['A'], label: 'Start or stop auto-counting' },
      { keys: ['['], label: 'Previous counter' },
      { keys: [']'], label: 'Next counter' },
    ],
  },
  {
    title: 'Anywhere',
    items: [
      { keys: ['N'], label: 'New counter' },
      { keys: ['/'], label: 'Search (on My Counters and History)' },
      { keys: ['?'], label: 'Show this help' },
      { keys: ['Alt', '1 – 7'], label: 'Home, My Counters, Templates, Statistics, History, Tools, Settings' },
      { keys: ['Esc'], label: 'Close a dialog or leave full screen' },
    ],
  },
];

/** True when the key event came from somewhere the person is typing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    return !['button', 'checkbox', 'radio', 'range', 'color', 'submit', 'reset'].includes(type);
  }
  return tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** True when a modal dialog is open, so page-level shortcuts should stay quiet. */
export function dialogIsOpen(): boolean {
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

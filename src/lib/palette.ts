/** The command palette lives in App. Anything can open it by sending this event. */
export const PALETTE_EVENT = 'tickwell:palette';

export function openCommandPalette(): void {
  window.dispatchEvent(new Event(PALETTE_EVENT));
}

/** Ctrl+K on Windows and Linux, Cmd+K on a Mac. */
export function isPaletteShortcut(e: KeyboardEvent): boolean {
  return (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K');
}

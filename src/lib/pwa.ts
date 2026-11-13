import { useSyncExternalStore } from 'react';

/**
 * Install-to-home-screen support. This module registers its listeners as soon as it
 * is loaded (the Onboarding component imports it at startup), because browsers fire
 * "beforeinstallprompt" early and only once.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
}

let state: InstallState = { deferred: null, installed: false };
const listeners = new Set<() => void>();

function set(patch: Partial<InstallState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
  } catch {
    /* ignore */
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

if (typeof window !== 'undefined') {
  state = { ...state, installed: isStandalone() };
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    set({ deferred: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => set({ deferred: null, installed: true }));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getState(): InstallState {
  return state;
}

function detectIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iDevice = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = /Macintosh/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
  return iDevice || iPadOs;
}

export function useInstallPrompt(): { canInstall: boolean; installed: boolean; install(): Promise<void>; isIos: boolean } {
  const s = useSyncExternalStore(subscribe, getState, getState);
  return {
    canInstall: s.deferred !== null && !s.installed,
    installed: s.installed,
    isIos: detectIos() && !s.installed,
    async install() {
      const prompt = s.deferred;
      if (!prompt) return;
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        // The browser only allows one prompt per event.
        set({ deferred: null, installed: choice.outcome === 'accepted' ? true : state.installed });
      } catch {
        set({ deferred: null });
      }
    },
  };
}

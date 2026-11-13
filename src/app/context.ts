import { createContext, useContext, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { CounterConfig, CounterMode, Settings } from '../core/types';
import type { AppState, MessageKind, Store } from '../data/store';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

/** Show a short message. Pass an action to offer "Undo" and similar. */
export type ToastFn = (message: string, kind?: MessageKind, action?: ToastAction) => void;

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive and focus "Cancel" first. */
  danger?: boolean;
}

export interface EditorOptions {
  /** Edit this counter. Leave out to create a new one. */
  counterId?: string;
  /** Mode to start from when creating. */
  mode?: CounterMode;
  /** Start from this configuration (a template or shared counter) when creating. */
  config?: CounterConfig;
  /** Suggested name when creating. */
  name?: string;
  folderId?: string | null;
}

export interface Dialogs {
  openEditor(options?: EditorOptions): void;
  openShare(counterId: string): void;
  openShortcuts(): void;
}

export interface AppContextValue {
  store: Store;
  toast: ToastFn;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  dialogs: Dialogs;
}

export const AppCtx = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const v = useContext(AppCtx);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}

export function useStore(): Store {
  return useApp().store;
}

/** The whole app state. Re-renders on every change, so select what you need with useMemo. */
export function useAppState(): AppState {
  const { store } = useApp();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useSettings(): Settings {
  return useAppState().settings;
}

export function useToast(): ToastFn {
  return useApp().toast;
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  return useApp().confirm;
}

export function useDialogs(): Dialogs {
  return useApp().dialogs;
}

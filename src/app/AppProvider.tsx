import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { Store } from '../data/store';
import type { MessageKind } from '../data/store';
import { openBestAdapter } from '../data/db';
import { AppCtx } from './context';
import type { ConfirmOptions, Dialogs, EditorOptions, ToastAction, ToastFn } from './context';
import { Button, IconButton, Modal } from '../components/ui';
import { cx } from '../lib/cx';
import { Logo } from '../components/Logo';
import { CounterEditor } from '../components/CounterEditor';
import { ShareDialog } from '../components/ShareDialog';
import { ShortcutsHelp } from '../components/ShortcutsHelp';

/* One store for the whole page, created once even if React mounts twice. */
let storePromise: Promise<Store> | null = null;

function loadStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = (async () => {
      const adapter = await openBestAdapter();
      const store = new Store(adapter);
      await store.init();
      return store;
    })();
  }
  return storePromise;
}

interface ToastItem {
  id: number;
  message: string;
  kind: MessageKind;
  action?: ToastAction;
}

interface ConfirmState {
  options: ConfirmOptions;
  resolve: (ok: boolean) => void;
}

const TOAST_ICON = {
  info: <Info size={17} />,
  success: <CheckCircle2 size={17} />,
  error: <AlertTriangle size={17} />,
};

function Toasts({ items, dismiss }: { items: ToastItem[]; dismiss: (id: number) => void }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[84px] z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6 md:left-[76px] lg:left-[248px]"
      aria-live="polite"
      aria-atomic="false"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className="toast-in card-solid pointer-events-auto flex max-w-md items-center gap-3 py-2.5 pl-4 pr-2 text-sm shadow-xl"
        >
          <span className={cx('shrink-0', t.kind === 'success' && 'text-good', t.kind === 'error' && 'text-bad', t.kind === 'info' && 'text-accent')}>
            {TOAST_ICON[t.kind]}
          </span>
          <span className="min-w-0 flex-1 py-0.5">{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="rounded-lg px-2.5 py-1 text-[13px] font-semibold text-accent hover:bg-accent/15"
              onClick={() => {
                t.action?.onClick();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <IconButton label="Dismiss" size="sm" tooltip={false} icon={<X size={15} />} onClick={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}

function BootScreen({ error }: { error?: string }) {
  if (!error) {
    return (
      <div className="boot" role="status" aria-label="Loading Tickwell">
        <div className="boot-mark" />
      </div>
    );
  }
  return (
    <div className="boot p-6">
      <div className="card-solid max-w-md p-6 text-center">
        <Logo size={44} className="mx-auto mb-4" />
        <h1 className="text-xl font-semibold">Tickwell could not start</h1>
        <p className="mt-2 text-sm text-muted">{error}</p>
        <Button variant="primary" className="mt-5" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    </div>
  );
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store | null>(null);
  const [bootError, setBootError] = useState<string | undefined>();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [editor, setEditor] = useState<EditorOptions | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [shortcuts, setShortcuts] = useState(false);
  const nextId = useRef(1);

  useEffect(() => {
    let cancelled = false;
    loadStore()
      .then((s) => {
        if (!cancelled) setStore(s);
      })
      .catch((err: unknown) => {
        if (!cancelled) setBootError(err instanceof Error ? err.message : 'Something went wrong while opening your saved data.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback<ToastFn>(
    (message, kind = 'info', action) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, message, kind, action }]);
      const ms = kind === 'error' ? 9000 : action ? 6500 : 3800;
      window.setTimeout(() => dismiss(id), ms);
    },
    [dismiss],
  );

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ options, resolve });
      }),
    [],
  );

  const settle = (ok: boolean) => {
    confirmState?.resolve(ok);
    setConfirmState(null);
  };

  const dialogs = useMemo<Dialogs>(
    () => ({
      openEditor: (options = {}) => setEditor(options),
      openShare: (id) => setShareId(id),
      openShortcuts: () => setShortcuts(true),
    }),
    [],
  );

  // Surface save problems and keep data safe when the page is hidden or closed.
  useEffect(() => {
    if (!store) return undefined;
    store.onMessage = toast;
    const save = () => void store.flush();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') save();
    };
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [store, toast]);

  useEffect(() => {
    const ready = () => toast('Tickwell is ready to work offline.', 'success');
    window.addEventListener('tickwell:offline-ready', ready);
    return () => window.removeEventListener('tickwell:offline-ready', ready);
  }, [toast]);

  if (bootError) return <BootScreen error={bootError} />;
  if (!store) return <BootScreen />;

  const value = { store, toast, confirm, dialogs };
  const opts = confirmState?.options;

  return (
    <AppCtx.Provider value={value}>
      {children}
      <Toasts items={toasts} dismiss={dismiss} />
      <CounterEditor options={editor} onClose={() => setEditor(null)} />
      <ShareDialog counterId={shareId} onClose={() => setShareId(null)} />
      <ShortcutsHelp open={shortcuts} onClose={() => setShortcuts(false)} />
      <Modal
        open={confirmState !== null}
        onClose={() => settle(false)}
        title={opts?.title}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => settle(false)} data-autofocus={opts?.danger ? true : undefined}>
              {opts?.cancelLabel ?? 'Cancel'}
            </Button>
            <Button variant={opts?.danger ? 'danger' : 'primary'} onClick={() => settle(true)} data-autofocus={opts?.danger ? undefined : true}>
              {opts?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        {opts?.message && <div className="text-[14.5px] leading-relaxed text-muted">{opts.message}</div>}
      </Modal>
    </AppCtx.Provider>
  );
}

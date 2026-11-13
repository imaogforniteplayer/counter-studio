import { Suspense, lazy, useEffect, useRef } from 'react';
import { useApp, useAppState } from './app/context';
import { navigate, useRoute } from './lib/router';
import { useApplyTheme } from './lib/theme';
import { dialogIsOpen, isTypingTarget } from './lib/shortcuts';
import { NAV_ITEMS, Nav } from './components/Nav';
import { Button, Notice, PageSkeleton } from './components/ui';
import { Onboarding } from './components/Onboarding';
import HomePage from './pages/Home';

// Everything except Home is loaded on demand, so the first screen appears quickly.
const CountersPage = lazy(() => import('./pages/Counters'));
const TemplatesPage = lazy(() => import('./pages/Templates'));
const StatsPage = lazy(() => import('./pages/Stats'));
const HistoryPage = lazy(() => import('./pages/History'));
const ToolsPage = lazy(() => import('./pages/Tools'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const ImportPage = lazy(() => import('./pages/Import'));

function PageFor({ path }: { path: string }) {
  switch (path) {
    case '/':
      return <HomePage />;
    case '/counters':
      return <CountersPage />;
    case '/templates':
      return <TemplatesPage />;
    case '/stats':
      return <StatsPage />;
    case '/history':
      return <HistoryPage />;
    case '/tools':
      return <ToolsPage />;
    case '/settings':
      return <SettingsPage />;
    case '/import':
      return <ImportPage />;
    default:
      return <NotFound />;
  }
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 text-2xl font-semibold">That page does not exist</h1>
      <p className="mt-2 text-sm text-muted">The link may be old or mistyped.</p>
      <Button variant="primary" className="mt-6" onClick={() => navigate('/')}>
        Go to Home
      </Button>
    </div>
  );
}

/** Shortcuts that work on every page. Counting shortcuts live on the Home screen. */
function useGlobalShortcuts() {
  const { dialogs } = useApp();
  const { settings } = useAppState();
  const enabled = settings.shortcuts;

  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTypingTarget(e.target) || dialogIsOpen()) return;
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const m = /^Digit([1-7])$/.exec(e.code);
        if (m) {
          e.preventDefault();
          navigate(NAV_ITEMS[Number(m[1]) - 1].path);
        }
        return;
      }
      if (e.ctrlKey || e.metaKey) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        dialogs.openEditor({});
      } else if (e.key === '?') {
        e.preventDefault();
        dialogs.openShortcuts();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, dialogs]);
}

export default function App() {
  const route = useRoute();
  const { settings, storage, loadError } = useAppState();
  useApplyTheme(settings);
  useGlobalShortcuts();

  const main = useRef<HTMLElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [route.path]);

  return (
    <>
      <div className="app-bg" aria-hidden="true" />
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:shadow-xl"
      >
        Skip to content
      </a>
      <Nav current={route.path} />
      <main
        id="main"
        ref={main}
        tabIndex={-1}
        className="min-h-dvh pb-[88px] outline-none md:pb-10 md:pl-[76px] lg:pl-[248px]"
      >
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8 lg:px-10">
          {storage === 'memory' && (
            <div className="mb-5">
              <Notice tone="warn">
                <strong className="font-semibold">Saving is switched off in this browser.</strong> Private browsing or blocked site data can cause this. You can still
                count, but everything is lost when you close the tab. Export a backup from Settings before you leave.
              </Notice>
            </div>
          )}
          {loadError && (
            <div className="mb-5">
              <Notice
                tone="error"
                action={
                  <Button size="sm" onClick={() => window.location.reload()}>
                    Reload
                  </Button>
                }
              >
                <strong className="font-semibold">Your saved data could not be read.</strong> {loadError} Nothing has been deleted. Reloading often fixes this.
              </Notice>
            </div>
          )}
          <div key={route.path} className="page-enter">
            <Suspense fallback={<PageSkeleton />}>
              <PageFor path={route.path} />
            </Suspense>
          </div>
        </div>
      </main>
      <Onboarding />
    </>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Clock3, Hourglass, Keyboard, Lock, Moon, Plus, Search, Sun, Target, Unlock } from 'lucide-react';
import { useApp, useAppState } from '../app/context';
import { currentCounter, liveCounters } from '../app/selectors';
import { MODE_INFO } from '../core/counter';
import { formatNumber } from '../core/format';
import { rankEntries } from '../core/palette';
import { PALETTE_EVENT, isPaletteShortcut } from '../lib/palette';
import { navigate } from '../lib/router';
import { cx } from '../lib/cx';
import { NAV_ITEMS } from './Nav';
import { Modal } from './ui';

interface Entry {
  id: string;
  label: string;
  keywords?: string;
  hint: string;
  icon: ReactNode;
  run: () => void;
}

/** Ctrl+K (or Cmd+K): jump to a page or a counter, or run a common action, by typing a few letters. */
export function CommandPalette() {
  const { store, dialogs } = useApp();
  const { counters, settings } = useAppState();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const show = () => {
      setQuery('');
      setActive(0);
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (!isPaletteShortcut(e) || !settings.shortcuts) return;
      e.preventDefault();
      if (open) setOpen(false);
      else if (document.querySelector('[role="dialog"][aria-modal="true"]') === null) show();
    };
    window.addEventListener(PALETTE_EVENT, show);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(PALETTE_EVENT, show);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, settings.shortcuts]);

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    const current = currentCounter(counters, settings.lastCounterId);
    out.push({ id: 'new', label: 'New counter', keywords: 'create add', hint: 'Action', icon: <Plus size={17} />, run: () => dialogs.openEditor({}) });
    if (current) {
      out.push({
        id: 'lock',
        label: current.locked ? `Unlock “${current.name}”` : `Lock “${current.name}”`,
        keywords: 'lock unlock protect accidental taps',
        hint: 'Action',
        icon: current.locked ? <Unlock size={17} /> : <Lock size={17} />,
        run: () => store.toggleLock(current.id),
      });
    }
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    out.push({
      id: 'theme',
      label: dark ? 'Switch to light theme' : 'Switch to dark theme',
      keywords: 'appearance colours colors mode night day',
      hint: 'Action',
      icon: dark ? <Sun size={17} /> : <Moon size={17} />,
      run: () => store.updateSettings({ theme: dark ? 'light' : 'dark' }),
    });
    out.push({ id: 'keys', label: 'Keyboard shortcuts', keywords: 'keys help', hint: 'Action', icon: <Keyboard size={17} />, run: () => dialogs.openShortcuts() });
    NAV_ITEMS.forEach((n, i) => {
      const Icon = n.icon;
      out.push({ id: `go${n.path}`, label: n.label, keywords: 'go open page', hint: `Alt+${i + 1}`, icon: <Icon size={17} />, run: () => navigate(n.path) });
    });
    out.push(
      { id: 'tool-timer', label: 'Timer', keywords: 'countdown alarm tools', hint: 'Tools', icon: <Hourglass size={17} />, run: () => navigate('/tools', { tool: 'timer' }) },
      { id: 'tool-stopwatch', label: 'Stopwatch', keywords: 'laps tools', hint: 'Tools', icon: <Clock3 size={17} />, run: () => navigate('/tools', { tool: 'stopwatch' }) },
      { id: 'tool-focus', label: 'Focus timer', keywords: 'pomodoro study work breaks tools', hint: 'Tools', icon: <Target size={17} />, run: () => navigate('/tools', { tool: 'focus' }) },
    );
    for (const c of liveCounters(counters)) {
      out.push({
        id: `c-${c.id}`,
        label: c.name,
        keywords: MODE_INFO[c.mode].name,
        hint: c.mode === 'normal' || c.mode === 'goal' || c.mode === 'tally' || c.mode === 'countdown' || c.mode === 'interval' ? `${MODE_INFO[c.mode].name}, ${formatNumber(c.value)}` : MODE_INFO[c.mode].name,
        icon: <Search size={17} />,
        run: () => {
          store.selectCounter(c.id);
          navigate('/');
        },
      });
    }
    return out;
  }, [counters, settings.lastCounterId, settings.theme, store, dialogs]);

  const results = useMemo(() => rankEntries(entries, query, 40), [entries, query]);
  const at = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [at, results]);

  const choose = (entry: Entry | undefined) => {
    if (!entry) return;
    setOpen(false);
    // Let the palette close first, so a dialog opened by the action is not closed with it.
    window.setTimeout(entry.run, 0);
  };

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Command palette" size="md">
      <div className="space-y-3">
        <div className="relative">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            className="input w-full pl-10"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={results[at] ? `palette-${results[at].id}` : undefined}
            aria-label="Search pages, counters and actions"
            placeholder="Search pages, counters and actions"
            autoComplete="off"
            spellCheck={false}
            value={query}
            data-autofocus
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((at + 1) % Math.max(1, results.length));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((at - 1 + results.length) % Math.max(1, results.length));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                choose(results[at]);
              }
            }}
          />
        </div>
        {results.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Nothing matches “{query.trim()}”. Try a page name, a counter name or a word like “timer”.</p>
        ) : (
          <ul id="palette-list" ref={list} role="listbox" aria-label="Results" className="-mx-1 max-h-[min(22rem,50dvh)] overflow-y-auto px-1">
            {results.map((r, i) => (
              <li key={r.id} id={`palette-${r.id}`} role="option" aria-selected={i === at}>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => choose(r)}
                  onMouseMove={() => setActive(i)}
                  className={cx('flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[14.5px] transition-colors', i === at ? 'bg-accent/15' : 'hover:bg-line/10')}
                >
                  <span className={cx('shrink-0', i === at ? 'text-accent' : 'text-muted')} aria-hidden="true">
                    {r.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{r.label}</span>
                  <span className="max-w-[40%] shrink-0 truncate text-[12.5px] text-muted">{r.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="hidden text-[12px] text-muted sm:block">Use the arrow keys to move, Enter to choose, Esc to close.</p>
      </div>
    </Modal>
  );
}

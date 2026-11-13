import { useState } from 'react';
import { BarChart3, History, Home, LayoutGrid, LayoutTemplate, MoreHorizontal, Settings, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppState } from '../app/context';
import { href } from '../lib/router';
import { cx } from '../lib/cx';
import { Logo } from './Logo';
import { Modal } from './ui';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

/** Order matters: Alt+1 to Alt+7 jump to these. */
export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/counters', label: 'My Counters', icon: LayoutGrid },
  { path: '/templates', label: 'Templates', icon: LayoutTemplate },
  { path: '/stats', label: 'Statistics', icon: BarChart3 },
  { path: '/history', label: 'History', icon: History },
  { path: '/tools', label: 'Tools', icon: Wrench },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const MOBILE_PRIMARY = ['/', '/counters', '/stats', '/tools'];

function SaveStatus() {
  const { saveStatus, storage } = useAppState();
  let text = 'Saved on this device';
  let dot = 'bg-good';
  if (storage === 'memory') {
    text = 'Not saving (private mode?)';
    dot = 'bg-bad';
  } else if (saveStatus === 'saving') {
    text = 'Saving…';
    dot = 'bg-[rgb(255_190_60)]';
  } else if (saveStatus === 'error') {
    text = 'Could not save';
    dot = 'bg-bad';
  }
  return (
    <div className="flex items-center gap-2 text-[12px] text-muted" role="status" aria-live="polite">
      <span className={cx('h-2 w-2 shrink-0 rounded-full', dot)} aria-hidden="true" />
      <span className="hidden lg:inline">{text}</span>
      <span className="sr-only lg:hidden">{text}</span>
    </div>
  );
}

function isActive(current: string, path: string): boolean {
  return path === '/' ? current === '/' : current === path || current.startsWith(`${path}/`);
}

export function Nav({ current }: { current: string }) {
  const [more, setMore] = useState(false);
  const primary = NAV_ITEMS.filter((n) => MOBILE_PRIMARY.includes(n.path));
  const secondary = NAV_ITEMS.filter((n) => !MOBILE_PRIMARY.includes(n.path));
  const moreActive = secondary.some((n) => isActive(current, n.path));

  return (
    <>
      {/* Tablet and desktop: a rail that widens into a sidebar. */}
      <nav
        aria-label="Main"
        className="fixed inset-y-0 left-0 z-30 hidden w-[76px] flex-col border-r border-line/10 bg-surface/70 px-3 py-5 backdrop-blur-xl md:flex lg:w-[248px] lg:px-4"
      >
        <a href={href('/')} className="mb-7 flex items-center gap-3 rounded-xl px-1.5" aria-label="Tickwell home">
          <Logo size={36} className="shrink-0" />
          <span className="hidden text-[19px] font-semibold tracking-tight lg:block">
            Tickwell
            <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Counter Studio</span>
          </span>
        </a>

        <ul className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(current, item.path);
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <a
                  href={href(item.path)}
                  aria-current={active ? 'page' : undefined}
                  title={item.label}
                  className={cx(
                    'group relative flex h-11 items-center gap-3 rounded-xl px-3 text-[14.5px] font-medium transition-colors',
                    'justify-center lg:justify-start',
                    active ? 'bg-accent/15 text-ink' : 'text-muted hover:bg-line/10 hover:text-ink',
                  )}
                >
                  {active && <span className="absolute -left-3 h-5 w-1 rounded-r-full bg-accent lg:-left-4" aria-hidden="true" />}
                  <Icon size={19} strokeWidth={active ? 2.3 : 2} className={active ? 'text-accent' : undefined} aria-hidden="true" />
                  <span className="hidden lg:inline">{item.label}</span>
                  <span className="sr-only lg:hidden">{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex justify-center border-t border-line/10 pt-4 lg:justify-start lg:px-2">
          <SaveStatus />
        </div>
      </nav>

      {/* Phones: a bottom tab bar. */}
      <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line/10 bg-surface/85 backdrop-blur-xl md:hidden">
        <ul className="mx-auto flex h-16 max-w-md items-stretch justify-around px-2">
          {primary.map((item) => {
            const active = isActive(current, item.path);
            const Icon = item.icon;
            return (
              <li key={item.path} className="flex-1">
                <a
                  href={href(item.path)}
                  aria-current={active ? 'page' : undefined}
                  className={cx('flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium', active ? 'text-ink' : 'text-muted')}
                >
                  <Icon size={21} strokeWidth={active ? 2.4 : 2} className={active ? 'text-accent' : undefined} aria-hidden="true" />
                  {item.label === 'My Counters' ? 'Counters' : item.label}
                </a>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMore(true)}
              aria-haspopup="dialog"
              className={cx('flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium', moreActive ? 'text-ink' : 'text-muted')}
            >
              <MoreHorizontal size={21} className={moreActive ? 'text-accent' : undefined} aria-hidden="true" />
              More
            </button>
          </li>
        </ul>
      </nav>

      <Modal open={more} onClose={() => setMore(false)} title="More" size="sm">
        <ul className="space-y-1">
          {secondary.map((item) => {
            const Icon = item.icon;
            const active = isActive(current, item.path);
            return (
              <li key={item.path}>
                <a
                  href={href(item.path)}
                  onClick={() => setMore(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cx('flex h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-medium', active ? 'bg-accent/15' : 'hover:bg-line/10')}
                >
                  <Icon size={20} className={active ? 'text-accent' : 'text-muted'} aria-hidden="true" />
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 border-t border-line/10 pt-4">
          <SaveStatus />
        </div>
      </Modal>
    </>
  );
}

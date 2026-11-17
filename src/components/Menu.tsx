import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { IconButton } from './ui';
import { useDismiss } from './home/useDismiss';
import { cx } from '../lib/cx';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Draw a divider above this item. */
  separatorBefore?: boolean;
}

/**
 * A small dropdown menu: opens on click, closes on Escape or an outside press, and the
 * arrow keys move between items. Items are real buttons with role="menuitem".
 */
export function Menu({
  label,
  items,
  align = 'right',
  trigger,
  className,
}: {
  label: string;
  items: MenuItem[];
  align?: 'left' | 'right';
  /** Replace the default "more" button. Receives the open state. */
  trigger?: (open: boolean) => ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; minWidth: number; maxHeight: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, [wrap, list]);

  // The menu is drawn in a layer of its own on top of the page, so no card, bar or
  // scrolling area can ever cover or clip it. It opens downwards, or upwards when that fits better.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const anchor = wrap.current?.getBoundingClientRect();
    const menu = list.current;
    if (!anchor || !menu) return;
    const gap = 6;
    const margin = 8;
    const w = Math.max(menu.offsetWidth, anchor.width);
    const natural = menu.scrollHeight;
    const below = window.innerHeight - anchor.bottom - gap - margin;
    const above = anchor.top - gap - margin;
    const up = natural > below && above > below;
    const maxHeight = Math.max(120, up ? above : below);
    const height = Math.min(natural, maxHeight);
    const top = up ? anchor.top - gap - height : anchor.bottom + gap;
    let left = align === 'right' ? anchor.right - w : anchor.left;
    left = Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - w - margin));
    setPos({ left, top, minWidth: anchor.width, maxHeight });
  }, [open, align, items.length]);

  // Scrolling or resizing moves the button out from under the menu, so just close it.
  useEffect(() => {
    if (!open) return undefined;
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && list.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const first = list.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])');
    first?.focus();
  }, [open]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End' && e.key !== 'Tab') return;
    if (e.key === 'Tab') {
      setOpen(false);
      return;
    }
    const nodes = Array.from(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
    if (nodes.length === 0) return;
    e.preventDefault();
    const at = nodes.indexOf(document.activeElement as HTMLElement);
    let next = 0;
    if (e.key === 'ArrowDown') next = at < 0 ? 0 : (at + 1) % nodes.length;
    else if (e.key === 'ArrowUp') next = at <= 0 ? nodes.length - 1 : at - 1;
    else if (e.key === 'End') next = nodes.length - 1;
    nodes[next].focus();
  };

  return (
    <div ref={wrap} className={cx('relative inline-flex', className)}>
      <span onClick={() => setOpen((o) => !o)} className="inline-flex min-w-0 max-w-full flex-1">
        {trigger ? (
          trigger(open)
        ) : (
          <IconButton label={label} size="sm" icon={<MoreHorizontal size={18} />} aria-haspopup="menu" aria-expanded={open} active={open} />
        )}
      </span>
      {open &&
        createPortal(
        <div
          ref={list}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          className="card-solid fixed z-[80] min-w-[13.5rem] overflow-y-auto p-1.5 shadow-xl"
          style={pos ? { left: pos.left, top: pos.top, minWidth: Math.max(216, pos.minWidth), maxHeight: pos.maxHeight } : { left: 0, top: 0, visibility: 'hidden' }}
        >
          {items.map((item) => (
            <div key={item.label}>
              {item.separatorBefore && <div className="my-1.5 h-px bg-line/10" role="separator" />}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cx(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] transition-colors disabled:opacity-40',
                  item.danger ? 'text-bad hover:bg-bad/10' : 'hover:bg-line/10',
                )}
              >
                {item.icon && <span className="shrink-0 text-muted">{item.icon}</span>}
                {item.label}
              </button>
            </div>
          ))}
        </div>,
        document.body,
        )}
    </div>
  );
}

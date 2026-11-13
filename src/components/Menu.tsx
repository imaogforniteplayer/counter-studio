import { useCallback, useEffect, useRef, useState } from 'react';
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
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, wrap);

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
      <span onClick={() => setOpen((o) => !o)} className="inline-flex">
        {trigger ? (
          trigger(open)
        ) : (
          <IconButton label={label} size="sm" icon={<MoreHorizontal size={18} />} aria-haspopup="menu" aria-expanded={open} active={open} />
        )}
      </span>
      {open && (
        <div
          ref={list}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          className={cx('sheet-in card-solid absolute top-full z-40 mt-1.5 min-w-[13.5rem] p-1.5 shadow-xl', align === 'right' ? 'right-0' : 'left-0')}
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
        </div>
      )}
    </div>
  );
}

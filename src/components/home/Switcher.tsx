import { ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, Plus } from 'lucide-react';
import { useDialogs, useStore } from '../../app/context';
import type { Counter } from '../../core/types';
import { CounterIcon } from '../../lib/icons';
import { navigate } from '../../lib/router';
import { cx } from '../../lib/cx';
import { Menu } from '../Menu';
import type { MenuItem } from '../Menu';
import { Button, IconButton } from '../ui';
import { tileStyle } from './shared';

/** Move between counters: previous, next, a list of all of them, and a new-counter button. */
export function Switcher({ counters, current, onPrev, onNext }: { counters: Counter[]; current: Counter; onPrev: () => void; onNext: () => void }) {
  const store = useStore();
  const dialogs = useDialogs();
  const many = counters.length > 1;

  const items: MenuItem[] = [
    ...counters.slice(0, 40).map((c) => ({
      label: c.name,
      icon: (
        <span className="grid h-6 w-6 place-items-center rounded-md" style={tileStyle(c.color)}>
          <CounterIcon name={c.icon} size={14} />
        </span>
      ),
      onSelect: () => store.selectCounter(c.id),
    })),
    { label: 'All counters…', icon: <LayoutGrid size={16} />, onSelect: () => navigate('/counters'), separatorBefore: true },
  ];

  return (
    <div className="flex items-center gap-2">
      <IconButton label="Previous counter ([)" icon={<ChevronLeft size={19} />} variant="secondary" disabled={!many} onClick={onPrev} />
      <Menu
        label="Choose a counter"
        align="left"
        className="min-w-0 flex-1 sm:flex-none"
        items={items}
        trigger={(open) => (
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            className={cx('btn btn-secondary h-10 w-full min-w-0 justify-between gap-2.5 px-3 sm:min-w-[14rem]', open && 'border-accent/50')}
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md" style={tileStyle(current.color)}>
              <CounterIcon name={current.icon} size={14} />
            </span>
            <span className="min-w-0 flex-1 truncate text-left">{current.name}</span>
            <ChevronDown size={16} className="shrink-0 text-muted" aria-hidden="true" />
          </button>
        )}
      />
      <IconButton label="Next counter (])" icon={<ChevronRight size={19} />} variant="secondary" disabled={!many} onClick={onNext} />
      <Button className="ml-auto hidden sm:inline-flex" icon={<Plus size={16} />} onClick={() => dialogs.openEditor({})}>
        New counter
      </Button>
      <IconButton className="ml-auto sm:hidden" label="New counter (N)" variant="secondary" icon={<Plus size={19} />} onClick={() => dialogs.openEditor({})} />
    </div>
  );
}

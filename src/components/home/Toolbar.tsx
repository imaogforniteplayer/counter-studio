import { Maximize2, Minimize2, Redo2, RotateCcw, Share2, Undo2 } from 'lucide-react';
import { useAppState, useDialogs, useStore } from '../../app/context';
import type { Counter } from '../../core/types';
import { CounterMenu } from '../counters/CounterMenu';
import { IconButton } from '../ui';
import { useCounterActions } from './actions';
import type { FullscreenControl } from './useFullscreen';

/** Undo, redo, reset, share, full screen and the counter's menu. */
export function Toolbar({ counter, fullscreen }: { counter: Counter; fullscreen: FullscreenControl }) {
  const store = useStore();
  const dialogs = useDialogs();
  const { undo } = useAppState();
  const { reset } = useCounterActions();
  const flags = undo[counter.id] ?? { undo: false, redo: false };
  const full = fullscreen.active;

  return (
    <div className="flex items-center justify-center gap-1.5" role="toolbar" aria-label="Counter tools">
      <IconButton label="Undo (Z)" icon={<Undo2 size={19} />} variant="secondary" disabled={!flags.undo} onClick={() => store.undo(counter.id)} />
      <IconButton label="Redo (Shift+Z)" icon={<Redo2 size={19} />} variant="secondary" disabled={!flags.redo} onClick={() => store.redo(counter.id)} />
      <IconButton label="Reset (R)" icon={<RotateCcw size={18} />} variant="secondary" onClick={() => void reset(counter)} />
      <span className="mx-1 h-6 w-px bg-line/15" aria-hidden="true" />
      <IconButton
        label={full ? 'Exit full screen (Esc)' : 'Full screen (F)'}
        icon={full ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        variant="secondary"
        onClick={fullscreen.toggle}
      />
      {!full && (
        <>
          <IconButton label="Share" icon={<Share2 size={18} />} variant="secondary" onClick={() => dialogs.openShare(counter.id)} />
          <CounterMenu counter={counter} />
        </>
      )}
    </div>
  );
}

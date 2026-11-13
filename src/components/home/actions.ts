import { useCallback } from 'react';
import { useConfirm, useStore, useToast } from '../../app/context';
import type { Counter } from '../../core/types';
import { clampValue } from '../../core/counter';
import { formatNumber } from '../../core/format';
import { isAtStart, isSingleValue } from './shared';

/** Actions shared by buttons, menus and keyboard shortcuts. */
export function useCounterActions() {
  const store = useStore();
  const confirm = useConfirm();
  const toast = useToast();

  const reset = useCallback(
    async (c: Counter) => {
      if (isAtStart(c)) {
        toast(isSingleValue(c.mode) ? 'Already at the starting value.' : 'Every score is already 0.');
        return;
      }
      const single = isSingleValue(c.mode);
      const ok = await confirm({
        title: `Reset “${c.name}”?`,
        message: single
          ? `The value goes back to ${formatNumber(clampValue(c.startValue, c.min, c.max))}. You can undo this.`
          : 'Every score goes back to 0. You can undo this.',
        confirmLabel: 'Reset',
        danger: true,
      });
      if (!ok) return;
      if (store.reset(c.id)) {
        toast('Counter reset.', 'success', {
          label: 'Undo',
          onClick: () => {
            store.undo(c.id);
          },
        });
      }
    },
    [confirm, store, toast],
  );

  return { reset };
}

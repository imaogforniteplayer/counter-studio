import { useEffect } from 'react';
import type { RefObject } from 'react';

/** Close a popover on Escape or when the pointer goes down outside of it. */
export function useDismiss(open: boolean, onClose: () => void, ref: RefObject<HTMLElement> | RefObject<HTMLElement>[]): void {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: Event) => {
      const refs = Array.isArray(ref) ? ref : [ref];
      const target = e.target;
      if (target instanceof Node && !refs.some((r) => r.current?.contains(target))) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);
}

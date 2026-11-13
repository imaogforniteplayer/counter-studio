import { useEffect } from 'react';
import type { RefObject } from 'react';

/** Close a popover on Escape or when the pointer goes down outside of it. */
export function useDismiss(open: boolean, onClose: () => void, ref: RefObject<HTMLElement>): void {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: Event) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) onClose();
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
  }, [open, onClose, ref]);
}

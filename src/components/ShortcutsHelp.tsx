import { Fragment } from 'react';
import { Kbd, Modal } from './ui';
import { SHORTCUT_GROUPS } from '../lib/shortcuts';

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" description="Shortcuts never fire while you are typing in a box." size="md">
      <div className="space-y-6">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="eyebrow mb-2">{group.title}</h3>
            <ul className="divide-y divide-line/10">
              {group.items.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <span>{item.label}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {item.keys.map((k, i) => (
                      <Fragment key={`${k}-${i}`}>
                        {i > 0 && <span className="text-muted">+</span>}
                        <Kbd>{k}</Kbd>
                      </Fragment>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}

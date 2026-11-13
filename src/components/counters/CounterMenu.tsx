import { useState } from 'react';
import { BarChart3, Copy, Folder, History, Pencil, Pin, PinOff, Save, Share2, Trash2 } from 'lucide-react';
import { useAppState, useDialogs, useStore, useToast } from '../../app/context';
import type { Counter } from '../../core/types';
import { navigate } from '../../lib/router';
import { Menu } from '../Menu';
import type { MenuItem } from '../Menu';
import { Button, Field, Modal, TextInput } from '../ui';
import { cx } from '../../lib/cx';

/** The "more" menu for one counter, with the small dialogs its actions need. */
export function CounterMenu({
  counter,
  extraItems = [],
  className,
}: {
  counter: Counter;
  /** Items shown first, e.g. "Move up" and "Move down" on the My Counters page. */
  extraItems?: MenuItem[];
  className?: string;
}) {
  const store = useStore();
  const toast = useToast();
  const dialogs = useDialogs();
  const { folders } = useAppState();
  const [templateOpen, setTemplateOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const trash = () => {
    if (!store.trashCounter(counter.id)) return;
    toast(`“${counter.name}” moved to the trash.`, 'info', {
      label: 'Undo',
      onClick: () => {
        store.restoreCounter(counter.id);
      },
    });
  };

  const items: MenuItem[] = [
    ...extraItems,
    { label: 'Edit', icon: <Pencil size={16} />, onSelect: () => dialogs.openEditor({ counterId: counter.id }), separatorBefore: extraItems.length > 0 },
    { label: 'Share…', icon: <Share2 size={16} />, onSelect: () => dialogs.openShare(counter.id) },
    {
      label: 'Duplicate',
      icon: <Copy size={16} />,
      onSelect: () => {
        const copy = store.duplicateCounter(counter.id);
        if (copy) toast(`Created “${copy.name}”.`, 'success');
      },
    },
    {
      label: counter.pinned ? 'Unpin' : 'Pin to top',
      icon: counter.pinned ? <PinOff size={16} /> : <Pin size={16} />,
      onSelect: () => {
        store.togglePin(counter.id);
      },
    },
    { label: 'Move to folder…', icon: <Folder size={16} />, onSelect: () => setFolderOpen(true) },
    {
      label: 'Save as template…',
      icon: <Save size={16} />,
      onSelect: () => {
        setTemplateName(counter.name);
        setTemplateOpen(true);
      },
    },
    { label: 'View history', icon: <History size={16} />, onSelect: () => navigate('/history', { c: counter.id }), separatorBefore: true },
    { label: 'View statistics', icon: <BarChart3 size={16} />, onSelect: () => navigate('/stats', { c: counter.id }) },
    { label: 'Move to trash', icon: <Trash2 size={16} />, onSelect: trash, danger: true, separatorBefore: true },
  ];

  const saveTemplate = () => {
    const name = templateName.trim();
    if (!name) return;
    const t = store.saveTemplate(counter.id, name);
    setTemplateOpen(false);
    if (t) toast(`Saved the template “${t.name}”. Find it under Templates.`, 'success');
  };

  return (
    <>
      <Menu label={`Actions for ${counter.name}`} items={items} className={className} />

      <Modal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="Save as template"
        description="Saves this counter's settings (not its current value or history) so you can start new counters from it."
        size="sm"
        footer={
          <>
            <Button onClick={() => setTemplateOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveTemplate} disabled={!templateName.trim()}>
              Save template
            </Button>
          </>
        }
      >
        <Field label="Template name" htmlFor="tpl-name">
          <TextInput
            id="tpl-name"
            value={templateName}
            onChange={setTemplateName}
            maxLength={80}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTemplate();
            }}
          />
        </Field>
      </Modal>

      <Modal open={folderOpen} onClose={() => setFolderOpen(false)} title="Move to folder" size="sm">
        <div className="space-y-1.5" role="radiogroup" aria-label="Folder">
          {[{ id: null as string | null, name: 'No folder' }, ...folders.map((f) => ({ id: f.id as string | null, name: f.name }))].map((f) => {
            const active = counter.folderId === f.id;
            return (
              <button
                key={f.id ?? 'none'}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  store.moveToFolder(counter.id, f.id);
                  setFolderOpen(false);
                  toast(f.id ? `Moved to ${f.name}.` : 'Removed from its folder.', 'success');
                }}
                className={cx('flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-[14.5px] transition-colors', active ? 'border-accent/60 bg-accent/10' : 'border-line/10 hover:bg-line/10')}
              >
                <Folder size={17} className="text-muted" aria-hidden="true" />
                {f.name}
              </button>
            );
          })}
          {folders.length === 0 && <p className="pt-2 text-sm text-muted">You have no folders yet. Create one from the My Counters page.</p>}
        </div>
      </Modal>
    </>
  );
}

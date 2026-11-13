import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { ArchiveRestore, ArrowDown, ArrowUp, FolderPlus, Layers, LayoutGrid, List, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useAppState, useConfirm, useDialogs, useSettings, useStore, useToast } from '../app/context';
import { inManualOrder, liveCounters, recentlyUsed, trashedCounters } from '../app/selectors';
import type { Counter } from '../core/types';
import { MODE_INFO, counterTotal } from '../core/counter';
import { reorderWithin } from '../core/order';
import { relativeTime } from '../core/format';
import { dialogIsOpen, isTypingTarget } from '../lib/shortcuts';
import { navigate, useRoute } from '../lib/router';
import { feedback } from '../lib/feedback';
import { cx } from '../lib/cx';
import { CounterCard } from '../components/CounterCard';
import { CounterMenu } from '../components/counters/CounterMenu';
import type { MenuItem } from '../components/Menu';
import { Button, ColorPicker, EmptyState, Field, IconButton, Modal, PageHeader, Segmented, Select, TextInput } from '../components/ui';
import { gradientCss } from '../core/colors';

type Sort = 'manual' | 'recent' | 'name' | 'value' | 'newest';

const SORTS: { value: Sort; label: string }[] = [
  { value: 'manual', label: 'My order' },
  { value: 'recent', label: 'Recently used' },
  { value: 'name', label: 'Name' },
  { value: 'value', label: 'Highest value' },
  { value: 'newest', label: 'Newest first' },
];

function matches(c: Counter, q: string): boolean {
  const hay = [c.name, c.description, MODE_INFO[c.mode].name, ...c.players.map((p) => p.name), ...c.subCounters.map((s) => s.name)].join('\n').toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term));
}

function sortCounters(list: Counter[], sort: Sort): Counter[] {
  switch (sort) {
    case 'recent':
      return [...list].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
    case 'name':
      return [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
    case 'value':
      return [...list].sort((a, b) => counterTotal(b) - counterTotal(a));
    case 'newest':
      return [...list].sort((a, b) => b.createdAt - a.createdAt);
    default:
      return inManualOrder(list);
  }
}

interface FolderDialog {
  id: string | null;
  name: string;
  color: string;
}

export default function CountersPage() {
  const store = useStore();
  const toast = useToast();
  const confirm = useConfirm();
  const dialogs = useDialogs();
  const settings = useSettings();
  const { counters, folders } = useAppState();
  const route = useRoute();

  const [filter, setFilter] = useState(route.query.get('f') ?? 'all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('manual');
  const [folderDialog, setFolderDialog] = useState<FolderDialog | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const search = useRef<HTMLInputElement>(null);

  const live = useMemo(() => liveCounters(counters), [counters]);
  const trashed = useMemo(() => trashedCounters(counters), [counters]);
  const activeFolder = folders.find((f) => f.id === filter) ?? null;

  // If the folder being viewed is deleted, fall back to everything.
  useEffect(() => {
    if (filter !== 'all' && filter !== 'pinned' && filter !== 'recent' && filter !== 'trash' && !activeFolder) setFilter('all');
  }, [filter, activeFolder]);

  useEffect(() => {
    if (!settings.shortcuts) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target) || dialogIsOpen()) return;
      e.preventDefault();
      search.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settings.shortcuts]);

  const base = useMemo(() => {
    if (filter === 'pinned') return live.filter((c) => c.pinned);
    if (filter === 'recent') return recentlyUsed(live, 12);
    if (activeFolder) return live.filter((c) => c.folderId === activeFolder.id);
    return live;
  }, [filter, live, activeFolder]);

  const visible = useMemo(() => {
    const found = query.trim() ? base.filter((c) => matches(c, query)) : base;
    return filter === 'recent' ? sortCounters(found, 'recent') : sortCounters(found, sort);
  }, [base, query, sort, filter]);

  const canReorder = sort === 'manual' && !query.trim() && filter !== 'recent' && filter !== 'trash';
  const view = settings.countersView;

  const open = (c: Counter) => {
    store.selectCounter(c.id);
    navigate('/');
  };

  const bump = (c: Counter, dir: 1 | -1) => {
    const r = store.bump(c.id, dir);
    if (r?.hit) feedback(settings, 'limit');
    else feedback(settings, dir > 0 ? 'tap' : 'dec');
    if (r?.completed) toast(`“${c.name}” finished.`, 'success');
  };

  const applyOrder = (ids: string[]) => store.reorder(reorderWithin(live, ids));

  const move = (id: string, delta: -1 | 1) => {
    const ids = visible.map((c) => c.id);
    const at = ids.indexOf(id);
    const to = at + delta;
    if (at < 0 || to < 0 || to >= ids.length) return;
    [ids[at], ids[to]] = [ids[to], ids[at]];
    applyOrder(ids);
  };

  const onDrop = (target: string) => {
    if (!dragId || dragId === target) return;
    const ids = visible.map((c) => c.id).filter((id) => id !== dragId);
    const at = ids.indexOf(target);
    ids.splice(at, 0, dragId);
    applyOrder(ids);
  };

  const dragProps = (c: Counter) =>
    canReorder
      ? {
          draggable: true,
          onDragStart: (e: DragEvent<HTMLElement>) => {
            setDragId(c.id);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', c.id);
          },
          onDragOver: (e: DragEvent<HTMLElement>) => {
            if (!dragId) return;
            e.preventDefault();
            setOverId(c.id);
          },
          onDragLeave: () => setOverId((o) => (o === c.id ? null : o)),
          onDrop: (e: DragEvent<HTMLElement>) => {
            e.preventDefault();
            onDrop(c.id);
            setDragId(null);
            setOverId(null);
          },
          onDragEnd: () => {
            setDragId(null);
            setOverId(null);
          },
        }
      : {};

  const reorderItems = (c: Counter, index: number): MenuItem[] =>
    canReorder
      ? [
          { label: 'Move earlier', icon: <ArrowUp size={16} />, onSelect: () => move(c.id, -1), disabled: index === 0 },
          { label: 'Move later', icon: <ArrowDown size={16} />, onSelect: () => move(c.id, 1), disabled: index === visible.length - 1 },
        ]
      : [];

  const saveFolder = () => {
    if (!folderDialog) return;
    const name = folderDialog.name.trim();
    if (!name) return;
    if (folderDialog.id) {
      store.updateFolder(folderDialog.id, { name, color: folderDialog.color });
      toast('Folder updated.', 'success');
    } else {
      const f = store.addFolder(name, folderDialog.color);
      setFilter(f.id);
      toast(`Folder “${f.name}” created.`, 'success');
    }
    setFolderDialog(null);
  };

  const deleteFolder = async () => {
    if (!activeFolder) return;
    const n = live.filter((c) => c.folderId === activeFolder.id).length;
    const ok = await confirm({
      title: `Delete the folder “${activeFolder.name}”?`,
      message: n > 0 ? `Its ${n} ${n === 1 ? 'counter stays' : 'counters stay'} in My Counters. Only the folder is removed.` : 'The folder is empty.',
      confirmLabel: 'Delete folder',
      danger: true,
    });
    if (!ok) return;
    store.deleteFolder(activeFolder.id);
    setFilter('all');
    toast('Folder deleted.', 'success');
  };

  const emptyTrash = async () => {
    const ok = await confirm({
      title: 'Empty the trash?',
      message: `${trashed.length} ${trashed.length === 1 ? 'counter' : 'counters'} and their history will be deleted permanently. This cannot be undone.`,
      confirmLabel: 'Empty trash',
      danger: true,
    });
    if (!ok) return;
    const n = store.emptyTrash();
    toast(`Deleted ${n} ${n === 1 ? 'counter' : 'counters'} for good.`, 'success');
  };

  const deleteForever = async (c: Counter) => {
    const ok = await confirm({
      title: `Delete “${c.name}” forever?`,
      message: 'Its history goes with it. This cannot be undone.',
      confirmLabel: 'Delete forever',
      danger: true,
    });
    if (!ok) return;
    store.deleteForever(c.id);
    toast('Deleted.', 'success');
  };

  const chips: { id: string; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: live.length },
    { id: 'pinned', label: 'Pinned', count: live.filter((c) => c.pinned).length },
    { id: 'recent', label: 'Recent' },
    ...folders.map((f) => ({ id: f.id, label: f.name, count: live.filter((c) => c.folderId === f.id).length })),
    { id: 'trash', label: 'Trash', count: trashed.length },
  ];

  const header = (
    <PageHeader
      title="My Counters"
      subtitle={live.length === 0 ? 'Everything you count lives here.' : `${live.length} ${live.length === 1 ? 'counter' : 'counters'}${trashed.length ? ` · ${trashed.length} in the trash` : ''}`}
      actions={
        <Button variant="primary" icon={<Plus size={17} />} onClick={() => dialogs.openEditor({ folderId: activeFolder?.id ?? null })}>
          New counter
        </Button>
      }
    />
  );

  /* ------------------------------- trash -------------------------------- */
  const trashView = (
    <>
      {trashed.length > 0 ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">Counters here can be restored. Deleting one for good also deletes its history.</p>
            <Button variant="danger" size="sm" icon={<Trash2 size={15} />} onClick={() => void emptyTrash()}>
              Empty trash
            </Button>
          </div>
          <div className="space-y-3">
            {trashed.map((c) => (
              <div key={c.id} className="opacity-90">
                <CounterCard
                  counter={c}
                  view="list"
                  menu={
                    <div className="flex items-center gap-1.5">
                      <span className="mr-1 hidden text-[12px] text-muted md:inline">Deleted {relativeTime(c.deletedAt ?? Date.now())}</span>
                      <Button
                        size="sm"
                        icon={<ArchiveRestore size={15} />}
                        onClick={() => {
                          store.restoreCounter(c.id);
                          toast(`Restored “${c.name}”.`, 'success');
                        }}
                      >
                        Restore
                      </Button>
                      <IconButton label={`Delete ${c.name} forever`} size="sm" variant="danger" icon={<Trash2 size={15} />} onClick={() => void deleteForever(c)} />
                    </div>
                  }
                />
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyState icon={<Trash2 size={26} />} title="The trash is empty" description="Counters you delete land here first, so you can change your mind." />
      )}
    </>
  );

  /* ------------------------------- lists -------------------------------- */
  const listView = (
    <>
      {visible.length === 0 ? (
        live.length === 0 ? (
          <EmptyState icon={<Layers size={26} />} title="No counters yet" description="Create your first counter, or start from a template.">
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => dialogs.openEditor({})}>
              New counter
            </Button>
            <Button onClick={() => navigate('/templates')}>Browse templates</Button>
          </EmptyState>
        ) : query.trim() ? (
          <EmptyState icon={<Search size={26} />} title="No matches" description={`Nothing matches “${query.trim()}”.`}>
            <Button onClick={() => setQuery('')}>Clear search</Button>
          </EmptyState>
        ) : filter === 'pinned' ? (
          <EmptyState icon={<Layers size={26} />} title="Nothing pinned" description="Pin a counter from its menu and it stays at the top of the list." />
        ) : activeFolder ? (
          <EmptyState icon={<Layers size={26} />} title="This folder is empty" description="Add a counter here with “Move to folder” in its menu, or create a new one.">
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => dialogs.openEditor({ folderId: activeFolder.id })}>
              New counter in this folder
            </Button>
          </EmptyState>
        ) : (
          <EmptyState icon={<Layers size={26} />} title="Nothing here yet" description="Counters you use will show up here." />
        )
      ) : (
        <div className={cx(view === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-3')}>
          {visible.map((c, i) => (
            <CounterCard
              key={c.id}
              counter={c}
              view={view}
              onOpen={() => open(c)}
              onBump={(dir) => bump(c, dir)}
              articleProps={dragProps(c)}
              highlight={overId === c.id && dragId !== c.id}
              className={cx(dragId === c.id && 'opacity-40', canReorder && 'cursor-grab active:cursor-grabbing')}
              menu={<CounterMenu counter={c} extraItems={reorderItems(c, i)} />}
            />
          ))}
        </div>
      )}
      {canReorder && visible.length > 1 && <p className="mt-5 text-center text-[12.5px] text-muted">Drag cards to rearrange them, or use “Move earlier” and “Move later” in a card's menu.</p>}
    </>
  );

  return (
    <div>
      {header}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <TextInput ref={search} type="search" value={query} onChange={setQuery} placeholder="Search counters   ( / )" aria-label="Search counters" className="pl-10" />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:text-ink">
              <X size={15} />
            </button>
          )}
        </div>
        {filter !== 'trash' && (
          <>
            <Select<Sort> aria-label="Sort counters" className="w-44" value={sort} onChange={setSort} options={SORTS} />
            <Segmented
              ariaLabel="Layout"
              value={view}
              onChange={(v) => store.updateSettings({ countersView: v })}
              options={[
                { value: 'grid', label: <span className="sr-only">Grid</span>, icon: <LayoutGrid size={16} /> },
                { value: 'list', label: <span className="sr-only">List</span>, icon: <List size={16} /> },
              ]}
            />
          </>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter counters">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={filter === c.id}
            data-active={filter === c.id}
            className="chip"
            onClick={() => setFilter(c.id)}
          >
            {folders.some((f) => f.id === c.id) && (
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: gradientCss(folders.find((f) => f.id === c.id)?.color ?? 'slate') }} aria-hidden="true" />
            )}
            {c.label}
            {c.count !== undefined && <span className="text-[12px] opacity-70">{c.count}</span>}
          </button>
        ))}
        <button type="button" className="chip border-dashed" onClick={() => setFolderDialog({ id: null, name: '', color: 'ember' })}>
          <FolderPlus size={14} aria-hidden="true" /> New folder
        </button>
      </div>

      {activeFolder && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-lg font-semibold">{activeFolder.name}</h2>
          <Button size="sm" icon={<Pencil size={14} />} onClick={() => setFolderDialog({ id: activeFolder.id, name: activeFolder.name, color: activeFolder.color })}>
            Rename or recolour
          </Button>
          <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => void deleteFolder()}>
            Delete folder
          </Button>
        </div>
      )}

      {filter === 'trash' ? trashView : listView}

      <Modal
        open={folderDialog !== null}
        onClose={() => setFolderDialog(null)}
        title={folderDialog?.id ? 'Edit folder' : 'New folder'}
        size="sm"
        footer={
          <>
            <Button onClick={() => setFolderDialog(null)}>Cancel</Button>
            <Button variant="primary" onClick={saveFolder} disabled={!folderDialog?.name.trim()}>
              {folderDialog?.id ? 'Save' : 'Create folder'}
            </Button>
          </>
        }
      >
        {folderDialog && (
          <div className="space-y-5">
            <Field label="Folder name" htmlFor="folder-name">
              <TextInput
                id="folder-name"
                value={folderDialog.name}
                maxLength={60}
                placeholder="e.g. Fitness"
                onChange={(name) => setFolderDialog({ ...folderDialog, name })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveFolder();
                }}
              />
            </Field>
            <Field label="Colour">
              <ColorPicker value={folderDialog.color} allowCustom={false} onChange={(color) => setFolderDialog({ ...folderDialog, color })} />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

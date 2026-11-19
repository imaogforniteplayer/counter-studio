import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { Archive, Database, Download, FileJson, FileSpreadsheet, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useAppState, useConfirm, useStore, useToast } from '../../app/context';
import { liveCounters } from '../../app/selectors';
import { countersToCsv, historyToCsv } from '../../core/csv';
import { ImportError, parseBackup } from '../../core/dataio';
import type { BackupFile } from '../../core/types';
import { downloadText, readFileText, slug, stamp } from '../../lib/files';
import { Badge, Button, Modal, Notice } from '../ui';

function when(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

interface Pending {
  backup: BackupFile;
  fileName: string;
}

function Block({ icon, title, description, action, tone, children }: { icon: ReactNode; title: string; description: ReactNode; action?: ReactNode; tone?: 'danger'; children: ReactNode }) {
  const danger = tone === 'danger';
  return (
    <div className={danger ? 'rounded-2xl border border-bad/30 bg-bad/5 p-4 sm:p-5' : 'rounded-2xl border border-line/10 bg-raised/30 p-4 sm:p-5'}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-3">
        <span className={danger ? 'grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-bad/15 text-bad' : 'grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent'}>{icon}</span>
        <div className="min-w-0 flex-1 basis-52">
          <h3 className={danger ? 'text-[15px] font-semibold text-bad' : 'text-[15px] font-semibold'}>{title}</h3>
          <p className="mt-0.5 text-[13.5px] leading-snug text-muted">{description}</p>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function DataSection() {
  const store = useStore();
  const toast = useToast();
  const confirm = useConfirm();
  const { counters, history, backups, storage } = useAppState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const live = liveCounters(counters);
  const names = Object.fromEntries(counters.map((c) => [c.id, c.name]));

  const exportJson = () => {
    const backup = store.exportBackup();
    downloadText(`tickwell-backup-${stamp()}.json`, JSON.stringify(backup, null, 2));
    toast('Backup file saved to your downloads.', 'success');
  };
  const exportCounters = () => {
    downloadText(`tickwell-counters-${stamp()}.csv`, countersToCsv(live), 'text/csv');
    toast('Counters exported as CSV.', 'success');
  };
  const exportHistory = () => {
    downloadText(`tickwell-history-${stamp()}.csv`, historyToCsv(history, names), 'text/csv');
    toast('History exported as CSV.', 'success');
  };

  const onFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    setError(null);
    try {
      const text = await readFileText(file);
      setPending({ backup: parseBackup(text), fileName: file.name });
    } catch (e) {
      setError(e instanceof ImportError || e instanceof Error ? e.message : 'That file could not be read.');
    }
  };

  const runImport = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    setBusy(true);
    try {
      const s = await store.importBackup(pending.backup, mode);
      setPending(null);
      if (mode === 'replace') toast(`Replaced everything with ${s.counters} counters and ${s.addedHistory} history entries. Your previous data is in Restore points.`, 'success');
      else toast(`Imported: ${s.addedCounters} new, ${s.updatedCounters} updated, ${s.skippedCounters} unchanged, ${s.addedHistory} history entries added.`, 'success');
    } catch {
      toast('The import failed and nothing was changed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const createPoint = async () => {
    const r = await store.createRestorePoint('Manual backup');
    toast(r === 'duplicate' ? 'You already have a restore point with exactly this data.' : 'Restore point saved in this browser.', r === 'duplicate' ? 'info' : 'success');
  };

  const restore = async (id: string, label: string) => {
    const ok = await confirm({
      title: 'Restore this point?',
      message: `Everything will be replaced with “${label}”. Your current data is saved as a new restore point first, so you can come back.`,
      confirmLabel: 'Restore',
    });
    if (!ok) return;
    const done = await store.restoreFromPoint(id);
    toast(done ? 'Restored.' : 'That restore point could not be found.', done ? 'success' : 'error');
  };

  const removePoint = async (id: string) => {
    const ok = await confirm({ title: 'Delete this restore point?', confirmLabel: 'Delete', danger: true });
    if (ok) await store.deleteRestorePoint(id);
  };

  const downloadPoint = async (id: string, label: string) => {
    const p = await store.getRestorePoint(id);
    if (!p) return toast('That restore point could not be found.', 'error');
    downloadText(`tickwell-${slug(label, 'restore-point')}-${stamp(new Date(p.createdAt))}.json`, JSON.stringify(p.data, null, 2));
  };

  const reset = async () => {
    const ok = await confirm({
      title: 'Erase everything?',
      message: 'This deletes all counters, folders, templates, history and settings on this device. A restore point is made first, unless you also clear restore points on the next step.',
      confirmLabel: 'Continue',
      danger: true,
    });
    if (!ok) return;
    const wipeBackups = await confirm({
      title: 'Also delete the restore points?',
      message: 'Choose “Keep them” to be able to undo this from Restore points. Deleting them cannot be undone.',
      confirmLabel: 'Delete them too',
      cancelLabel: 'Keep them',
      danger: true,
    });
    await store.resetEverything(wipeBackups);
    toast('Everything was erased.', 'success');
  };

  return (
    <div className="space-y-5">
      {storage === 'memory' && (
        <Notice tone="warn">
          This browser is not letting Tickwell save data, so everything is held in memory and will be lost when you close the tab. Export a backup before you leave.
        </Notice>
      )}

      <Block icon={<Download size={18} aria-hidden="true" />} title="Export" description="Save your data as a file you keep. The JSON backup contains everything and can be imported again.">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<FileJson size={16} />} onClick={exportJson}>
            Full backup (JSON)
          </Button>
          <Button icon={<FileSpreadsheet size={16} />} onClick={exportCounters} disabled={live.length === 0}>
            Counters (CSV)
          </Button>
          <Button icon={<FileSpreadsheet size={16} />} onClick={exportHistory} disabled={history.length === 0}>
            History (CSV)
          </Button>
        </div>
      </Block>

      <Block icon={<Upload size={18} aria-hidden="true" />} title="Import" description="Choose a Tickwell backup file. You will see what it contains before anything changes.">
        <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" id="backup-file" aria-label="Choose a backup file" onChange={(e) => void onFile(e.target.files?.[0])} />
        <Button icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>
          Choose backup file…
        </Button>
        {error && (
          <p className="mt-3 text-[13px] text-bad" role="alert">
            {error}
          </p>
        )}
      </Block>

      <Block
        icon={<Archive size={18} aria-hidden="true" />}
        title="Restore points"
        description="Snapshots kept inside this browser. One is made automatically each day you use the app, and before every import, restore or reset. Clearing site data in your browser deletes them, so export a file for safety."
        action={
          <Button size="sm" icon={<Database size={14} />} onClick={() => void createPoint()}>
            Save one now
          </Button>
        }
      >
        {backups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line/20 px-4 py-5 text-sm text-muted">No restore points yet.</p>
        ) : (
          <ul className="divide-y divide-line/10 overflow-hidden rounded-xl border border-line/15">
            {backups.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-surface px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
                    <span className="truncate">{b.label}</span>
                    {b.auto && <Badge>Automatic</Badge>}
                  </p>
                  <p className="text-[12.5px] text-muted">
                    {when(b.createdAt)} · {b.counterCount} counters · {b.historyCount} history entries
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" icon={<RotateCcw size={14} />} onClick={() => void restore(b.id, b.label)}>
                    Restore
                  </Button>
                  <Button size="sm" variant="ghost" icon={<Download size={14} />} aria-label={`Download ${b.label} from ${when(b.createdAt)}`} onClick={() => void downloadPoint(b.id, b.label)} />
                  <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} aria-label={`Delete ${b.label} from ${when(b.createdAt)}`} onClick={() => void removePoint(b.id)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block icon={<Trash2 size={18} aria-hidden="true" />} tone="danger" title="Erase everything" description="Start completely fresh on this device.">
        <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => void reset()}>
          Erase all data…
        </Button>
      </Block>

      <Modal
        open={pending !== null}
        onClose={() => (busy ? undefined : setPending(null))}
        title="Import this backup?"
        description={pending ? `From “${pending.fileName}”, exported ${when(pending.backup.exportedAt)}.` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void runImport('replace')} loading={busy} disabled={busy}>
              Replace everything
            </Button>
            <Button variant="primary" onClick={() => void runImport('merge')} loading={busy} disabled={busy}>
              Merge with mine
            </Button>
          </>
        }
      >
        {pending && (
          <div className="space-y-3 text-sm">
            <ul className="grid grid-cols-2 gap-2 text-center">
              {[
                ['Counters', pending.backup.counters.length],
                ['Folders', pending.backup.folders.length],
                ['Templates', pending.backup.templates.length],
                ['History entries', pending.backup.history.length],
              ].map(([label, n]) => (
                <li key={label} className="rounded-lg border border-line/15 bg-raised px-3 py-2.5">
                  <p className="text-xl font-semibold tabular-nums">{n}</p>
                  <p className="text-[12.5px] text-muted">{label}</p>
                </li>
              ))}
            </ul>
            <p className="text-muted">
              <strong className="text-ink">Merge</strong> adds what is new and keeps your current counters. If the same counter is in both, the one changed most recently wins.
            </p>
            <p className="text-muted">
              <strong className="text-ink">Replace</strong> swaps all your data, including settings, for this file.
            </p>
            <p className="text-muted">Either way, your current data is saved as a restore point first.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

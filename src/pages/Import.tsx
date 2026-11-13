import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Link2, ShieldCheck } from 'lucide-react';
import { useStore, useToast } from '../app/context';
import { counterFromShareToken, tokenFromHash } from '../core/share';
import type { Counter } from '../core/types';
import { MODE_INFO } from '../core/counter';
import { formatNumber } from '../core/format';
import { navigate, useRoute } from '../lib/router';
import { CounterCard } from '../components/CounterCard';
import { describeConfig } from '../components/counters/summary';
import { configOf } from '../core/counter';
import { Button, Card, EmptyState, Field, Notice, PageHeader, TextInput } from '../components/ui';

type Decoded = { ok: true; counter: Counter } | { ok: false; error: string };

function decode(token: string): Decoded {
  try {
    return { ok: true, counter: counterFromShareToken(token) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'This link could not be read.' };
  }
}

/** Pull a share token out of whatever the person pasted: a full link, a #/import?d= fragment or a bare token. */
function tokenFromInput(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  try {
    const url = new URL(t);
    const fromHash = tokenFromHash(url.hash);
    if (fromHash) return fromHash;
  } catch {
    /* not a full URL */
  }
  const fromFragment = tokenFromHash(t.startsWith('#') ? t : `#${t.replace(/^.*?(?=\/import)/, '')}`);
  return fromFragment ?? (/^[A-Za-z0-9_-]{8,}$/.test(t) ? t : null);
}

export default function ImportPage() {
  const store = useStore();
  const toast = useToast();
  const route = useRoute();
  const urlToken = route.query.get('d');
  const [pasted, setPasted] = useState('');
  const [pastedToken, setPastedToken] = useState<string | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);

  const token = pastedToken ?? urlToken;
  const result = useMemo(() => (token ? decode(token) : null), [token]);

  const read = () => {
    const found = tokenFromInput(pasted);
    if (!found) {
      setPasteError('That does not look like a Tickwell share link. Paste the whole link you were sent.');
      return;
    }
    setPasteError(null);
    setPastedToken(found);
  };

  const add = (c: Counter) => {
    const created = store.addCounter(c);
    store.selectCounter(created.id);
    toast(`Added “${created.name}” to your counters.`, 'success');
    navigate('/');
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add a shared counter" subtitle="Someone sent you a Tickwell link or QR code. Check what it contains, then add it to your counters." />

      {result?.ok ? (
        <div className="space-y-6">
          <div className="mx-auto max-w-sm">
            <CounterCard counter={result.counter} view="grid" />
          </div>

          <Card className="space-y-3 p-5" solid>
            <p className="flex items-center gap-2 text-[15px] font-semibold">
              <ShieldCheck size={17} className="text-good" aria-hidden="true" /> What you are adding
            </p>
            <ul className="space-y-1.5 text-[14px] text-muted">
              <li>
                <span className="text-ink">Type:</span> {MODE_INFO[result.counter.mode].name}
              </li>
              {describeConfig(configOf(result.counter)).length > 0 && (
                <li>
                  <span className="text-ink">Settings:</span> {describeConfig(configOf(result.counter)).join(' · ')}
                </li>
              )}
              {result.counter.mode !== 'score' && result.counter.mode !== 'multi' && (
                <li>
                  <span className="text-ink">Starting value:</span> {formatNumber(result.counter.value)}
                </li>
              )}
              {result.counter.description && (
                <li>
                  <span className="text-ink">Note:</span> {result.counter.description}
                </li>
              )}
            </ul>
            <p className="border-t border-line/10 pt-3 text-[13px] text-muted">
              Nothing is added until you press the button. The link never includes anyone's history or other counters, and you get your own separate copy.
              {' '}If you already have a counter with this name, you will simply have two.
            </p>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="lg" icon={<Check size={18} />} onClick={() => add(result.counter)}>
              Add to my counters
            </Button>
            <Button size="lg" onClick={() => navigate('/counters')}>
              Not now
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {result && !result.ok && (
            <Notice tone="error">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={16} aria-hidden="true" /> This link could not be opened
              </p>
              <p className="mt-1 text-muted">{result.error}</p>
              <p className="mt-1 text-muted">Ask for a fresh link, and make sure the whole link was copied.</p>
            </Notice>
          )}
          {!token && (
            <EmptyState icon={<Link2 size={26} />} title="Paste a share link" description="Open a link from a friend and it lands here automatically, or paste it below." compact />
          )}
          <Card className="space-y-4 p-5" solid>
            <Field label="Share link" htmlFor="paste-link" error={pasteError}>
              <TextInput id="paste-link" value={pasted} onChange={setPasted} placeholder="https://…/#/import?d=…" onKeyDown={(e) => e.key === 'Enter' && read()} />
            </Field>
            <Button variant="primary" onClick={read} disabled={!pasted.trim()}>
              Read link
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}

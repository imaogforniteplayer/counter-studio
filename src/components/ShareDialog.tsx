import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, Link2, Share2, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { useAppState, useToast } from '../app/context';
import { DEFAULT_SHARE_OPTIONS, MAX_SHARE_TOKEN, buildShareUrl } from '../core/share';
import type { ShareOptions } from '../core/share';
import type { Counter } from '../core/types';
import { copyText, slug } from '../lib/files';
import { Button, Modal, Notice, Spinner, TextInput, Toggle } from './ui';

type Qr = { state: 'loading' } | { state: 'ready'; url: string } | { state: 'error'; message: string };

function Inner({ counter, onClose }: { counter: Counter; onClose: () => void }) {
  const toast = useToast();
  const [opts, setOpts] = useState<ShareOptions>(DEFAULT_SHARE_OPTIONS);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<Qr>({ state: 'loading' });

  const link = useMemo(() => {
    try {
      return buildShareUrl(counter, opts, `${window.location.origin}${window.location.pathname}`);
    } catch {
      return null;
    }
  }, [counter, opts]);

  const tooLong = link !== null && link.length > MAX_SHARE_TOKEN;
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const valueLabel = counter.mode === 'score' ? 'Current scores' : counter.mode === 'multi' ? 'Current values' : 'Current value';

  useEffect(() => {
    if (!link) {
      setQr({ state: 'error', message: 'This counter could not be turned into a link.' });
      return undefined;
    }
    let cancelled = false;
    setQr({ state: 'loading' });
    QRCode.toDataURL(link, { margin: 1, width: 320, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setQr({ state: 'ready', url });
      })
      .catch(() => {
        if (!cancelled) {
          setQr({
            state: 'error',
            message: 'This link holds too much data to fit in a QR code. Turn off the description or the current value, or use fewer players. The link itself still works.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [link]);

  const copy = async () => {
    if (!link) return;
    const ok = await copyText(link);
    if (ok) {
      setCopied(true);
      toast('Link copied.', 'success');
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      toast('Your browser blocked copying. Select the link and copy it by hand.', 'error');
    }
  };

  const share = async () => {
    if (!link) return;
    try {
      await navigator.share({ title: counter.name, text: `Open “${counter.name}” in Tickwell`, url: link });
    } catch {
      /* the person closed the share sheet */
    }
  };

  const downloadQr = () => {
    if (qr.state !== 'ready') return;
    const a = document.createElement('a');
    a.href = qr.url;
    a.download = `tickwell-${slug(counter.name)}-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Share “${counter.name}”`}
      description="Anyone with the link gets their own copy to count with. Nothing is uploaded anywhere."
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="grid gap-6 md:grid-cols-[1fr_auto]">
        <div className="min-w-0 space-y-5">
          <div>
            <h3 className="eyebrow mb-1">What to include</h3>
            <div className="divide-y divide-line/10">
              <Toggle checked={opts.includeValue} onChange={(v) => setOpts((o) => ({ ...o, includeValue: v }))} label={valueLabel} description="Off: your copy starts from the counter's starting value." />
              <Toggle checked={opts.includeDescription} onChange={(v) => setOpts((o) => ({ ...o, includeDescription: v }))} label="Description" description="Off by default because notes can be personal." />
            </div>
          </div>

          <div className="rounded-xl border border-line/10 bg-raised/40 p-4 text-[13.5px] leading-relaxed">
            <p className="mb-2 flex items-center gap-2 font-semibold">
              <ShieldCheck size={16} className="text-good" aria-hidden="true" /> What the link contains
            </p>
            <p className="text-muted">
              <strong className="font-medium text-ink">Included:</strong> name, type, colour, icon, card style, step, limits, goal
              {counter.mode === 'score' ? ', player names' : ''}
              {counter.mode === 'multi' ? ', counter names' : ''}
              {opts.includeValue ? ', current value' : ''}
              {opts.includeDescription ? ', description' : ''}.
            </p>
            <p className="mt-1.5 text-muted">
              <strong className="font-medium text-ink">Never included:</strong> history, statistics, folders, pins, your other counters or any account details.
            </p>
          </div>

          <div>
            <label htmlFor="share-link" className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium">
              <Link2 size={14} aria-hidden="true" /> Share link
            </label>
            <div className="flex gap-2">
              <TextInput id="share-link" value={link ?? ''} onChange={() => undefined} className="min-w-0 flex-1 text-[13px]" aria-label="Share link" />
              <Button variant="primary" onClick={() => void copy()} icon={copied ? <Check size={16} /> : <Copy size={16} />} disabled={!link}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            {canNativeShare && (
              <Button className="mt-2" size="sm" icon={<Share2 size={15} />} onClick={() => void share()} disabled={!link}>
                Share via…
              </Button>
            )}
          </div>

          {tooLong && (
            <Notice tone="warn">This link is very long, and some apps may cut it off. Try turning off the description or current value.</Notice>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 md:w-[240px]">
          <div className="grid aspect-square w-full max-w-[240px] place-items-center overflow-hidden rounded-2xl bg-white p-2 shadow-soft">
            {qr.state === 'ready' && <img src={qr.url} alt={`QR code that opens a copy of ${counter.name}`} width={320} height={320} className="h-full w-full" />}
            {qr.state === 'loading' && (
              <span className="text-neutral-500">
                <Spinner size={26} />
              </span>
            )}
            {qr.state === 'error' && <p className="p-3 text-center text-[12.5px] leading-snug text-neutral-600">QR code unavailable</p>}
          </div>
          {qr.state === 'error' && (
            <p className="text-center text-[12.5px] leading-snug text-muted" role="status">
              {qr.message}
            </p>
          )}
          <Button size="sm" icon={<Download size={15} />} onClick={downloadQr} disabled={qr.state !== 'ready'}>
            Download QR
          </Button>
          <p className="text-center text-[12px] text-muted">Scan with a phone camera to open it in Tickwell.</p>
        </div>
      </div>
    </Modal>
  );
}

/** Pass a counter id to open the sharing dialog, or null to close it. */
export function ShareDialog({ counterId, onClose }: { counterId: string | null; onClose: () => void }) {
  const { counters } = useAppState();
  const counter = counterId ? counters.find((c) => c.id === counterId && c.deletedAt === null) : undefined;
  if (!counter) return null;
  return <Inner key={counter.id} counter={counter} onClose={onClose} />;
}

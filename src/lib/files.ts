/** Save text as a file. Works without a server, in every modern browser. */
export function downloadText(filename: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  downloadBlob(filename, blob);
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

/** Read a text file chosen by the person, refusing anything unreasonably large. */
export async function readFileText(file: File, maxBytes = MAX_IMPORT_BYTES): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error(`That file is ${(file.size / 1048576).toFixed(1)} MB, which is larger than the ${Math.round(maxBytes / 1048576)} MB limit.`);
  }
  return file.text();
}

/** Copy text to the clipboard. Returns false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** 2026-11-10-1432, for file names. */
export function stamp(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
}

/** A safe file name fragment from free text. */
export function slug(text: string, fallback = 'counter'): string {
  const s = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return s || fallback;
}

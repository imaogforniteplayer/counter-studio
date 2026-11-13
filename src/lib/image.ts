import { MAX_BACKGROUND_IMAGE_CHARS } from '../core/settings';

export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const MAX_SIDE = 1600;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be opened. It may be damaged. Try a different file.'));
    };
    img.src = url;
  });
}

/**
 * Turn a picture the person chose into a compact JPEG data URL that fits in local
 * storage. Nothing is uploaded anywhere: the work happens in this browser.
 */
export async function imageToBackgroundDataUrl(file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('That file type is not supported. Choose a PNG, JPEG or WebP image.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`That image is ${(file.size / 1048576).toFixed(1)} MB. Choose one under ${Math.round(MAX_IMAGE_BYTES / 1048576)} MB.`);
  }
  const img = await loadImage(file);
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  if (!naturalW || !naturalH) throw new Error('That image has no size, so it cannot be used.');

  let scale = Math.min(1, MAX_SIDE / Math.max(naturalW, naturalH));
  for (let attempt = 0; attempt < 4; attempt++) {
    const w = Math.max(1, Math.round(naturalW * scale));
    const h = Math.max(1, Math.round(naturalH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot process images, so the background was not changed.');
    // JPEG has no transparency, so paint a dark base first.
    ctx.fillStyle = '#0b0b0e';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    for (let quality = 0.82; quality >= 0.35; quality -= 0.12) {
      const url = canvas.toDataURL('image/jpeg', quality);
      if (url.startsWith('data:image/') && url.length <= MAX_BACKGROUND_IMAGE_CHARS) return url;
    }
    scale *= 0.75;
  }
  throw new Error('That image is too detailed to store on this device. Try a smaller or simpler picture.');
}

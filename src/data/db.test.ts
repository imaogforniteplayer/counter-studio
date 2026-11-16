import { describe, expect, it } from 'vitest';
import { withTimeout } from './db';


describe('withTimeout', () => {
  it('passes values through', async () => {
    expect(await withTimeout(Promise.resolve(5), 100, 'x')).toBe(5);
  });
  it('rejects when the promise never settles', async () => {
    let message = '';
    try {
      await withTimeout(new Promise<number>(() => {}), 20, 'Opening storage');
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    expect(message).toBe('Opening storage timed out');
  });
});

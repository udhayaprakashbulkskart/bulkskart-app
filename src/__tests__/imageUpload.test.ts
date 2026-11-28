import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('@/db/supabase', () => ({
  supabaseUrl: 'https://example.test',
  supabaseAnonKey: 'anon-test-key',
  supabase: {
    auth: { getSession: vi.fn(() => new Promise(() => {})) },
    storage: {
      from: () => ({
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.test/rfq.jpg' } }),
      }),
    },
  },
}));

import { compressImage, inferImageType, isHeicType, isKnownImageType, putWithWatchdog, uploadImage } from '@/lib/storage';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('phone photo types', () => {
  it('fills in a missing type from the file name, and maps image/jpg', () => {
    expect(inferImageType({ type: '', name: 'IMG_0091.JPG' })).toBe('image/jpeg');
    expect(inferImageType({ type: 'image/jpg', name: 'p.jpg' })).toBe('image/jpeg');
    expect(inferImageType({ type: '', name: 'photo.heic' })).toBe('image/heic');
    expect(isHeicType('image/heic')).toBe(true);
    expect(isKnownImageType('image/heic')).toBe(true);
    expect(isKnownImageType('application/pdf')).toBe(false);
  });
});

describe('the post-requirement uploader no longer hangs at 95%', () => {
  it('the fake interval that capped progress at 95% is gone, and timeouts were added', () => {
    const uploader = src('src/components/common/SingleImageUploader.tsx');
    expect(uploader).not.toContain('prev < 85 ? prev + 15');
    expect(uploader).toContain('onProgress:');
    expect(uploader).toContain('maxOriginalBytes');
    const storage = src('src/lib/storage.ts');
    expect(storage).toContain('Timed out reading this photo');
    expect(storage).toContain('The photo upload stalled');
    expect(storage).toContain("formats = ['image/jpeg', 'image/webp']");
    expect(storage).toContain('maxWidth = 1600');
    expect(storage).toContain('initialQuality = 0.8');
    expect(storage).toContain("'Content-Type': fileToUpload.type");
  });

  it('rejects an empty or unknown type before uploading', async () => {
    const empty = new File([new Uint8Array([1, 2, 3])], 'notes.txt', { type: '' });
    await expect(uploadImage(empty)).rejects.toThrow(/Unsupported image format/i);
  });

  it('times out a toBlob that never calls back, instead of hanging', async () => {
    vi.stubGlobal(
      'Image',
      class {
        width = 2000;
        height = 1500;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_url: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} });
    const toBlob = vi.fn(function (this: HTMLCanvasElement, cb?: (b: Blob | null) => void, _mime?: string, _q?: number) {
      // never call back — the old WebP path hung here on some phones
      void cb;
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(toBlob);

    const file = new File([new Uint8Array(2_000_000)], 'camera.jpg', { type: 'image/jpeg' });
    vi.useFakeTimers();
    const pending = expect(compressImage(file)).rejects.toThrow(/Could not compress this photo/i);
    await vi.runAllTimersAsync();
    await pending;
    vi.useRealTimers();
    expect(toBlob).toHaveBeenCalled();
  });
});

class FakeXhr {
  static last: FakeXhr;
  static mode: 'ok' | 'silent' | 'fail403' = 'ok';
  static sends = 0;
  status = 0;
  responseText = '';
  upload: { onprogress: ((e: unknown) => void) | null; onload: (() => void) | null } = { onprogress: null, onload: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  headers: Record<string, string> = {};
  url = '';
  constructor() {
    FakeXhr.last = this;
  }
  open(_m: string, url: string) {
    this.url = url;
  }
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }
  abort() {
    this.onabort?.();
  }
  send() {
    FakeXhr.sends += 1;
    if (FakeXhr.mode === 'silent') return;
    queueMicrotask(() => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 });
      this.upload.onprogress?.({ lengthComputable: true, loaded: 10, total: 10 });
      this.upload.onload?.();
      if (FakeXhr.mode === 'fail403') {
        this.status = 403;
        this.responseText = JSON.stringify({ message: 'new row violates row-level security policy' });
      } else {
        this.status = 200;
      }
      this.onload?.();
    });
  }
}

describe('uploads can no longer hang silently', () => {
  const smallJpeg = () => new File([new Uint8Array(1000)], 'IMG_1.jpg', { type: 'image/jpeg' });

  it('uploads through the watchdog, sends the public key when there is no session, and reports real progress', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    FakeXhr.mode = 'ok';
    FakeXhr.sends = 0;
    vi.useFakeTimers();
    const seen: number[] = [];
    const pending = uploadImage(smallJpeg(), { bucket: 'rfq-images', folder: 'rfqs/guest', onProgress: (p) => seen.push(p) });
    await vi.runAllTimersAsync();
    const result = await pending;
    vi.useRealTimers();
    expect(result.url).toBe('https://example.test/rfq.jpg');
    expect(FakeXhr.last.url).toMatch(/^https:\/\/example\.test\/storage\/v1\/object\/rfq-images\/rfqs\/guest\/IMG_1_/);
    expect(FakeXhr.last.headers.Authorization).toBe('Bearer anon-test-key');
    expect(FakeXhr.last.headers['Content-Type']).toBe('image/jpeg');
    expect(seen).toContain(70);
    expect(seen[seen.length - 1]).toBe(100);
  });

  it('retries once after a stalled upload, then fails with a clear message instead of spinning forever', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    FakeXhr.mode = 'silent';
    FakeXhr.sends = 0;
    vi.useFakeTimers();
    const pending = expect(uploadImage(smallJpeg(), { bucket: 'rfq-images' })).rejects.toThrow(/stalled/i);
    await vi.runAllTimersAsync();
    await pending;
    vi.useRealTimers();
    expect(FakeXhr.sends).toBe(2);
  });

  it('does not retry a server refusal and shows the server message', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    FakeXhr.mode = 'fail403';
    FakeXhr.sends = 0;
    vi.useFakeTimers();
    const pending = expect(uploadImage(smallJpeg(), { bucket: 'rfq-images' })).rejects.toThrow(/row-level security/);
    await vi.runAllTimersAsync();
    await pending;
    vi.useRealTimers();
    expect(FakeXhr.sends).toBe(1);
  });

  it('putWithWatchdog aborts when no response arrives after the bytes are sent', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    FakeXhr.mode = 'silent';
    vi.useFakeTimers();
    const pending = expect(putWithWatchdog({ url: 'https://example.test/x', body: new Blob(['a']), headers: {} })).rejects.toThrow(/stalled/i);
    await vi.runAllTimersAsync();
    await pending;
    vi.useRealTimers();
  });

  it('uploads the original photo when compression fails', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    FakeXhr.mode = 'ok';
    // a decoder that never answers: compressImage waits on it until the compression timeout
    vi.stubGlobal(
      'Image',
      class {
        width = 0;
        height = 0;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_url: string) {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} });
    const big = new File([new Uint8Array(900_000)], 'camera.jpg', { type: 'image/jpeg' });
    vi.useFakeTimers();
    const pending = uploadImage(big, { bucket: 'rfq-images' });
    await vi.runAllTimersAsync();
    const result = await pending;
    vi.useRealTimers();
    expect(result.compressed).toBe(false);
    expect(result.newSize).toBe(900_000);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

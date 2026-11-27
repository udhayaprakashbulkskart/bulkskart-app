import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('@/db/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: vi.fn(async () => ({ data: { path: 'p.jpg' }, error: null })),
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.test/rfq.jpg' } }),
      }),
    },
  },
}));

import { compressImage, inferImageType, isHeicType, isKnownImageType, uploadImage } from '@/lib/storage';

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
    expect(storage).toContain('The photo upload timed out');
    expect(storage).toContain("formats = ['image/jpeg', 'image/webp']");
    expect(storage).toContain('maxWidth = 1600');
    expect(storage).toContain('initialQuality = 0.8');
    expect(storage).toContain('contentType: fileToUpload.type');
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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

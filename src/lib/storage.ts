import { supabase, supabaseAnonKey, supabaseUrl } from '@/db/supabase';

export interface CompressionResult {
  file: File;
  compressed: boolean;
  originalSize: number;
  newSize: number;
}

const HEIC_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);
const SKIP_COMPRESS = new Set(['image/svg+xml', 'image/gif']);
const KNOWN_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
  ...HEIC_TYPES,
]);

/** Map a missing or odd phone-camera type (empty, image/jpg, .heic) to a real MIME type. */
export function inferImageType(file: Pick<File, 'type' | 'name'>): string {
  const type = (file.type || '').toLowerCase().trim();
  if (type === 'image/jpg') return 'image/jpeg';
  if (type.startsWith('image/')) return type;
  const name = (file.name || '').toLowerCase();
  if (/\.jpe?g$/.test(name)) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.avif')) return 'image/avif';
  if (name.endsWith('.svg')) return 'image/svg+xml';
  if (/\.hei[cf]$/.test(name)) return 'image/heic';
  return type;
}

export function isHeicType(type: string): boolean {
  return HEIC_TYPES.has(type);
}

export function isKnownImageType(type: string): boolean {
  return KNOWN_IMAGE_TYPES.has(type);
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number, timeoutMs = 8000): Promise<Blob | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    try {
      canvas.toBlob(
        (blob) => {
          clearTimeout(timer);
          resolve(blob);
        },
        mimeType,
        quality,
      );
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

function loadImage(file: File, timeoutMs = 12000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out reading this photo. Try a smaller JPEG or PNG.'));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      URL.revokeObjectURL(objectUrl);
    };
    img.onload = () => {
      cleanup();
      resolve(img);
    };
    img.onerror = () => {
      cleanup();
      reject(new Error(
        isHeicType(inferImageType(file))
          ? 'This phone photo (HEIC) could not be read. Please choose a JPEG or PNG, or on iPhone set Camera to Most Compatible.'
          : 'This file could not be read as a photo. Please choose a JPEG or PNG.',
      ));
    };
    img.src = objectUrl;
  });
}

function safeFileName(name: string, ext: string): string {
  const base = name
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .slice(0, 30) || 'photo';
  return `${base}.${ext}`;
}

/**
 * Compress a photo on the device: max 1600px on the long edge, JPEG quality ~0.8.
 * Times out instead of hanging (canvas.toBlob to WebP never returns on some phones).
 */
export async function compressImage(
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    initialQuality?: number;
    maxSizeBytes?: number;
  } = {},
): Promise<CompressionResult> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    initialQuality = 0.8,
    maxSizeBytes = 1024 * 1024,
  } = options;

  const type = inferImageType(file);
  if (!type.startsWith('image/') || SKIP_COMPRESS.has(type)) {
    return { file, compressed: false, originalSize: file.size, newSize: file.size };
  }

  if (file.size <= 400 * 1024 && (type === 'image/jpeg' || type === 'image/webp') && !isHeicType(type)) {
    return { file, compressed: false, originalSize: file.size, newSize: file.size };
  }

  const img = await loadImage(file);
  let width = img.width || 0;
  let height = img.height || 0;
  if (width < 1 || height < 1) {
    throw new Error('This photo could not be read. Please choose another JPEG or PNG.');
  }
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { file, compressed: false, originalSize: file.size, newSize: file.size };
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  // JPEG first — WebP export never calls back on some mobile browsers, which left the RFQ form stuck at 95%.
  const formats = ['image/jpeg', 'image/webp'] as const;
  let blob: Blob | null = null;
  let mime: (typeof formats)[number] = 'image/jpeg';
  for (const format of formats) {
    let quality = initialQuality;
    let candidate = await canvasToBlob(canvas, format, quality);
    let attempts = 0;
    while (candidate && candidate.size > maxSizeBytes && quality > 0.45 && attempts < 4) {
      quality -= 0.15;
      attempts += 1;
      candidate = await canvasToBlob(canvas, format, quality);
    }
    if (candidate) {
      blob = candidate;
      mime = format;
      break;
    }
  }

  if (!blob) {
    throw new Error('Could not compress this photo on this device. Please try a smaller JPEG or PNG.');
  }

  if (blob.size < file.size || width < (img.width || 0) || height < (img.height || 0) || isHeicType(type)) {
    const ext = mime === 'image/webp' ? 'webp' : 'jpg';
    const newFile = new File([blob], safeFileName(file.name, ext), { type: mime });
    return { file: newFile, compressed: true, originalSize: file.size, newSize: newFile.size };
  }

  return { file, compressed: false, originalSize: file.size, newSize: file.size };
}

/**
 * Format bytes to readable string (e.g., "450 KB", "1.2 MB")
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export type StorageBucket = 'product-images' | 'company-assets' | 'rfq-images' | 'avatars' | 'verification-docs' | 'attachments';

export interface UploadOptions {
  bucket?: StorageBucket;
  folder?: string;
  autoCompress?: boolean;
  maxSizeBytes?: number;
  /** Original files up to this size are accepted and compressed first (phone camera photos are often 5–12 MB). */
  maxOriginalBytes?: number;
  onProgress?: (percentage: number) => void;
}

export interface UploadResult {
  url: string;
  path: string;
  compressed: boolean;
  originalSize: number;
  newSize: number;
}

const DEFAULT_MAX_ORIGINAL = 15 * 1024 * 1024;
const DEFAULT_MAX_UPLOAD = 5 * 1024 * 1024;
/** Reading the picked file into memory. A cloud-only or revoked gallery file can stall here forever on Android. */
const READ_TIMEOUT_MS = 20_000;
/** Whole compression step (decode + canvas + JPEG/WebP export). On timeout the original photo is uploaded. */
const COMPRESS_TIMEOUT_MS = 20_000;
/** Looking up the signed-in token; on timeout the upload goes out with the public key instead of waiting. */
const TOKEN_TIMEOUT_MS = 3_000;
/** No upload byte moved for this long: give up on this attempt (and retry once). */
export const UPLOAD_STALL_MS = 25_000;
/** All bytes sent but no answer from the server for this long. */
export const UPLOAD_RESPONSE_MS = 30_000;

/** Copy the picked file into memory so a stalled or revoked content:// handle cannot freeze the upload later. */
async function readIntoMemory(file: File, type: string): Promise<File> {
  const buffer = await withTimeout(
    typeof file.arrayBuffer === 'function'
      ? file.arrayBuffer()
      : new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error ?? new Error('read failed'));
          reader.readAsArrayBuffer(file);
        }),
    READ_TIMEOUT_MS,
    'Could not read this photo from your phone (it may still be downloading from Google Photos). Please pick it again, or choose a photo saved on the device.',
  );
  return new File([buffer], file.name || safeFileName('photo', type.split('/')[1] || 'jpg'), { type });
}

async function accessToken(): Promise<string> {
  try {
    const { data } = await withTimeout(supabase.auth.getSession(), TOKEN_TIMEOUT_MS, 'session timeout');
    return data.session?.access_token || supabaseAnonKey;
  } catch {
    return supabaseAnonKey;
  }
}

interface PutOptions {
  url: string;
  body: Blob;
  headers: Record<string, string>;
  onUploadProgress?: (fraction: number) => void;
  stallMs?: number;
  responseMs?: number;
}

/**
 * POST a file with XMLHttpRequest so we see real upload progress and can abort a stalled request.
 * Always settles: resolves on 2xx, rejects with a readable message otherwise.
 */
export function putWithWatchdog({ url, body, headers, onUploadProgress, stallMs = UPLOAD_STALL_MS, responseMs = UPLOAD_RESPONSE_MS }: PutOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let done = false;
    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (err) reject(err);
      else resolve();
    };
    const arm = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        // settle first: abort() fires onabort synchronously, which would otherwise win with the wrong message
        finish(new Error('The photo upload stalled. Please check your connection and try again.'));
        try {
          xhr.abort();
        } catch {
          // ignore
        }
      }, ms);
    };
    xhr.open('POST', url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      arm(stallMs);
      if (e.lengthComputable && e.total > 0) onUploadProgress?.(e.loaded / e.total);
    };
    xhr.upload.onload = () => {
      onUploadProgress?.(1);
      arm(responseMs);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return finish();
      let message = '';
      try {
        const parsed = JSON.parse(xhr.responseText || '{}');
        message = parsed.message || parsed.error || '';
      } catch {
        // not JSON
      }
      finish(new Error(message || `Failed to upload image to storage (${xhr.status}).`));
    };
    xhr.onerror = () => finish(new Error('Network error while uploading the photo. Please check your connection and try again.'));
    xhr.onabort = () => finish(new Error('The photo upload was cancelled.'));
    arm(stallMs);
    try {
      xhr.send(body);
    } catch (e) {
      finish(e instanceof Error ? e : new Error('Could not start the photo upload.'));
    }
  });
}

/**
 * Upload an image to Supabase Storage with automatic compression and public URL generation.
 * Never hangs: every step has a timeout, compression failure falls back to the original photo,
 * and a stalled upload is retried once before a clear error is shown.
 */
export async function uploadImage(
  file: File,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const {
    bucket = 'product-images',
    folder = '',
    autoCompress = true,
    maxSizeBytes = DEFAULT_MAX_UPLOAD,
    maxOriginalBytes = DEFAULT_MAX_ORIGINAL,
    onProgress,
  } = options;

  const type = inferImageType(file);
  if (!isKnownImageType(type)) {
    throw new Error('Unsupported image format. Please upload a JPEG, PNG, WEBP or GIF.');
  }

  if (file.size > maxOriginalBytes) {
    throw new Error(`File is too large (${formatBytes(file.size)}). Max allowed is ${formatBytes(maxOriginalBytes)} before compression.`);
  }

  onProgress?.(15);

  const original = await readIntoMemory(file, type);
  let fileToUpload = original;
  let wasCompressed = false;
  const originalSize = file.size;
  let newSize = file.size;

  if (autoCompress && !SKIP_COMPRESS.has(type)) {
    try {
      const comp = await withTimeout(
        compressImage(original),
        COMPRESS_TIMEOUT_MS,
        'Timed out compressing this photo.',
      );
      fileToUpload = comp.file;
      wasCompressed = comp.compressed;
      newSize = comp.newSize;
    } catch (err) {
      // A browser that cannot decode HEIC cannot show it either, so there is nothing useful to upload.
      if (isHeicType(type)) throw err;
      console.warn('Photo compression failed; uploading the original instead.', err);
      fileToUpload = original;
      wasCompressed = false;
      newSize = original.size;
    }
  }

  onProgress?.(50);

  const limit = wasCompressed ? maxSizeBytes : Math.max(maxSizeBytes, maxOriginalBytes);
  if (fileToUpload.size > limit) {
    throw new Error(`File is still too large after compression (${formatBytes(fileToUpload.size)}). Please try a smaller photo.`);
  }

  const ext = fileToUpload.name.split('.').pop()?.toLowerCase() || (fileToUpload.type === 'image/webp' ? 'webp' : 'jpg');
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const baseName = safeFileName(fileToUpload.name, ext).replace(/\.[^/.]+$/, '');
  const filePath = folder
    ? `${folder.replace(/^\/+|\/+$/g, '')}/${baseName}_${timestamp}_${randomStr}.${ext}`
    : `${baseName}_${timestamp}_${randomStr}.${ext}`;

  const token = await accessToken();
  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${filePath.split('/').map(encodeURIComponent).join('/')}`;
  const headers = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${token}`,
    'Content-Type': fileToUpload.type || 'image/jpeg',
    'Cache-Control': 'max-age=31536000',
    'x-upsert': 'true',
  };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await putWithWatchdog({
        url,
        body: fileToUpload,
        headers,
        onUploadProgress: (fraction) => onProgress?.(50 + Math.round(fraction * 40)),
      });
      lastError = null;
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Failed to upload image to storage.');
      // only a stall or dropped connection is worth retrying; a server answer (RLS, size) will not change
      if (!/stalled|Network error/i.test(lastError.message)) break;
      onProgress?.(50);
    }
  }
  if (lastError) throw lastError;

  onProgress?.(90);

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
  if (!publicData?.publicUrl) {
    throw new Error('The photo was uploaded but its link could not be created. Please try again.');
  }

  onProgress?.(100);

  return {
    url: publicData.publicUrl,
    path: filePath,
    compressed: wasCompressed,
    originalSize,
    newSize,
  };
}

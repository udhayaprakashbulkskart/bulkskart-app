import { supabase } from '@/db/supabase';

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

const UPLOAD_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_ORIGINAL = 15 * 1024 * 1024;
const DEFAULT_MAX_UPLOAD = 5 * 1024 * 1024;

/**
 * Upload an image to Supabase Storage with automatic compression and public URL generation
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

  let fileToUpload = file;
  if (fileToUpload.type !== type) {
    fileToUpload = new File([file], file.name || safeFileName('photo', type.split('/')[1] || 'jpg'), { type });
  }
  let wasCompressed = false;
  const originalSize = file.size;
  let newSize = file.size;

  if (autoCompress && !SKIP_COMPRESS.has(type)) {
    const comp = await compressImage(fileToUpload);
    fileToUpload = comp.file;
    wasCompressed = comp.compressed;
    newSize = comp.newSize;
  }

  onProgress?.(50);

  if (fileToUpload.size > maxSizeBytes) {
    throw new Error(`File is still too large after compression (${formatBytes(fileToUpload.size)}). Please try a smaller photo.`);
  }

  const ext = fileToUpload.name.split('.').pop()?.toLowerCase() || (fileToUpload.type === 'image/webp' ? 'webp' : 'jpg');
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const filePath = folder
    ? `${folder.replace(/^\/+|\/+$/g, '')}/${safeFileName(fileToUpload.name, ext).replace(/\.[^/.]+$/, '')}_${timestamp}_${randomStr}.${ext}`
    : `${safeFileName(fileToUpload.name, ext).replace(/\.[^/.]+$/, '')}_${timestamp}_${randomStr}.${ext}`;

  const { error: uploadError } = await withTimeout(
    supabase.storage.from(bucket).upload(filePath, fileToUpload, {
      cacheControl: '31536000',
      upsert: true,
      contentType: fileToUpload.type || 'image/jpeg',
    }),
    UPLOAD_TIMEOUT_MS,
    'The photo upload timed out. Please check your connection and try a smaller JPEG.',
  );

  if (uploadError) {
    throw new Error(uploadError.message || 'Failed to upload image to storage.');
  }

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

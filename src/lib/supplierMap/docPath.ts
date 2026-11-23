/** Buckets that hold business documents. Both are private (migration 00071); files open only through signed links. */
export const PRIVATE_DOC_BUCKETS = ['verification-docs', 'business-docs'] as const;
export type PrivateDocBucket = (typeof PRIVATE_DOC_BUCKETS)[number];

const STORAGE_LINK = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/(verification-docs|business-docs)\/([^?#]+)/;

/**
 * Bucket and object path from a document link saved by the older pages (they stored "public" links, which stop
 * working once the bucket is private). Null for anything that is not in one of the document buckets.
 */
export function privateDocRef(url: string | null | undefined): { bucket: PrivateDocBucket; path: string } | null {
  if (!url) return null;
  const m = url.match(STORAGE_LINK);
  return m ? { bucket: m[1] as PrivateDocBucket, path: decodeURIComponent(m[2]) } : null;
}

/**
 * The object path inside verification-docs, from a saved link or a bare path ("<user id>/..."). Null for anything
 * that is not in the verification-docs bucket.
 */
export function docPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const ref = privateDocRef(url);
  if (ref) return ref.bucket === 'verification-docs' ? ref.path : null;
  return /^[0-9a-f-]{36}\//i.test(url) ? url : null;
}

/**
 * On-demand loaders for the large static catalogue datasets.
 * These files are several megabytes of source; importing them statically made every page download them.
 * Each loader imports its module once, on first use, and reuses the same promise afterwards.
 */

let alibabaModule: Promise<typeof import('@/data/alibabaVerifiedSuppliers')> | null = null;
let globalModule: Promise<typeof import('@/data/expandedGlobalProducts')> | null = null;
let curatedModule: Promise<typeof import('@/data/curatedIndustrialProducts')> | null = null;

export function loadAlibabaCatalog() {
  alibabaModule ??= import('@/data/alibabaVerifiedSuppliers');
  return alibabaModule;
}

export function loadGlobalCatalog() {
  globalModule ??= import('@/data/expandedGlobalProducts');
  return globalModule;
}

export function loadCuratedCatalog() {
  curatedModule ??= import('@/data/curatedIndustrialProducts');
  return curatedModule;
}

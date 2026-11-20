import { useEffect, useState } from 'react';
import { Factory, FileText, Package, type LucideIcon } from 'lucide-react';
import { fetchPublicCounts, formatExactCount, type PublicCounts } from '@/lib/publicCounts';

function usePublicCounts(): PublicCounts | null {
  const [counts, setCounts] = useState<PublicCounts | null>(null);
  useEffect(() => {
    let live = true;
    fetchPublicCounts().then((data) => {
      if (live) setCounts(data);
    });
    return () => {
      live = false;
    };
  }, []);
  return counts;
}

const TILES: Array<{ key: keyof PublicCounts; label: string; icon: LucideIcon }> = [
  { key: 'products', label: 'Active products', icon: Package },
  { key: 'verifiedSuppliers', label: 'Verified suppliers', icon: Factory },
  { key: 'openRequirements', label: 'Open requirements', icon: FileText },
];

/**
 * Real catalogue totals. Tiles appear only after a successful count, so a failed
 * query never falls back to a marketing number.
 */
export default function LiveCountStrip({ tone = 'dark', className = '' }: { tone?: 'dark' | 'light'; className?: string }) {
  const counts = usePublicCounts();
  const items = TILES.flatMap((tile) => {
    const value = counts?.[tile.key];
    return typeof value === 'number' ? [{ ...tile, value }] : [];
  });
  if (items.length === 0) return null;

  const dark = tone === 'dark';
  return (
    <ul
      className={`grid grid-cols-1 gap-2 sm:grid-cols-3 ${className}`}
      aria-label="Catalogue totals"
    >
      {items.map(({ key, label, value, icon: Icon }) => (
        <li
          key={key}
          className={`flex min-h-11 items-center gap-3 rounded-2xl border px-4 py-3 ${
            dark
              ? 'border-white/10 bg-white/[0.04] text-white'
              : 'border-border bg-card text-foreground'
          }`}
        >
          <Icon className="h-5 w-5 shrink-0 text-[#FF5A00]" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-xl font-black leading-none tabular-nums">{formatExactCount(value)}</span>
            <span className={`mt-1 block text-sm ${dark ? 'text-white/70' : 'text-muted-foreground'}`}>{label}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

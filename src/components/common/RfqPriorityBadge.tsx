import { Flame, Siren, Zap } from 'lucide-react';
import type { RfqPriorityTag } from '@/lib/rfqPriority';
import { RFQ_PRIORITY_CLASS, RFQ_PRIORITY_LABEL, normalizePriorityTag } from '@/lib/rfqPriority';

const ICONS: Record<RfqPriorityTag, typeof Flame> = {
  emergency: Siren,
  urgent: Zap,
  hot: Flame,
};

export default function RfqPriorityBadge({
  tag,
  className = '',
}: {
  tag: string | null | undefined;
  className?: string;
}) {
  const value = normalizePriorityTag(tag);
  if (!value) return null;
  const Icon = ICONS[value];
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${RFQ_PRIORITY_CLASS[value]} ${className}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {RFQ_PRIORITY_LABEL[value]}
    </span>
  );
}

export function RfqPriorityPicker({
  value,
  onChange,
  disabled = false,
  id,
}: {
  value: RfqPriorityTag | null;
  onChange: (tag: RfqPriorityTag | null) => void;
  disabled?: boolean;
  id?: string;
}) {
  const selected = normalizePriorityTag(value);
  return (
    <div>
      <p id={id} className="mb-1.5 text-xs font-bold text-foreground">
        Priority tag <span className="font-medium text-muted-foreground">(optional)</span>
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={id}>
        {(['emergency', 'urgent', 'hot'] as const).map((tag) => {
          const active = selected === tag;
          return (
            <button
              key={tag}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onChange(active ? null : tag)}
              className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[12px] font-bold transition-colors disabled:opacity-60 ${
                active ? RFQ_PRIORITY_CLASS[tag] : 'border-border bg-background text-foreground hover:border-[#FF5A00]/60'
              }`}
            >
              {tag === 'emergency' && <Siren className="h-3.5 w-3.5" aria-hidden="true" />}
              {tag === 'urgent' && <Zap className="h-3.5 w-3.5" aria-hidden="true" />}
              {tag === 'hot' && <Flame className="h-3.5 w-3.5" aria-hidden="true" />}
              {RFQ_PRIORITY_LABEL[tag]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

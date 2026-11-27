import { Circle, Flame, Siren, Zap } from 'lucide-react';
import type { RfqPriorityChoice, RfqPriorityTag } from '@/lib/rfqPriority';
import { RFQ_PRIORITY_CHOICES, RFQ_PRIORITY_CLASS, RFQ_PRIORITY_LABEL, normalizePriorityChoice, normalizePriorityTag } from '@/lib/rfqPriority';

const ICONS: Record<RfqPriorityChoice, typeof Flame> = {
  emergency: Siren,
  urgent: Zap,
  hot: Flame,
  regular: Circle,
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
      className={`inline-flex max-w-full items-center gap-0.5 rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide sm:text-[10px] ${RFQ_PRIORITY_CLASS[value]} ${className}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{RFQ_PRIORITY_LABEL[value]}</span>
    </span>
  );
}

export function RfqPriorityPicker({
  value,
  onChange,
  disabled = false,
  id,
  required = false,
  error,
}: {
  value: RfqPriorityChoice | null;
  onChange: (tag: RfqPriorityChoice) => void;
  disabled?: boolean;
  id?: string;
  required?: boolean;
  error?: string;
}) {
  const selected = normalizePriorityChoice(value);
  return (
    <div>
      <p id={id} className="mb-1.5 text-xs font-bold text-foreground">
        Priority tag
        {required ? (
          <span className="fk-req text-[#FF5A00]" aria-hidden="true"> *</span>
        ) : (
          <span className="font-medium text-muted-foreground"> (optional)</span>
        )}
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={id} aria-required={required || undefined}>
        {RFQ_PRIORITY_CHOICES.map((tag) => {
          const active = selected === tag;
          const Icon = ICONS[tag];
          return (
            <button
              key={tag}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onChange(tag)}
              className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[12px] font-bold transition-colors disabled:opacity-60 ${
                active ? RFQ_PRIORITY_CLASS[tag] : 'border-border bg-background text-foreground hover:border-[#FF5A00]/60'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {RFQ_PRIORITY_LABEL[tag]}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-1.5 text-[11px] text-destructive" role="alert">{error}</p>
      ) : required ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground">Choose one: this is required when you post.</p>
      ) : null}
    </div>
  );
}

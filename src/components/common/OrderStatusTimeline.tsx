import React, { useState } from 'react';
import { CheckCircle2, Circle, XCircle, ChevronDown, ChevronUp, User } from 'lucide-react';
import type { OrderStatusHistory, PipelineStatus } from '@/types/types';

export const PIPELINE_STAGES: { key: PipelineStatus; label: string; desc: string }[] = [
  { key: 'pending',    label: 'Pending',    desc: 'Order placed, awaiting supplier confirmation' },
  { key: 'confirmed',  label: 'Confirmed',  desc: 'Supplier confirmed and accepted the order' },
  { key: 'processing', label: 'Processing', desc: 'Production / preparation in progress' },
  { key: 'shipped',    label: 'Shipped',    desc: 'Products dispatched to buyer' },
  { key: 'delivered',  label: 'Delivered',  desc: 'Buyer confirmed receipt of products' },
];

function statusIndex(s: PipelineStatus | string): number {
  return PIPELINE_STAGES.findIndex(st => st.key === s);
}

interface Props {
  currentStatus: PipelineStatus;
  history: OrderStatusHistory[];
  /** compact = list page condensed view, full = detail page */
  variant?: 'full' | 'compact';
}

export default function OrderStatusTimeline({ currentStatus, history, variant = 'full' }: Props) {
  const [expandedStage, setExpandedStage] = useState<PipelineStatus | null>(null);
  const isCancelled = currentStatus === 'cancelled';
  const curIdx = statusIndex(currentStatus);

  // Map stage key → most recent history entry reaching that stage
  const historyByStage: Partial<Record<PipelineStatus, OrderStatusHistory>> = {};
  for (const h of history) {
    if (h.to_status && h.to_status !== 'cancelled') {
      historyByStage[h.to_status] = h;
    }
  }
  const cancelEntry = history.find(h => h.to_status === 'cancelled');

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-0 overflow-x-auto pb-1">
        {PIPELINE_STAGES.map((stage, idx) => {
          const done = !isCancelled && idx <= curIdx;
          const active = !isCancelled && idx === curIdx;
          return (
            <React.Fragment key={stage.key}>
              <div className="flex flex-col items-center shrink-0">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center
                  ${done && !active ? 'bg-[#C94400] border-[#FF5A00]/40' :
                    active ? 'bg-[#C94400] border-primary ring-2 ring-primary/20' :
                    'bg-muted border-border'}`}>
                  {done && !active
                    ? <CheckCircle2 className="w-3 h-3 text-white" />
                    : <Circle className={`w-2.5 h-2.5 ${active ? 'text-primary-foreground' : 'text-muted-foreground'}`} />}
                </div>
                <span className={`text-[9px] mt-0.5 whitespace-nowrap font-medium
                  ${active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {stage.label}
                </span>
              </div>
              {idx < PIPELINE_STAGES.length - 1 && (
                <div className={`h-0.5 w-6 md:w-10 shrink-0 mt-[-12px] ${idx < curIdx && !isCancelled ? 'bg-[#C94400]' : 'bg-border'}`} />
              )}
            </React.Fragment>
          );
        })}
        {isCancelled && (
          <div className="ml-2 flex items-center gap-1 shrink-0">
            <XCircle className="w-4 h-4 text-destructive" />
            <span className="text-xs text-destructive font-medium">Cancelled</span>
          </div>
        )}
      </div>
    );
  }

  // Full variant — vertical timeline
  return (
    <div className="space-y-0">
      {PIPELINE_STAGES.map((stage, idx) => {
        const done = !isCancelled && idx < curIdx;
        const active = !isCancelled && idx === curIdx;
        const pending = isCancelled || idx > curIdx;
        const entry = historyByStage[stage.key];
        const isLast = idx === PIPELINE_STAGES.length - 1;
        const isExpanded = expandedStage === stage.key;

        return (
          <div key={stage.key} className="flex gap-3 md:gap-4">
            {/* Connector column */}
            <div className="flex flex-col items-center shrink-0">
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all
                ${done ? 'bg-[#C94400] border-[#FF5A00]/40' :
                  active ? 'bg-[#C94400] border-primary ring-4 ring-primary/15' :
                  'bg-muted border-border'}`}>
                {done
                  ? <CheckCircle2 className="w-4 h-4 text-white" />
                  : active
                    ? <div className="w-2.5 h-2.5 rounded-full bg-primary-foreground" />
                    : <Circle className="w-3 h-3 text-muted-foreground" />}
              </div>
              {!isLast && (
                <div className={`w-0.5 flex-1 min-h-[28px] transition-all ${done ? 'bg-[#C94400]' : 'bg-border'}`} />
              )}
            </div>

            {/* Content */}
            <div className={`pb-5 flex-1 min-w-0 ${isLast ? '' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={`text-sm font-semibold leading-tight
                    ${active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {stage.label}
                    {active && (
                      <span className="ml-2 text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                        Current
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stage.desc}</p>
                </div>
              </div>

              {/* Entry details */}
              {entry && (
                <div className="mt-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                    <User className="w-3 h-3 shrink-0" />
                    <span className="font-medium text-foreground">
                      {entry.changer?.full_name ?? 'User'}
                    </span>
                    <span className="capitalize text-muted-foreground/70">({entry.changer_role})</span>
                    <span>·</span>
                    <span>{new Date(entry.created_at).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}</span>
                    {entry.notes && (
                      <button
                        onClick={() => setExpandedStage(isExpanded ? null : stage.key)}
                        className="flex items-center gap-0.5 text-primary hover:underline"
                      >
                        Note {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                  {isExpanded && entry.notes && (
                    <div className="mt-1.5 bg-muted/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground">
                      {entry.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Cancelled node */}
      {isCancelled && (
        <div className="flex gap-3 md:gap-4 mt-1">
          <div className="flex flex-col items-center shrink-0">
            <div className="w-8 h-8 rounded-full border-2 bg-destructive/10 border-destructive flex items-center justify-center">
              <XCircle className="w-4 h-4 text-destructive" />
            </div>
          </div>
          <div className="pb-2 flex-1 min-w-0">
            <p className="text-sm font-semibold text-destructive">Cancelled</p>
            {cancelEntry && (
              <div className="mt-1 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                  <User className="w-3 h-3 shrink-0" />
                  <span className="font-medium text-foreground">{cancelEntry.changer?.full_name ?? 'User'}</span>
                  <span className="capitalize text-muted-foreground/70">({cancelEntry.changer_role})</span>
                  <span>·</span>
                  <span>{new Date(cancelEntry.created_at).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}</span>
                </div>
                {cancelEntry.notes && (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2 text-xs text-destructive">
                    Reason: {cancelEntry.notes}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Small pieces shared by the applicant's loan page and the admin review page. */
import { Check, Eye, FileText, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type Checks, DOC_LABEL, type KycDocument, type KycStatus, type LoanApplication, STAGES, STATUS_LABEL, day,
} from '@/lib/loanKyc/api';

const STATUS_STYLE: Record<KycStatus, string> = {
  not_started: 'border-border bg-muted text-muted-foreground',
  pending: 'border-border bg-background text-foreground',
  in_progress: 'border-[#FF5A00]/50 bg-[#FF5A00]/10 text-[#C24400] dark:text-[#FF8A3D]',
  verified: 'border-[#FF5A00] bg-[#FF5A00] text-white',
  rejected: 'border-red-600 bg-red-600 text-white',
  resubmission_required: 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400',
};

export function StatusBadge({ status, className }: { status: KycStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold', STATUS_STYLE[status], className)}>
      {status === 'verified' && <Check className="h-3 w-3" aria-hidden="true" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PendingBadge({ label = 'Integration Pending' }: { label?: string }) {
  return <span className="inline-flex items-center whitespace-nowrap rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{label}</span>;
}

/** Loan Request → KYC → Verification → Lending partner review → Loan decision. */
export function StageTracker({ app }: { app: LoanApplication }) {
  const order = ['request', ...STAGES.map((s) => s.key)];
  const current = app.stage === 'withdrawn' ? -1 : order.indexOf(app.stage);
  const items = [{ key: 'request', label: 'Loan request' }, ...STAGES];
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Application progress">
      {items.map((s, i) => {
        const done = current > i || (app.stage === 'decision' && i === 4);
        const now = current === i && app.stage !== 'decision';
        return (
          <li key={s.key} className="min-w-0" aria-current={now ? 'step' : undefined}>
            <span className={cn('block h-1.5 rounded-full', done ? 'bg-[#FF5A00]' : now ? 'bg-[#FF5A00]/50' : 'bg-muted')} />
            <span className={cn('mt-1 block text-[10.5px] leading-tight sm:text-[11.5px]', now ? 'font-black text-foreground' : done ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function IntegrationNotice({ checks }: { checks: Checks }) {
  const pending = (Object.entries(checks) as [keyof Checks, string][]).filter(([, v]) => v === 'integration_pending').map(([k]) => k);
  const sandbox = Object.values(checks).includes('sandbox');
  if (!pending.length && !sandbox) return null;
  const names: Record<keyof Checks, string> = { documents: 'secure document storage', pan: 'PAN check', aadhaar: 'instant Aadhaar check (DigiLocker)', gstin: 'GSTIN check', bank: 'bank account check' };
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-3 text-[12.5px] leading-relaxed">
      {pending.length > 0 && (
        <p><b>Integration Pending:</b> {pending.map((k) => names[k]).join(', ')}. {pending.includes('documents')
          ? 'Nothing can be uploaded until this is connected.'
          : 'Our team verifies those details from the documents you upload and calls you back.'}</p>
      )}
      {sandbox && <p className="mt-1"><b>Test mode:</b> the verification service is in sandbox mode. Test results are never treated as verified.</p>}
    </div>
  );
}

const DOC_STATUS: Record<KycDocument['status'], { label: string; cls: string }> = {
  uploaded: { label: 'Waiting for review', cls: 'text-muted-foreground' },
  accepted: { label: 'Accepted', cls: 'text-[#C24400] dark:text-[#FF8A3D]' },
  rejected: { label: 'Rejected', cls: 'text-red-600 dark:text-red-400' },
  resubmission_required: { label: 'Upload a new one', cls: 'text-red-600 dark:text-red-400' },
  purged: { label: 'Deleted', cls: 'text-muted-foreground' },
};

export function DocumentRow({ doc, onOpen, onRemove, busy, children }: {
  doc: KycDocument;
  onOpen?: () => void;
  onRemove?: () => void;
  busy?: boolean;
  children?: React.ReactNode;
}) {
  const st = DOC_STATUS[doc.status];
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#FF5A00]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-snug">{DOC_LABEL[doc.doc_type] ?? doc.doc_type}</p>
          <p className="truncate text-[11.5px] text-muted-foreground">{doc.file_name} · {Math.max(1, Math.round(doc.size_bytes / 1024))} KB · {day(doc.uploaded_at)}</p>
          <p className={cn('text-[11.5px] font-semibold', st.cls)}>{st.label}{doc.review_note ? `: ${doc.review_note}` : ''}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {onOpen && (
          <button type="button" onClick={onOpen} className="fk-btn is-ghost !min-h-[36px] !px-3 !text-[12px]" disabled={busy}>
            <Eye className="h-3.5 w-3.5" aria-hidden="true" /> View
          </button>
        )}
        {onRemove && (
          <button type="button" onClick={onRemove} className="fk-btn is-ghost !min-h-[36px] !px-3 !text-[12px]" disabled={busy} aria-label={`Remove ${DOC_LABEL[doc.doc_type]}`}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />} Remove
          </button>
        )}
        {children}
      </div>
    </li>
  );
}

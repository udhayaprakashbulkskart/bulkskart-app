import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, CheckCircle2, Landmark, Loader2, RefreshCw, RotateCcw, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PageMeta from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Actions, CountedTextArea, Field, FormDialog, IconBox, KitButton, TextInput } from '@/components/formkit';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { adminResolvePayout, commissionSplit, money, refundOrderPayment, releaseOrderPayment } from '@/lib/orderPayments';

interface HeldOrder {
  id: string;
  order_number: string;
  paid_amount: number | null;
  total_amount: number;
  currency: string;
  paid_at: string | null;
  order_status: string | null;
  commission_pct: number | null;
  buyer?: { full_name: string | null; email: string | null } | null;
  companies?: { company_name: string | null } | null;
}

interface PayoutRow {
  id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  payout_reference: string | null;
  admin_note: string | null;
  bank_snapshot: { account_name?: string; account_number?: string; ifsc?: string; bank_name?: string } | null;
  created_at: string;
  processed_at: string | null;
  companies?: { company_name: string | null } | null;
}

type Dialog = { kind: 'release' | 'refund'; order: HeldOrder } | { kind: 'pay' | 'reject'; payout: PayoutRow } | null;

const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Admin: money BulkSkart is holding for buyers, refunds due on cancelled orders, and manufacturers' payout requests. */
export default function AdminPaymentsPage() {
  const { profile } = useAuth();
  const [held, setHeld] = useState<HeldOrder[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [orders, requests] = await Promise.all([
      supabase
        .from('orders')
        .select('id,order_number,paid_amount,total_amount,currency,paid_at,order_status,commission_pct,buyer:profiles!buyer_id(full_name),companies:supplier_company_id(company_name)')
        .eq('payment_status', 'escrow')
        .order('paid_at', { ascending: true }),
      supabase.from('withdrawal_requests').select('*, companies(company_name)').order('created_at', { ascending: false }).limit(100),
    ]);
    setHeld((orders.data as unknown as HeldOrder[]) ?? []);
    setPayouts((requests.data as unknown as PayoutRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (profile && profile.role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Access denied.</div>
      </DashboardLayout>
    );
  }

  const refundsDue = held.filter((o) => o.order_status === 'cancelled');
  const holding = held.filter((o) => o.order_status !== 'cancelled');
  const waiting = payouts.filter((p) => p.status === 'pending');
  const sum = (list: HeldOrder[]) => list.reduce((s, o) => s + Number(o.paid_amount ?? o.total_amount), 0);

  const open = (next: Dialog) => {
    setText('');
    setError('');
    setDialog(next);
  };

  const confirm = async () => {
    if (!dialog) return;
    if ((dialog.kind === 'refund' || dialog.kind === 'pay') && !text.trim()) {
      setError(dialog.kind === 'pay' ? 'Enter the bank transfer reference (UTR).' : 'Say why the payment is refunded.');
      document.getElementById('admin-pay-text')?.focus();
      return;
    }
    setBusy(true);
    let problem: string | null = null;
    if (dialog.kind === 'release') problem = (await releaseOrderPayment(dialog.order.id)).error;
    if (dialog.kind === 'refund') problem = await refundOrderPayment(dialog.order.id, text.trim());
    if (dialog.kind === 'pay') problem = await adminResolvePayout(dialog.payout.id, true, text.trim(), '');
    if (dialog.kind === 'reject') problem = await adminResolvePayout(dialog.payout.id, false, '', text.trim());
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    toast.success(
      dialog.kind === 'release' ? 'Released to the manufacturer.' : dialog.kind === 'refund' ? 'Refund sent through Razorpay.' : dialog.kind === 'pay' ? 'Payout recorded as sent.' : 'Payout rejected; the amount is back in their balance.',
    );
    setDialog(null);
    load();
  };

  const orderRow = (o: HeldOrder, refund: boolean) => {
    const amount = Number(o.paid_amount ?? o.total_amount);
    const { payout } = commissionSplit(amount, o.commission_pct ?? undefined);
    return (
      <li key={o.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">
            #{o.order_number} · {money(amount, o.currency)}
          </p>
          <p className="text-xs text-muted-foreground">
            {o.buyer?.full_name || 'Buyer'} → {o.companies?.company_name || 'Manufacturer'} · paid {date(o.paid_at)} · order {o.order_status ?? 'pending'}
            {!refund && ` · maker gets ${money(payout, o.currency)}`}
          </p>
        </div>
        <div className="flex gap-2">
          {!refund && (
            <Button size="sm" variant="outline" onClick={() => open({ kind: 'release', order: o })} className="gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Release
            </Button>
          )}
          <Button size="sm" variant={refund ? 'default' : 'ghost'} onClick={() => open({ kind: 'refund', order: o })} className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Refund
          </Button>
        </div>
      </li>
    );
  };

  return (
    <DashboardLayout>
      <PageMeta title="Payments | BulkSkart Admin" description="Held order payments, refunds and payouts." robots="noindex, nofollow" />
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" /> Payments
            </h1>
            <p className="text-sm text-muted-foreground">Buyers' online payments held until delivery, refunds due, and manufacturers' payouts.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Held for buyers', value: money(sum(holding)), note: `${holding.length} order${holding.length === 1 ? '' : 's'}` },
            { label: 'Refunds due', value: money(sum(refundsDue)), note: `${refundsDue.length} cancelled order${refundsDue.length === 1 ? '' : 's'}` },
            { label: 'Payouts to send', value: money(waiting.reduce((s, p) => s + Number(p.amount), 0)), note: `${waiting.length} request${waiting.length === 1 ? '' : 's'}` },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-xl font-bold text-foreground mt-1">{loading ? '…' : card.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{card.note}</p>
            </div>
          ))}
        </div>

        {refundsDue.length > 0 && (
          <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <h2 className="text-sm font-semibold text-foreground">Refunds due on cancelled orders</h2>
            <ul className="divide-y divide-border">{refundsDue.map((o) => orderRow(o, true))}</ul>
          </section>
        )}

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Payout requests</h2>
          {payouts.length === 0 ? (
            <p className="text-xs text-muted-foreground mt-2">No payout requests.</p>
          ) : (
            <ul className="divide-y divide-border">
              {payouts.map((p) => (
                <li key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      {p.companies?.company_name || 'Manufacturer'} · {money(p.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2">
                      <span>Asked {date(p.created_at)}</span>
                      {p.bank_snapshot && (
                        <span className="flex items-center gap-1 font-mono">
                          <Landmark className="w-3 h-3" /> {p.bank_snapshot.account_name} · {p.bank_snapshot.account_number} · {p.bank_snapshot.ifsc}
                        </span>
                      )}
                      {p.notes && <span>“{p.notes}”</span>}
                      {p.status === 'approved' && <span className="text-orange-600">Sent {date(p.processed_at)}, ref {p.payout_reference}</span>}
                      {p.status === 'rejected' && <span>Rejected{p.admin_note ? `: ${p.admin_note}` : ''}</span>}
                    </p>
                  </div>
                  {p.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => open({ kind: 'pay', payout: p })} className="gap-1.5">
                        <Banknote className="w-3.5 h-3.5" /> Mark sent
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => open({ kind: 'reject', payout: p })} className="text-destructive">
                        Reject
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Held for buyers</h2>
          <p className="text-xs text-muted-foreground">Buyers release these themselves. Release or refund here only after a dispute is decided.</p>
          {holding.length === 0 ? <p className="text-xs text-muted-foreground mt-2">Nothing held.</p> : <ul className="divide-y divide-border">{holding.map((o) => orderRow(o, false))}</ul>}
          <Link to="/dashboard/admin" className="text-xs text-primary hover:underline">Disputes are in the Control Panel</Link>
        </section>
      </div>

      <FormDialog
        open={dialog !== null}
        onOpenChange={(next) => !busy && !next && setDialog(null)}
        busy={busy}
        width={560}
        title={
          dialog?.kind === 'release' ? 'Release payment' : dialog?.kind === 'refund' ? 'Refund to buyer' : dialog?.kind === 'pay' ? 'Payout sent' : 'Reject payout'
        }
        description={
          dialog?.kind === 'release'
            ? `Release #${dialog.order.order_number} to ${dialog.order.companies?.company_name || 'the manufacturer'} (less commission).`
            : dialog?.kind === 'refund'
              ? `Send ${money(Number(dialog.order.paid_amount ?? dialog.order.total_amount), dialog.order.currency)} back to the buyer through Razorpay. This cannot be undone.`
              : dialog?.kind === 'pay'
                ? `Record the bank transfer of ${money(dialog.payout.amount)} to ${dialog.payout.companies?.company_name || 'the manufacturer'}.`
                : dialog?.kind === 'reject'
                  ? `The ${money(dialog.payout.amount)} goes back to their balance.`
                  : undefined
        }
      >
        <form
          noValidate
          className="fk-form fk-stack"
          onSubmit={(e) => {
            e.preventDefault();
            confirm();
          }}
        >
          {dialog?.kind === 'pay' && (
            <Field htmlFor="admin-pay-text" label="Bank transfer reference (UTR)" required error={error}>
              <IconBox icon={Banknote}>
                <TextInput id="admin-pay-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. HDFCN52026111612345" invalid={Boolean(error)} iconPadding />
              </IconBox>
            </Field>
          )}
          {(dialog?.kind === 'refund' || dialog?.kind === 'reject') && (
            <Field htmlFor="admin-pay-text" label={dialog.kind === 'refund' ? 'Reason' : 'Reason (shown to the manufacturer)'} required={dialog.kind === 'refund'} optional={dialog.kind === 'reject'} error={error}>
              <CountedTextArea id="admin-pay-text" icon={RotateCcw} rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} invalid={Boolean(error)} />
            </Field>
          )}
          {error && dialog?.kind === 'release' && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <Actions>
            <KitButton type="submit" variant={dialog?.kind === 'refund' || dialog?.kind === 'reject' ? 'danger' : 'primary'} disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              {busy ? 'Working…' : 'Confirm'}
            </KitButton>
            <KitButton variant="ghost" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </KitButton>
          </Actions>
        </form>
      </FormDialog>
    </DashboardLayout>
  );
}

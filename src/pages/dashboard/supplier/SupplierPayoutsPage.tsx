import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, Clock, Landmark, Loader2, RefreshCw, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PageMeta from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Field, IconBox, KitButton, TextInput } from '@/components/formkit';
import '@/components/formkit/formkit.css';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { getOrdersForSupplier } from '@/lib/api';
import { commissionSplit, money, requestPayout } from '@/lib/orderPayments';
import type { OrderRow } from '@/types/types';

interface Balance {
  withdrawable_balance: number | null;
  total_revenue: number | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
}

interface PayoutRequest {
  id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  payout_reference: string | null;
  admin_note: string | null;
  processed_at: string | null;
  created_at: string;
}

const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/**
 * The manufacturer's money from online orders: what is ready to pay out, what buyers have paid but not yet released,
 * and payouts to their bank. BulkSkart's team makes each transfer and records the bank reference.
 */
export default function SupplierPayoutsPage() {
  const { company } = useAuth();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!company?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [bal, reqs, ords] = await Promise.all([
      supabase.from('companies').select('withdrawable_balance,total_revenue,bank_account_name,bank_account_number,bank_ifsc,bank_name').eq('id', company.id).maybeSingle(),
      supabase.from('withdrawal_requests').select('*').eq('company_id', company.id).order('created_at', { ascending: false }),
      getOrdersForSupplier(company.id),
    ]);
    setBalance((bal.data as Balance | null) ?? null);
    setRequests((reqs.data as PayoutRequest[] | null) ?? []);
    setOrders(ords);
    setLoading(false);
  }, [company?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const ready = Number(balance?.withdrawable_balance ?? 0);
  const heldOrders = orders.filter((o) => o.payment_status === 'escrow' && o.order_status !== 'cancelled');
  const heldPayout = heldOrders.reduce((sum, o) => sum + commissionSplit(Number(o.paid_amount ?? o.total_amount), o.commission_pct ?? undefined).payout, 0);
  const paidOut = requests.filter((r) => r.status === 'approved').reduce((sum, r) => sum + Number(r.amount), 0);
  const waiting = requests.filter((r) => r.status === 'pending').reduce((sum, r) => sum + Number(r.amount), 0);
  const released = orders.filter((o) => o.payment_status === 'released');
  const hasBank = Boolean(balance?.bank_account_number?.trim() && balance?.bank_ifsc?.trim());

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = amount.trim() ? Number(amount) : ready;
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter the amount to pay out.');
      document.getElementById('payout-amount')?.focus();
      return;
    }
    if (value > ready) {
      setError(`You can pay out up to ${money(ready)}.`);
      document.getElementById('payout-amount')?.focus();
      return;
    }
    setSending(true);
    const problem = await requestPayout(value, note.trim());
    setSending(false);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setAmount('');
    setNote('');
    toast.success(`Payout of ${money(value)} requested. You will be told when it is sent.`);
    load();
  };

  return (
    <DashboardLayout>
      <PageMeta title="Payouts | BulkSkart" description="Your earnings from online orders and payouts to your bank." robots="noindex, nofollow" />
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" /> Payouts
            </h1>
            <p className="text-sm text-muted-foreground">Money buyers paid online, after they confirm delivery, less BulkSkart's 2% commission.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Ready to pay out', value: money(ready), icon: Wallet, note: waiting > 0 ? `${money(waiting)} more is on its way to your bank` : 'Ask for a payout below' },
            { label: 'Held until buyers confirm', value: money(heldPayout), icon: Clock, note: `${heldOrders.length} order${heldOrders.length === 1 ? '' : 's'}, after commission` },
            { label: 'Paid to your bank', value: money(paidOut), icon: Landmark, note: 'All time' },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <card.icon className="w-3.5 h-3.5 text-primary" /> {card.label}
              </p>
              <p className="text-xl font-bold text-foreground mt-1">{loading ? '…' : card.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{card.note}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4 text-sm space-y-2">
            <p className="font-semibold text-foreground flex items-center gap-2">
              <Landmark className="w-4 h-4 text-primary" /> Bank account for payouts
            </p>
            {hasBank ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="text-foreground">{balance?.bank_account_name || '—'}</dd>
                <dt className="text-muted-foreground">Account</dt>
                <dd className="text-foreground font-mono">•••• {balance?.bank_account_number?.trim().slice(-4)}</dd>
                <dt className="text-muted-foreground">IFSC</dt>
                <dd className="text-foreground font-mono">{balance?.bank_ifsc}</dd>
                {balance?.bank_name && (
                  <>
                    <dt className="text-muted-foreground">Bank</dt>
                    <dd className="text-foreground">{balance.bank_name}</dd>
                  </>
                )}
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">No bank account yet. Add it with your verification details so we can pay you.</p>
            )}
            <Link to="/dashboard/supplier/verification" className="text-xs font-semibold text-primary hover:underline">
              {hasBank ? 'Change bank account' : 'Add bank account'}
            </Link>
          </div>

          <form noValidate onSubmit={submit} className="fk-skin rounded-2xl border border-border bg-card p-4 space-y-3">
            <p className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Banknote className="w-4 h-4 text-primary" /> Ask for a payout
            </p>
            <Field htmlFor="payout-amount" label="Amount (INR)" error={error} hint={`Up to ${money(ready)}. Leave empty for all of it.`}>
              <IconBox icon={Banknote}>
                <TextInput id="payout-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(ready)} invalid={Boolean(error)} iconPadding />
              </IconBox>
            </Field>
            <Field htmlFor="payout-note" label="Note for our team" optional>
              <TextInput id="payout-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. For June orders" maxLength={200} />
            </Field>
            <KitButton type="submit" disabled={sending || ready <= 0 || !hasBank} className="w-full">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
              {sending ? 'Sending…' : ready > 0 ? 'Request Payout' : 'Nothing to pay out yet'}
            </KitButton>
            <p className="text-[11px] text-muted-foreground">The BulkSkart team transfers it to your bank and records the bank reference here.</p>
          </form>
        </div>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Payout requests</h2>
          {requests.length === 0 ? (
            <p className="text-xs text-muted-foreground">No payout requests yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {requests.map((r) => (
                <li key={r.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{money(r.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      Asked {date(r.created_at)}
                      {r.status === 'approved' && r.payout_reference && ` · Sent ${date(r.processed_at)}, reference ${r.payout_reference}`}
                      {r.status === 'rejected' && ` · Not sent${r.admin_note ? `: ${r.admin_note}` : ''}; the amount is back in your balance`}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-semibold border rounded-full px-2 py-0.5 ${
                      r.status === 'approved'
                        ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30'
                        : r.status === 'rejected'
                          ? 'bg-muted text-muted-foreground border-border'
                          : 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30'
                    }`}
                  >
                    {r.status === 'approved' ? 'Sent to bank' : r.status === 'rejected' ? 'Not sent' : 'Waiting'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Released order payments</h2>
          {released.length === 0 ? (
            <p className="text-xs text-muted-foreground">None yet. When a buyer confirms delivery of an order they paid online, it appears here.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {released.map((o) => (
                <li key={o.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <Link to={`/dashboard/supplier/orders/${o.id}`} className="font-semibold text-foreground hover:text-primary">
                    #{o.order_number}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {date(o.released_at)} · you got <b className="text-foreground">{money(o.payout_amount, o.currency)}</b> · commission {money(o.commission_amount, o.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}

import { useCallback, useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, CalendarDays, CheckCircle2, CreditCard, Factory, HandCoins, Loader2, RotateCcw, ShieldCheck, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Actions, CountedTextArea, Field, FormDialog, IconBox, KitButton, TextInput } from '@/components/formkit';
import BookFactoryVisitDialog from '@/components/common/BookFactoryVisitDialog';
import { useAuth } from '@/contexts/AuthContext';
import {
  canRelease,
  chooseOrderPaymentMethod,
  commissionSplit,
  confirmFactoryPayment,
  describeEvent,
  describePayment,
  getOrderPaymentEvents,
  money,
  payOrderOnline,
  refundOrderPayment,
  releaseOrderPayment,
  type OrderPaymentFields,
  type PaymentEvent,
  type PaymentTone,
  type PaymentViewer,
} from '@/lib/orderPayments';

const TONE: Record<PaymentTone, string> = {
  waiting: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30',
  held: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30',
  done: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30',
  returned: 'bg-muted text-muted-foreground border-border',
};

interface Props {
  order: OrderPaymentFields & { supplier_company_id: string; companies?: { company_name?: string | null } | null };
  viewer: PaymentViewer;
  onChanged: () => void;
}

/**
 * How the order is paid. Buyers choose to pay online (BulkSkart holds the money until they confirm delivery) or at the
 * factory; manufacturers record factory payments; admins release or refund held payments after a dispute.
 */
export default function OrderPaymentPanel({ order, viewer, onChanged }: Props) {
  const ids = useId();
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [visitOpen, setVisitOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [factoryOpen, setFactoryOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [factoryAmount, setFactoryAmount] = useState('');
  const [factoryNote, setFactoryNote] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [formError, setFormError] = useState('');

  const status = order.payment_status ?? 'pending';
  const cancelled = order.order_status === 'cancelled';
  const companyName = order.companies?.company_name || 'the manufacturer';
  const info = describePayment(order, viewer);
  const held = order.paid_amount ?? order.total_amount;
  const split = commissionSplit(held, order.commission_pct ?? undefined);
  const inRupees = (order.currency || 'INR') === 'INR';

  const loadEvents = useCallback(() => {
    getOrderPaymentEvents(order.id).then(setEvents);
  }, [order.id]);
  useEffect(() => {
    loadEvents();
  }, [loadEvents, order.payment_status, order.payment_method]);

  const done = (message: string) => {
    toast.success(message);
    onChanged();
    loadEvents();
  };

  const run = async (key: string, action: () => Promise<string | null>, success: string) => {
    setBusy(key);
    const problem = await action();
    setBusy(null);
    if (problem) toast.error(problem);
    else done(success);
    return !problem;
  };

  const payOnline = () =>
    run('online', () => payOrderOnline(order, { name: profile?.full_name ?? '', email: user?.email ?? '', phone: profile?.phone ?? '' }),
      `Paid. BulkSkart holds ${money(order.total_amount, order.currency)} until you confirm delivery.`);

  const release = async () => {
    setBusy('release');
    const { payout, error } = await releaseOrderPayment(order.id);
    setBusy(null);
    if (error) {
      setFormError(error);
      return;
    }
    setReleaseOpen(false);
    done(viewer === 'admin' ? `Released ${money(payout, order.currency)} to ${companyName}.` : `Thank you. ${money(payout, order.currency)} goes to ${companyName}.`);
  };

  const recordFactoryPayment = async () => {
    const amount = factoryAmount.trim() ? Number(factoryAmount) : order.total_amount;
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Enter the amount you received.');
      document.getElementById(`${ids}-amount`)?.focus();
      return;
    }
    setBusy('factory');
    const problem = await confirmFactoryPayment(order.id, amount, factoryNote.trim());
    setBusy(null);
    if (problem) {
      setFormError(problem);
      return;
    }
    setFactoryOpen(false);
    done('Payment recorded. The buyer has been told.');
  };

  const refund = async () => {
    if (!refundReason.trim()) {
      setFormError('Say why the payment is refunded.');
      document.getElementById(`${ids}-reason`)?.focus();
      return;
    }
    setBusy('refund');
    const problem = await refundOrderPayment(order.id, refundReason.trim());
    setBusy(null);
    if (problem) {
      setFormError(problem);
      return;
    }
    setRefundOpen(false);
    done('Refund sent to the buyer through Razorpay.');
  };

  const openDialog = (open: (v: boolean) => void) => {
    setFormError('');
    open(true);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" /> Payment
          </span>
          <span className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 ${TONE[info.tone]}`}>{info.badge}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">{info.text}</p>

        {/* ── buyer: choose how to pay ── */}
        {viewer === 'buyer' && status === 'pending' && !cancelled && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className={`rounded-xl border p-4 space-y-2 ${order.payment_method === 'online' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              <p className="font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" /> Pay online, held by BulkSkart
              </p>
              <p className="text-xs text-muted-foreground">
                Your money stays with BulkSkart and shows in your dashboard. {companyName} gets it only when you confirm the goods arrived.
              </p>
              {inRupees ? (
                <Button onClick={payOnline} disabled={busy !== null} className="w-full gap-2">
                  {busy === 'online' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  Pay {money(order.total_amount, order.currency)} online
                </Button>
              ) : (
                <p className="text-xs text-orange-700 dark:text-orange-300">Online payment works for orders in rupees. Pay at the factory, or ask for a quote in INR.</p>
              )}
            </div>
            <div className={`rounded-xl border p-4 space-y-2 ${order.payment_method === 'at_factory' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              <p className="font-semibold text-foreground flex items-center gap-2">
                <Factory className="w-4 h-4 text-primary" /> Visit and pay at the factory
              </p>
              <p className="text-xs text-muted-foreground">Meet {companyName}, see the goods, and pay them directly. Book a visit time online first.</p>
              <div className="flex flex-wrap gap-2">
                {order.payment_method !== 'at_factory' && (
                  <Button
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => run('factory-choice', () => chooseOrderPaymentMethod(order.id, 'at_factory'), `${companyName} has been told you will pay at the factory.`)}
                    className="gap-2"
                  >
                    {busy === 'factory-choice' ? <Loader2 className="w-4 h-4 animate-spin" /> : <HandCoins className="w-4 h-4" />}
                    I'll pay at the factory
                  </Button>
                )}
                <Button variant="outline" onClick={() => setVisitOpen(true)} className="gap-2">
                  <CalendarDays className="w-4 h-4" /> Book a factory visit
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── buyer: release a held payment ── */}
        {viewer === 'buyer' && status === 'escrow' && !cancelled && (
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 space-y-2">
            <p className="text-foreground">
              <b>{money(held, order.currency)}</b> is held for you. Release it only when you have the goods and they are right.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => openDialog(setReleaseOpen)} disabled={!canRelease(order)} className="gap-2">
                <CheckCircle2 className="w-4 h-4" /> Goods received, release payment
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/dashboard/buyer/disputes">Problem with the order?</Link>
              </Button>
            </div>
            {!canRelease(order) && <p className="text-xs text-muted-foreground">You can release it once {companyName} marks the order shipped.</p>}
          </div>
        )}

        {/* ── manufacturer: record a factory payment ── */}
        {viewer === 'supplier' && status === 'pending' && !cancelled && order.payment_method !== 'online' && (
          <Button onClick={() => openDialog(setFactoryOpen)} variant="outline" className="gap-2">
            <Banknote className="w-4 h-4" /> Record payment received at the factory
          </Button>
        )}
        {viewer === 'supplier' && status === 'released' && (
          <Button variant="outline" asChild className="gap-2">
            <Link to="/dashboard/supplier/payouts">
              <Wallet className="w-4 h-4" /> Go to payouts
            </Link>
          </Button>
        )}

        {/* ── admin: settle a held payment ── */}
        {viewer === 'admin' && status === 'escrow' && (
          <div className="flex flex-wrap gap-2">
            {!cancelled && (
              <Button onClick={() => openDialog(setReleaseOpen)} className="gap-2">
                <CheckCircle2 className="w-4 h-4" /> Release to manufacturer
              </Button>
            )}
            <Button variant="outline" onClick={() => openDialog(setRefundOpen)} className="gap-2 border-destructive/40 text-destructive">
              <RotateCcw className="w-4 h-4" /> Refund to buyer
            </Button>
          </div>
        )}

        {events.length > 0 && (
          <ol className="border-t border-border pt-3 space-y-1.5">
            {events.map((event) => (
              <li key={event.id} className="flex justify-between gap-3 text-xs">
                <span className="text-foreground">{describeEvent(event, order.currency)}</span>
                <span className="text-muted-foreground shrink-0">
                  {new Date(event.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>

      {/* release */}
      <FormDialog
        open={releaseOpen}
        onOpenChange={(open) => busy !== 'release' && setReleaseOpen(open)}
        busy={busy === 'release'}
        width={560}
        title={
          <>
            Release <em>Payment</em>
          </>
        }
        description={viewer === 'admin' ? `Release the held payment for order #${order.order_number} after the dispute.` : 'Only release once the goods have arrived and are right.'}
      >
        <div className="fk-form fk-stack">
          <dl className="fk-summary">
            <div>
              <dt>Held for this order</dt>
              <dd>{money(held, order.currency)}</dd>
            </div>
            <div>
              <dt>BulkSkart commission ({order.commission_pct ?? 2}%)</dt>
              <dd>{money(split.commission, order.currency)}</dd>
            </div>
            <div>
              <dt>{companyName} receives</dt>
              <dd>{money(split.payout, order.currency)}</dd>
            </div>
          </dl>
          {formError && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {formError}
            </p>
          )}
          <Actions>
            <KitButton onClick={release} disabled={busy === 'release'}>
              {busy === 'release' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
              {busy === 'release' ? 'Releasing…' : `Release ${money(held, order.currency)}`}
            </KitButton>
            <KitButton variant="ghost" onClick={() => setReleaseOpen(false)} disabled={busy === 'release'}>
              Not yet
            </KitButton>
          </Actions>
        </div>
      </FormDialog>

      {/* factory payment */}
      <FormDialog
        open={factoryOpen}
        onOpenChange={(open) => busy !== 'factory' && setFactoryOpen(open)}
        busy={busy === 'factory'}
        width={560}
        title={
          <>
            Payment <em>Received</em>
          </>
        }
        description={`Record what the buyer paid you directly for order #${order.order_number}. This money does not pass through BulkSkart.`}
      >
        <form
          noValidate
          className="fk-form fk-stack"
          onSubmit={(e) => {
            e.preventDefault();
            recordFactoryPayment();
          }}
        >
          <Field htmlFor={`${ids}-amount`} label={`Amount received (${order.currency})`} hint={`Leave empty for the full order value, ${money(order.total_amount, order.currency)}.`}>
            <IconBox icon={Banknote}>
              <TextInput id={`${ids}-amount`} inputMode="decimal" value={factoryAmount} onChange={(e) => setFactoryAmount(e.target.value)} placeholder={String(order.total_amount)} iconPadding />
            </IconBox>
          </Field>
          <Field htmlFor={`${ids}-note`} label="How it was paid" optional>
            <CountedTextArea id={`${ids}-note`} icon={HandCoins} rows={2} maxLength={200} value={factoryNote} onChange={(e) => setFactoryNote(e.target.value)} placeholder="e.g. Bank transfer UTR 1234, or cash at the factory" />
          </Field>
          {formError && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {formError}
            </p>
          )}
          <Actions>
            <KitButton type="submit" disabled={busy === 'factory'}>
              {busy === 'factory' ? 'Saving…' : 'Record Payment'}
            </KitButton>
            <KitButton variant="ghost" onClick={() => setFactoryOpen(false)} disabled={busy === 'factory'}>
              Cancel
            </KitButton>
          </Actions>
        </form>
      </FormDialog>

      {/* refund */}
      <FormDialog
        open={refundOpen}
        onOpenChange={(open) => busy !== 'refund' && setRefundOpen(open)}
        busy={busy === 'refund'}
        width={560}
        title={
          <>
            Refund to <em>Buyer</em>
          </>
        }
        description={`Send ${money(held, order.currency)} back to the buyer through Razorpay. This cannot be undone.`}
      >
        <form
          noValidate
          className="fk-form fk-stack"
          onSubmit={(e) => {
            e.preventDefault();
            refund();
          }}
        >
          <Field htmlFor={`${ids}-reason`} label="Reason" required error={formError && !refundReason.trim() ? formError : undefined}>
            <CountedTextArea id={`${ids}-reason`} icon={RotateCcw} rows={3} maxLength={300} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="e.g. Order cancelled before production; dispute decided for the buyer" />
          </Field>
          {formError && refundReason.trim() && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {formError}
            </p>
          )}
          <Actions>
            <KitButton type="submit" variant="danger" disabled={busy === 'refund'}>
              {busy === 'refund' ? 'Refunding…' : `Refund ${money(held, order.currency)}`}
            </KitButton>
            <KitButton variant="ghost" onClick={() => setRefundOpen(false)} disabled={busy === 'refund'}>
              Cancel
            </KitButton>
          </Actions>
        </form>
      </FormDialog>

      {viewer === 'buyer' && (
        <BookFactoryVisitDialog open={visitOpen} onOpenChange={setVisitOpen} companyId={order.supplier_company_id} companyName={companyName} orderId={order.id} />
      )}
    </Card>
  );
}

import { describePayment, type OrderPaymentFields, type PaymentTone, type PaymentViewer } from '@/lib/orderPayments';

const TONE: Record<PaymentTone, string> = {
  waiting: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  held: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
  done: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  returned: 'bg-muted text-muted-foreground border-border',
};

/** Where an order's money is, as a small badge for order lists. */
export default function PaymentBadge({ order, viewer }: { order: OrderPaymentFields; viewer: PaymentViewer }) {
  const info = describePayment(order, viewer);
  return (
    <span title={info.text} className={`inline-flex items-center text-[11px] font-semibold border rounded-full px-2 py-0.5 whitespace-nowrap ${TONE[info.tone]}`}>
      {info.badge}
    </span>
  );
}

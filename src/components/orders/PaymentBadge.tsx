import { describePayment, type OrderPaymentFields, type PaymentTone, type PaymentViewer } from '@/lib/orderPayments';

const TONE: Record<PaymentTone, string> = {
  waiting: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30',
  held: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30',
  done: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30',
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

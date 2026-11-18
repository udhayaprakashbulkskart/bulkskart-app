import { describePayment, type OrderPaymentFields, type PaymentTone, type PaymentViewer } from '@/lib/orderPayments';

const TONE: Record<PaymentTone, string> = {
  waiting: 'bg-[#FF5A00]/10 text-[#C94400] dark:text-[#FF7A2E] border-[#FF5A00]/35',
  held: 'bg-[#FF5A00]/15 text-[#B33D00] dark:text-[#FF9A5C] border-[#FF5A00]/50',
  done: 'bg-[#FF5A00] text-white border-[#FF5A00]',
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

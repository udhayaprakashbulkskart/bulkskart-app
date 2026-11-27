import { deliveryByLabel, isDeliveryDatePassed } from '@/lib/deliveryDate';

/** "Delivery by 12 Dec 2026", or muted "Delivery date passed" once that day in IST is over. */
export default function DeliveryByText({
  deadline,
  className = '',
  now,
}: {
  deadline: string | null | undefined;
  className?: string;
  now?: Date;
}) {
  const label = deliveryByLabel(deadline, now);
  if (!label) return null;
  const passed = isDeliveryDatePassed(deadline, now);
  return (
    <span className={passed ? `text-muted-foreground ${className}` : className}>
      {label}
    </span>
  );
}

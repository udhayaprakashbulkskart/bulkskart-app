/** India Standard Time, the calendar the buyer uses for a delivery date. */
export const IST = 'Asia/Kolkata';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** YYYY-MM-DD for a Date in a named zone, with no UTC shift. */
export function isoDateInTimeZone(date: Date, timeZone = IST): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Today's calendar date in IST, for date-picker min values. */
export function todayIsoDateIST(now = new Date()): string {
  return isoDateInTimeZone(now, IST);
}

/** Take a date-only value as YYYY-MM-DD, or null if it is blank or not a calendar date. */
export function normalizeDeadlineInput(value: string | null | undefined): string | null {
  const iso = (value ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

/**
 * Format a stored date-only deadline as "12 Dec 2026".
 * Uses the calendar digits themselves so UTC parsing cannot shift the day.
 */
export function deliveryDateLabel(deadline: string | null | undefined): string | null {
  const iso = normalizeDeadlineInput(deadline);
  if (!iso) return null;
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${String(day).padStart(2, '0')} ${MONTHS[month - 1]} ${year}`;
}

/** True once the IST calendar day of the deadline is over. The delivery day itself still counts as upcoming. */
export function isDeliveryDatePassed(deadline: string | null | undefined, now = new Date()): boolean {
  const iso = normalizeDeadlineInput(deadline);
  if (!iso) return false;
  return iso < todayIsoDateIST(now);
}

export function isValidDeliveryDate(value: string, now = new Date()): boolean {
  const iso = normalizeDeadlineInput(value);
  if (!iso) return false;
  return iso >= todayIsoDateIST(now);
}

/** "Delivery by 12 Dec 2026", "Delivery date passed", or null when the buyer left the date blank. */
export function deliveryByLabel(deadline: string | null | undefined, now = new Date()): string | null {
  if (!deliveryDateLabel(deadline)) return null;
  if (isDeliveryDatePassed(deadline, now)) return 'Delivery date passed';
  return `Delivery by ${deliveryDateLabel(deadline)}`;
}

export const PAST_DELIVERY_DATE_MESSAGE = 'Choose today or a later date';

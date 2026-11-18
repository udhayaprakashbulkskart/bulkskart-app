import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, CalendarDays, Clock, Factory, Phone, ShieldCheck, Users } from 'lucide-react';
import { Actions, CountedTextArea, Done, Field, FormDialog, IconBox, KitButton, Stepper, TextInput } from '@/components/formkit';
import type { FormPoint } from '@/components/formkit';
import { useAuth } from '@/contexts/AuthContext';
import { bookFactoryVisit } from '@/lib/orderPayments';

const POINTS: FormPoint[] = [
  { icon: CalendarDays, title: 'Pick a day and time', detail: 'The manufacturer confirms it or suggests another time.' },
  { icon: BellRing, title: 'You are told in BulkSkart', detail: 'Their answer arrives in your notifications and Factory Visits.' },
  { icon: ShieldCheck, title: 'Free to book', detail: 'Meet them, see the goods, and pay at the factory if you like.' },
];

/** Tomorrow at 11:00, in the browser's own time zone, as the date and time fields want them. */
function defaultSlot(): { date: string; time: string } {
  const d = new Date(Date.now() + 24 * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: '11:00' };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  /** the order the visit is about, when booked from an order */
  orderId?: string | null;
  onBooked?: () => void;
}

/** A buyer asks to visit a manufacturer's factory. Nothing is charged; the manufacturer confirms or declines. */
export default function BookFactoryVisitDialog({ open, onOpenChange, companyId, companyName, orderId, onBooked }: Props) {
  const ids = useId();
  const { profile } = useAuth();
  const [date, setDate] = useState(defaultSlot().date);
  const [time, setTime] = useState(defaultSlot().time);
  const [visitors, setVisitors] = useState(1);
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [errors, setErrors] = useState<{ when?: string; phone?: string; server?: string }>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (open) {
      const slot = defaultSlot();
      setDate(slot.date);
      setTime(slot.time);
      setVisitors(1);
      setPurpose('');
      setPhone(profile?.phone ?? '');
      setErrors({});
      setSent(false);
    }
  }, [open, profile?.phone]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const when = new Date(`${date}T${time || '00:00'}`);
    const found: typeof errors = {};
    if (!date || Number.isNaN(when.getTime())) found.when = 'Pick the day and time you want to visit.';
    else if (when.getTime() < Date.now() + 3_600_000) found.when = 'Pick a time at least an hour from now.';
    if (phone.replace(/\D/g, '').length < 8) found.phone = 'Add a phone number the manufacturer can call to arrange the visit.';
    setErrors(found);
    if (found.when) return document.getElementById(`${ids}-date`)?.focus();
    if (found.phone) return document.getElementById(`${ids}-phone`)?.focus();

    setBusy(true);
    const problem = await bookFactoryVisit({ companyId, when, visitors, purpose, phone, orderId });
    setBusy(false);
    if (problem) {
      setErrors({ server: problem });
      return;
    }
    setSent(true);
    onBooked?.();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      busy={busy}
      width={760}
      points={POINTS}
      title={
        <>
          Book a <em>Factory Visit</em>
        </>
      }
      description={`Ask ${companyName} for a time to visit, meet the team and see the goods.`}
    >
      {sent ? (
        <Done
          title="Visit request sent"
          actions={
            <Actions>
              <Link to="/dashboard/buyer/visits" onClick={() => onOpenChange(false)} className="fk-btn is-primary">
                My factory visits
              </Link>
              <KitButton variant="ghost" onClick={() => onOpenChange(false)}>
                Close
              </KitButton>
            </Actions>
          }
        >
          <p>
            {companyName} will confirm the time or suggest another. You will see their answer in your notifications and in <b>Factory Visits</b>.
          </p>
        </Done>
      ) : (
        <form noValidate onSubmit={submit} className="fk-form fk-stack">
          <div className="fk-grid">
            <Field htmlFor={`${ids}-date`} label="Day" required error={errors.when}>
              <IconBox icon={CalendarDays}>
                <TextInput id={`${ids}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} invalid={Boolean(errors.when)} iconPadding />
              </IconBox>
            </Field>
            <Field htmlFor={`${ids}-time`} label="Time" required>
              <IconBox icon={Clock}>
                <TextInput id={`${ids}-time`} type="time" value={time} onChange={(e) => setTime(e.target.value)} iconPadding />
              </IconBox>
            </Field>
            <Field htmlFor={`${ids}-visitors`} label="People visiting" required>
              <Stepper id={`${ids}-visitors`} value={String(visitors)} onChange={(value) => setVisitors(Math.min(20, Math.max(1, Number(value) || 1)))} min={1} max={20} unitName="people" />
            </Field>
            <Field htmlFor={`${ids}-phone`} label="Your phone" required error={errors.phone}>
              <IconBox icon={Phone}>
                <TextInput id={`${ids}-phone`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98xxx xxxxx" invalid={Boolean(errors.phone)} iconPadding />
              </IconBox>
            </Field>
          </div>
          <Field htmlFor={`${ids}-purpose`} label="What you want to see or discuss" optional>
            <CountedTextArea
              id={`${ids}-purpose`}
              icon={Factory}
              rows={3}
              maxLength={500}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. See the production line, check samples, and pay for order #ORD-…"
            />
          </Field>
          {errors.server && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {errors.server}
            </p>
          )}
          <Actions>
            <KitButton type="submit" disabled={busy}>
              <Users aria-hidden="true" />
              {busy ? 'Sending…' : 'Request the Visit'}
            </KitButton>
            <KitButton variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </KitButton>
          </Actions>
        </form>
      )}
    </FormDialog>
  );
}

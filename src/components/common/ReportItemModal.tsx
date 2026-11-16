import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { EyeOff, FileText, Flag, Loader2, LogIn, Mail, ShieldAlert, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  Actions,
  CountedTextArea,
  Done,
  EntityCard,
  Field,
  FormDialog,
  IconBox,
  KitButton,
  NativeSelect,
  SectionTitle,
  type FormPoint,
} from '@/components/formkit';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { SUPPORT_EMAIL } from '@/lib/supportContact';

interface ReportItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: 'product' | 'company' | 'requirement' | 'auction';
  targetId: string;
  targetTitle: string;
}

const REPORT_REASONS = [
  { value: 'counterfeit', label: 'Counterfeit or Fake Product' },
  { value: 'fraud', label: 'Fraudulent Supplier / Scam Attempt' },
  { value: 'misleading_pricing', label: 'Incorrect Specifications or Misleading Price' },
  { value: 'ip_infringement', label: 'Intellectual Property / Trademark Violation' },
  { value: 'prohibited_goods', label: 'Prohibited, Hazardous or Restricted Goods' },
  { value: 'abusive_spam', label: 'Spam, Abusive or Inappropriate Content' },
  { value: 'other', label: 'Other Regulatory or Policy Violation' },
];

const POINTS: FormPoint[] = [
  { icon: ShieldCheck, title: 'Sent to the BulkSkart team' },
  { icon: FileText, title: 'Say what is wrong', detail: 'A reason and a few details' },
  { icon: EyeOff, title: 'Not shown to the seller', detail: 'Only the BulkSkart team sees it' },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAMES: Record<ReportItemModalProps['targetType'], string> = {
  product: 'Product',
  company: 'Supplier',
  requirement: 'Requirement',
  auction: 'Auction',
};

/**
 * Report a listing. A signed-in person's report is saved to the `reports` table, where the admin panel lists it;
 * someone who is not signed in can e-mail it instead (a report always has a reporter).
 */
export default function ReportItemModal({ open, onOpenChange, targetType, targetId, targetTitle }: ReportItemModalProps) {
  const { user } = useAuth();
  const ids = useId();
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ reason?: string; notes?: string }>({});
  const [loading, setLoading] = useState(false);
  const [reference, setReference] = useState('');

  const name = NAMES[targetType];
  const reasonLabel = REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Report: ${name} "${targetTitle}"`)}&body=${encodeURIComponent(
    `${name}: ${targetTitle}\nID: ${targetId}\nPage: ${typeof window !== 'undefined' ? window.location.href : ''}\n\nReason: ${reasonLabel || ''}\n\nDetails:\n${notes}`,
  )}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: typeof errors = {};
    if (!reason) found.reason = 'Please select a reason.';
    if (notes.trim().length < 10) found.notes = 'Please describe the issue in at least 10 characters.';
    setErrors(found);
    if (found.reason || found.notes) {
      document.getElementById(found.reason ? `${ids}-reason` : `${ids}-notes`)?.focus();
      return;
    }
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('reports')
      .insert({
        reporter_id: user.id,
        reason,
        description: `[${name}] ${targetTitle} (${targetId})\n\n${notes.trim()}`,
        reported_product_id: targetType === 'product' && UUID.test(targetId) ? targetId : null,
        reported_company_id: targetType === 'company' && UUID.test(targetId) ? targetId : null,
      })
      .select('id')
      .maybeSingle();
    setLoading(false);
    if (error) {
      toast.error('Your report could not be sent. Please try again, or e-mail it to us.');
      return;
    }
    setReference(String(data?.id ?? '').slice(0, 8).toUpperCase());
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setReference('');
      setReason('');
      setNotes('');
      setErrors({});
    }, 300);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
      busy={loading}
      title={
        <>
          Report <em>{name}</em>
        </>
      }
      description="Tell us what is wrong with this listing."
      points={POINTS}
      width={980}
    >
      {reference ? (
        <Done
          title="Report received"
          actions={
            <Actions single>
              <KitButton onClick={handleClose}>Done</KitButton>
            </Actions>
          }
        >
          <p>Thank you. Your report has been sent to the BulkSkart team.</p>
          <p>
            Your reference: <b>{reference}</b>
          </p>
        </Done>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="fk-form fk-stack">
          <EntityCard fallbackIcon={Flag} name={targetTitle} byLabel="Reporting:" by={name} />

          <SectionTitle>What is wrong</SectionTitle>

          <Field htmlFor={`${ids}-reason`} label="Reason for reporting" required error={errors.reason}>
            <IconBox icon={ShieldAlert}>
              <NativeSelect
                id={`${ids}-reason`}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setErrors((prev) => ({ ...prev, reason: undefined }));
                }}
                invalid={Boolean(errors.reason)}
                iconPadding
              >
                <option value="">Select a reason…</option>
                {REPORT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </NativeSelect>
            </IconBox>
          </Field>

          <Field htmlFor={`${ids}-notes`} label="Details & Evidence" required error={errors.notes} hint="At least 10 characters.">
            <CountedTextArea
              id={`${ids}-notes`}
              icon={FileText}
              rows={4}
              maxLength={1000}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setErrors((prev) => ({ ...prev, notes: undefined }));
              }}
              placeholder="Please describe why this listing breaks BulkSkart policies (e.g. inaccurate specs, fake certification, price gouging)..."
              invalid={Boolean(errors.notes)}
            />
          </Field>

          {user ? (
            <Actions>
              <KitButton type="submit" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Flag aria-hidden="true" />}
                {loading ? 'Sending…' : 'Submit Report'}
              </KitButton>
              <KitButton variant="ghost" onClick={handleClose} disabled={loading}>
                Cancel
              </KitButton>
            </Actions>
          ) : (
            <>
              <p className="fk-note">Reports are sent from a BulkSkart account. Log in to send it here, or e-mail it to us.</p>
              <Actions>
                <Link to="/auth?tab=login" className="fk-btn is-primary">
                  <LogIn aria-hidden="true" /> Log in to report
                </Link>
                <a href={mailto} className="fk-btn is-ghost">
                  <Mail aria-hidden="true" /> E-mail it
                </a>
              </Actions>
            </>
          )}
        </form>
      )}
    </FormDialog>
  );
}

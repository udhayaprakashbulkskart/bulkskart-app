import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Building2, FileText, Globe2, Loader2, LogIn, Package, Send, Zap } from 'lucide-react';
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
  Stepper,
  type FormPoint,
} from '@/components/formkit';
import { normaliseUnit, unitsWith } from '@/components/formkit/units';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';

const COUNTRIES = ['India', 'UAE', 'USA', 'UK', 'Germany', 'Singapore', 'Australia', 'Canada', 'China', 'Japan', 'Other'];

const POINTS: FormPoint[] = [
  { icon: Zap, title: 'Quick to send', detail: 'Quantity, unit and country' },
  { icon: Building2, title: 'Goes to this supplier', detail: 'For this product only' },
  { icon: Package, title: 'Bulk & MOQ orders' },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  productId: string;
  productName: string;
  supplierCompanyId: string;
  supplierName: string;
  moq?: number;
  moqUnit?: string;
}

export default function InstantQuoteDialog({ open, onOpenChange, productId, productName, supplierCompanyId, supplierName, moq = 1, moqUnit = 'Pcs' }: Props) {
  const { user, profile } = useAuth();
  const ids = useId();
  const [qty, setQty] = useState(String(moq));
  const [unit, setUnit] = useState(normaliseUnit(moqUnit));
  const [country, setCountry] = useState('India');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please log in');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('instant_quote_requests').insert({
      product_id: productId,
      buyer_id: user.id,
      supplier_company_id: supplierCompanyId,
      quantity: parseInt(qty) || moq,
      quantity_unit: unit,
      destination_country: country,
      message: message.trim() || null,
      status: 'pending',
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDone(true);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setDone(false);
      setMessage('');
    }, 300);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
      busy={submitting}
      title={
        <>
          Instant <em>Quote Request</em>
        </>
      }
      description="Ask this supplier for a price on the quantity you need."
      points={POINTS}
      sheetArt="quote"
      width={980}
    >
      {!user || profile?.role !== 'buyer' ? (
        <div className="fk-done">
          <span className="fk-done-ico">
            <LogIn aria-hidden="true" />
          </span>
          <h3>Log in as a buyer</h3>
          <p>Quote requests are sent from a buyer account.</p>
          <Actions single>
            <Link to="/auth" className="fk-btn is-primary">
              Login / Register
            </Link>
          </Actions>
        </div>
      ) : done ? (
        <Done
          title="Quote request sent"
          actions={
            <Actions single>
              <KitButton onClick={handleClose}>Done</KitButton>
            </Actions>
          }
        >
          <p>
            Your request for <b>{productName}</b> is with <b>{supplierName}</b>.
          </p>
        </Done>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="fk-form fk-stack">
          <EntityCard fallbackIcon={Package} name={productName} by={supplierName} meta={moq > 1 ? [{ icon: Box, children: `MOQ: ${moq.toLocaleString('en-IN')} ${normaliseUnit(moqUnit)}` }] : []} />

          <SectionTitle>Your Requirement</SectionTitle>

          <div className="fk-grid is-keep">
            <Field htmlFor={`${ids}-qty`} label="Quantity" required>
              <Stepper id={`${ids}-qty`} value={qty} onChange={setQty} min={1} unitName={unit} required />
            </Field>
            <Field htmlFor={`${ids}-unit`} label="Unit">
              <IconBox icon={Box}>
                <NativeSelect id={`${ids}-unit`} value={unit} onChange={(e) => setUnit(e.target.value)} iconPadding>
                  {unitsWith(unit).map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </NativeSelect>
              </IconBox>
            </Field>
            <Field htmlFor={`${ids}-country`} label="Destination Country" wide>
              <IconBox icon={Globe2}>
                <NativeSelect id={`${ids}-country`} value={country} onChange={(e) => setCountry(e.target.value)} iconPadding>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </NativeSelect>
              </IconBox>
            </Field>
          </div>

          <Field htmlFor={`${ids}-message`} label="Additional Requirements" optional>
            <CountedTextArea
              id={`${ids}-message`}
              icon={FileText}
              rows={3}
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Custom color, branding, certification requirements, delivery timeline…"
            />
          </Field>

          <Actions>
            <KitButton type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              {submitting ? 'Sending…' : 'Send Quote Request'}
            </KitButton>
            <KitButton variant="ghost" onClick={handleClose} disabled={submitting}>
              Cancel
            </KitButton>
          </Actions>
        </form>
      )}
    </FormDialog>
  );
}

import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Info, Loader2, LogIn, MapPin, Package, Send, Truck } from 'lucide-react';
import { toast } from 'sonner';
import {
  Actions,
  Callout,
  CountedTextArea,
  Done,
  EntityCard,
  Field,
  FormDialog,
  KitButton,
  SectionTitle,
  Stepper,
  TextArea,
  type FormPoint,
} from '@/components/formkit';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';

const POINTS: FormPoint[] = [
  { icon: Package, title: 'Try it before bulk', detail: 'Usually 1 to 10 units' },
  { icon: Truck, title: 'Sent to your address' },
  { icon: Info, title: 'Costs set by the supplier', detail: 'Samples may or may not be free' },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  productId: string;
  productName: string;
  supplierCompanyId: string;
  supplierName: string;
  moqUnit?: string;
}

export default function SampleRequestDialog({ open, onOpenChange, productId, productName, supplierCompanyId, supplierName, moqUnit = 'Pcs' }: Props) {
  const { user, profile } = useAuth();
  const ids = useId();
  const [qty, setQty] = useState('1');
  const [purpose, setPurpose] = useState('');
  const [address, setAddress] = useState('');
  const [addressError, setAddressError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please log in to request a sample');
      return;
    }
    if (!address.trim()) {
      setAddressError('Shipping address is required');
      document.getElementById(`${ids}-address`)?.focus();
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('sample_requests').insert({
      product_id: productId,
      buyer_id: user.id,
      supplier_company_id: supplierCompanyId,
      quantity: parseInt(qty) || 1,
      purpose: purpose.trim() || null,
      shipping_address: address.trim(),
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
      setQty('1');
      setPurpose('');
      setAddress('');
      setAddressError('');
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
          Request a <em>Sample</em>
        </>
      }
      description="Check the quality before you place a bulk order."
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
          <p>Samples are requested from a buyer account.</p>
          <Actions single>
            <Link to="/auth" className="fk-btn is-primary">
              Login / Register
            </Link>
          </Actions>
        </div>
      ) : done ? (
        <Done
          title="Sample request sent"
          actions={
            <Actions single>
              <KitButton onClick={handleClose}>Close</KitButton>
            </Actions>
          }
        >
          <p>
            Your request is with <b>{supplierName}</b>. They will review it and reply to you.
          </p>
        </Done>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="fk-form fk-stack">
          <EntityCard fallbackIcon={Package} name={productName} by={supplierName} />

          <SectionTitle>Your Sample</SectionTitle>

          <div className="fk-grid is-one">
            <Field htmlFor={`${ids}-qty`} label={`Sample Quantity (${moqUnit})`} hint="Sample orders are typically 1–10 units.">
              <Stepper id={`${ids}-qty`} value={qty} onChange={setQty} min={1} max={10} unitName={moqUnit} describedBy={`${ids}-qty-hint`} />
            </Field>
          </div>

          <Field htmlFor={`${ids}-purpose`} label="Purpose / Intended Use" optional>
            <CountedTextArea
              id={`${ids}-purpose`}
              icon={ClipboardList}
              rows={2}
              maxLength={300}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Quality evaluation before bulk order of 500 units"
            />
          </Field>

          <Field htmlFor={`${ids}-address`} label="Shipping Address" required error={addressError}>
            <div className="fk-ctl has-ico is-area is-accent">
              <MapPin className="fk-ico" aria-hidden="true" />
              <TextArea
                id={`${ids}-address`}
                rows={3}
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  if (addressError) setAddressError('');
                }}
                placeholder="Full delivery address including city, state, PIN code and country"
                invalid={Boolean(addressError)}
                iconPadding
              />
            </div>
          </Field>

          <Callout icon={Info}>Sample pricing and shipping costs will be communicated by the supplier. Samples may or may not be free.</Callout>

          <Actions>
            <KitButton type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              {submitting ? 'Sending…' : 'Send Sample Request'}
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

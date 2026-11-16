/**
 * QuickQuoteModal
 *
 * "Request Quick Quote" for a product: the buyer says how much, at what price and where, the requirement is posted,
 * and when the product's supplier is known a direct chat with them opens straight after.
 */
import React, { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Box,
  ChevronDown,
  FileText,
  IndianRupee,
  Loader2,
  MapPin,
  MessageCircleMore,
  MessagesSquare,
  Package,
  Send,
  ShieldCheck,
  Star,
  Truck,
  Users,
  Zap,
} from 'lucide-react';
import type { DisplayProduct } from '@/components/home/FeaturedProductsSection';
import {
  Actions,
  CheckRow,
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
  TextInput,
  type EntityMeta,
  type FormPoint,
} from '@/components/formkit';
import { readMoq, unitsWith } from '@/components/formkit/units';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { createRequirement, getOrCreateConversation, sendMessage } from '@/lib/api';
import { CITY_NAMES } from '@/lib/signup/places';

interface Props {
  product: DisplayProduct | null;
  open: boolean;
  onClose: () => void;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REMARKS_MAX = 500;

/** The product's company, when it is a real one on the marketplace (sample listings have none). */
export function knownCompanyId(product: Pick<DisplayProduct, 'companyId'> | null): string | null {
  return product?.companyId && UUID.test(product.companyId) ? product.companyId : null;
}

export default function QuickQuoteModal({ product, open, onClose }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const ids = useId();

  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('Pcs');
  const [targetPrice, setTargetPrice] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [message, setMessage] = useState('');
  const [autoOpenChat, setAutoOpenChat] = useState(true);
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submittedReqId, setSubmittedReqId] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState('');

  const moq = useMemo(() => readMoq(product?.moq), [product?.moq]);
  const companyId = knownCompanyId(product);
  // a direct chat needs the real company behind the product
  const reachable = Boolean(companyId);
  const chatAfter = reachable && autoOpenChat;

  // Start from the product's minimum order whenever another product is opened
  useEffect(() => {
    setQuantity(moq.quantity ? String(moq.quantity) : '');
    setUnit(moq.unit);
    setTargetPrice('');
    setDestinationCity('');
    setMessage('');
    setQuantityError('');
    setSuccess(false);
    setSubmittedReqId(null);
  }, [product, moq.quantity, moq.unit]);

  if (!product) return null;

  const busy = loading || chatLoading;

  // The supplier behind the product: its owner is needed to start a chat. No guessing by name.
  const resolveSupplier = async (): Promise<{ supplierOwnerId: string; companyId: string } | null> => {
    if (!companyId) return null;
    if (product.supplierOwnerId) return { supplierOwnerId: product.supplierOwnerId, companyId };
    const { data } = await supabase.from('companies').select('id, owner_id').eq('id', companyId).maybeSingle();
    return data?.owner_id ? { supplierOwnerId: data.owner_id as string, companyId } : null;
  };

  // Open direct chat with the supplier
  const handleOpenDirectChat = async (requirementId?: string | null) => {
    if (!user) {
      navigate('/auth?tab=register&redirect=/messages');
      return;
    }

    setChatLoading(true);
    try {
      const supplier = await resolveSupplier();
      if (!supplier) {
        toast.error('This supplier cannot be messaged directly yet. Your requirement is posted for matching suppliers.');
        return;
      }

      if (user.id === supplier.supplierOwnerId) {
        toast.info('This product is listed by your own account.');
        return;
      }

      const reqId = requirementId || submittedReqId || undefined;
      const conv = await getOrCreateConversation(user.id, supplier.supplierOwnerId, supplier.companyId, reqId);

      if (conv?.id) {
        const initialText = `Hello ${product.supplierName},\n\nI have submitted a quotation inquiry for "${product.name}".\n• Quantity: ${quantity || moq.quantity || 1} ${unit}\n${targetPrice ? `• Target Price: ₹${targetPrice} per unit\n` : ''}${destinationCity ? `• Destination: ${destinationCity}\n` : ''}${message ? `• Requirements: ${message}\n` : ''}\nPlease let me know your best pricing and lead time.`;
        await sendMessage(conv.id, initialText).catch(() => null);
        toast.success(`Direct chat with ${product.supplierName} opened!`);
        onClose();
        navigate(`/messages?conversation=${conv.id}`);
      } else {
        toast.error('Could not open the chat. Taking you to your messages.');
        onClose();
        navigate('/messages');
      }
    } catch (err) {
      console.error('Failed to open direct chat:', err);
      toast.error('Could not open the chat. Please try from your messages.');
      navigate('/messages');
    } finally {
      setChatLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.info('Please log in or register to submit a quote request.');
      navigate('/auth?tab=register');
      return;
    }

    if (!quantity || !(Number(quantity) > 0)) {
      setQuantityError('Please enter how many you need.');
      document.getElementById(`${ids}-qty`)?.focus();
      return;
    }
    setQuantityError('');

    setLoading(true);
    try {
      const payload = {
        buyer_id: user.id,
        title: `RFQ for ${product.name}`,
        description:
          message ||
          `Looking for quotation for ${product.name} with quantity ${quantity} ${unit}. Please provide your best bulk price and delivery lead time.`,
        specifications: `Target Product: ${product.name}\nQuantity: ${quantity} ${unit}\nDestination: ${destinationCity || 'Global'}\nTarget Price: ${targetPrice || 'Negotiable'}`,
        quantity: Number(quantity),
        quantity_unit: unit,
        destination_country: 'India',
        destination_city: destinationCity || null,
        target_price: targetPrice ? Number(targetPrice) : null,
        status: 'active' as const,
        currency: 'INR',
      };

      const res = await createRequirement(payload);
      if (res.error) {
        toast.error(`Failed to submit quote request: ${res.error}`);
      } else {
        const newReqId = res.id ?? null;
        setSubmittedReqId(newReqId);

        if (chatAfter) {
          toast.success(`Quote submitted! Connecting to ${product.supplierName}...`);
          await handleOpenDirectChat(newReqId);
        } else {
          setSuccess(true);
          toast.success(`Quote request for ${product.name} submitted successfully!`);
        }
      }
    } catch (err) {
      console.error('QuickQuote submit error:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Only what is known about the product and its supplier is shown
  const meta: EntityMeta[] = [];
  if (moq.quantity) meta.push({ icon: Box, children: `MOQ: ${moq.quantity.toLocaleString('en-IN')} ${moq.unit}` });
  if (reachable && product.isVerifiedSupplier) meta.push({ icon: ShieldCheck, children: 'Verified Supplier' });
  if (reachable && product.reviewCount > 0 && product.rating > 0) {
    meta.push({
      icon: Star,
      star: true,
      children: (
        <>
          <b>{product.rating.toFixed(1)}</b> <small>({product.reviewCount.toLocaleString('en-IN')} Reviews)</small>
        </>
      ),
    });
  }

  const points: FormPoint[] = [
    { icon: Zap, title: 'Quick to send', detail: 'Quantity, price and city' },
    reachable
      ? { icon: MessagesSquare, title: 'Chat with the supplier', detail: 'Opens as soon as you send' }
      : { icon: Users, title: 'Goes to matching suppliers', detail: 'Those who make this product' },
    { icon: Package, title: 'Bulk & MOQ orders' },
    { icon: Truck, title: 'Quotes for your city' },
  ];

  const belowMoq = moq.quantity && Number(quantity) > 0 && Number(quantity) < moq.quantity;

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      busy={busy}
      title={
        <>
          Request <em>Quick Quote</em>
        </>
      }
      description="Tell the supplier what you need and get a price for your quantity."
      points={points}
      sheetArt="quote"
    >
      {success ? (
        <Done
          title="Quote request sent"
          actions={
            <Actions single={!reachable}>
              {reachable && (
                <KitButton onClick={() => handleOpenDirectChat(submittedReqId)} disabled={chatLoading}>
                  {chatLoading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <MessageCircleMore aria-hidden="true" />}
                  Chat with {product.supplierName}
                </KitButton>
              )}
              <KitButton
                variant="ghost"
                onClick={() => {
                  onClose();
                  navigate('/buyer/requirements');
                }}
              >
                View my requirements
              </KitButton>
            </Actions>
          }
        >
          <p>
            Your requirement for <b>{product.name}</b> is posted.{' '}
            {reachable ? 'You can chat with the supplier about price and delivery now.' : 'Suppliers who make this product can send you quotes.'}
          </p>
        </Done>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="fk-form fk-stack">
          <EntityCard
            image={product.img}
            fallbackIcon={Package}
            name={product.name}
            by={product.supplierName}
            verified={reachable && product.isVerifiedSupplier}
            meta={meta}
          />

          <SectionTitle>Your Requirement</SectionTitle>

          <div className="fk-grid is-keep">
            <Field htmlFor={`${ids}-qty`} label="Required Quantity" required error={quantityError} hint={belowMoq ? `Below this supplier's minimum order (${moq.quantity} ${moq.unit}).` : undefined}>
              <Stepper
                id={`${ids}-qty`}
                value={quantity}
                onChange={(value) => {
                  setQuantity(value);
                  if (quantityError) setQuantityError('');
                }}
                min={1}
                unitName={unit}
                required
                invalid={Boolean(quantityError)}
                describedBy={quantityError ? `${ids}-qty-error` : belowMoq ? `${ids}-qty-hint` : undefined}
              />
            </Field>
            <Field htmlFor={`${ids}-unit`} label="Unit" required>
              <IconBox icon={Box}>
                <NativeSelect id={`${ids}-unit`} value={unit} onChange={(event) => setUnit(event.target.value)} iconPadding>
                  {unitsWith(unit).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </NativeSelect>
              </IconBox>
            </Field>
            <Field htmlFor={`${ids}-price`} label="Target Price (Per Unit)">
              <IconBox icon={IndianRupee} accent>
                <TextInput
                  id={`${ids}-price`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={targetPrice}
                  onChange={(event) => setTargetPrice(event.target.value)}
                  placeholder="e.g. 2,000"
                  iconPadding
                />
              </IconBox>
            </Field>
            <Field htmlFor={`${ids}-city`} label="Delivery City">
              <IconBox icon={MapPin} accent trailing={ChevronDown}>
                <TextInput
                  id={`${ids}-city`}
                  list={`${ids}-cities`}
                  value={destinationCity}
                  onChange={(event) => setDestinationCity(event.target.value)}
                  placeholder="e.g. Mumbai"
                  autoComplete="address-level2"
                  iconPadding
                  className="min-[900px]:pr-11"
                />
              </IconBox>
              <datalist id={`${ids}-cities`}>
                {CITY_NAMES.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            </Field>
          </div>

          <Field htmlFor={`${ids}-remarks`} label="Requirement Details / Remarks">
            <CountedTextArea
              id={`${ids}-remarks`}
              icon={FileText}
              rows={3}
              maxLength={REMARKS_MAX}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Specify customizations, packaging preferences, certification needs, or delivery timelines..."
            />
          </Field>

          {reachable && (
            <CheckRow id={`${ids}-chat`} checked={autoOpenChat} onCheckedChange={setAutoOpenChat} icon={MessageCircleMore}>
              Open direct chat with supplier immediately after submit
            </CheckRow>
          )}

          <Actions>
            <KitButton type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              {chatAfter ? 'Submit & Chat Now' : 'Submit Requirement'}
            </KitButton>
            <KitButton variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </KitButton>
          </Actions>
        </form>
      )}
    </FormDialog>
  );
}

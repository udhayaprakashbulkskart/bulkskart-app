import React, { useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Building2, Clock, CreditCard, FileText, Flame, Globe2, Hash, Layers, ListChecks, Loader2, LogIn, MapPin, Receipt, ShieldCheck, Tag, Timer, TrendingUp, Truck, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { SUPPORTED_COUNTRIES, calculateSubscriptionBill } from '@/lib/countryTaxConfig';
import { SUPPORT_EMAIL } from '@/lib/supportContact';
import MultiImageUploader from '@/components/common/MultiImageUploader';
import {
  Actions,
  Callout,
  CountedTextArea,
  Done,
  Field,
  FormDialog,
  IconBox,
  KitButton,
  NativeSelect,
  SectionTitle,
  Stepper,
  TextInput,
  optionsWith,
  type FormPoint,
} from '@/components/formkit';

interface CreateReverseAuctionDialogProps {
  /** kept for older callers; the dialog is opened with `open` */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: (auctionId: string) => void;
  initialData?: {
    title?: string;
    category?: string;
    description?: string;
    total_quantity?: number;
    quantity_unit?: string;
    starting_price?: number;
    reserve_price?: number;
    min_bid_increment?: number;
    delivery_location?: string;
  };
}

const CATEGORIES = [
  'Electrical & Cable',
  'Textiles & Yarn',
  'Metals & Mining',
  'Plastics & Polymers',
  'Chemicals & Solvents',
  'Industrial Machinery',
  'Packaging Materials',
  'Construction & Building',
];
const UNITS = ['Pieces / Units', 'Metre (m)', 'Kilograms (kg)', 'Metric Tonnes (MT)', 'Barrels'];
const DISPATCH = [
  { value: 'Ready for Immediate Dispatch', label: 'Ready for immediate dispatch (24h)' },
  { value: 'Ready within 48 Hours', label: 'Ready within 48 hours' },
  { value: 'Ready within 3 to 5 Days', label: 'Ready within 3 to 5 days' },
];

const POINTS: FormPoint[] = [
  { icon: Flame, title: 'Sell a bulk lot fast', detail: '24-hour or 60-minute bidding' },
  { icon: ShieldCheck, title: 'Anti-sniping built in', detail: 'A late bid adds 2 minutes' },
  { icon: Receipt, title: 'One posting fee', detail: 'Shown with tax before you pay' },
];

// Helper to load Razorpay Checkout JS dynamically
function loadRazorpaySdk(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

type Errors = Partial<Record<'title' | 'quantity' | 'start' | 'reserve' | 'billingName' | 'taxId', string>>;

/**
 * Post a bulk lot for timed bidding: the lot, then the posting fee and billing details, then payment through Razorpay.
 * The auction is published only after a payment comes back, and only a saved auction is shown as live.
 */
export default function CreateReverseAuctionDialog({ open: controlledOpen, onOpenChange: setControlledOpen, onSuccess, initialData }: CreateReverseAuctionDialogProps) {
  const { user, company } = useAuth();
  const navigate = useNavigate();
  const ids = useId();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (isControlled) setControlledOpen?.(val);
    else setInternalOpen(val);
  };

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  // the lot
  const [title, setTitle] = useState(initialData?.title || '');
  const [category, setCategory] = useState(initialData?.category || CATEGORIES[0]);
  const [auctionDuration, setAuctionDuration] = useState<'24h' | '60m'>('24h');
  const [totalQuantity, setTotalQuantity] = useState(initialData?.total_quantity ? String(initialData.total_quantity) : '');
  const [quantityUnit, setQuantityUnit] = useState(initialData?.quantity_unit || UNITS[0]);
  const [startingPrice, setStartingPrice] = useState(initialData?.starting_price ? String(initialData.starting_price) : '');
  const [reservePrice, setReservePrice] = useState(initialData?.reserve_price ? String(initialData.reserve_price) : '');
  const [minBidIncrement, setMinBidIncrement] = useState(initialData?.min_bid_increment ? String(initialData.min_bid_increment) : '2');
  const [deliveryLocation, setDeliveryLocation] = useState(initialData?.delivery_location || '');
  const [leadTime, setLeadTime] = useState(DISPATCH[0].value);
  const [description, setDescription] = useState(initialData?.description || '');
  const [specs, setSpecs] = useState('');
  const [lotImages, setLotImages] = useState<string[]>([]);

  useEffect(() => {
    if (initialData) {
      if (initialData.title) setTitle(initialData.title);
      if (initialData.category) setCategory(initialData.category);
      if (initialData.description) setDescription(initialData.description);
      if (initialData.total_quantity) setTotalQuantity(String(initialData.total_quantity));
      if (initialData.quantity_unit) setQuantityUnit(initialData.quantity_unit);
      if (initialData.starting_price) setStartingPrice(String(initialData.starting_price));
      if (initialData.reserve_price) setReservePrice(String(initialData.reserve_price));
      if (initialData.min_bid_increment) setMinBidIncrement(String(initialData.min_bid_increment));
      if (initialData.delivery_location) setDeliveryLocation(initialData.delivery_location);
    }
  }, [initialData]);

  // billing: started from the seller's own company profile
  const [selectedCountryCode, setSelectedCountryCode] = useState('IN');
  const [companyBillingName, setCompanyBillingName] = useState('');
  const [taxIdGstin, setTaxIdGstin] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  useEffect(() => {
    if (!company) return;
    setCompanyBillingName((prev) => prev || company.company_name || '');
    setTaxIdGstin((prev) => prev || company.gst_number || '');
    setBillingAddress((prev) => prev || company.address || '');
  }, [company]);

  // the result
  const [createdAuctionId, setCreatedAuctionId] = useState('');
  const [paymentReferenceId, setPaymentReferenceId] = useState('');
  const [publishFailed, setPublishFailed] = useState(false);

  const bill = calculateSubscriptionBill(selectedCountryCode);
  const paysOnline = selectedCountryCode === 'IN';

  useEffect(() => {
    loadRazorpaySdk();
  }, []);

  // start again after a finished posting
  useEffect(() => {
    if (open && currentStep === 3) {
      setCurrentStep(1);
      setPublishFailed(false);
      setCreatedAuctionId('');
      setPaymentReferenceId('');
    }
    // only when the dialog is opened again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const clear = (key: keyof Errors) => setErrors((prev) => ({ ...prev, [key]: undefined }));
  const focusFirst = (found: Errors, order: Array<keyof Errors>) => {
    const first = order.find((key) => found[key]);
    if (first) document.getElementById(`${ids}-${first}`)?.focus();
    return Boolean(first);
  };

  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const found: Errors = {};
    const qty = parseInt(totalQuantity, 10);
    const startP = parseFloat(startingPrice);
    if (!title.trim()) found.title = 'Please enter a title for the lot.';
    if (!qty || qty <= 0) found.quantity = 'Please enter the quantity in the lot.';
    if (!startP || startP <= 0) found.start = 'Please enter a starting price greater than 0.';
    else if (reservePrice && parseFloat(reservePrice) < startP) found.reserve = 'The reserve price cannot be lower than the starting price.';
    setErrors(found);
    if (focusFirst(found, ['title', 'quantity', 'start', 'reserve'])) return;
    setCurrentStep(2);
  };

  const publishAuctionToDatabase = async (paymentRef: string) => {
    const now = new Date();
    const durationHours = auctionDuration === '24h' ? 24 : 1;
    const endTime = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
    const auctionNumber = `BS-REV-${Math.floor(1000 + Math.random() * 9000)}`;
    const qty = parseInt(totalQuantity, 10);
    const startP = parseFloat(startingPrice);

    const auctionData = {
      auction_number: auctionNumber,
      auction_type: 'reverse',
      title: title.trim(),
      description: description.trim() || `Bulk lot of ${qty} ${quantityUnit} for ${auctionDuration === '24h' ? '24-hour' : '60-minute'} bidding.`,
      total_quantity: qty,
      moq: Math.max(1, Math.floor(qty * 0.1)),
      quantity_unit: quantityUnit,
      starting_price: startP,
      reserve_price: reservePrice ? parseFloat(reservePrice) : startP,
      min_bid_increment: parseFloat(minBidIncrement) || 2,
      current_highest_bid: startP,
      total_bids: 0,
      currency: bill.country.currency,
      duration_minutes: durationHours * 60,
      start_time: now.toISOString(),
      end_time: endTime.toISOString(),
      anti_sniping_enabled: true,
      anti_sniping_trigger_seconds: 120,
      anti_sniping_extend_seconds: 120,
      status: 'live',
      delivery_location: deliveryLocation.trim() || null,
      freight_terms: leadTime,
      seller_id: user?.id || null,
      specifications: {
        'Lot Quantity': `${qty} ${quantityUnit}`,
        ...(specs.trim() ? { 'Specs Note': specs.trim() } : {}),
        'Auction Window': auctionDuration === '24h' ? '24-Hour Bidding' : '60-Minute Bidding',
        'Dispatch Time': leadTime,
        'Posting Fee Paid': `${bill.formattedTotal} (${bill.country.name}, incl. ${bill.country.taxName})`,
        'Payment Ref': paymentRef,
        'Seller Billing Name': companyBillingName.trim(),
        'Tax ID / GSTIN': taxIdGstin.trim(),
      },
      images: lotImages,
    };

    const { data, error } = await supabase.from('auctions').insert(auctionData).select('id').single();
    setPaymentReferenceId(paymentRef);
    setCurrentStep(3);
    if (error || !data?.id) {
      console.error('Auction creation error:', error);
      setPublishFailed(true);
      return;
    }
    setCreatedAuctionId(data.id);
    toast.success('Payment received. Your auction is live.');
    onSuccess?.(data.id);
  };

  const handlePayAndLaunchAuction = async () => {
    if (!user) return;
    const found: Errors = {};
    if (!companyBillingName.trim()) found.billingName = 'Please enter the company name for the invoice.';
    if (!taxIdGstin.trim()) found.taxId = 'Please enter your GSTIN or tax number.';
    setErrors(found);
    if (focusFirst(found, ['billingName', 'taxId'])) return;
    if (!paysOnline) return;

    setLoading(true);
    try {
      const sdkReady = await loadRazorpaySdk();
      if (!sdkReady || !(window as any).Razorpay) {
        setLoading(false);
        toast.error('The payment window could not be loaded. Please check your connection and try again.');
        return;
      }
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TZ1W7USRc0Injp',
        amount: Math.round(bill.totalAmount * 100),
        currency: 'INR',
        name: 'BulkSkart B2B Marketplace',
        description: `Auction posting fee (${bill.formattedTotal})`,
        image: '/brand/bulkskart-icon.png',
        prefill: {
          name: companyBillingName.trim() || (user.user_metadata as any)?.full_name || '',
          email: user.email || '',
          contact: user.phone || (user.user_metadata as any)?.phone || '',
        },
        notes: {
          service: 'auction-posting-fee',
          base_fee: String(bill.baseFee),
          tax_amount: String(bill.taxAmount),
          total_fee: String(bill.totalAmount),
          lot_title: title.substring(0, 40),
        },
        theme: { color: '#FF5A1F' },
        handler: async (response: any) => {
          const payId = response?.razorpay_payment_id;
          if (!payId) {
            setLoading(false);
            toast.error('The payment did not complete. You have not been charged for this auction.');
            return;
          }
          await publishAuctionToDatabase(payId);
          setLoading(false);
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            toast.info('Payment window closed. Your auction has not been posted yet.');
          },
        },
      };
      const rzpInstance = new (window as any).Razorpay(options);
      rzpInstance.on('payment.failed', (resp: any) => {
        setLoading(false);
        toast.error(`Payment failed: ${resp.error?.description || 'Transaction declined'}`);
      });
      rzpInstance.open();
    } catch (err: any) {
      toast.error(`Payment could not start: ${err?.message || 'please try again'}`);
      setLoading(false);
    }
  };

  const qtyNumber = parseInt(totalQuantity, 10) || 0;

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!loading) setOpen(next);
      }}
      busy={loading}
      title={
        currentStep === 1 ? (
          <>
            Sell a <em>Bulk Lot</em>
          </>
        ) : currentStep === 2 ? (
          <>
            Posting Fee & <em>Billing</em>
          </>
        ) : publishFailed ? (
          <>
            Auction <em>Not Posted</em>
          </>
        ) : (
          <>
            Auction <em>Live</em>
          </>
        )
      }
      description={
        currentStep === 1
          ? 'Step 1 of 2: the lot buyers will bid on.'
          : currentStep === 2
            ? `Step 2 of 2: a fixed posting fee of ${bill.formattedBase} plus ${bill.country.taxName}.`
            : undefined
      }
      points={POINTS}
      width={1080}
    >
      {currentStep === 3 ? (
        publishFailed ? (
          <div className="fk-done" role="alert">
            <span className="fk-done-ico">
              <AlertTriangle aria-hidden="true" />
            </span>
            <h3>Your payment went through, but the auction was not posted</h3>
            <p>
              Please write to <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Auction not posted: ${paymentReferenceId}`)}`}>{SUPPORT_EMAIL}</a> with your payment reference{' '}
              <b>{paymentReferenceId}</b> so the team can sort it out.
            </p>
            <Actions single>
              <KitButton onClick={() => setOpen(false)}>Close</KitButton>
            </Actions>
          </div>
        ) : (
          <Done
            title="Payment received. Your auction is live."
            actions={
              <Actions>
                <KitButton
                  onClick={() => {
                    setOpen(false);
                    navigate(`/auctions/reverse/${createdAuctionId}`);
                  }}
                >
                  Open the Auction <ArrowRight aria-hidden="true" />
                </KitButton>
                <KitButton variant="ghost" onClick={() => setOpen(false)}>
                  Close
                </KitButton>
              </Actions>
            }
          >
            <p>
              <b>{title.trim()}</b> is open for bidding for {auctionDuration === '24h' ? '24 hours' : '60 minutes'}.
            </p>
            <p>
              Fee paid: <b>{bill.formattedTotal}</b> · Payment reference <b>{paymentReferenceId}</b>. Keep it for your records.
            </p>
          </Done>
        )
      ) : currentStep === 1 ? (
        <form onSubmit={handleProceedToPayment} noValidate className="fk-form fk-stack">
          <SectionTitle>The Lot</SectionTitle>
          <Field htmlFor={`${ids}-title`} label="Lot Title" required error={errors.title}>
            <IconBox icon={Tag}>
              <TextInput
                id={`${ids}-title`}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  clear('title');
                }}
                placeholder="e.g. Pure Copper Wire 2.5mm Industrial Grade (surplus lot)"
                invalid={Boolean(errors.title)}
                iconPadding
              />
            </IconBox>
          </Field>
          <div className="fk-grid">
            <Field htmlFor={`${ids}-category`} label="Category">
              <IconBox icon={Layers}>
                <NativeSelect id={`${ids}-category`} value={category} onChange={(e) => setCategory(e.target.value)} iconPadding>
                  {optionsWith(CATEGORIES, category).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </NativeSelect>
              </IconBox>
            </Field>
            <Field htmlFor={`${ids}-dispatch`} label="Dispatch Time">
              <IconBox icon={Truck}>
                <NativeSelect id={`${ids}-dispatch`} value={leadTime} onChange={(e) => setLeadTime(e.target.value)} iconPadding>
                  {DISPATCH.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </NativeSelect>
              </IconBox>
            </Field>
            <Field htmlFor={`${ids}-quantity`} label="Quantity in the Lot" required error={errors.quantity}>
              <Stepper
                id={`${ids}-quantity`}
                value={totalQuantity}
                onChange={(value) => {
                  setTotalQuantity(value);
                  clear('quantity');
                }}
                min={1}
                unitName={quantityUnit}
                invalid={Boolean(errors.quantity)}
                required
              />
            </Field>
            <Field htmlFor={`${ids}-unit`} label="Unit">
              <IconBox icon={Hash}>
                <NativeSelect id={`${ids}-unit`} value={quantityUnit} onChange={(e) => setQuantityUnit(e.target.value)} iconPadding>
                  {optionsWith(UNITS, quantityUnit).map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </NativeSelect>
              </IconBox>
            </Field>
          </div>

          <SectionTitle>Bidding</SectionTitle>
          <div className="fk-grid">
            <Field htmlFor={`${ids}-start`} label="Starting Price (₹ per unit)" required error={errors.start} hint="The opening bid.">
              <IconBox icon={Wallet} accent>
                <TextInput
                  id={`${ids}-start`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={startingPrice}
                  onChange={(e) => {
                    setStartingPrice(e.target.value);
                    clear('start');
                  }}
                  placeholder="e.g. 140"
                  invalid={Boolean(errors.start)}
                  iconPadding
                />
              </IconBox>
            </Field>
            <Field htmlFor={`${ids}-reserve`} label="Reserve Price (₹ per unit)" optional error={errors.reserve} hint="The lowest price you will sell at.">
              <IconBox icon={TrendingUp}>
                <TextInput
                  id={`${ids}-reserve`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={reservePrice}
                  onChange={(e) => {
                    setReservePrice(e.target.value);
                    clear('reserve');
                  }}
                  placeholder="e.g. 165"
                  invalid={Boolean(errors.reserve)}
                  iconPadding
                />
              </IconBox>
            </Field>
            <div className="fk-field">
              <span className="text-[0.93rem] font-bold leading-tight text-foreground" id={`${ids}-window-label`}>
                Bidding Window
              </span>
              <div className="fk-segment" role="group" aria-labelledby={`${ids}-window-label`}>
                <button type="button" className="is-add" aria-pressed={auctionDuration === '24h'} onClick={() => setAuctionDuration('24h')}>
                  <Clock aria-hidden="true" /> 24 hours
                </button>
                <button type="button" className="is-add" aria-pressed={auctionDuration === '60m'} onClick={() => setAuctionDuration('60m')}>
                  <Timer aria-hidden="true" /> 60 minutes
                </button>
              </div>
            </div>
            <Field htmlFor={`${ids}-increment`} label="Minimum Bid Step (₹)">
              <IconBox icon={TrendingUp}>
                <TextInput id={`${ids}-increment`} type="number" inputMode="decimal" min="0" step="any" value={minBidIncrement} onChange={(e) => setMinBidIncrement(e.target.value)} iconPadding />
              </IconBox>
            </Field>
          </div>

          <SectionTitle>Details</SectionTitle>
          <div className="fk-grid">
            <Field htmlFor={`${ids}-location`} label="Factory / Delivery Location" optional>
              <IconBox icon={MapPin} accent>
                <TextInput id={`${ids}-location`} value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} placeholder="e.g. Ahmedabad, Gujarat" iconPadding />
              </IconBox>
            </Field>
            <Field htmlFor={`${ids}-specs`} label="Grade & Test Specs" optional>
              <IconBox icon={ListChecks}>
                <TextInput id={`${ids}-specs`} value={specs} onChange={(e) => setSpecs(e.target.value)} placeholder="e.g. Purity 99.9%, commercial grade" iconPadding />
              </IconBox>
            </Field>
          </div>
          <Field htmlFor={`${ids}-description`} label="Description & Packing" optional>
            <CountedTextArea
              id={`${ids}-description`}
              icon={FileText}
              rows={3}
              maxLength={1500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Certification, packing, inspection details…"
            />
          </Field>
          <MultiImageUploader
            images={lotImages}
            onChange={setLotImages}
            maxImages={6}
            label="Lot Photos"
            description="Photos of the real lot help buyers bid with confidence."
            folder="auctions"
            defaultSearchTerm={title || category}
            defaultCategory={category}
          />

          <Callout icon={ShieldCheck}>A bid in the last 2 minutes adds 2 more minutes, so nobody can win by bidding at the last second.</Callout>

          <Actions>
            <KitButton type="submit">
              Continue to Fee & Billing <ArrowRight aria-hidden="true" />
            </KitButton>
            <KitButton variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </KitButton>
          </Actions>
        </form>
      ) : (
        <div className="fk-form fk-stack">
          <SectionTitle>Posting Fee</SectionTitle>
          <dl className="fk-summary">
            <div>
              <dt>
                {qtyNumber > 0 ? `${qtyNumber.toLocaleString('en-IN')} ${quantityUnit} · ` : ''}
                {auctionDuration === '24h' ? '24-hour' : '60-minute'} auction
              </dt>
              <dd>{bill.formattedBase}</dd>
            </div>
            <div>
              <dt>{bill.country.taxName}</dt>
              <dd>{bill.formattedTax}</dd>
            </div>
            <div className="is-total">
              <dt>Total to pay</dt>
              <dd>{bill.formattedTotal}</dd>
            </div>
          </dl>

          {!user ? (
            <>
              <Callout icon={LogIn}>Log in to your BulkSkart account to pay and post the auction. What you entered stays here.</Callout>
              <Actions>
                <Link to={`/login?returnUrl=${encodeURIComponent(window.location.pathname)}`} className="fk-btn is-primary">
                  <LogIn aria-hidden="true" /> Log In
                </Link>
                <KitButton variant="ghost" onClick={() => setCurrentStep(1)}>
                  Back
                </KitButton>
              </Actions>
            </>
          ) : (
            <>
              <SectionTitle>Billing Details</SectionTitle>
              <Field htmlFor={`${ids}-country`} label="Billing Country">
                <IconBox icon={Globe2}>
                  <NativeSelect id={`${ids}-country`} value={selectedCountryCode} onChange={(e) => setSelectedCountryCode(e.target.value)} iconPadding>
                    {SUPPORTED_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name} — {c.currency} ({c.taxName})
                      </option>
                    ))}
                  </NativeSelect>
                </IconBox>
              </Field>
              <div className="fk-grid">
                <Field htmlFor={`${ids}-billingName`} label="Company Name" required error={errors.billingName}>
                  <IconBox icon={Building2}>
                    <TextInput
                      id={`${ids}-billingName`}
                      value={companyBillingName}
                      onChange={(e) => {
                        setCompanyBillingName(e.target.value);
                        clear('billingName');
                      }}
                      invalid={Boolean(errors.billingName)}
                      autoComplete="organization"
                      iconPadding
                    />
                  </IconBox>
                </Field>
                <Field htmlFor={`${ids}-taxId`} label={selectedCountryCode === 'IN' ? 'GSTIN' : 'Tax / VAT Number'} required error={errors.taxId}>
                  <IconBox icon={Receipt}>
                    <TextInput
                      id={`${ids}-taxId`}
                      value={taxIdGstin}
                      onChange={(e) => {
                        setTaxIdGstin(e.target.value);
                        clear('taxId');
                      }}
                      placeholder={selectedCountryCode === 'IN' ? '15-character GSTIN' : 'VAT or tax number'}
                      invalid={Boolean(errors.taxId)}
                      iconPadding
                    />
                  </IconBox>
                </Field>
                <Field htmlFor={`${ids}-address`} label="Billing Address" optional wide>
                  <IconBox icon={MapPin}>
                    <TextInput id={`${ids}-address`} value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} placeholder="Street, city, state, PIN code" autoComplete="street-address" iconPadding />
                  </IconBox>
                </Field>
              </div>

              {paysOnline ? (
                <Callout icon={CreditCard}>You will pay securely with Razorpay (UPI, cards or net banking). The auction goes live as soon as the payment comes through.</Callout>
              ) : (
                <Callout icon={Globe2}>
                  Online payment is available for Indian billing (INR) right now. To post an auction from {bill.country.name}, write to{' '}
                  <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Posting an auction from ' + bill.country.name)}`}>{SUPPORT_EMAIL}</a>.
                </Callout>
              )}

              <Actions>
                <KitButton onClick={handlePayAndLaunchAuction} disabled={loading || !paysOnline}>
                  {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CreditCard aria-hidden="true" />}
                  {loading ? 'Opening payment…' : `Pay ${bill.formattedTotal} & Post`}
                </KitButton>
                <KitButton variant="ghost" onClick={() => setCurrentStep(1)} disabled={loading}>
                  Back
                </KitButton>
              </Actions>
            </>
          )}
        </div>
      )}
    </FormDialog>
  );
}

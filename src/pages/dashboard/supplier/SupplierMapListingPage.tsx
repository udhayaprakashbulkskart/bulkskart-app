/**
 * Manufacturer: get on the Live Verified Supplier Map.
 * 1. Business registration application (legal details + documents) -> admin checks it on the government portals.
 * 2. Factory location pin (the registered factory, not anyone's live position) -> admin checks it.
 * 3. Availability (capacity, stock, lead time), shown with the date it was last updated.
 * The checklist at the top is supplier_map_status() from the database: the same rules the map uses.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, BadgeCheck, Building2, CheckCircle2, Circle, Clock3, ExternalLink, FileText, Loader2, MapPin, Package,
  RefreshCw, Save, Send, ShieldAlert, Trash2, Upload, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PageMeta from '@/components/common/PageMeta';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/db/supabase';
import {
  myMapStatus, saveFactoryLocation, openPrivateDocument, submitBusinessVerification, updateAvailability,
  uploadVerificationDocument,
} from '@/lib/supplierMap/api';
import { docPathFromUrl } from '@/lib/supplierMap/docPath';
import { COUNTRY_NAMES, findPlace, PLACES, placeLabel, searchPlaces } from '@/lib/supplierMap/places';
import { ENTITY_TYPES, isForeign, isIncorporated, mapDbError, normalise, validateApplication } from '@/lib/supplierMap/registration';
import { timeAgo } from '@/lib/supplierMap/matchScore';
import type { BusinessStatus, EntityType, MyMapStatus, StockStatus, SupplyType, VerificationDocument } from '@/lib/supplierMap/types';
import { cn } from '@/lib/utils';

const LocationPickerMap = lazy(() => import('@/components/supplierMap/LocationPickerMap'));

const DOC_KINDS: { value: VerificationDocument['kind']; label: string }[] = [
  { value: 'gst', label: 'GST registration certificate' },
  { value: 'incorporation', label: 'Certificate of incorporation or business licence' },
  { value: 'udyam', label: 'Udyam registration certificate' },
  { value: 'partnership_deed', label: 'Partnership deed' },
  { value: 'factory', label: 'Factory licence or address proof' },
  { value: 'other', label: 'Other registration document' },
];
const UNITS = ['pcs', 'kg', 'tonnes', 'metres', 'litres', 'sets', 'boxes', 'units'];
const STOCK: { value: StockStatus; label: string }[] = [
  { value: 'in_stock', label: 'In stock, ready to ship' },
  { value: 'limited', label: 'Limited stock' },
  { value: 'made_to_order', label: 'Made to order' },
  { value: 'out_of_stock', label: 'Out of stock for now' },
];
const SUPPLY: { value: SupplyType; label: string }[] = [
  { value: 'bulk', label: 'Bulk orders' },
  { value: 'contract', label: 'Contract manufacturing' },
  { value: 'bulk_contract', label: 'Bulk and contract' },
  { value: 'export', label: 'Export orders' },
];

const BUSINESS_STATUS: Record<BusinessStatus, { label: string; tone: string }> = {
  pending: { label: 'Waiting for review', tone: 'bg-orange-500/12 text-orange-600 dark:text-orange-400' },
  needs_info: { label: 'More information needed', tone: 'bg-orange-500/12 text-orange-600 dark:text-orange-400' },
  approved: { label: 'Approved', tone: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' },
  rejected: { label: 'Rejected', tone: 'bg-red-500/12 text-red-600 dark:text-red-400' },
  suspended: { label: 'Suspended', tone: 'bg-red-500/12 text-red-600 dark:text-red-400' },
};

const field = 'mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-[14px] outline-none focus:border-[#FF5A00]';

export default function SupplierMapListingPage() {
  const { user, profile, company } = useAuth();
  const { theme } = useTheme();
  const [status, setStatus] = useState<MyMapStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // registration
  const [app, setApp] = useState({
    entity_type: '' as EntityType | '', legal_name: '', cin_llpin: '', gstin: '', udyam_number: '', registration_country: '', registration_number: '',
    registered_address: '', factory_address: '', contact_name: '', contact_phone: '', contact_email: '',
  });
  const [docs, setDocs] = useState<VerificationDocument[]>([]);
  const [docKind, setDocKind] = useState<VerificationDocument['kind']>('gst');
  const [uploading, setUploading] = useState(false);
  const [earlierDocs, setEarlierDocs] = useState<VerificationDocument[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);

  // location
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [loc, setLoc] = useState({ address: '', city: '', state: '', country: 'India', pincode: '' });
  const [jump, setJump] = useState('');
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom: number; key: number } | null>(null);
  const [savingLoc, setSavingLoc] = useState(false);

  // availability
  const [avail, setAvail] = useState({ capacity: '', unit: 'pcs', lead: '', stock: '' as StockStatus | '', supply: '' as SupplyType | '' });
  const [savingAvail, setSavingAvail] = useState(false);

  const load = useCallback(async () => {
    const { status: s, error } = await myMapStatus();
    setLoading(false);
    if (error) {
      setLoadError(mapDbError(error));
      return;
    }
    setLoadError(null);
    setStatus(s);
    return s;
  }, []);

  // first load: fill the forms from the saved application, else from the business profile
  useEffect(() => {
    (async () => {
      const s = await load();
      const b = s?.business;
      const c = company as unknown as Record<string, string | null> | null;
      setApp({
        entity_type: b?.entity_type ?? '',
        legal_name: b?.legal_name ?? c?.company_name ?? '',
        cin_llpin: b?.cin_llpin ?? '',
        gstin: b?.gstin ?? c?.gst_number ?? '',
        udyam_number: b?.udyam_number ?? '',
        registration_country: b?.registration_country ?? (c?.country && c.country !== 'India' ? c.country : ''),
        registration_number: b?.registration_number ?? '',
        registered_address: b?.registered_address ?? [c?.address, c?.city, c?.state, c?.pincode].filter(Boolean).join(', '),
        factory_address: b?.factory_address ?? '',
        contact_name: b?.contact_name ?? profile?.full_name ?? '',
        contact_phone: b?.contact_phone ?? profile?.phone ?? '',
        contact_email: b?.contact_email ?? user?.email ?? '',
      });
      setDocs(Array.isArray(b?.documents) ? b.documents : []);
      const l = s?.location;
      if (l) {
        setPin({ lat: Number(l.latitude), lng: Number(l.longitude) });
        setLoc({ address: l.address ?? '', city: l.city ?? '', state: l.state ?? '', country: l.country || 'India', pincode: l.pincode ?? '' });
        setAvail({
          capacity: l.monthly_capacity != null ? String(l.monthly_capacity) : '', unit: l.capacity_unit ?? 'pcs',
          lead: l.lead_time_days != null ? String(l.lead_time_days) : '', stock: l.stock_status ?? '', supply: l.supply_type ?? '',
        });
      } else if (c) {
        const country = c.country && COUNTRY_NAMES.includes(c.country) ? c.country : 'India';
        setLoc({ address: c.address ?? '', city: c.city ?? '', state: c.state ?? '', country, pincode: c.pincode ?? '' });
        const city = findPlace(`${c.city ?? ''}, ${country}`) ?? (country === 'India' ? findPlace(c.city ?? '') : PLACES.find((p) => p.country === country));
        if (city) setFocus({ lat: city.lat, lng: city.lng, zoom: 12, key: 1 });
      }
      // documents already uploaded on the Verification page (same private bucket, same folder)
      if (company?.id && user?.id) {
        const { data } = await supabase.from('companies').select('gst_doc_url,reg_doc_url,factory_doc_url').eq('id', company.id).maybeSingle();
        const d = (data ?? {}) as Record<string, string | null>;
        const found: VerificationDocument[] = [];
        const add = (url: string | null, kind: VerificationDocument['kind'], name: string) => {
          const path = docPathFromUrl(url);
          if (path?.startsWith(`${user.id}/`)) found.push({ kind, path, name });
        };
        add(d.gst_doc_url, 'gst', 'GST certificate (from Verification)');
        add(d.reg_doc_url, 'incorporation', 'Registration document (from Verification)');
        add(d.factory_doc_url, 'factory', 'Factory address proof (from Verification)');
        setEarlierDocs(found);
      }
    })();
  }, [company?.id]);

  const business = status?.business ?? null;
  const location = status?.location ?? null;
  const canEditApp = !business || editing || business.status === 'needs_info' || business.status === 'rejected';

  const upload = async (file: File) => {
    if (!user) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Files up to 10 MB, please');
      return;
    }
    if (!/\.(pdf|jpe?g|png|webp)$/i.test(file.name)) {
      toast.error('Upload a PDF or a photo (JPG, PNG)');
      return;
    }
    setUploading(true);
    try {
      const d = await uploadVerificationDocument(user.id, docKind, file);
      setDocs((prev) => [...prev, d]);
      setErrors((e) => ({ ...e, documents: '' }));
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const openDoc = async (path: string) => {
    if (!(await openPrivateDocument(path))) toast.error('Could not open the file (it may have been removed)');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateApplication({ ...app, documentCount: docs.length });
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    if (business?.status === 'approved' && !window.confirm('Changing an approved application sends it back for review. Your factory leaves the map until it is approved again. Continue?')) return;
    setSubmitting(true);
    const err = await submitBusinessVerification({
      ...app,
      cin_llpin: normalise(app.cin_llpin) || null,
      registration_number: app.registration_number.trim().toUpperCase() || null,
      registration_country: app.registration_country || null,
      gstin: normalise(app.gstin) || null,
      udyam_number: normalise(app.udyam_number) || null,
      documents: docs,
    });
    setSubmitting(false);
    if (err) {
      toast.error(mapDbError(err));
      return;
    }
    toast.success('Sent for review. We check registrations on the government portals, usually within 2 working days.');
    setEditing(false);
    load();
  };

  const saveLocation = async () => {
    if (!pin) {
      toast.error('Click the map to place your factory pin');
      return;
    }
    if (!loc.address.trim()) {
      toast.error('Enter the factory address');
      return;
    }
    setSavingLoc(true);
    const { status: st, error } = await saveFactoryLocation({ lat: pin.lat, lng: pin.lng, address: loc.address, city: loc.city, state: loc.state, country: loc.country, pincode: loc.pincode });
    setSavingLoc(false);
    if (error) {
      toast.error(mapDbError(error));
      return;
    }
    toast.success(st === 'verified' ? 'Saved' : 'Saved. Our team will check the location before it shows on the map.');
    load();
  };

  const saveAvailability = async () => {
    setSavingAvail(true);
    const err = await updateAvailability({
      monthlyCapacity: avail.capacity ? Number(avail.capacity) : null,
      capacityUnit: avail.unit,
      leadTimeDays: avail.lead ? Math.min(365, Number(avail.lead)) : null,
      stockStatus: avail.stock,
      supplyType: avail.supply,
    });
    setSavingAvail(false);
    if (err) {
      toast.error(mapDbError(err));
      return;
    }
    toast.success('Availability updated. Buyers see it now.');
    load();
  };

  const steps = useMemo(() => {
    if (!status) return [];
    return [
      { done: status.account_active, label: 'Active manufacturer account', hint: 'Your account is not active. Contact BulkSkart support.' },
      { done: business?.status === 'approved', label: 'Business registration approved', hint: business ? BUSINESS_STATUS[business.status].label : 'Not submitted yet', anchor: '#registration' },
      { done: location?.status === 'verified', label: 'Factory location verified', hint: location ? (location.status === 'pending' ? 'Waiting for review' : location.status === 'rejected' ? 'Rejected: place the pin again' : 'Verified') : 'Not added yet', anchor: '#location' },
      { done: status.active_products > 0, label: 'At least one active product', hint: status.active_products > 0 ? `${status.active_products} active` : 'Add a product', link: '/dashboard/supplier/products' },
      { done: !status.blocked, label: 'Account in good standing', hint: 'Your company is blocked. Contact support.' },
    ];
  }, [status, business, location]);

  if (loading) {
    return (
      <DashboardLayout>
        <PageMeta title="Supplier Map Listing | BulkSkart" description="Get your factory on BulkSkart's verified supplier map" robots="noindex, nofollow" />
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#FF5A00]" /></div>
      </DashboardLayout>
    );
  }

  const err = (k: string) => errors[k] ? <span className="mt-1 block text-[11.5px] font-semibold text-red-500">{errors[k]}</span> : null;
  const entity = app.entity_type;

  return (
    <DashboardLayout>
      <PageMeta title="Supplier Map Listing | BulkSkart" description="Get your factory on BulkSkart's verified supplier map" robots="noindex, nofollow" />
      <div className="mx-auto w-full max-w-3xl space-y-5 px-1 pb-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black"><MapPin className="h-6 w-6 text-[#FF5A00]" aria-hidden="true" /> Live Supplier Map</h1>
            <p className="text-sm text-muted-foreground">Buyers near you find your factory on the map once BulkSkart has checked your registration and location.</p>
          </div>
          <Link to="/supplier-map" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-border px-3 text-[13px] font-bold hover:border-[#FF5A00] hover:text-[#FF5A00]">
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> Open the map
          </Link>
        </div>

        {loadError ? (
          <p className="rounded-2xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">{loadError}</p>
        ) : !status?.company_id ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <Building2 className="mx-auto h-9 w-9 text-[#FF5A00]" aria-hidden="true" />
            <p className="mt-2 font-bold">Create your business profile first</p>
            <Link to="/business-setup" className="mt-3 inline-flex min-h-[40px] items-center rounded-xl bg-[#FF5A00] px-4 text-[13px] font-bold text-white">Set up business</Link>
          </div>
        ) : (
          <>
            {/* checklist */}
            <section className={cn('rounded-2xl border p-4', status.on_map ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border bg-card')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-[16px] font-black">
                  {status.on_map ? <><BadgeCheck className="h-5 w-5 text-emerald-500" aria-hidden="true" /> Your factory is on the map</> : <>Not on the map yet</>}
                </h2>
                <button type="button" onClick={() => load()} className="inline-flex min-h-[32px] items-center gap-1 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Refresh</button>
              </div>
              <ul className="mt-3 space-y-2">
                {steps.map((s) => (
                  <li key={s.label} className="flex items-start gap-2.5 text-[13px]">
                    {s.done ? <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-emerald-500" aria-label="Done" /> : <Circle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-label="To do" />}
                    <span className="min-w-0 flex-1">
                      <span className={cn('font-semibold', s.done && 'text-muted-foreground')}>{s.label}</span>
                      {!s.done && <span className="block text-[12px] text-muted-foreground">{s.hint}</span>}
                    </span>
                    {!s.done && s.anchor && <a href={s.anchor} className="shrink-0 text-[12px] font-bold text-[#E04E00] dark:text-[#FF8A3D]">Go</a>}
                    {!s.done && s.link && <Link to={s.link} className="shrink-0 text-[12px] font-bold text-[#E04E00] dark:text-[#FF8A3D]">Add</Link>}
                  </li>
                ))}
              </ul>
              {business?.status === 'approved' && business.recheck_due_at && (
                <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> Approval valid until {new Date(business.recheck_due_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. We check it again every year.</p>
              )}
            </section>

            {/* 1. registration */}
            <section id="registration" className="scroll-mt-24 rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[16px] font-black">1. Business registration</h2>
                {business && <span className={cn('rounded-full px-2.5 py-0.5 text-[11.5px] font-bold', BUSINESS_STATUS[business.status].tone)}>{BUSINESS_STATUS[business.status].label}</span>}
              </div>
              {business?.decision_note && business.status !== 'approved' && (
                <p className="mt-2 flex items-start gap-2 rounded-xl border border-orange-500/40 bg-orange-500/10 p-3 text-[12.5px]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" aria-hidden="true" /> <span><b>From the BulkSkart team:</b> {business.decision_note}</span>
                </p>
              )}
              {business?.status === 'suspended' ? (
                <p className="mt-3 flex items-start gap-2 text-[13px]"><ShieldAlert className="h-4 w-4 shrink-0 text-red-500" aria-hidden="true" /> This business is suspended from the map. Contact BulkSkart support to resolve it.</p>
              ) : !canEditApp ? (
                <div className="mt-3 space-y-2 text-[13px]">
                  <p><b>{business?.legal_name}</b> · {ENTITY_TYPES.find((t) => t.value === business?.entity_type)?.label}</p>
                  <p className="text-muted-foreground">
                    {[business?.registration_number && `${business.registration_country} registration ${business.registration_number}`, business?.cin_llpin && `CIN/LLPIN ${business.cin_llpin}`, business?.gstin && `GSTIN ${business.gstin}`, business?.udyam_number && `Udyam ${business.udyam_number}`].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-[12px] text-muted-foreground">Sent {business && timeAgo(business.submitted_at)} · {business?.documents.length} document{business?.documents.length === 1 ? '' : 's'}</p>
                  <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-[38px] items-center rounded-xl border border-border px-3 text-[12.5px] font-bold hover:border-[#FF5A00]">Change details</button>
                </div>
              ) : (
                <form onSubmit={submit} noValidate className="mt-3 space-y-4">
                  <fieldset>
                    <legend className="text-[13px] font-semibold">How is the business registered? <span className="text-red-500">*</span></legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {ENTITY_TYPES.map((t) => (
                        <label key={t.value} className={cn('flex min-h-[52px] cursor-pointer items-start gap-2.5 rounded-xl border p-2.5', entity === t.value ? 'border-[#FF5A00] bg-[#FF5A00]/8' : 'border-border hover:border-[#FF5A00]/50')}>
                          <input type="radio" name="entity" value={t.value} checked={entity === t.value} onChange={() => setApp({ ...app, entity_type: t.value })} className="mt-1 accent-[#FF5A00]" />
                          <span><span className="block text-[13px] font-bold">{t.label}</span><span className="text-[11.5px] text-muted-foreground">{t.hint}</span></span>
                        </label>
                      ))}
                    </div>
                    {err('entity_type')}
                  </fieldset>

                  <label className="block text-[13px] font-semibold">Legal name, exactly as registered <span className="text-red-500">*</span>
                    <input className={field} value={app.legal_name} onChange={(e) => setApp({ ...app, legal_name: e.target.value })} autoComplete="organization" />
                    {err('legal_name')}
                  </label>

                  {isForeign(entity) ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-[13px] font-semibold">Country of registration <span className="text-red-500">*</span>
                          <select className={field} value={app.registration_country} onChange={(e) => setApp({ ...app, registration_country: e.target.value })}>
                            <option value="">Choose a country</option>
                            {COUNTRY_NAMES.filter((c) => c !== 'India').map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                          {err('registration_country')}
                        </label>
                        <label className="block text-[13px] font-semibold">Company registration number <span className="text-red-500">*</span>
                          <input className={cn(field, 'uppercase')} value={app.registration_number} onChange={(e) => setApp({ ...app, registration_number: e.target.value })} placeholder="As on your certificate or business licence" />
                          {err('registration_number')}
                        </label>
                      </div>
                      <p className="text-[11.5px] text-muted-foreground">We check it in your country's official company registry. Attach your certificate of incorporation or business licence below.</p>
                    </>
                  ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block text-[13px] font-semibold">{entity === 'llp' ? 'LLPIN' : 'CIN'} {entity && isIncorporated(entity) && <span className="text-red-500">*</span>}
                      <input className={cn(field, 'uppercase')} value={app.cin_llpin} onChange={(e) => setApp({ ...app, cin_llpin: e.target.value })} placeholder={entity === 'llp' ? 'AAB-1234' : 'U12345TN2020PTC123456'} disabled={!!entity && !isIncorporated(entity)} />
                      {err('cin_llpin')}
                    </label>
                    <label className="block text-[13px] font-semibold">GSTIN
                      <input className={cn(field, 'uppercase')} value={app.gstin} onChange={(e) => setApp({ ...app, gstin: e.target.value })} placeholder="33ABCDE1234F1Z5" />
                      {err('gstin')}
                    </label>
                    <label className="block text-[13px] font-semibold">Udyam number
                      <input className={cn(field, 'uppercase')} value={app.udyam_number} onChange={(e) => setApp({ ...app, udyam_number: e.target.value })} placeholder="UDYAM-TN-01-1234567" />
                      {err('udyam_number')}
                    </label>
                  </div>
                  )}
                  {entity && isIncorporated(entity) && (
                    <p className="text-[11.5px] text-muted-foreground">Companies and LLPs are approved on their {entity === 'llp' ? 'LLPIN' : 'CIN'}, checked on the MCA portal. A GSTIN alone does not prove a company is incorporated.</p>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-[13px] font-semibold">Registered office address <span className="text-red-500">*</span>
                      <textarea rows={3} className={cn(field, 'h-auto py-2')} value={app.registered_address} onChange={(e) => setApp({ ...app, registered_address: e.target.value })} />
                      {err('registered_address')}
                    </label>
                    <label className="block text-[13px] font-semibold">Factory address <span className="text-red-500">*</span>
                      <textarea rows={3} className={cn(field, 'h-auto py-2')} value={app.factory_address} onChange={(e) => setApp({ ...app, factory_address: e.target.value })} />
                      {err('factory_address')}
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block text-[13px] font-semibold">Contact person <span className="text-red-500">*</span>
                      <input className={field} value={app.contact_name} onChange={(e) => setApp({ ...app, contact_name: e.target.value })} autoComplete="name" />
                      {err('contact_name')}
                    </label>
                    <label className="block text-[13px] font-semibold">Phone <span className="text-red-500">*</span>
                      <input className={field} inputMode="tel" value={app.contact_phone} onChange={(e) => setApp({ ...app, contact_phone: e.target.value })} autoComplete="tel" />
                      {err('contact_phone')}
                    </label>
                    <label className="block text-[13px] font-semibold">Email <span className="text-red-500">*</span>
                      <input className={field} type="email" value={app.contact_email} onChange={(e) => setApp({ ...app, contact_email: e.target.value })} autoComplete="email" />
                      {err('contact_email')}
                    </label>
                  </div>
                  <p className="text-[11.5px] text-muted-foreground">Contact details are for our checks only; they are not shown on the map.</p>

                  <div>
                    <p className="text-[13px] font-semibold">Documents <span className="text-red-500">*</span></p>
                    <p className="text-[11.5px] text-muted-foreground">PDF or photo, up to 10 MB each. Stored privately; only you and BulkSkart admins can open them.</p>
                    <ul className="mt-2 space-y-1.5">
                      {docs.map((d) => (
                        <li key={d.path} className="flex items-center gap-2 rounded-xl border border-border px-2.5 py-2 text-[12.5px]">
                          <FileText className="h-4 w-4 shrink-0 text-[#FF5A00]" aria-hidden="true" />
                          <button type="button" onClick={() => openDoc(d.path)} className="min-w-0 flex-1 truncate text-left font-semibold hover:underline">{d.name}</button>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{DOC_KINDS.find((k) => k.value === d.kind)?.label.split(' (')[0]}</span>
                          <button type="button" aria-label={`Remove ${d.name}`} onClick={() => setDocs((p) => p.filter((x) => x.path !== d.path))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-red-500/10 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </li>
                      ))}
                    </ul>
                    {earlierDocs.filter((e) => !docs.some((d) => d.path === e.path)).map((e) => (
                      <button key={e.path} type="button" onClick={() => setDocs((p) => [...p, e])} className="mt-1.5 flex min-h-[38px] w-full items-center gap-2 rounded-xl border border-dashed border-border px-2.5 text-left text-[12.5px] hover:border-[#FF5A00]">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> Attach {e.name}
                      </button>
                    ))}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select value={docKind} onChange={(e) => setDocKind(e.target.value as VerificationDocument['kind'])} className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-[13px] outline-none focus:border-[#FF5A00]" aria-label="Document type">
                        {DOC_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                      </select>
                      <label className={cn('inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#FF5A00] px-3 text-[13px] font-bold text-[#E04E00] hover:bg-[#FF5A00] hover:text-white dark:text-[#FF8A3D]', uploading && 'pointer-events-none opacity-60')}>
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" aria-hidden="true" />} Upload
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
                      </label>
                    </div>
                    {err('documents')}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {editing && <button type="button" onClick={() => setEditing(false)} className="min-h-[46px] rounded-xl border border-border px-4 text-[13.5px] font-bold">Cancel</button>}
                    <button type="submit" disabled={submitting} className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF5A00] px-4 text-[14px] font-black text-white hover:bg-[#E04E00] disabled:opacity-60">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" aria-hidden="true" />} {business ? 'Send for review again' : 'Send for verification'}
                    </button>
                  </div>
                  <p className="text-[11.5px] text-muted-foreground">Nothing is approved automatically. A BulkSkart admin checks each number on the official registry (MCA, GST and Udyam portals in India, or your country's company registry) and reads your documents.</p>
                </form>
              )}
            </section>

            {/* 2. location */}
            <section id="location" className="scroll-mt-24 rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[16px] font-black">2. Factory location</h2>
                {location && (
                  <span className={cn('rounded-full px-2.5 py-0.5 text-[11.5px] font-bold', location.status === 'verified' ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' : location.status === 'rejected' ? 'bg-red-500/12 text-red-600 dark:text-red-400' : 'bg-orange-500/12 text-orange-600 dark:text-orange-400')}>
                    {location.status === 'verified' ? 'Verified' : location.status === 'rejected' ? 'Rejected' : 'Waiting for review'}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">Place the pin on your registered factory. Moving it later sends it for review again. We never track anyone's live location.</p>
              {location?.status === 'rejected' && location.review_note && (
                <p className="mt-2 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-[12.5px]"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" /> {location.review_note}</p>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-[13px] font-semibold">Country of the factory <span className="text-red-500">*</span>
                  <select className={field} value={loc.country} onChange={(e) => {
                    const country = e.target.value;
                    setLoc({ ...loc, country });
                    const first = PLACES.find((p) => p.country === country);
                    if (first && !pin) setFocus({ lat: first.lat, lng: first.lng, zoom: country === 'India' ? 5 : 6, key: Date.now() });
                  }}>
                    {COUNTRY_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="block text-[13px] font-semibold">Jump to a city
                  <input type="search" className={field} value={jump} onChange={(e) => setJump(e.target.value)} placeholder="Type a city, e.g. Tiruppur or Shenzhen" />
                </label>
              </div>
              {jump.trim() && (
                <ul className="mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-border" aria-label="Cities">
                  {searchPlaces(jump).map((p) => (
                    <li key={placeLabel(p)}>
                      <button type="button" onClick={() => { setFocus({ lat: p.lat, lng: p.lng, zoom: 12, key: Date.now() }); setLoc((l) => ({ ...l, country: COUNTRY_NAMES.includes(p.country) ? p.country : l.country, city: l.city || p.name })); setJump(''); }}
                        className="flex min-h-[40px] w-full items-center gap-2 px-3 text-left text-[13px] hover:bg-muted">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#FF5A00]" aria-hidden="true" /> <b>{p.name}</b> <span className="truncate text-muted-foreground">{[p.region, p.country].filter(Boolean).join(', ')}</span>
                      </button>
                    </li>
                  ))}
                  {searchPlaces(jump).length === 0 && <li className="px-3 py-2.5 text-[12px] text-muted-foreground">Not in the list: zoom and drag the map to your factory instead.</li>}
                </ul>
              )}
              <div className="mt-3 h-[320px] overflow-hidden rounded-2xl border border-border sm:h-[380px]">
                <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#FF5A00]" /></div>}>
                  <LocationPickerMap className={cn('bsm-map h-full w-full', theme === 'light' && 'bsm-light')} value={pin} onChange={setPin} focus={focus} theme={theme} start={loc.country === 'India' ? 'india' : 'world'} />
                </Suspense>
              </div>
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">{pin ? `Pin at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}. Drag it to adjust.` : 'Click the map at your factory to drop the pin. Zoom in for accuracy.'}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-[13px] font-semibold sm:col-span-2">Factory address <span className="text-red-500">*</span>
                  <input className={field} value={loc.address} onChange={(e) => setLoc({ ...loc, address: e.target.value })} autoComplete="street-address" />
                </label>
                <label className="block text-[13px] font-semibold">City
                  <input className={field} value={loc.city} onChange={(e) => setLoc({ ...loc, city: e.target.value })} autoComplete="address-level2" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-[13px] font-semibold">{loc.country === 'India' ? 'State' : 'State / region'}
                    <input className={field} value={loc.state} onChange={(e) => setLoc({ ...loc, state: e.target.value })} autoComplete="address-level1" />
                  </label>
                  <label className="block text-[13px] font-semibold">{loc.country === 'India' ? 'PIN code' : 'Postal code'}
                    <input className={field} inputMode={loc.country === 'India' ? 'numeric' : 'text'} maxLength={loc.country === 'India' ? 6 : 12} value={loc.pincode}
                      onChange={(e) => setLoc({ ...loc, pincode: loc.country === 'India' ? e.target.value.replace(/\D/g, '') : e.target.value.toUpperCase() })} autoComplete="postal-code" />
                  </label>
                </div>
              </div>
              <button type="button" onClick={saveLocation} disabled={savingLoc} className="mt-3 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#FF5A00] px-4 text-[14px] font-black text-white hover:bg-[#E04E00] disabled:opacity-60 sm:w-auto">
                {savingLoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" aria-hidden="true" />} Save location
              </button>
            </section>

            {/* 3. availability */}
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[16px] font-black">3. Availability</h2>
                {location?.availability_updated_at && <span className="text-[12px] text-muted-foreground">Updated {timeAgo(location.availability_updated_at)}</span>}
              </div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">Shown on your map card with the date you updated it. Keep it current: buyers see stale availability as less reliable.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <label className="block text-[13px] font-semibold">Monthly capacity
                    <input className={field} inputMode="numeric" value={avail.capacity} onChange={(e) => setAvail({ ...avail, capacity: e.target.value.replace(/\D/g, '') })} placeholder="e.g. 50000" />
                  </label>
                  <label className="block text-[13px] font-semibold">Unit
                    <select className={field} value={avail.unit} onChange={(e) => setAvail({ ...avail, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
                  </label>
                </div>
                <label className="block text-[13px] font-semibold">Lead time (days)
                  <input className={field} inputMode="numeric" value={avail.lead} onChange={(e) => setAvail({ ...avail, lead: e.target.value.replace(/\D/g, '').slice(0, 3) })} placeholder="e.g. 15" />
                </label>
                <label className="block text-[13px] font-semibold">Stock
                  <select className={field} value={avail.stock} onChange={(e) => setAvail({ ...avail, stock: e.target.value as StockStatus | '' })}>
                    <option value="">Not set</option>
                    {STOCK.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
                <label className="block text-[13px] font-semibold">Takes
                  <select className={field} value={avail.supply} onChange={(e) => setAvail({ ...avail, supply: e.target.value as SupplyType | '' })}>
                    <option value="">Not set</option>
                    {SUPPLY.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
              </div>
              <button type="button" onClick={saveAvailability} disabled={savingAvail || !location} className="mt-3 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-[#FF5A00] px-4 text-[14px] font-black text-[#E04E00] hover:bg-[#FF5A00] hover:text-white disabled:opacity-50 dark:text-[#FF8A3D] sm:w-auto">
                {savingAvail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" aria-hidden="true" />} Update availability
              </button>
              {!location && <p className="mt-1.5 text-[11.5px] text-muted-foreground">Save your factory location first.</p>}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

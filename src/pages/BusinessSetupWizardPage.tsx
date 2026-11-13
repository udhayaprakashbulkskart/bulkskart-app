import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import {
  Building2, User, FileText, CheckCircle2, ArrowRight, ArrowLeft,
  Upload, Shield, ShieldCheck, AlertCircle, Save, Briefcase,
  Globe, Truck, Award, Sparkles, Check, Info, FileCheck, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PageMeta from '@/components/common/PageMeta';
import { cn } from '@/lib/utils';

type FieldErrors = Record<string, string>;

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const IEC_REGEX = /^[0-9]{10}$/;

function digitCount(value: string): number {
  return (value.match(/\d/g) || []).length;
}

function isValidPhone(value: string): boolean {
  const digits = digitCount(value);
  // Allow local 10-digit or international E.164-style (7–15 digits with optional +)
  if (digits < 10 || digits > 15) return false;
  return /^[+]?[\d\s().-]{7,20}$/.test(value.trim());
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value.startsWith('http') ? value : `https://${value}`);
    return Boolean(u.hostname.includes('.'));
  } catch {
    return false;
  }
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      data-field-error="true"
      role="alert"
      className="flex items-start gap-1 text-[11px] text-destructive font-medium leading-snug"
    >
      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
      <span>{message}</span>
    </p>
  );
}

const ACCOUNT_TYPES = [
  { id: 'Manufacturer', label: 'Manufacturer / Factory', desc: 'Direct production facility with custom OEM/ODM bulk capabilities', role: 'supplier' },
  { id: 'Wholesaler', label: 'Wholesaler / Stockist', desc: 'Holds ready stock in bulk warehouses for fast regional dispatch', role: 'supplier' },
  { id: 'Distributor', label: 'Authorized Distributor', desc: 'Direct brand channel distributor with institutional pricing', role: 'supplier' },
  { id: 'Buyer', label: 'Bulk Buyer / Procurement', desc: 'Procures raw materials, industrial equipment, or wholesale batches', role: 'buyer' },
  { id: 'Importer', label: 'Importer', desc: 'Imports products in bulk containers for domestic distribution', role: 'supplier' },
  { id: 'Exporter', label: 'Exporter', desc: 'Exports certified goods and components to international markets', role: 'supplier' },
];

const PRODUCT_CATEGORIES = [
  'Machinery & Industrial Equipment',
  'Packaging & Printing',
  'Textiles & Apparel',
  'Chemicals & Raw Materials',
  'Construction & Building Materials',
  'Electronics & Electricals',
  'Auto Parts & Vehicles',
  'Pharmaceuticals & Healthcare',
  'Agriculture & Food Products',
  'Plastics & Rubber',
  'Furniture & Home Decor',
  'Gems & Jewellery',
  'Handicrafts & Gifts',
];

const PAYMENT_TERMS = ['L/C (Letter of Credit)', 'T/T (Telegraphic Transfer)', 'D/P (Documents Against Payment)', 'D/A (Documents Against Acceptance)', 'Escrow Trade Assurance', 'Cash Against Documents', 'Advance Payment'];
const SHIPPING_MODES = ['Road Freight / Full Truckload', 'Air Cargo (Express & General)', 'Sea Freight (FCL & LCL)', 'Courier / Parcel Express', 'Warehousing & Cross-Docking', 'Cold Chain Logistics'];
const COUNTRIES_LIST = ['India', 'United States', 'United Arab Emirates', 'United Kingdom', 'Germany', 'Australia', 'Canada', 'Saudi Arabia', 'Singapore', 'Japan', 'South Africa', 'Worldwide'];

// Never let a single slow database read keep the wizard on a spinner forever.
function withTimeout<T>(promise: PromiseLike<T>, ms = 12000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out. Please check your connection and retry.')), ms);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// Adds the sample manufacturer welcome leads after navigation, so they never delay onboarding.
async function seedWelcomeLeadsInBackground(userId: string, fallbackName: string) {
  try {
    const { data: co } = await withTimeout(
      supabase.from('companies').select('id, company_name').eq('owner_id', userId).maybeSingle(),
      8000,
    );
    if (!co?.id) return;
    const { ensureManufacturerWelcomeLeads } = await import('@/lib/api');
    const result = ensureManufacturerWelcomeLeads(co.id, co.company_name || fallbackName || 'Your Factory');
    if (result.seeded) {
      toast.success('5 sample buyer leads added to your Messages inbox', {
        description: 'Open Messages to reply — this is a simulation for new manufacturers.',
      });
    }
  } catch (seedErr) {
    console.warn('Welcome lead seed skipped:', seedErr);
  }
}

export default function BusinessSetupWizardPage() {
  const { user, profile, company, buyerProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [saving, setSaving] = useState<boolean>(false);
  const [completing, setCompleting] = useState<boolean>(false);

  // Form state
  const [accountType, setAccountType] = useState<string>('Manufacturer');

  // Step 2: Personal Details
  const [personal, setPersonal] = useState({
    fullName: '',
    email: '',
    phone: '',
    whatsappNumber: '',
    country: 'India',
    state: '',
    city: '',
  });

  // Step 3: Business Details
  const [business, setBusiness] = useState({
    legalName: '',
    brandName: '',
    businessType: 'Manufacturer',
    registrationNumber: '',
    gstNumber: '',
    panNumber: '',
    iecNumber: '',
    address: '',
    pincode: '',
    website: '',
    yearEstablished: '',
    description: '',
  });

  // Step 4: Operations
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [productsSupplied, setProductsSupplied] = useState<string[]>([]);
  const [productInput, setProductInput] = useState<string>('');
  const [moq, setMoq] = useState<string>('');
  const [capacity, setCapacity] = useState<string>('');
  const [tradeType, setTradeType] = useState<string>('domestic'); // 'domestic' | 'import' | 'export' | 'both'
  const [countriesServed, setCountriesServed] = useState<string[]>(['India']);
  const [paymentTerms, setPaymentTerms] = useState<string[]>(['T/T (Telegraphic Transfer)']);
  const [shippingCapabilities, setShippingCapabilities] = useState<string[]>(['Road Freight / Full Truckload']);

  // Step 5: Verification docs
  const [docs, setDocs] = useState<{
    gstDocUrl?: string;
    iecDocUrl?: string;
    panDocUrl?: string;
    regDocUrl?: string;
  }>({});
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'unverified' | 'pending' | 'verified' | 'rejected'>('unverified');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const submitLock = React.useRef(false);
  const persistRef = React.useRef<(opts: { step: number; completed: boolean }) => Promise<{ error: string | null }>>(
    async () => ({ error: 'Still loading your account. Please try again.' })
  );

  const clearFieldError = useCallback((key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const scrollToFirstError = useCallback(() => {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>('[data-field-error="true"]');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  /** Validate a wizard step and return field-level error messages */
  const validateStep = useCallback((step: number): FieldErrors => {
    const errors: FieldErrors = {};

    if (step === 1) {
      if (!accountType) {
        errors.accountType = 'Please select an account type to continue';
      }
    }

    if (step === 2) {
      if (!personal.fullName.trim()) {
        errors.fullName = 'This field is required';
      } else if (personal.fullName.trim().length < 2) {
        errors.fullName = 'Please enter a valid full name';
      }

      if (!personal.email.trim()) {
        errors.email = 'This field is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal.email.trim())) {
        errors.email = 'This email address looks invalid';
      }

      if (!personal.phone.trim()) {
        errors.phone = 'This field is required';
      } else if (!isValidPhone(personal.phone)) {
        errors.phone = 'Enter a valid mobile number (10–15 digits)';
      }

      if (personal.whatsappNumber.trim() && !isValidPhone(personal.whatsappNumber)) {
        errors.whatsappNumber = 'Enter a valid WhatsApp number or leave this blank';
      }

      if (!personal.country.trim()) {
        errors.country = 'This field is required';
      }

      if (!personal.state.trim()) {
        errors.state = 'This field is required';
      } else if (personal.state.trim().length < 2) {
        errors.state = 'Please enter a valid state / province';
      }

      if (!personal.city.trim()) {
        errors.city = 'This field is required';
      } else if (personal.city.trim().length < 2) {
        errors.city = 'Please enter a valid city';
      }
    }

    if (step === 3) {
      if (!business.legalName.trim()) {
        errors.legalName = 'This field is required';
      } else if (business.legalName.trim().length < 2) {
        errors.legalName = 'Please enter a valid legal business name';
      }

      if (business.gstNumber.trim()) {
        const gst = business.gstNumber.trim().toUpperCase();
        if (!GSTIN_REGEX.test(gst)) {
          errors.gstNumber = 'Invalid GSTIN format (e.g. 27ABCDE1234F1Z5)';
        }
      }

      if (business.panNumber.trim()) {
        const pan = business.panNumber.trim().toUpperCase();
        if (!PAN_REGEX.test(pan)) {
          errors.panNumber = 'Invalid PAN format (e.g. ABCDE1234F)';
        }
      }

      if (business.iecNumber.trim()) {
        const iec = business.iecNumber.trim().replace(/\s/g, '');
        if (!IEC_REGEX.test(iec)) {
          errors.iecNumber = 'IEC must be exactly 10 digits';
        }
      }

      if (business.yearEstablished.trim()) {
        const year = parseInt(business.yearEstablished, 10);
        const currentYear = new Date().getFullYear();
        if (!Number.isFinite(year) || year < 1800 || year > currentYear) {
          errors.yearEstablished = `Enter a valid year between 1800 and ${currentYear}`;
        }
      }

      if (business.website.trim() && !isValidUrl(business.website.trim())) {
        errors.website = 'Enter a valid website URL';
      }

      if (business.pincode.trim() && !/^[A-Za-z0-9\s-]{3,12}$/.test(business.pincode.trim())) {
        errors.pincode = 'Enter a valid PIN / ZIP code';
      }
    }

    if (step === 4) {
      if (selectedCategories.length === 0) {
        errors.categories = 'Select at least one product category';
      }
      if (productsSupplied.length === 0) {
        errors.products = 'Add at least one product to continue';
      }
    }

    return errors;
  }, [accountType, personal, business, selectedCategories, productsSupplied]);

  const handleNextStep = useCallback(async () => {
    if (submitLock.current) return;
    const errors = validateStep(currentStep);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      const count = Object.keys(errors).length;
      toast.error(
        count === 1
          ? 'Please fix the highlighted field to continue'
          : `Please fix ${count} required or invalid fields to continue`
      );
      scrollToFirstError();
      return;
    }

    setFieldErrors({});
    const nextStep = Math.min(5, currentStep + 1);
    submitLock.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await persistRef.current({ step: nextStep, completed: false });
      if (saved.error) {
        setSaveError(saved.error);
        toast.error(saved.error);
        return;
      }
      setCurrentStep(nextStep);
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  }, [currentStep, validateStep, scrollToFirstError]);

  const handleBackStep = useCallback(() => {
    setFieldErrors({});
    setCurrentStep((p) => Math.max(1, p - 1));
  }, []);

  /** Allow revisiting past steps freely; validating when jumping ahead */
  const handleStepJump = useCallback((targetStep: number) => {
    if (targetStep === currentStep) return;

    if (targetStep < currentStep) {
      setFieldErrors({});
      setCurrentStep(targetStep);
      return;
    }

    // Validate every step between current and target (inclusive of current)
    for (let step = currentStep; step < targetStep; step++) {
      const errors = validateStep(step);
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setCurrentStep(step);
        toast.error('Please complete the required fields on this step first');
        setTimeout(scrollToFirstError, 80);
        return;
      }
    }

    setFieldErrors({});
    setCurrentStep(targetStep);
  }, [currentStep, validateStep, scrollToFirstError]);

  // Load existing data for user
  const userId = user?.id;
  const userEmail = user?.email;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        // Direct query to guarantee exact logged-in user profile without crosstalk
        const { data: directProfile } = await withTimeout(
          supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle()
        );
        if (cancelled) return;

        const activeProfile = directProfile || profile;

        // Prefill personal details from user & profile
        setPersonal(prev => ({
          ...prev,
          fullName: activeProfile?.full_name || '',
          email: user.email || '',
          phone: activeProfile?.phone || '',
          whatsappNumber: (activeProfile as any)?.whatsapp_number || '',
          country: (activeProfile as any)?.country || 'India',
          state: (activeProfile as any)?.state || '',
          city: (activeProfile as any)?.city || '',
        }));

        if (activeProfile?.role === 'buyer') {
          setAccountType('Buyer');
        } else if (activeProfile?.role === 'supplier' || user.user_metadata?.role === 'supplier') {
          setAccountType((prev) => (prev === 'Buyer' ? 'Manufacturer' : prev));
        }

        // Direct query company owned specifically by this user to eliminate any cross-account leakage
        const { data: directCompany } = await withTimeout(
          supabase
            .from('companies')
            .select('*')
            .eq('owner_id', userId)
            .maybeSingle()
        );
        if (cancelled) return;

        const targetCompany = directCompany || (company?.owner_id === userId ? company : null);

        // Direct query buyer profile specifically for this user
        const { data: directBuyerProfile } = await withTimeout(
          supabase
            .from('buyer_profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle()
        );
        if (cancelled) return;

        const targetBuyerProfile = directBuyerProfile || (buyerProfile?.user_id === userId ? buyerProfile : null);

        // Check if company exists
        if (targetCompany) {
          setAccountType(targetCompany.business_type || 'Manufacturer');
          setBusiness({
            legalName: targetCompany.company_name || '',
            brandName: (targetCompany as any).brand_name || '',
            businessType: targetCompany.business_type || 'Manufacturer',
            registrationNumber: (targetCompany as any).registration_number || '',
            gstNumber: targetCompany.gst_number || '',
            panNumber: (targetCompany as any).pan_number || '',
            iecNumber: targetCompany.iec_number || '',
            address: targetCompany.address || '',
            pincode: targetCompany.pincode || '',
            website: targetCompany.website || '',
            yearEstablished: targetCompany.year_established ? String(targetCompany.year_established) : '',
            description: targetCompany.description || '',
          });
          setSelectedCategories((targetCompany as any).product_categories || []);
          setProductsSupplied(targetCompany.key_products || []);
          setMoq(targetCompany.moq_policy || '');
          setCapacity(targetCompany.production_capacity || '');
          setTradeType((targetCompany as any).trade_type || 'both');
          setCountriesServed(targetCompany.export_destinations || ['India']);
          setPaymentTerms(targetCompany.payment_terms || ['T/T (Telegraphic Transfer)']);
          if ((targetCompany as any).shipping_capabilities) {
            setShippingCapabilities([(targetCompany as any).shipping_capabilities]);
          }
          setDocs({
            gstDocUrl: targetCompany.gst_doc_url || undefined,
            iecDocUrl: targetCompany.iec_doc_url || undefined,
            panDocUrl: (targetCompany as any).pan_doc_url || undefined,
            regDocUrl: targetCompany.reg_doc_url || undefined,
          });
          setVerificationStatus(targetCompany.verification_status as any || 'unverified');
          setPersonal(prev => ({
            ...prev,
            state: prev.state || targetCompany.state || '',
            city: prev.city || targetCompany.city || '',
            country: prev.country || targetCompany.country || 'India',
          }));
          if ((targetCompany as any).onboarding_step && (targetCompany as any).onboarding_step <= 5) {
            setCurrentStep((targetCompany as any).onboarding_step);
          }
        } else if (targetBuyerProfile) {
          setAccountType('Buyer');
          setBusiness(prev => ({
            ...prev,
            legalName: targetBuyerProfile.company_name || '',
            brandName: (targetBuyerProfile as any).brand_name || '',
            businessType: targetBuyerProfile.business_type || 'Wholesaler / Distributor',
            registrationNumber: (targetBuyerProfile as any).registration_number || '',
            gstNumber: targetBuyerProfile.gst_number || '',
            panNumber: (targetBuyerProfile as any).pan_number || '',
            address: targetBuyerProfile.address || '',
            pincode: targetBuyerProfile.pincode || '',
            description: (targetBuyerProfile as any).description || '',
          }));
          setSelectedCategories((targetBuyerProfile as any).product_categories || []);
          setProductsSupplied((targetBuyerProfile as any).target_products || []);
          setDocs({
            gstDocUrl: (targetBuyerProfile as any).gst_doc_url || undefined,
            panDocUrl: (targetBuyerProfile as any).pan_doc_url || undefined,
            regDocUrl: (targetBuyerProfile as any).reg_doc_url || undefined,
          });
          setVerificationStatus((targetBuyerProfile as any).verification_status as any || 'unverified');
          if ((targetBuyerProfile as any).onboarding_step && (targetBuyerProfile as any).onboarding_step <= 5) {
            setCurrentStep((targetBuyerProfile as any).onboarding_step);
          }
        }
      } catch (err) {
        console.error('Error loading onboarding data:', err);
        if (!cancelled) {
          setLoadError(
            err instanceof Error && err.message
              ? err.message
              : 'We could not load your saved details. You can still fill in the form.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
    // Reload only when the signed-in user changes or the user presses Retry.
    // Re-running on every profile/company object change restarted the spinner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userEmail, reloadKey]);

  // Handle document uploads
  const handleUploadDoc = async (file: File, type: 'gst' | 'iec' | 'pan' | 'reg') => {
    if (!user) return;
    setUploadingDoc(type);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/docs/${type}-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('business-docs').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('business-docs').getPublicUrl(data.path);
      const docUrl = urlData.publicUrl;

      setDocs(prev => ({
        ...prev,
        [`${type}DocUrl`]: docUrl,
      }));
      setVerificationStatus('pending');
      if (accountType === 'Buyer' && type === 'iec') {
        toast.success('IEC document uploaded successfully!');
        return;
      }
      const column = `${type}_doc_url`;
      const table = accountType === 'Buyer' ? 'buyer_profiles' : 'companies';
      const ownerColumn = accountType === 'Buyer' ? 'user_id' : 'owner_id';
      const attach = await supabase.from(table).update({
        [column]: docUrl,
        verification_status: 'pending',
        updated_at: new Date().toISOString(),
      }).eq(ownerColumn, user.id);
      if (attach.error) {
        toast.error(`Uploaded, but it could not be attached to your profile yet: ${attach.error.message}`);
      } else {
        toast.success(`${type.toUpperCase()} document uploaded successfully!`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload document');
    } finally {
      setUploadingDoc(null);
    }
  };

  // Add product tag
  const handleAddProduct = () => {
    const val = productInput.trim();
    if (val && !productsSupplied.includes(val)) {
      setProductsSupplied(p => [...p, val]);
      setProductInput('');
    }
  };

  const handleRemoveProduct = (p: string) => {
    setProductsSupplied(prev => prev.filter(x => x !== p));
  };

  // Calculate completion percentage
  const calculateCompletionScore = (): number => {
    let score = 20; // Step 1 complete
    if (personal.fullName && personal.phone && personal.city && personal.state) score += 20;
    if (business.legalName && business.description && (business.gstNumber || business.registrationNumber)) score += 25;
    if (selectedCategories.length > 0 && productsSupplied.length > 0) score += 20;
    if (docs.gstDocUrl || docs.panDocUrl || docs.regDocUrl || docs.iecDocUrl) score += 15;
    return Math.min(100, score);
  };

  const persistWizard = async (opts: { step: number; completed: boolean }): Promise<{ error: string | null }> => {
    if (!user) return { error: 'You must be logged in to save progress.' };
    const isBuyer = accountType === 'Buyer';
    const completionScore = opts.completed ? Math.max(75, calculateCompletionScore()) : calculateCompletionScore();
    const hasUploadedDoc = Boolean(docs.gstDocUrl || docs.panDocUrl || docs.regDocUrl || docs.iecDocUrl);
    const status = opts.completed ? (hasUploadedDoc ? 'pending' : 'unverified') : verificationStatus;
    const now = new Date().toISOString();
    const legalName = business.legalName.trim();
    const year = parseInt(business.yearEstablished, 10);

    try {
      if (isBuyer) {
        const buyerPayload = {
          user_id: user.id,
          company_name: legalName || 'My Procurement Business',
          brand_name: business.brandName.trim() || null,
          business_type: business.businessType || 'Buyer',
          registration_number: business.registrationNumber.trim() || null,
          gst_number: business.gstNumber.trim() || null,
          pan_number: business.panNumber.trim() || null,
          website: business.website.trim() || null,
          address: business.address.trim() || null,
          city: personal.city.trim() || null,
          state: personal.state.trim() || null,
          country: personal.country || 'India',
          pincode: business.pincode.trim() || null,
          description: business.description.trim() || null,
          product_categories: selectedCategories,
          target_products: productsSupplied,
          trade_type: tradeType,
          countries_served: countriesServed,
          payment_terms: paymentTerms,
          gst_doc_url: docs.gstDocUrl || null,
          pan_doc_url: docs.panDocUrl || null,
          reg_doc_url: docs.regDocUrl || null,
          onboarding_step: opts.step,
          onboarding_completed: opts.completed,
          profile_completion: completionScore,
          verification_status: status,
          updated_at: now,
        };
        const existing = await withTimeout(
          supabase.from('buyer_profiles').select('id').eq('user_id', user.id).maybeSingle()
        );
        if (existing.error) return { error: `Could not read your business profile: ${existing.error.message}` };
        const buyerRes = existing.data?.id
          ? await withTimeout(supabase.from('buyer_profiles').update(buyerPayload).eq('user_id', user.id))
          : await withTimeout(supabase.from('buyer_profiles').insert(buyerPayload));
        if (buyerRes.error) return { error: `Could not save your business profile: ${buyerRes.error.message}` };
      } else {
        const slug = (legalName || 'supplier').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + user.id.slice(0, 6);
        const companyPayload: Record<string, unknown> = {
          owner_id: user.id,
          brand_name: business.brandName.trim() || null,
          business_type: business.businessType || accountType,
          registration_number: business.registrationNumber.trim() || null,
          gst_number: business.gstNumber.trim() || null,
          pan_number: business.panNumber.trim() || null,
          iec_number: business.iecNumber.trim() || null,
          address: business.address.trim() || null,
          city: personal.city.trim() || null,
          state: personal.state.trim() || null,
          country: personal.country || 'India',
          pincode: business.pincode.trim() || null,
          website: business.website.trim() || null,
          year_established: Number.isFinite(year) ? year : null,
          description: business.description.trim() || null,
          product_categories: selectedCategories,
          key_products: productsSupplied,
          moq_policy: moq.trim() || null,
          production_capacity: capacity.trim() || null,
          trade_type: tradeType,
          export_destinations: countriesServed,
          payment_terms: paymentTerms,
          shipping_capabilities: shippingCapabilities.join(', '),
          gst_doc_url: docs.gstDocUrl || null,
          iec_doc_url: docs.iecDocUrl || null,
          pan_doc_url: docs.panDocUrl || null,
          reg_doc_url: docs.regDocUrl || null,
          onboarding_step: opts.step,
          onboarding_completed: opts.completed,
          profile_completion: completionScore,
          verification_status: status,
          updated_at: now,
        };
        if (legalName) companyPayload.company_name = legalName;

        const existing = await withTimeout(
          supabase.from('companies').select('id').eq('owner_id', user.id).maybeSingle()
        );
        if (existing.error) return { error: `Could not read your company profile: ${existing.error.message}` };
        const companyRes = existing.data?.id
          ? await withTimeout(supabase.from('companies').update(companyPayload).eq('owner_id', user.id))
          : await withTimeout(supabase.from('companies').insert({
              ...companyPayload,
              company_name: legalName || 'My Industrial Company',
              slug,
              verification_status: opts.completed ? status : 'unverified',
              is_verified: false,
              is_featured: false,
              total_products: 0,
              total_quotes_sent: 0,
            }));
        if (companyRes.error) return { error: `Could not save your company profile: ${companyRes.error.message}` };
      }

      const profRes = await withTimeout(supabase.from('profiles').update({
        full_name: personal.fullName.trim() || profile?.full_name,
        phone: personal.phone.trim() || profile?.phone || null,
        whatsapp_number: personal.whatsappNumber.trim() || null,
        country: personal.country,
        state: personal.state,
        city: personal.city,
        role: isBuyer ? 'buyer' : 'supplier',
        ...(opts.completed ? { onboarding_completed: true } : {}),
        updated_at: now,
      }).eq('id', user.id));
      if (profRes.error) return { error: `Could not save your personal details: ${profRes.error.message}` };
      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save your profile. Please try again.';
      return { error: message };
    }
  };
  persistRef.current = persistWizard;

  const handleSaveDraft = async () => {
    if (submitLock.current) return;
    if (!user) {
      toast.error('You must be logged in to save progress');
      return;
    }
    submitLock.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await persistWizard({ step: currentStep, completed: false });
      if (saved.error) {
        setSaveError(saved.error);
        toast.error(saved.error);
        return;
      }
      toast.success('Draft saved successfully! You can resume anytime.');
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  };

  const handleCompleteProfile = async () => {
    if (!user || submitLock.current) return;

    for (const step of [1, 2, 3, 4] as const) {
      const errors = validateStep(step);
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setCurrentStep(step);
        toast.error('Please complete all required fields before launching your profile');
        setTimeout(scrollToFirstError, 80);
        return;
      }
    }

    const finalErrors = validateStep(5);
    if (Object.keys(finalErrors).length > 0) {
      setFieldErrors(finalErrors);
      toast.error('Please fix the highlighted fields');
      scrollToFirstError();
      return;
    }

    submitLock.current = true;
    setCompleting(true);
    setSaveError(null);
    const isBuyer = accountType === 'Buyer';
    try {
      const saved = await persistWizard({ step: 5, completed: true });
      if (saved.error) {
        setSaveError(saved.error);
        toast.error(saved.error);
        return;
      }

      try {
        await withTimeout(refreshProfile(), 4000);
      } catch (refreshErr) {
        console.warn('Profile refresh after save did not finish:', refreshErr);
      }
      toast.success('Business profile setup completed successfully!');
      const finalRole = isBuyer ? 'buyer' : 'supplier';
      const fullName = personal.fullName.trim();
      // After this click returns, so the auth lock cannot freeze "Completing Profile...".
      window.setTimeout(() => {
        void supabase.auth.updateUser({ data: { role: finalRole, full_name: fullName } }).then((metaRes) => {
          if (metaRes.error) console.warn('Auth metadata sync failed:', metaRes.error.message);
        }).catch((metaErr) => console.warn('Auth metadata sync skipped:', metaErr));
      }, 0);
      if (!isBuyer) void seedWelcomeLeadsInBackground(user.id, business.legalName);
      navigate(isBuyer ? '/dashboard/buyer' : '/dashboard/supplier', { replace: true });
    } finally {
      submitLock.current = false;
      setCompleting(false);
    }
  };

  const steps = [
    { num: 1, title: 'Account Type', icon: Briefcase },
    { num: 2, title: 'Personal Details', icon: User },
    { num: 3, title: 'Business Details', icon: Building2 },
    { num: 4, title: 'Operations', icon: Layers },
    { num: 5, title: 'Verification', icon: ShieldCheck },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Loading profile setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PageMeta title="Business Profile Setup Wizard | BulkSkart" description="Complete your official BulkSkart business registration and trade profile." />

      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-foreground truncate">Business Profile Setup Wizard</h1>
            <p className="text-[11px] text-muted-foreground truncate">Official verification & marketplace onboarding</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={saving || completing}
            className="text-xs h-8 gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save Draft</span>
          </Button>
          <Button
            size="sm"
            onClick={() => navigate(accountType === 'Buyer' ? '/dashboard/buyer' : '/dashboard/supplier')}
            variant="ghost"
            className="text-xs h-8 text-muted-foreground hover:text-foreground"
          >
            Exit to Dashboard
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6">
        {saveError && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{saveError}</p>
          </div>
        )}
        {loadError && (
          <div role="alert" className="flex flex-col gap-3 rounded-xl border border-[#FF5A00]/40 bg-[#FF5A00]/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Your saved details did not load</p>
              <p className="mt-0.5 text-xs text-muted-foreground break-words">{loadError}</p>
            </div>
            <Button size="sm" onClick={() => setReloadKey((k) => k + 1)} className="shrink-0">
              Retry loading
            </Button>
          </div>
        )}
        {/* Progress Bar & Steps Indicator */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Step {currentStep} of 5: {steps[currentStep - 1]?.title}</span>
            <span className="text-primary">{calculateCompletionScore()}% Completed</span>
          </div>

          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#C94400] h-full transition-all duration-300 rounded-full"
              style={{ width: `${(currentStep / 5) * 100}%` }}
            />
          </div>

          <div className="grid grid-cols-5 gap-1 sm:gap-2 pt-1">
            {steps.map(s => {
              const Icon = s.icon;
              const isActive = s.num === currentStep;
              const isPast = s.num < currentStep;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => handleStepJump(s.num)}
                  className={`flex flex-col items-center text-center p-1.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-bold'
                      : isPast
                      ? 'text-foreground hover:bg-muted/50'
                      : 'text-muted-foreground/60 hover:text-muted-foreground'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs mb-1 ${
                    isActive
                      ? 'bg-[#C94400] text-white shadow-sm'
                      : isPast
                      ? 'bg-[#FF5A00]/20 text-[#FF7A2E]'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {isPast ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-[10px] sm:text-xs leading-tight line-clamp-1">{s.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Wizard Step Content */}
        <Card className="border-border bg-card shadow-sm">
          {/* STEP 1: ACCOUNT TYPE */}
          {currentStep === 1 && (
            <div>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary" />
                  Select Your Account & Trading Role
                </CardTitle>
                <CardDescription>
                  Choose how your enterprise operates on BulkSkart. This tailors your RFQs, catalog tools, and verification requirements.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FieldError message={fieldErrors.accountType} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ACCOUNT_TYPES.map(type => (
                    <div
                      key={type.id}
                      onClick={() => {
                        setAccountType(type.id);
                        clearFieldError('accountType');
                      }}
                      className={`cursor-pointer border rounded-xl p-4 transition-all ${
                        accountType === type.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm'
                          : fieldErrors.accountType
                          ? 'border-destructive/50 bg-card hover:border-primary/40'
                          : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm sm:text-base text-foreground">{type.label}</p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{type.desc}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          accountType === type.id ? 'border-primary bg-[#C94400] text-white' : 'border-border'
                        }`}>
                          {accountType === type.id && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                      <Badge variant="outline" className="mt-3 text-[10px] uppercase font-semibold">
                        Role: {type.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </div>
          )}

          {/* STEP 2: PERSONAL DETAILS */}
          {currentStep === 2 && (
            <div>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Authorized Representative Details
                </CardTitle>
                <CardDescription>
                  Provide the contact information of the primary account holder or procurement director.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Full Name <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="e.g. Rajesh Sharma"
                      value={personal.fullName}
                      aria-invalid={Boolean(fieldErrors.fullName)}
                      onChange={e => {
                        setPersonal(p => ({ ...p, fullName: e.target.value }));
                        clearFieldError('fullName');
                      }}
                      className={cn('bg-background text-sm', fieldErrors.fullName && 'border-destructive focus-visible:ring-destructive')}
                    />
                    <FieldError message={fieldErrors.fullName} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Official Email Address <span className="text-destructive">*</span></Label>
                    <Input
                      type="email"
                      placeholder="name@company.com"
                      value={personal.email}
                      disabled
                      aria-invalid={Boolean(fieldErrors.email)}
                      className={cn('bg-muted text-muted-foreground text-sm cursor-not-allowed', fieldErrors.email && 'border-destructive')}
                    />
                    <p className="text-[10px] text-muted-foreground">Linked to your authenticated login credentials</p>
                    <FieldError message={fieldErrors.email} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Mobile Phone Number <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="e.g. +91 98765 43210"
                      value={personal.phone}
                      inputMode="tel"
                      autoComplete="tel"
                      aria-invalid={Boolean(fieldErrors.phone)}
                      onChange={e => {
                        setPersonal(p => ({ ...p, phone: e.target.value }));
                        clearFieldError('phone');
                      }}
                      className={cn('bg-background text-sm', fieldErrors.phone && 'border-destructive focus-visible:ring-destructive')}
                    />
                    <FieldError message={fieldErrors.phone} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">WhatsApp Number (For Direct RFQ Alerts)</Label>
                    <Input
                      placeholder="e.g. +91 98765 43210"
                      value={personal.whatsappNumber}
                      inputMode="tel"
                      aria-invalid={Boolean(fieldErrors.whatsappNumber)}
                      onChange={e => {
                        setPersonal(p => ({ ...p, whatsappNumber: e.target.value }));
                        clearFieldError('whatsappNumber');
                      }}
                      className={cn('bg-background text-sm', fieldErrors.whatsappNumber && 'border-destructive focus-visible:ring-destructive')}
                    />
                    <FieldError message={fieldErrors.whatsappNumber} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Country <span className="text-destructive">*</span></Label>
                    <select
                      value={personal.country}
                      aria-invalid={Boolean(fieldErrors.country)}
                      onChange={e => {
                        setPersonal(p => ({ ...p, country: e.target.value }));
                        clearFieldError('country');
                      }}
                      className={cn(
                        'w-full h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary',
                        fieldErrors.country ? 'border-destructive focus:ring-destructive' : 'border-input'
                      )}
                    >
                      {COUNTRIES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <FieldError message={fieldErrors.country} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">State / Province <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="e.g. Maharashtra, Gujarat, Delhi"
                      value={personal.state}
                      aria-invalid={Boolean(fieldErrors.state)}
                      onChange={e => {
                        setPersonal(p => ({ ...p, state: e.target.value }));
                        clearFieldError('state');
                      }}
                      className={cn('bg-background text-sm', fieldErrors.state && 'border-destructive focus-visible:ring-destructive')}
                    />
                    <FieldError message={fieldErrors.state} />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold">City <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="e.g. Mumbai, Ahmedabad, Surat, New Delhi"
                      value={personal.city}
                      aria-invalid={Boolean(fieldErrors.city)}
                      onChange={e => {
                        setPersonal(p => ({ ...p, city: e.target.value }));
                        clearFieldError('city');
                      }}
                      className={cn('bg-background text-sm', fieldErrors.city && 'border-destructive focus-visible:ring-destructive')}
                    />
                    <FieldError message={fieldErrors.city} />
                  </div>
                </div>
              </CardContent>
            </div>
          )}

          {/* STEP 3: BUSINESS DETAILS */}
          {currentStep === 3 && (
            <div>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Legal Enterprise & Registration Details
                </CardTitle>
                <CardDescription>
                  Enter your authentic legal company information. This is validated against your business certificates.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Legal Business Name <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="e.g. Apex Precision Forgings Pvt Ltd"
                      value={business.legalName}
                      aria-invalid={Boolean(fieldErrors.legalName)}
                      onChange={e => {
                        setBusiness(b => ({ ...b, legalName: e.target.value }));
                        clearFieldError('legalName');
                      }}
                      className={cn('bg-background text-sm', fieldErrors.legalName && 'border-destructive focus-visible:ring-destructive')}
                    />
                    <FieldError message={fieldErrors.legalName} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Brand / Trade Name</Label>
                    <Input
                      placeholder="e.g. Apex Tools (if different)"
                      value={business.brandName}
                      onChange={e => setBusiness(b => ({ ...b, brandName: e.target.value }))}
                      className="bg-background text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Business Registration / CIN / Udyam</Label>
                    <Input
                      placeholder="e.g. UDYAM-MH-01-0012345"
                      value={business.registrationNumber}
                      onChange={e => setBusiness(b => ({ ...b, registrationNumber: e.target.value }))}
                      className="bg-background text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">GSTIN (India) / Tax ID</Label>
                    <Input
                      placeholder="e.g. 27ABCDE1234F1Z5"
                      value={business.gstNumber}
                      aria-invalid={Boolean(fieldErrors.gstNumber)}
                      onChange={e => {
                        setBusiness(b => ({ ...b, gstNumber: e.target.value.toUpperCase() }));
                        clearFieldError('gstNumber');
                      }}
                      className={cn('bg-background text-sm font-mono', fieldErrors.gstNumber && 'border-destructive focus-visible:ring-destructive')}
                    />
                    <FieldError message={fieldErrors.gstNumber} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">PAN Number</Label>
                    <Input
                      placeholder="e.g. ABCDE1234F"
                      value={business.panNumber}
                      aria-invalid={Boolean(fieldErrors.panNumber)}
                      onChange={e => {
                        setBusiness(b => ({ ...b, panNumber: e.target.value.toUpperCase() }));
                        clearFieldError('panNumber');
                      }}
                      className={cn('bg-background text-sm font-mono', fieldErrors.panNumber && 'border-destructive focus-visible:ring-destructive')}
                    />
                    <FieldError message={fieldErrors.panNumber} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">IEC Code (For Import / Export)</Label>
                    <Input
                      placeholder="e.g. 0308994411 (10 Digits)"
                      value={business.iecNumber}
                      aria-invalid={Boolean(fieldErrors.iecNumber)}
                      onChange={e => {
                        setBusiness(b => ({ ...b, iecNumber: e.target.value }));
                        clearFieldError('iecNumber');
                      }}
                      className={cn('bg-background text-sm font-mono', fieldErrors.iecNumber && 'border-destructive focus-visible:ring-destructive')}
                    />
                    <FieldError message={fieldErrors.iecNumber} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Year of Establishment</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 2012"
                      value={business.yearEstablished}
                      aria-invalid={Boolean(fieldErrors.yearEstablished)}
                      onChange={e => {
                        setBusiness(b => ({ ...b, yearEstablished: e.target.value }));
                        clearFieldError('yearEstablished');
                      }}
                      className={cn('bg-background text-sm', fieldErrors.yearEstablished && 'border-destructive focus-visible:ring-destructive')}
                    />
                    <FieldError message={fieldErrors.yearEstablished} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Company Website (Optional)</Label>
                    <Input
                      placeholder="https://www.yourcompany.com"
                      value={business.website}
                      aria-invalid={Boolean(fieldErrors.website)}
                      onChange={e => {
                        setBusiness(b => ({ ...b, website: e.target.value }));
                        clearFieldError('website');
                      }}
                      className={cn('bg-background text-sm', fieldErrors.website && 'border-destructive focus-visible:ring-destructive')}
                    />
                    <FieldError message={fieldErrors.website} />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold">Registered Factory / Office Address</Label>
                    <Input
                      placeholder="Plot No., Industrial Area, Phase II"
                      value={business.address}
                      onChange={e => setBusiness(b => ({ ...b, address: e.target.value }))}
                      className="bg-background text-sm"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold">Business Overview & Capabilities</Label>
                    <Textarea
                      rows={3}
                      placeholder="Describe your manufacturing facilities, quality control standards, machinery, and wholesale specialties..."
                      value={business.description}
                      onChange={e => setBusiness(b => ({ ...b, description: e.target.value }))}
                      className="bg-background text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </div>
          )}

          {/* STEP 4: OPERATIONS */}
          {currentStep === 4 && (
            <div>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" />
                  Product Categories & Supply Operations
                </CardTitle>
                <CardDescription>
                  Configure your primary wholesale categories, minimum order quantities, and delivery capabilities.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Product Categories */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Primary Product Categories (Select applicable) <span className="text-destructive">*</span>
                  </Label>
                  <div
                    className={cn(
                      'flex flex-wrap gap-2 rounded-xl p-2 -m-2',
                      fieldErrors.categories && 'ring-1 ring-destructive/60 bg-destructive/5'
                    )}
                  >
                    {PRODUCT_CATEGORIES.map(cat => {
                      const isSelected = selectedCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCategories(p => p.filter(c => c !== cat));
                            } else {
                              setSelectedCategories(p => [...p, cat]);
                            }
                            clearFieldError('categories');
                          }}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            isSelected
                              ? 'bg-[#C94400] text-white border-primary shadow-sm'
                              : 'bg-background border-border text-foreground hover:bg-muted'
                          }`}
                        >
                          {cat} {isSelected && '✓'}
                        </button>
                      );
                    })}
                  </div>
                  <FieldError message={fieldErrors.categories} />
                </div>

                {/* Specific Products Supplied Tag Input */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Products Manufactured or Procured (Press Enter to add) <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. Stainless Steel Valves, Hydraulic Pumps, Cotton Yarn"
                      value={productInput}
                      aria-invalid={Boolean(fieldErrors.products)}
                      onChange={e => {
                        setProductInput(e.target.value);
                        clearFieldError('products');
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddProduct();
                          clearFieldError('products');
                        }
                      }}
                      className={cn('bg-background text-sm', fieldErrors.products && 'border-destructive focus-visible:ring-destructive')}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        handleAddProduct();
                        clearFieldError('products');
                      }}
                      variant="secondary"
                    >
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {productsSupplied.map(p => (
                      <Badge key={p} variant="outline" className="text-xs py-1 px-2.5 border-primary/30 text-foreground gap-1.5">
                        {p}
                        <button type="button" onClick={() => handleRemoveProduct(p)} className="hover:text-destructive text-muted-foreground ml-1">
                          ×
                        </button>
                      </Badge>
                    ))}
                    {productsSupplied.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No products added yet. Add at least 1-2 product types.</p>
                    )}
                  </div>
                  <FieldError message={fieldErrors.products} />
                </div>

                {/* MOQ & Capacity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Minimum Order Quantity (MOQ)</Label>
                    <Input
                      placeholder="e.g. 50 Units, 500 Kilograms, 1 Container"
                      value={moq}
                      onChange={e => setMoq(e.target.value)}
                      className="bg-background text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Monthly Production / Supply Capacity</Label>
                    <Input
                      placeholder="e.g. 25,000 Units / Month"
                      value={capacity}
                      onChange={e => setCapacity(e.target.value)}
                      className="bg-background text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Trade Scope</Label>
                    <select
                      value={tradeType}
                      onChange={e => setTradeType(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="domestic">Domestic Trade Only (India)</option>
                      <option value="export">International Export Focus</option>
                      <option value="import">Import for Distribution</option>
                      <option value="both">Both Domestic & Global Export</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Key Countries / Regions Served</Label>
                    <Input
                      placeholder="e.g. India, UAE, USA, Germany, Africa"
                      value={countriesServed.join(', ')}
                      onChange={e => setCountriesServed(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      className="bg-background text-sm"
                    />
                  </div>
                </div>

                {/* Payment Terms & Shipping */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Preferred Payment Terms</Label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_TERMS.map(term => {
                      const isSel = paymentTerms.includes(term);
                      return (
                        <button
                          key={term}
                          type="button"
                          onClick={() => {
                            if (isSel) setPaymentTerms(p => p.filter(t => t !== term));
                            else setPaymentTerms(p => [...p, term]);
                          }}
                          className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                            isSel ? 'bg-primary/10 border-primary text-primary font-semibold' : 'bg-background border-border text-foreground hover:bg-muted'
                          }`}
                        >
                          {term}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Shipping & Dispatch Capabilities</Label>
                  <div className="flex flex-wrap gap-2">
                    {SHIPPING_MODES.map(mode => {
                      const isSel = shippingCapabilities.includes(mode);
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => {
                            if (isSel) setShippingCapabilities(p => p.filter(m => m !== mode));
                            else setShippingCapabilities(p => [...p, mode]);
                          }}
                          className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                            isSel ? 'bg-primary/10 border-primary text-primary font-semibold' : 'bg-background border-border text-foreground hover:bg-muted'
                          }`}
                        >
                          {mode}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </div>
          )}

          {/* STEP 5: VERIFICATION & COMPLETION */}
          {currentStep === 5 && (
            <div>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Business Verification & Document Upload
                </CardTitle>
                <CardDescription>
                  Upload your legitimate business registration documents to earn the BulkSkart Verified badge and unlock high-value RFQ matching.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Status Indicator Banner */}
                <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                  verificationStatus === 'verified'
                    ? 'bg-[#FF5A00]/10 border-[#FF5A00]/30 text-[#FF7A2E] dark:text-[#FF7A2E]'
                    : verificationStatus === 'pending'
                    ? 'bg-[#FF5A00]/10 border-[#FF5A00]/30 text-[#FF7A2E] dark:text-[#FF7A2E]'
                    : verificationStatus === 'rejected'
                    ? 'bg-destructive/10 border-destructive/30 text-destructive'
                    : 'bg-muted/50 border-border text-muted-foreground'
                }`}>
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">
                        Verification Status: {verificationStatus === 'verified' ? 'Verified Enterprise' : verificationStatus === 'pending' ? 'Documents Pending Review' : verificationStatus === 'rejected' ? 'Verification Rejected' : 'Not Submitted (Unverified)'}
                      </p>
                      <p className="text-xs opacity-90">
                        {verificationStatus === 'verified'
                          ? 'Your enterprise has passed KYC and is authorized for high-volume transactions.'
                          : verificationStatus === 'pending'
                          ? 'Our compliance team reviews documents within 1-2 business days.'
                          : 'Upload certificates below to request official verification.'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs uppercase font-bold">
                    {verificationStatus}
                  </Badge>
                </div>

                {/* Upload Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* GST Document */}
                  <div className="p-4 rounded-xl border border-border bg-background space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">GST Registration Certificate</p>
                        <p className="text-xs text-muted-foreground">PDF or JPG/PNG image of Form REG-06</p>
                      </div>
                      {docs.gstDocUrl ? (
                        <Badge className="bg-[#1A0C05] text-white text-[10px] gap-1">
                          <Check className="w-3 h-3" /> Uploaded
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                      )}
                    </div>
                    <div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadDoc(file, 'gst');
                          }}
                        />
                        <div className="h-9 w-full rounded-md border border-dashed border-primary/40 hover:bg-primary/5 flex items-center justify-center gap-2 text-xs text-primary font-medium transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingDoc === 'gst' ? 'Uploading...' : docs.gstDocUrl ? 'Replace GST Document' : 'Upload GST Certificate'}
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* PAN Card */}
                  <div className="p-4 rounded-xl border border-border bg-background space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Company / Proprietor PAN Card</p>
                        <p className="text-xs text-muted-foreground">Official Income Tax Department PAN</p>
                      </div>
                      {docs.panDocUrl ? (
                        <Badge className="bg-[#1A0C05] text-white text-[10px] gap-1">
                          <Check className="w-3 h-3" /> Uploaded
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                      )}
                    </div>
                    <div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadDoc(file, 'pan');
                          }}
                        />
                        <div className="h-9 w-full rounded-md border border-dashed border-primary/40 hover:bg-primary/5 flex items-center justify-center gap-2 text-xs text-primary font-medium transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingDoc === 'pan' ? 'Uploading...' : docs.panDocUrl ? 'Replace PAN Card' : 'Upload PAN Card'}
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* IEC Certificate */}
                  <div className="p-4 rounded-xl border border-border bg-background space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Import Export Code (IEC)</p>
                        <p className="text-xs text-muted-foreground">DGFT issued Certificate for foreign trade</p>
                      </div>
                      {docs.iecDocUrl ? (
                        <Badge className="bg-[#1A0C05] text-white text-[10px] gap-1">
                          <Check className="w-3 h-3" /> Uploaded
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Optional</Badge>
                      )}
                    </div>
                    <div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadDoc(file, 'iec');
                          }}
                        />
                        <div className="h-9 w-full rounded-md border border-dashed border-primary/40 hover:bg-primary/5 flex items-center justify-center gap-2 text-xs text-primary font-medium transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingDoc === 'iec' ? 'Uploading...' : docs.iecDocUrl ? 'Replace IEC Document' : 'Upload IEC Certificate'}
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Company Registration / Udyam */}
                  <div className="p-4 rounded-xl border border-border bg-background space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Udyam / MSME / Incorporation</p>
                        <p className="text-xs text-muted-foreground">Ministry of MSME / MCA Incorporation</p>
                      </div>
                      {docs.regDocUrl ? (
                        <Badge className="bg-[#1A0C05] text-white text-[10px] gap-1">
                          <Check className="w-3 h-3" /> Uploaded
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Optional</Badge>
                      )}
                    </div>
                    <div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadDoc(file, 'reg');
                          }}
                        />
                        <div className="h-9 w-full rounded-md border border-dashed border-primary/40 hover:bg-primary/5 flex items-center justify-center gap-2 text-xs text-primary font-medium transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingDoc === 'reg' ? 'Uploading...' : docs.regDocUrl ? 'Replace Certificate' : 'Upload Registration Document'}
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Completion summary */}
                <div className="p-4 rounded-xl bg-card border border-border text-xs space-y-2 text-muted-foreground">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <Info className="w-4 h-4 text-primary shrink-0" />
                    <span>Next steps after profile completion</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 pl-1">
                    <li>Your profile details are stored securely under your authenticated account ID.</li>
                    <li>If documents are uploaded, verification status switches to Pending Review.</li>
                    <li>You can update products, capacity, and credentials anytime from your Profile Settings.</li>
                  </ul>
                </div>
              </CardContent>
            </div>
          )}

          {/* Navigation Controls Footer */}
          <div className="border-t border-border p-4 sm:p-5 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 bg-card/50">
            <div>
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackStep}
                  disabled={saving || completing}
                  className="w-full sm:w-auto text-xs gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back: {steps[currentStep - 2]?.title}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={saving || completing}
                className="flex-1 sm:flex-initial text-xs gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Draft'}
              </Button>

              {currentStep < 5 ? (
                <Button
                  type="button"
                  onClick={handleNextStep}
                  disabled={saving || completing}
                  className="flex-1 sm:flex-initial bg-[#1A0C05] text-white hover:bg-primary/90 text-xs gap-1.5"
                >
                  {saving ? 'Saving...' : 'Next Step'} <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleCompleteProfile}
                  disabled={completing || saving}
                  className="flex-1 sm:flex-initial bg-[#B33D00] hover:bg-[#1A0C05] text-white text-xs gap-1.5 font-bold shadow-md"
                >
                  {completing ? 'Completing Profile...' : 'Complete Profile & Launch'}
                  <CheckCircle2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}

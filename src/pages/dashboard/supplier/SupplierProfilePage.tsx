import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import SingleImageUploader from '@/components/common/SingleImageUploader';
import AutoQuoteSettingsPanel from '@/components/common/AutoQuoteSettingsPanel';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { updateCompany, getCompanyCertifications, upsertCertification, deleteCertification } from '@/lib/api';
import type { Company, CompanyCertification } from '@/types/types';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import {
  Building2, Upload, ShieldCheck, Award, Plus, Trash2,
  Camera, CheckCircle, Clock, Globe, Users, TrendingUp,
  BarChart3, Star, Zap, Info, AlertTriangle, AlertCircle,
  Lock, RefreshCw,
} from 'lucide-react';
import PageMeta from '@/components/common/PageMeta';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

const PAYMENT_TERMS_OPTIONS = ['LC', 'TT', 'DP', 'DA', 'Cash in Advance', 'Others'];
const EMPLOYEE_RANGES = ['1-10', '11-50', '51-200', '201-500', '500+'];
const TURNOVER_RANGES = ['<₹1Cr', '₹1–5Cr', '₹5–10Cr', '₹10–50Cr', '₹50Cr+'];
const BUSINESS_TYPES = ['Manufacturer', 'Trader', 'Both'];

const COUNTRY_LIST = [
  'India', 'USA', 'China', 'UAE', 'Germany', 'UK', 'Australia', 'Canada',
  'France', 'Japan', 'South Korea', 'Brazil', 'South Africa', 'Saudi Arabia',
  'Singapore', 'Malaysia', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Pakistan',
];

function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (t: string[]) => void; placeholder?: string }) {
  const [val, setVal] = useState('');
  const add = () => {
    const v = val.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setVal('');
  };
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <Input
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder ?? 'Type and press Enter'}
          className="h-9 text-sm bg-background border-border"
        />
        <Button type="button" size="sm" variant="ghost" onClick={add} className="border border-border h-9">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map(t => (
          <Badge key={t} variant="outline" className="text-xs border-primary/30 text-primary gap-1 pr-1">
            {t}
            <button type="button" onClick={() => onChange(tags.filter(x => x !== t))} className="hover:text-destructive ml-1">×</button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

export default function SupplierProfilePage() {
  const { company: authCompany, refreshProfile } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [certs, setCerts] = useState<CompanyCertification[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  // form state
  const [form, setForm] = useState({
    company_name: '',
    tagline: '', description: '', business_type: '',
    year_established: '', employee_count_range: '', annual_turnover_range: '',
    production_capacity: '', moq_policy: '', packaging_details: '',
    contact_name: '', contact_phone: '', contact_email: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [keyProducts, setKeyProducts] = useState<string[]>([]);
  const [exportDests, setExportDests] = useState<string[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<string[]>([]);

  // Security / Password update state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  // Compute profile completion score (0–100) based on filled fields
  const computeCompletion = (c: Company | null, f: typeof form, kp: string[], crtList: CompanyCertification[]) => {
    if (!c) return 0;
    const checks = [
      !!c.logo_url,
      !!c.banner_url,
      !!f.tagline,
      !!f.description && f.description.length >= 100,
      !!f.business_type,
      !!f.year_established,
      !!f.employee_count_range,
      !!f.annual_turnover_range,
      kp.length >= 3,
      !!f.production_capacity,
      !!f.moq_policy,
      !!f.packaging_details,
      crtList.length >= 1,
      !!c.gst_number,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  };

  const completionPct = computeCompletion(company, form, keyProducts, certs);

  useEffect(() => {
    if (!authCompany) return;
    setCompany(authCompany);
    setForm({
      company_name: authCompany.company_name ?? '',
      tagline: authCompany.tagline ?? '',
      description: authCompany.description ?? '',
      business_type: authCompany.business_type ?? '',
      year_established: authCompany.year_established?.toString() ?? '',
      employee_count_range: authCompany.employee_count_range ?? authCompany.employee_count ?? '',
      annual_turnover_range: authCompany.annual_turnover_range ?? authCompany.annual_turnover ?? '',
      production_capacity: authCompany.production_capacity ?? '',
      moq_policy: authCompany.moq_policy ?? '',
      packaging_details: authCompany.packaging_details ?? '',
      contact_name: '', contact_phone: '', contact_email: '',
    });
    setKeyProducts(authCompany.key_products ?? []);
    setExportDests(authCompany.export_destinations ?? []);
    setPaymentTerms(authCompany.payment_terms ?? []);
    getCompanyCertifications(authCompany.id).then(setCerts);
  }, [authCompany]);

  const handleUpload = async (file: File, type: 'logo' | 'banner') => {
    if (!company) return;
    const setter = type === 'logo' ? setUploadingLogo : setUploadingBanner;
    setter(true);
    const ext = file.name.split('.').pop();
    const path = `${company.id}/${type}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('company-assets').upload(path, file, { upsert: true });
    if (error) { toast.error('Upload failed'); setter(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('company-assets').getPublicUrl(path);
    const field = type === 'logo' ? { logo_url: publicUrl } : { banner_url: publicUrl };
    await updateCompany(company.id, field);
    setCompany(prev => prev ? { ...prev, ...field } : prev);
    await refreshProfile();
    setter(false);
    toast.success(`${type === 'logo' ? 'Logo' : 'Banner'} updated`);
  };

  const validateSupplierProfile = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.company_name.trim()) {
      errors.company_name = 'Company legal name is required';
    }
    if (!company?.logo_url) {
      errors.logo_url = 'Company logo is required. Please upload your brand logo.';
    }
    if (!form.business_type) {
      errors.business_type = 'Please select your business type (Manufacturer / Trader / Both)';
    }
    if (!form.description.trim() || form.description.trim().length < 20) {
      errors.description = 'Company description is required (min 20 characters)';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const firstErr = Object.values(errors)[0];
      toast.error(firstErr);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!company) return;
    if (!validateSupplierProfile()) return;

    setSaving(true);
    const payload: Partial<Company> = {
      company_name: form.company_name.trim(),
      tagline: form.tagline,
      description: form.description.trim(),
      business_type: form.business_type,
      year_established: form.year_established ? parseInt(form.year_established) : null,
      employee_count_range: form.employee_count_range,
      annual_turnover_range: form.annual_turnover_range,
      production_capacity: form.production_capacity,
      moq_policy: form.moq_policy,
      packaging_details: form.packaging_details,
      key_products: keyProducts,
      export_destinations: exportDests,
      payment_terms: paymentTerms,
    };
    const { error } = await updateCompany(company.id, payload);
    if (error) toast.error(error);
    else {
      toast.success('Company profile updated successfully');
      setFieldErrors({});
      await refreshProfile();
    }
    setSaving(false);
  };

  const addCert = async () => {
    if (!company) return;
    const { error } = await upsertCertification({
      company_id: company.id, cert_type: 'other', cert_name: 'New Certificate',
    });
    if (!error) getCompanyCertifications(company.id).then(setCerts);
  };

  const removeCert = async (id: string) => {
    const { error } = await deleteCertification(id);
    if (!error) setCerts(c => c.filter(x => x.id !== id));
    else toast.error(error);
  };

  const updateCertField = async (id: string, field: keyof CompanyCertification, value: string) => {
    setCerts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    await upsertCertification({ id, [field]: value });
  };

  const togglePayment = (term: string) => {
    setPaymentTerms(prev => prev.includes(term) ? prev.filter(t => t !== term) : [...prev, term]);
  };
  const toggleExport = (country: string) => {
    setExportDests(prev => prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]);
  };

  const verifiedCerts = certs.filter(c => c.is_verified);
  const pendingCerts = certs.filter(c => c.pending_review && !c.is_verified);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setChangingPass(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update password';
      toast.error(msg);
    } finally {
      setChangingPass(false);
    }
  };

  return (
    <DashboardLayout>
      <PageMeta
        title="Company Profile — Supplier | BulkSkart"
        description="BulkSkart dashboard — manage your account, orders and trade activity."
        robots="noindex, nofollow"
      />
      <div className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-4xl w-full mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-black text-foreground">Business Profile</h1>
              <p className="text-sm text-muted-foreground">Manage your verified manufacturer profile</p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>

          {/* Profile Completion Meter */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Profile Completeness</h3>
              </div>
              <span className={`text-sm font-bold ${completionPct >= 80 ? 'text-green-500' : completionPct >= 50 ? 'text-yellow-500' : 'text-destructive'}`}>
                {completionPct}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all duration-500 ${completionPct >= 80 ? 'bg-green-500' : completionPct >= 50 ? 'bg-yellow-500' : 'bg-primary'}`}
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { label: 'Logo', done: !!company?.logo_url },
                { label: 'Banner', done: !!company?.banner_url },
                { label: 'Tagline', done: !!form.tagline },
                { label: 'Description (100+ chars)', done: form.description.length >= 100 },
                { label: '3+ Key Products', done: keyProducts.length >= 3 },
                { label: 'Capacity & MOQ', done: !!form.production_capacity && !!form.moq_policy },
                { label: 'Certifications', done: certs.length >= 1 },
                { label: 'GST Number', done: !!company?.gst_number },
              ].map(item => (
                <span key={item.label} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs ${item.done ? 'bg-green-50 border-green-300 text-green-700' : 'bg-muted border-border text-muted-foreground'}`}>
                  {item.done ? <CheckCircle className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          {/* Response Metrics (read-only) */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Performance Metrics</h3>
              <span className="text-xs text-muted-foreground ml-1">(auto-calculated)</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Response Rate', value: company?.response_rate ? `${company.response_rate}%` : '—', icon: TrendingUp, color: 'text-primary' },
                { label: 'Avg Response', value: company?.avg_response_hours ? `${company.avg_response_hours}h` : '—', icon: Clock, color: 'text-[#FF5A00]' },
                { label: 'Rating', value: company?.rating_avg ? `${Number(company.rating_avg).toFixed(1)} ★` : '—', icon: Star, color: 'text-yellow-500' },
                { label: 'Reviews', value: company?.review_count ?? 0, icon: Users, color: 'text-purple-500' },
              ].map(m => (
                <div key={m.label} className="bg-muted/50 rounded-xl p-3 text-center">
                  <m.icon className={`w-5 h-5 mx-auto mb-1 ${m.color}`} />
                  <p className="text-lg font-bold text-foreground">{m.value}</p>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Verification status banner */}
          {company && (
            <div className={`rounded-xl border p-4 flex items-center gap-3 ${
              company.is_verified
                ? 'bg-green-500/10 border-green-500/30'
                : company.verification_status === 'pending'
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-muted border-border'
            }`}>
              {company.is_verified ? (
                <ShieldCheck className="w-5 h-5 text-green-400 shrink-0" />
              ) : company.verification_status === 'pending' ? (
                <Clock className="w-5 h-5 text-yellow-400 shrink-0" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {company.is_verified ? 'Verified Business' : company.verification_status === 'pending' ? 'Verification Pending' : 'Not Verified'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {company.is_verified
                    ? `Verified on ${new Date(company.verified_at!).toLocaleDateString('en-GB', { day:'2-digit',month:'short',year:'numeric' })}`
                    : company.verification_status === 'pending'
                    ? 'Admin is reviewing your documents. This may take 1–2 business days.'
                    : 'Upload GST, IEC and company registration documents for verification.'
                  }
                </p>
              </div>
              {company.is_verified && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs shrink-0">
                  <ShieldCheck className="w-3 h-3 mr-1" /> Verified
                </Badge>
              )}
            </div>
          )}

          {/* Logo + Banner Branding Customization */}
          <div className="bg-card border border-border rounded-xl p-5 md:p-6 space-y-6">
            <div>
              <h3 className="text-sm md:text-base font-bold text-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" /> Visual Branding & Identity
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upload your company logo and cover banner. These assets are displayed on your public manufacturer profile and product listings.
              </p>
            </div>

            {/* Cover Banner Uploader */}
            <div className="space-y-2">
              <SingleImageUploader
                label="Company Cover Banner (Background)"
                description="Wide-format landscape banner (recommended 1920x640px, max 5MB). Displayed across the top of your public profile."
                value={company?.banner_url}
                shape="banner"
                bucket="company-assets"
                folder={`${company?.id || 'common'}/banner`}
                onChange={async (url) => {
                  if (!company) return;
                  await updateCompany(company.id, { banner_url: url ?? null });
                  setCompany(prev => prev ? { ...prev, banner_url: url ?? null } : prev);
                  await refreshProfile();
                }}
              />
            </div>

            {/* Company Logo Uploader */}
            <div className="pt-2 border-t border-border">
              <SingleImageUploader
                label="Company Logo (Square / Profile Icon) *"
                description="Square or circular company brand emblem (min 200x200px, max 5MB). Displayed on cards, search results, and chat. Mandatory for verified supplier status."
                value={company?.logo_url}
                shape="square"
                bucket="company-assets"
                folder={`${company?.id || 'common'}/logo`}
                onChange={async (url) => {
                  if (!company) return;
                  await updateCompany(company.id, { logo_url: url ?? null });
                  setCompany(prev => prev ? { ...prev, logo_url: url ?? null } : prev);
                  setFieldErrors(prev => ({ ...prev, logo_url: '' }));
                  await refreshProfile();
                }}
              />
              {fieldErrors.logo_url && (
                <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {fieldErrors.logo_url}
                </p>
              )}
            </div>

            {/* Basic Info Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-border">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Company Legal Name *</Label>
                <Input
                  value={form.company_name}
                  onChange={e => { setForm(f => ({ ...f, company_name: e.target.value })); setFieldErrors(prev => ({ ...prev, company_name: '' })); }}
                  placeholder="e.g. Apex Industrial Solutions Ltd"
                  className={`h-9 text-sm bg-background ${fieldErrors.company_name ? 'border-destructive ring-1 ring-destructive' : 'border-border'}`}
                />
                {fieldErrors.company_name && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {fieldErrors.company_name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tagline</Label>
                <Input value={form.tagline} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
                  placeholder="e.g. Premium Textile Manufacturer Since 2001"
                  className="h-9 text-sm bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Business Type *</Label>
                <Select value={form.business_type} onValueChange={v => { setForm(f => ({ ...f, business_type: v })); setFieldErrors(prev => ({ ...prev, business_type: '' })); }}>
                  <SelectTrigger className={`h-9 text-sm bg-background ${fieldErrors.business_type ? 'border-destructive ring-1 ring-destructive' : 'border-border'}`}>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                {fieldErrors.business_type && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {fieldErrors.business_type}</p>}
              </div>
            </div>
          </div>

          {/* About */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" /> About the Company
            </h3>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Company Description * <span className="text-muted-foreground/60">({form.description.length}/2000)</span></Label>
              <Textarea
                value={form.description}
                onChange={e => { setForm(f => ({ ...f, description: e.target.value.slice(0, 2000) })); setFieldErrors(prev => ({ ...prev, description: '' })); }}
                placeholder="Describe your company, products, manufacturing experience and strengths (minimum 20 characters)..."
                rows={4}
                className={`text-sm bg-background resize-none ${fieldErrors.description ? 'border-destructive ring-1 ring-destructive' : 'border-border'}`}
              />
              {fieldErrors.description && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {fieldErrors.description}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Key Products / Specializations</Label>
              <TagInput tags={keyProducts} onChange={setKeyProducts} placeholder="e.g. Cotton Fabric (press Enter)" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Year Established</Label>
                <Input type="number" min="1900" max={new Date().getFullYear()}
                  value={form.year_established}
                  onChange={e => setForm(f => ({ ...f, year_established: e.target.value }))}
                  placeholder="e.g. 2005" className="h-9 text-sm bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Employees</Label>
                <Select value={form.employee_count_range} onValueChange={v => setForm(f => ({ ...f, employee_count_range: v }))}>
                  <SelectTrigger className="h-9 text-sm bg-background border-border">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_RANGES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Annual Turnover</Label>
                <Select value={form.annual_turnover_range} onValueChange={v => setForm(f => ({ ...f, annual_turnover_range: v }))}>
                  <SelectTrigger className="h-9 text-sm bg-background border-border">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    {TURNOVER_RANGES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Export Destinations */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Export Destinations
            </h3>
            <div className="flex flex-wrap gap-2">
              {COUNTRY_LIST.map(c => (
                <button key={c} type="button" onClick={() => toggleExport(c)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    exportDests.includes(c)
                      ? 'bg-primary/20 border-primary/40 text-primary'
                      : 'bg-muted border-border text-muted-foreground hover:border-primary/30'
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Verifications & Certifications */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" /> Verifications & Certifications
              </h3>
              <Button type="button" size="sm" variant="ghost" onClick={addCert}
                className="text-xs border border-border gap-1 h-7">
                <Plus className="w-3 h-3" /> Add Cert
              </Button>
            </div>

            {/* Core verification badges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: 'GST Verified', field: 'gst_doc_url', certType: 'gst' },
                { label: 'IEC Verified', field: 'iec_doc_url', certType: 'iec' },
                { label: 'Company Reg. Verified', field: 'reg_doc_url', certType: 'company_reg' },
              ].map(badge => {
                const isVerified = verifiedCerts.some(c => c.cert_type === badge.certType);
                const isPending = pendingCerts.some(c => c.cert_type === badge.certType);
                return (
                  <div key={badge.label} className={`rounded-lg border p-3 flex items-center gap-3 ${
                    isVerified ? 'bg-green-500/10 border-green-500/30' :
                    isPending ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-muted border-border'
                  }`}>
                    {isVerified
                      ? <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                      : isPending
                      ? <Clock className="w-4 h-4 text-yellow-400 shrink-0" />
                      : <ShieldCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                    }
                    <div>
                      <p className="text-xs font-medium text-foreground">{badge.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {isVerified ? 'Verified' : isPending ? 'Under Review' : 'Not submitted'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Additional certs */}
            {certs.filter(c => !['gst','iec','company_reg'].includes(c.cert_type)).map(cert => (
              <div key={cert.id} className="flex gap-3 items-start p-3 border border-border rounded-lg bg-muted/20">
                <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <Select value={cert.cert_type} onValueChange={v => updateCertField(cert.id, 'cert_type', v)}>
                      <SelectTrigger className="h-8 text-xs bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="iso">ISO</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Certificate Name</Label>
                    <Input value={cert.cert_name}
                      onChange={e => updateCertField(cert.id, 'cert_name', e.target.value)}
                      className="h-8 text-xs bg-background border-border" placeholder="e.g. ISO 9001:2015" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Certificate Number</Label>
                    <Input value={cert.cert_number ?? ''}
                      onChange={e => updateCertField(cert.id, 'cert_number', e.target.value)}
                      className="h-8 text-xs bg-background border-border" placeholder="Cert number" />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-5 shrink-0">
                  {cert.is_verified && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Verified</Badge>}
                  {cert.pending_review && !cert.is_verified && <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Pending</Badge>}
                  <button type="button" onClick={() => removeCert(cert.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Trade Capabilities */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Trade Capabilities
            </h3>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Production Capacity</Label>
              <Input value={form.production_capacity}
                onChange={e => setForm(f => ({ ...f, production_capacity: e.target.value }))}
                placeholder="e.g. 50,000 meters/month" className="h-9 text-sm bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Minimum Order Quantity Policy</Label>
              <Input value={form.moq_policy}
                onChange={e => setForm(f => ({ ...f, moq_policy: e.target.value }))}
                placeholder="e.g. Minimum 500 kg per order" className="h-9 text-sm bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Packaging & Shipping Details</Label>
              <Textarea value={form.packaging_details}
                onChange={e => setForm(f => ({ ...f, packaging_details: e.target.value }))}
                placeholder="Describe your packaging standards and shipping capabilities..."
                rows={3} className="text-sm bg-background border-border resize-none" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Payment Terms Accepted</Label>
              <div className="flex flex-wrap gap-3">
                {PAYMENT_TERMS_OPTIONS.map(term => (
                  <div key={term} className="flex items-center space-x-2">
                    <Checkbox id={`pt-${term}`} checked={paymentTerms.includes(term)}
                      onCheckedChange={() => togglePayment(term)} />
                    <label htmlFor={`pt-${term}`} className="text-sm text-foreground cursor-pointer">{term}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Auto-Quotation Settings ───────────────────────────────── */}
          {company && (
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Automatic Quotation Settings</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Configure automatic quotation generation when buyers post matching RFQs. Set your default rates,
                choose whether quotes send instantly or need your approval first.
              </p>
              <AutoQuoteSettingsPanel companyId={company.id} />
            </div>
          )}

          {/* ── Security / Password ───────────────────────────────── */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Security & Password</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Update your account password. Must be at least 8 characters.
            </p>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">New Password (min 8 chars)</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-9 text-sm bg-background border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Confirm New Password</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-9 text-sm bg-background border-border"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={changingPass || !newPassword}
                  className="border-border text-xs"
                >
                  {changingPass ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                  Update Password
                </Button>
              </div>
            </form>
          </div>

          {/* Save footer */}
          <div className="flex justify-between items-center pb-4 pt-2">
            <Link to="/settings/delete-account">
              <Button variant="ghost" size="sm" className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Delete Manufacturer Account
              </Button>
            </Link>
            <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? 'Saving…' : 'Save All Changes'}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { ShieldCheck, Upload, FileText, CheckCircle2, Clock, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import PageMeta from '@/components/common/PageMeta';

const toHex = (s: string) =>
  Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, '0')).join('');

type CompanyData = {
  id: string;
  verification_status: string;
  is_verified: boolean;
  verified_at: string | null;
  verification_expiry_at: string | null;
  rejection_reason: string | null;
  gst_number: string | null;
  pan_number: string | null;
  gst_doc_url: string | null;
  pan_doc_url: string | null;
  reg_doc_url: string | null;
  factory_doc_url: string | null;
  bank_doc_url: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
};

export default function SupplierVerificationPage() {
  const { user, company } = useAuth();
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    gst_number: '', pan_number: '',
    bank_account_name: '', bank_account_number: '', bank_ifsc: '', bank_name: '',
  });
  const [docs, setDocs] = useState<Record<string, File | null>>({
    gst: null, pan: null, reg: null, factory: null, bank: null,
  });
  const refs = {
    gst: useRef<HTMLInputElement>(null),
    pan: useRef<HTMLInputElement>(null),
    reg: useRef<HTMLInputElement>(null),
    factory: useRef<HTMLInputElement>(null),
    bank: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    if (!company?.id) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('companies')
        .select('id,verification_status,is_verified,verified_at,verification_expiry_at,rejection_reason,gst_number,pan_number,gst_doc_url,pan_doc_url,reg_doc_url,factory_doc_url,bank_doc_url,bank_account_name,bank_account_number,bank_ifsc,bank_name')
        .eq('id', company.id)
        .maybeSingle();
      if (data) {
        setCompanyData(data);
        setForm({
          gst_number: data.gst_number || '',
          pan_number: data.pan_number || '',
          bank_account_name: data.bank_account_name || '',
          bank_account_number: data.bank_account_number || '',
          bank_ifsc: data.bank_ifsc || '',
          bank_name: data.bank_name || '',
        });
      }
      setLoading(false);
    };
    load();
  }, [company?.id]);

  const uploadDoc = async (file: File, folder: string) => {
    const dot = file.name.lastIndexOf('.');
    const stem = dot > 0 ? file.name.slice(0, dot) : file.name;
    const ext = dot > 0 ? file.name.slice(dot) : '';
    const safeName = `${user!.id}/${folder}/${toHex(stem)}${ext}`;
    const { data, error } = await supabase.storage.from('verification-docs').upload(safeName, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('verification-docs').getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;
    if (!docs.gst && !companyData?.gst_doc_url) { toast.error('GST document required'); return; }
    if (!docs.pan && !companyData?.pan_doc_url) { toast.error('PAN document required'); return; }
    if (!docs.bank && !companyData?.bank_doc_url) { toast.error('Bank verification document required'); return; }

    setSaving(true);
    try {
      const updates: Record<string, string> = { ...form, verification_status: 'pending' };
      if (docs.gst) updates.gst_doc_url = await uploadDoc(docs.gst!, 'gst');
      if (docs.pan) updates.pan_doc_url = await uploadDoc(docs.pan!, 'pan');
      if (docs.reg) updates.reg_doc_url = await uploadDoc(docs.reg!, 'reg');
      if (docs.factory) updates.factory_doc_url = await uploadDoc(docs.factory!, 'factory');
      if (docs.bank) updates.bank_doc_url = await uploadDoc(docs.bank!, 'bank');

      const { error } = await supabase.from('companies').update(updates).eq('id', company.id);
      if (error) throw error;
      toast.success('Verification request submitted! Admin will review within 1–2 business days.');
      setCompanyData(prev => prev ? { ...prev, ...updates } : null);
    } catch (err) {
      toast.error('Submission failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    unverified: { label: 'Not Submitted', color: 'bg-muted text-muted-foreground', icon: <FileText className="w-4 h-4" /> },
    pending: { label: 'Under Review', color: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40', icon: <Clock className="w-4 h-4" /> },
    verified: { label: 'Verified', color: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40', icon: <CheckCircle2 className="w-4 h-4" /> },
    rejected: { label: 'Rejected', color: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40', icon: <XCircle className="w-4 h-4" /> },
  };

  const status = companyData?.verification_status || 'unverified';
  const sc = statusConfig[status] || statusConfig.unverified;
  const canEdit = status === 'unverified' || status === 'rejected';

  // Expiry check
  const expiry = companyData?.verification_expiry_at ? new Date(companyData.verification_expiry_at) : null;
  const daysToExpiry = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null;
  const isExpiringSoon = daysToExpiry !== null && daysToExpiry <= 30 && daysToExpiry > 0;
  const isExpired = daysToExpiry !== null && daysToExpiry <= 0;

  const docFields = [
    { key: 'gst', label: 'GST Certificate *', ref: refs.gst, existing: companyData?.gst_doc_url },
    { key: 'pan', label: 'PAN Card *', ref: refs.pan, existing: companyData?.pan_doc_url },
    { key: 'reg', label: 'Company Registration', ref: refs.reg, existing: companyData?.reg_doc_url },
    { key: 'factory', label: 'Factory / Office Address Proof', ref: refs.factory, existing: companyData?.factory_doc_url },
    { key: 'bank', label: 'Bank Verification (Cancelled Cheque) *', ref: refs.bank, existing: companyData?.bank_doc_url },
  ];

  if (loading) return (
    <DashboardLayout>
      <PageMeta
        title="Manufacturer Verification | BulkSkart"
        description="BulkSkart dashboard — manage your account, orders and trade activity."
        robots="noindex, nofollow"
      />
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 min-w-0">
        <div className="flex items-start gap-3 sm:gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">Manufacturer Verification</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">Complete verification to get the Verified Manufacturer badge and accept orders</p>
          </div>
        </div>

        {/* Status card */}
        <Card className="w-full overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between flex-wrap gap-2.5 sm:gap-3">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Current Status</p>
                <div className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium px-3 py-1 rounded-full border ${sc.color}`}>
                  {sc.icon} {sc.label}
                </div>
                {expiry && status === 'verified' && (
                  <p className={`text-xs mt-1 ${isExpired ? 'text-[#FF7A2E]' : isExpiringSoon ? 'text-[#FF7A2E]' : 'text-muted-foreground'}`}>
                    Verification {isExpired ? 'expired' : `expires`}: {expiry.toLocaleDateString()}
                    {isExpiringSoon && !isExpired && ` (${daysToExpiry} days left)`}
                  </p>
                )}
              </div>
              {status === 'verified' && (
                <Badge className="bg-[#B33D00] text-white gap-1 shrink-0 text-xs sm:text-sm">
                  <ShieldCheck className="w-3.5 h-3.5" /> Verified Manufacturer
                </Badge>
              )}
            </div>
            {(isExpiringSoon || isExpired) && (
              <div className={`mt-3 p-3 rounded-lg border ${isExpired ? 'bg-destructive/10 border-destructive/20' : 'bg-[#FF5A00]/10 border-[#FF5A00]/30'}`}>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 shrink-0 ${isExpired ? 'text-destructive' : 'text-[#FF7A2E]'}`} />
                  <p className={`text-xs sm:text-sm font-medium ${isExpired ? 'text-destructive' : 'text-[#FF7A2E]'}`}>
                    {isExpired ? 'Verification expired — re-verify to accept new orders' : `Verification expiring soon — re-verify before ${expiry?.toLocaleDateString()}`}
                  </p>
                </div>
              </div>
            )}
            {status === 'rejected' && companyData?.rejection_reason && (
              <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-xs sm:text-sm font-medium text-destructive">Rejection Reason</p>
                <p className="text-xs sm:text-sm text-destructive/80 mt-0.5">{companyData.rejection_reason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {(canEdit || isExpiringSoon || isExpired) && (
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 w-full min-w-0">
            {/* Business documents */}
            <Card className="w-full overflow-hidden">
              <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
                <CardTitle className="text-base">Business Identifiers</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Enter your legal tax and registration identification</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-2 sm:pt-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 w-full min-w-0">
                  <div className="space-y-1.5 min-w-0 w-full">
                    <Label className="text-xs sm:text-sm font-medium">GST Number</Label>
                    <Input
                      value={form.gst_number}
                      placeholder="e.g. 22AAAAA0000A1Z5"
                      onChange={e => setForm(p => ({ ...p, gst_number: e.target.value }))}
                      className="w-full min-w-0 h-9 sm:h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 min-w-0 w-full">
                    <Label className="text-xs sm:text-sm font-medium">PAN Number</Label>
                    <Input
                      value={form.pan_number}
                      placeholder="e.g. AAAAA0000A"
                      onChange={e => setForm(p => ({ ...p, pan_number: e.target.value }))}
                      className="w-full min-w-0 h-9 sm:h-10 text-sm uppercase"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="w-full overflow-hidden">
              <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
                <CardTitle className="text-base">Bank Account Details</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Required for payment verification and withdrawals</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-2 sm:pt-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 w-full min-w-0">
                  <div className="space-y-1.5 min-w-0 w-full">
                    <Label className="text-xs sm:text-sm font-medium">Account Holder Name</Label>
                    <Input
                      value={form.bank_account_name}
                      placeholder="As per bank passbook / cheque"
                      onChange={e => setForm(p => ({ ...p, bank_account_name: e.target.value }))}
                      className="w-full min-w-0 h-9 sm:h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 min-w-0 w-full">
                    <Label className="text-xs sm:text-sm font-medium">Account Number</Label>
                    <Input
                      value={form.bank_account_number}
                      placeholder="Bank account number"
                      onChange={e => setForm(p => ({ ...p, bank_account_number: e.target.value }))}
                      className="w-full min-w-0 h-9 sm:h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 min-w-0 w-full">
                    <Label className="text-xs sm:text-sm font-medium">IFSC Code</Label>
                    <Input
                      value={form.bank_ifsc}
                      placeholder="e.g. SBIN0001234"
                      onChange={e => setForm(p => ({ ...p, bank_ifsc: e.target.value }))}
                      className="w-full min-w-0 h-9 sm:h-10 text-sm uppercase"
                    />
                  </div>
                  <div className="space-y-1.5 min-w-0 w-full">
                    <Label className="text-xs sm:text-sm font-medium">Bank Name</Label>
                    <Input
                      value={form.bank_name}
                      placeholder="Bank name and branch"
                      onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))}
                      className="w-full min-w-0 h-9 sm:h-10 text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="w-full overflow-hidden">
              <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
                <CardTitle className="text-base">Document Upload</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Upload PDF or image files (max 5MB each)</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-2 sm:pt-3 space-y-3">
                {docFields.map(({ key, label, ref, existing }) => (
                  <div key={key} className="flex items-center justify-between gap-2.5 sm:gap-3 p-3 border border-border rounded-lg bg-card/60 w-full min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium truncate">{label}</p>
                        {docs[key] ? (
                          <p className="text-[11px] sm:text-xs text-[#FF7A2E] truncate font-medium">{docs[key]!.name}</p>
                        ) : existing ? (
                          <p className="text-[11px] sm:text-xs text-[#FF7A2E] font-medium">Uploaded ✓</p>
                        ) : (
                          <p className="text-[11px] sm:text-xs text-muted-foreground">No file selected</p>
                        )}
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="shrink-0 h-8 px-2.5 sm:px-3 text-xs gap-1.5" onClick={() => ref.current?.click()}>
                      <Upload className="w-3.5 h-3.5" /><span>Upload</span>
                    </Button>
                    <input
                      ref={ref}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f && f.size > 5 * 1024 * 1024) { toast.error('Max 5MB per file'); return; }
                        if (f) setDocs(p => ({ ...p, [key]: f }));
                      }}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button type="submit" className="w-full bg-[#C94400] hover:bg-primary/90 text-primary-foreground h-11 mb-6 md:mb-0" disabled={saving}>
              {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              {saving ? 'Submitting…' : isExpiringSoon || isExpired ? 'Submit Re-verification' : 'Submit for Verification'}
            </Button>
          </form>
        )}

        {status === 'pending' && !isExpiringSoon && !isExpired && (
          <Card>
            <CardContent className="text-center py-10">
              <Clock className="w-10 h-10 text-[#FF7A2E] mx-auto mb-3" />
              <h3 className="font-semibold text-foreground">Documents under review</h3>
              <p className="text-sm text-muted-foreground mt-1">Admin typically reviews within 1–2 business days. You'll be notified.</p>
            </CardContent>
          </Card>
        )}

        {status === 'verified' && !isExpiringSoon && !isExpired && (
          <Card>
            <CardContent className="text-center py-10">
              <CheckCircle2 className="w-10 h-10 text-[#FF7A2E] mx-auto mb-3" />
              <h3 className="font-semibold text-foreground">Your business is fully verified!</h3>
              <p className="text-sm text-muted-foreground mt-1">Verified Manufacturer badge is active. You can accept orders.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

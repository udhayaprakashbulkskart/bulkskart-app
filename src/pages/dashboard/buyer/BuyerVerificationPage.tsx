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
import { ShieldCheck, Upload, FileText, CheckCircle2, Clock, XCircle, RefreshCw } from 'lucide-react';
import PageMeta from '@/components/common/PageMeta';

type BuyerProfile = {
  id: string;
  verification_status: string;
  gst_number: string | null;
  pan_number: string | null;
  registration_number: string | null;
  company_name: string;
  business_type: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  gst_doc_url: string | null;
  pan_doc_url: string | null;
  reg_doc_url: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
};

const toHex = (s: string) =>
  Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, '0')).join('');

export default function BuyerVerificationPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<BuyerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: '', business_type: '', gst_number: '', pan_number: '',
    registration_number: '', address: '', city: '', state: '', country: 'India',
  });
  const [docs, setDocs] = useState<{ gst: File | null; pan: File | null; reg: File | null }>({
    gst: null, pan: null, reg: null,
  });
  const gstRef = useRef<HTMLInputElement>(null);
  const panRef = useRef<HTMLInputElement>(null);
  const regRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('buyer_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setProfile(data);
        setForm({
          company_name: data.company_name || '',
          business_type: data.business_type || '',
          gst_number: data.gst_number || '',
          pan_number: data.pan_number || '',
          registration_number: data.registration_number || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          country: data.country || 'India',
        });
      }
      setLoading(false);
    };
    load();
  }, [user]);

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
    if (!user) return;
    if (!docs.gst && !profile?.gst_doc_url) { toast.error('GST document required'); return; }
    if (!docs.pan && !profile?.pan_doc_url) { toast.error('PAN document required'); return; }

    setSaving(true);
    try {
      const updates: Record<string, string> = { ...form, verification_status: 'pending' };
      if (docs.gst) updates.gst_doc_url = await uploadDoc(docs.gst, 'gst');
      if (docs.pan) updates.pan_doc_url = await uploadDoc(docs.pan, 'pan');
      if (docs.reg) updates.reg_doc_url = await uploadDoc(docs.reg, 'reg');

      const { error } = await supabase.from('buyer_profiles').upsert(
        { user_id: user.id, ...updates },
        { onConflict: 'user_id' }
      );
      if (error) throw error;
      toast.success('Verification request submitted successfully!');
      setProfile(prev => prev ? { ...prev, ...updates } : null);
    } catch (err) {
      toast.error('Submission failed. Please try again.');
      console.error(err);
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

  const status = profile?.verification_status || 'unverified';
  const sc = statusConfig[status] || statusConfig.unverified;
  const canEdit = status === 'unverified' || status === 'rejected';

  if (loading) return (
    <DashboardLayout>
      <PageMeta
        title="Buyer KYC Verification | BulkSkart"
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
      <div className="max-w-2xl mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-5 w-full min-w-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Buyer KYC Verification</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Verify your business to get the Verified Buyer badge</p>
          </div>
        </div>

        {/* Status card */}
        <Card className="w-full">
          <CardContent className="pt-4 sm:pt-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Current Status</p>
                <div className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium px-3 py-1 rounded-full border ${sc.color}`}>
                  {sc.icon} {sc.label}
                </div>
                {profile?.verified_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Verified on {new Date(profile.verified_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              {status === 'verified' && (
                <Badge className="bg-[#B33D00] text-white gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Verified Buyer
                </Badge>
              )}
            </div>
            {status === 'rejected' && profile?.rejection_reason && (
              <div className="mt-3 p-3 rounded-lg bg-[#FF5A00]/10 border border-[#FF5A00]/20">
                <p className="text-xs sm:text-sm font-medium text-destructive">Rejection Reason</p>
                <p className="text-xs sm:text-sm text-destructive/80 mt-0.5">{profile.rejection_reason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {canEdit && (
          <form onSubmit={handleSubmit} className="space-y-5 w-full">
            <Card className="w-full">
              <CardHeader className="pb-3 px-4 sm:px-6">
                <CardTitle className="text-base">Business Information</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Enter your registered business details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-4 sm:px-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs sm:text-sm">Company Name *</Label>
                    <Input value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} required className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs sm:text-sm">Business Type</Label>
                    <Input value={form.business_type} placeholder="e.g. Wholesaler, Trader" onChange={e => setForm(p => ({ ...p, business_type: e.target.value }))} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs sm:text-sm">GST Number</Label>
                    <Input value={form.gst_number} placeholder="22AAAAA0000A1Z5" onChange={e => setForm(p => ({ ...p, gst_number: e.target.value }))} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs sm:text-sm">PAN Number</Label>
                    <Input value={form.pan_number} placeholder="AAAAA0000A" onChange={e => setForm(p => ({ ...p, pan_number: e.target.value }))} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs sm:text-sm">Registration Number</Label>
                    <Input value={form.registration_number} onChange={e => setForm(p => ({ ...p, registration_number: e.target.value }))} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs sm:text-sm">City</Label>
                    <Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs sm:text-sm">State</Label>
                    <Input value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs sm:text-sm">Country</Label>
                    <Input value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} className="h-9 text-sm" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Registered Address</Label>
                  <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className="h-9 text-sm" />
                </div>
              </CardContent>
            </Card>

            <Card className="w-full">
              <CardHeader className="pb-3 px-4 sm:px-6">
                <CardTitle className="text-base">Document Upload</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Upload PDF or image files (max 5MB each)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-4 sm:px-6">
                {[
                  { key: 'gst' as const, label: 'GST Certificate *', ref: gstRef, existing: profile?.gst_doc_url },
                  { key: 'pan' as const, label: 'PAN Card *', ref: panRef, existing: profile?.pan_doc_url },
                  { key: 'reg' as const, label: 'Business Registration Document', ref: regRef, existing: profile?.reg_doc_url },
                ].map(({ key, label, ref, existing }) => (
                  <div key={key} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 border border-border rounded-lg bg-card/50">
                    <div className="flex items-center gap-2.5 min-w-0 w-full sm:w-auto">
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium truncate">{label}</p>
                        {docs[key] ? (
                          <p className="text-xs text-[#FF7A2E] font-medium truncate">{docs[key]!.name}</p>
                        ) : existing ? (
                          <p className="text-xs text-[#FF7A2E]">Document uploaded ✓</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">No file selected</p>
                        )}
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="shrink-0 w-full sm:w-auto h-8 text-xs border-border" onClick={() => ref.current?.click()}>
                      <Upload className="w-3.5 h-3.5 mr-1" /> Upload File
                    </Button>
                    <input
                      ref={ref}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f && f.size > 5 * 1024 * 1024) { toast.error('File size must be under 5MB'); return; }
                        if (f) setDocs(p => ({ ...p, [key]: f }));
                      }}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button type="submit" className="w-full bg-[#C94400] hover:bg-primary/90 text-primary-foreground h-11 text-sm font-semibold" disabled={saving}>
              {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              {saving ? 'Submitting…' : 'Submit for Verification'}
            </Button>
          </form>
        )}

        {status === 'pending' && (
          <Card>
            <CardContent className="pt-5 text-center py-8">
              <Clock className="w-10 h-10 text-[#FF7A2E] mx-auto mb-3" />
              <h3 className="font-semibold text-foreground">Your documents are under review</h3>
              <p className="text-sm text-muted-foreground mt-1">Admin typically reviews within 1–2 business days. You'll be notified of the result.</p>
            </CardContent>
          </Card>
        )}

        {status === 'verified' && (
          <Card>
            <CardContent className="pt-5 text-center py-8">
              <CheckCircle2 className="w-10 h-10 text-[#FF7A2E] mx-auto mb-3" />
              <h3 className="font-semibold text-foreground">Your business is verified!</h3>
              <p className="text-sm text-muted-foreground mt-1">You now have a Verified Buyer badge visible to all manufacturers.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

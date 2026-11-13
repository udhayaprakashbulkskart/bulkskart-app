import React, { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import {
  User, Building2, ShieldCheck, Mail, Phone, MapPin,
  Save, RefreshCw, Key, Shield, CheckCircle2, Clock,
  Upload, Sparkles, FileText, ShoppingBag, ArrowRight, Camera, ImageIcon,
  AlertCircle
} from 'lucide-react';
import PageMeta from '@/components/common/PageMeta';
import { Link } from 'react-router-dom';
import { buyerPublicUrl, copyText } from '@/lib/supplierPublicProfile';
import SingleImageUploader from '@/components/common/SingleImageUploader';

const BUSINESS_TYPES = [
  'Wholesaler / Distributor',
  'Retailer / Chain Store',
  'Importer / Exporter',
  'Manufacturer / OEM Buyer',
  'Corporate Buyer',
  'E-commerce Seller',
  'Trader',
  'Other'
];

const ANNUAL_BUDGETS = [
  '< ₹10 Lakhs',
  '₹10L – ₹50 Lakhs',
  '₹50L – ₹2 Crore',
  '₹2 Cr – ₹10 Crore',
  '₹10 Crore+'
];

export default function BuyerProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  // Profile data
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    avatarUrl: '',
    logoUrl: '',
    bannerUrl: '',
    companyName: '',
    businessType: '',
    gstNumber: '',
    panNumber: '',
    registrationNumber: '',
    annualVolume: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    preferredCategories: '',
  });

  const [kycStatus, setKycStatus] = useState<'unverified' | 'pending' | 'verified' | 'rejected'>('unverified');
  const [publicSlug, setPublicSlug] = useState('');

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!user) return;
    const fetchBuyerData = async () => {
      setLoading(true);
      try {
        // 1. Fetch user profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        // 2. Fetch buyer details
        const { data: buyerData } = await supabase
          .from('buyer_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileData || buyerData) {
          setFormData({
            fullName: profileData?.full_name || '',
            email: user.email || '',
            phone: profileData?.phone || '',
            avatarUrl: profileData?.avatar_url || '',
            logoUrl: buyerData?.logo_url || '',
            bannerUrl: buyerData?.banner_url || '',
            companyName: buyerData?.company_name || profileData?.company_name || '',
            businessType: buyerData?.business_type || 'Wholesaler / Distributor',
            gstNumber: buyerData?.gst_number || '',
            panNumber: buyerData?.pan_number || '',
            registrationNumber: buyerData?.registration_number || '',
            annualVolume: buyerData?.annual_volume || '₹10L – ₹50 Lakhs',
            address: buyerData?.address || '',
            city: buyerData?.city || '',
            state: buyerData?.state || '',
            country: buyerData?.country || 'India',
            preferredCategories: Array.isArray(buyerData?.product_categories)
              ? buyerData.product_categories.join(', ')
              : '',
          });
          setPublicSlug(buyerData?.public_slug || '');

          if (buyerData?.verification_status) {
            setKycStatus(buyerData.verification_status);
          }
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBuyerData();
  }, [user]);

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Avatar image must be under 2MB');
      return;
    }
    setAvatarUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('verification-docs').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('verification-docs').getPublicUrl(data.path);
      
      await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id);
      await refreshProfile();
      toast.success('Avatar updated successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload avatar');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      // 1. Update profiles table
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName,
          phone: formData.phone,
          avatar_url: formData.avatarUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileErr) throw profileErr;

      // 2. Upsert buyer_profiles table
      const preferredArr = formData.preferredCategories
        ? formData.preferredCategories.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const { error: buyerErr } = await supabase
        .from('buyer_profiles')
        .upsert({
          user_id: user.id,
          company_name: formData.companyName.trim() || formData.fullName.trim() || 'Buyer',
          business_type: formData.businessType,
          gst_number: formData.gstNumber,
          pan_number: formData.panNumber,
          registration_number: formData.registrationNumber,
          annual_volume: formData.annualVolume,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          country: formData.country,
          logo_url: formData.logoUrl || null,
          banner_url: formData.bannerUrl || null,
          product_categories: preferredArr,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (buyerErr) throw buyerErr;

      const { data: saved } = await supabase
        .from('buyer_profiles')
        .select('public_slug')
        .eq('user_id', user.id)
        .maybeSingle();
      if (saved?.public_slug) setPublicSlug(saved.public_slug);

      await refreshProfile();
      toast.success('Profile saved successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save profile changes');
    } finally {
      setSaving(false);
    }
  };

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
      const e = err as { message?: string };
      toast.error(e.message || 'Failed to update password');
    } finally {
      setChangingPass(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageMeta title="Buyer Profile | BulkSkart" description="Manage your buyer account profile and preferences." robots="noindex, nofollow" />
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageMeta title="Buyer Profile | BulkSkart" description="Manage your buyer account profile, business info and preferences." robots="noindex, nofollow" />
      
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header with Avatar Uploader */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border bg-card/40 p-4 rounded-xl border">
          <div className="flex items-center gap-4">
            <SingleImageUploader
              value={formData.avatarUrl}
              onChange={url => setFormData(p => ({ ...p, avatarUrl: url || '' }))}
              bucket="avatars"
              folder={`${user?.id || 'common'}/avatar`}
              shape="circle"
              className="shrink-0"
              placeholderIcon={<User className="w-7 h-7 text-primary/70" />}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-foreground truncate">{formData.fullName || 'Buyer Account'}</h1>
                <Badge variant="outline" className="text-xs capitalize font-semibold border-primary/30 text-primary shrink-0">
                  Buyer
                </Badge>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground truncate">{formData.email}</p>
              <p className="text-[11px] text-primary/80 mt-1 font-medium">Click photo to update personal avatar</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link to="/dashboard/buyer/verification">
              <Badge className={`text-xs px-3 py-1 gap-1 cursor-pointer hover:opacity-90 transition-opacity ${
                kycStatus === 'verified' ? 'bg-green-600 text-white' :
                kycStatus === 'pending' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/40' :
                'bg-muted text-muted-foreground border border-border'
              }`}>
                <ShieldCheck className="w-3.5 h-3.5" />
                KYC: {kycStatus === 'verified' ? 'Verified' : kycStatus === 'pending' ? 'Under Review' : 'Not Verified'}
              </Badge>
            </Link>
          </div>
        </div>

        {publicSlug && (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
            <p className="shrink-0 text-xs font-bold text-foreground">Public profile</p>
            <input
              readOnly
              value={buyerPublicUrl(publicSlug)}
              aria-label="Public buyer profile link"
              onFocus={event => event.currentTarget.select()}
              className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyText(buyerPublicUrl(publicSlug));
                  if (ok) toast.success('Public profile link copied');
                  else toast.error('Select the link and copy it');
                }}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#FF5A00] px-3 text-xs font-bold text-white"
              >
                Copy
              </button>
              <Link to={`/buyers/${publicSlug}`} className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-3 text-xs font-bold text-foreground">
                View
              </Link>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Personal & Account Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> Personal & Contact Details
              </CardTitle>
              <CardDescription>Your personal contact information for trade communication</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={e => setFormData(p => ({ ...p, fullName: e.target.value }))}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    value={formData.email}
                    disabled
                    className="bg-muted text-muted-foreground cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone / WhatsApp Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={e => setFormData(p => ({ ...p, country: e.target.value }))}
                    placeholder="India"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" /> Business Details
              </CardTitle>
              <CardDescription>Company information visible to verified suppliers during quoting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="companyName">Business / Company Name</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={e => setFormData(p => ({ ...p, companyName: e.target.value }))}
                    placeholder="e.g. Infopod Trading Corp"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="businessType">Business Type</Label>
                  <select
                    id="businessType"
                    value={formData.businessType}
                    onChange={e => setFormData(p => ({ ...p, businessType: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {BUSINESS_TYPES.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gstNumber">GST Number</Label>
                  <Input
                    id="gstNumber"
                    value={formData.gstNumber}
                    onChange={e => setFormData(p => ({ ...p, gstNumber: e.target.value }))}
                    placeholder="22AAAAA0000A1Z5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="panNumber">PAN Number</Label>
                  <Input
                    id="panNumber"
                    value={formData.panNumber}
                    onChange={e => setFormData(p => ({ ...p, panNumber: e.target.value }))}
                    placeholder="AAAAA0000A"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="registrationNumber">Company Registration / CIN</Label>
                  <Input
                    id="registrationNumber"
                    value={formData.registrationNumber}
                    onChange={e => setFormData(p => ({ ...p, registrationNumber: e.target.value }))}
                    placeholder="U12345DL2024PTC123456"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="annualVolume">Estimated Annual Purchase Volume</Label>
                  <select
                    id="annualVolume"
                    value={formData.annualVolume}
                    onChange={e => setFormData(p => ({ ...p, annualVolume: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {ANNUAL_BUDGETS.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Business Branding Assets: Logo & Banner */}
              <div className="pt-2 border-t border-border space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Business Branding Assets</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SingleImageUploader
                    label="Business Logo"
                    description="Upload your official company emblem (square, max 5MB)."
                    value={formData.logoUrl}
                    shape="square"
                    bucket="company-assets"
                    folder={`${user?.id || 'common'}/buyer-logo`}
                    onChange={url => setFormData(p => ({ ...p, logoUrl: url || '' }))}
                  />
                  <SingleImageUploader
                    label="Business Cover Banner"
                    description="Upload your business banner (landscape, max 5MB)."
                    value={formData.bannerUrl}
                    shape="banner"
                    bucket="company-assets"
                    folder={`${user?.id || 'common'}/buyer-banner`}
                    onChange={url => setFormData(p => ({ ...p, bannerUrl: url || '' }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={e => setFormData(p => ({ ...p, city: e.target.value }))}
                    placeholder="Mumbai"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="state">State / Province</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={e => setFormData(p => ({ ...p, state: e.target.value }))}
                    placeholder="Maharashtra"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address">Registered Office Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                  placeholder="Plot No. 123, Industrial Area, Sector 5..."
                  rows={2}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="preferredCategories">Sourcing Interests / Preferred Categories</Label>
                <Input
                  id="preferredCategories"
                  value={formData.preferredCategories}
                  onChange={e => setFormData(p => ({ ...p, preferredCategories: e.target.value }))}
                  placeholder="e.g. Textiles, Packaging, Industrial Machinery (comma separated)"
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Profile */}
          <div className="flex justify-end gap-3">
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-6 font-semibold"
              disabled={saving}
            >
              {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {saving ? 'Saving...' : 'Save Profile Changes'}
            </Button>
          </div>
        </form>

        {/* Change Password Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="w-4 h-4 text-primary" /> Security & Password
            </CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="outline"
                  disabled={changingPass || !newPassword}
                  className="border-border"
                >
                  {changingPass ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Update Password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* KYC Verification Shortcut */}
        <Card className="border-dashed border-primary/40 bg-primary/5">
          <CardContent className="pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground text-sm">Need Official Verification?</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload your GST, PAN and Company Registration docs to get the Verified Buyer badge and faster supplier quotes.
                </p>
              </div>
            </div>
            <Link to="/dashboard/buyer/verification" className="shrink-0">
              <Button size="sm" className="bg-primary text-primary-foreground gap-1.5">
                Go to KYC Verification <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Danger Zone: Account Deletion */}
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Danger Zone: Delete Account
            </CardTitle>
            <CardDescription className="text-xs">
              Permanently close your buyer account and erase your profile data from BulkSkart.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground max-w-lg">
              Once initiated, your submitted RFQs, negotiation history, and saved factories will be unlinked. Ongoing trade orders must be resolved first.
            </p>
            <Link to="/settings/delete-account" className="shrink-0">
              <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10 font-bold">
                Delete Buyer Account
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

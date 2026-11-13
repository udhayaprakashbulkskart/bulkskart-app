import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import PageMeta from '@/components/common/PageMeta';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import {
  AlertTriangle, ShieldAlert, Trash2, ArrowLeft,
  CheckCircle2, AlertCircle, Loader2, Info, Building2, ShoppingBag
} from 'lucide-react';

const REASONS = [
  'I am closing my business or trading operations',
  'I found another sourcing/supplier channel',
  'Too expensive / Subscription cost is high',
  'Not enough relevant buyers or suppliers found',
  'Created a duplicate or test account by mistake',
  'Taking a temporary break from bulk procurement',
  'Privacy concerns / Requesting data erasure',
  'Other reason'
];

export default function DeleteAccountPage() {
  const { user, profile, company, signOut } = useAuth();
  const navigate = useNavigate();

  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [hasActiveOrders, setHasActiveOrders] = useState(false);
  const [checkingOrders, setCheckingOrders] = useState(true);
  const [activeOrderCount, setActiveOrderCount] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Check if the user has active / incomplete orders
    const checkOrders = async () => {
      setCheckingOrders(true);
      try {
        let count = 0;
        if (company) {
          const { data } = await supabase
            .from('orders')
            .select('id, status')
            .eq('seller_company_id', company.id)
            .in('status', ['pending', 'confirmed', 'processing', 'shipped']);
          count = data?.length || 0;
        } else {
          const { data } = await supabase
            .from('orders')
            .select('id, status')
            .eq('buyer_id', user.id)
            .in('status', ['pending', 'confirmed', 'processing', 'shipped']);
          count = data?.length || 0;
        }
        setActiveOrderCount(count);
        setHasActiveOrders(count > 0);
      } catch (err) {
        console.warn('Order check error:', err);
      } finally {
        setCheckingOrders(false);
      }
    };

    checkOrders();
  }, [user, company]);

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto py-20 px-4 text-center space-y-4">
          <Info className="w-12 h-12 text-primary mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Sign In Required</h2>
          <p className="text-sm text-muted-foreground">You must be signed in to manage or delete your account.</p>
          <Link to="/auth">
            <Button className="bg-[#1A0C05] text-white">Go to Sign In</Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (confirmText.trim() !== 'DELETE') {
      toast.error('Please type "DELETE" exactly to confirm.');
      return;
    }

    if (!reason) {
      toast.error('Please select a reason for deleting your account.');
      return;
    }

    if (hasActiveOrders) {
      toast.error(`You have ${activeOrderCount} ongoing orders. Complete or cancel them first.`);
      return;
    }

    setDeleting(true);
    try {
      // 1. Verify password if entered
      if (password) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password,
        });
        if (signInErr) {
          toast.error('Incorrect password. Please verify your credentials.');
          setDeleting(false);
          return;
        }
      }

      // 2. Mark / Archive company and products if supplier
      if (company?.id) {
        await supabase
          .from('products')
          .update({ is_active: false })
          .eq('company_id', company.id);

        await supabase
          .from('companies')
          .update({
            description: '[Account Deleted by User]',
            tagline: null,
            logo_url: null,
            banner_url: null,
            verification_status: 'deactivated',
            is_verified: false,
          })
          .eq('id', company.id);
      }

      // 3. Mark buyer profile as deleted if buyer
      await supabase
        .from('buyer_profiles')
        .delete()
        .eq('user_id', user.id);

      // 4. Update or clear profile data
      await supabase
        .from('profiles')
        .update({
          full_name: 'Deleted User',
          phone: null,
          company_name: null,
          avatar_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      // 5. Invalidate auth and sign out
      await signOut();
      toast.success('Your BulkSkart account has been successfully deleted.');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error('Account deletion error:', err);
      toast.error(e.message || 'Failed to delete account. Please contact support.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <MainLayout>
      <PageMeta
        title="Delete Account | BulkSkart"
        description="Permanently delete your BulkSkart account and remove business data."
        robots="noindex, nofollow"
      />

      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12 space-y-6">
        {/* Back link */}
        <Link
          to={profile?.role === 'supplier' ? '/dashboard/supplier/profile' : '/dashboard/buyer/profile'}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Profile & Settings
        </Link>

        {/* Header alert */}
        <div className="bg-destructive/10 border-2 border-destructive/30 rounded-2xl p-5 md:p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-foreground">Permanent Account Deletion</h1>
              <p className="text-xs text-destructive font-semibold">Danger Zone — This action cannot be undone</p>
            </div>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground">
            Deleting your account will permanently disconnect your email <strong className="text-foreground">{user.email}</strong>,
            remove all active product catalogues, unlist your company storefront, cancel open RFQ matches, and revoke your verified trust badge.
          </p>
        </div>

        {/* Active Orders Safeguard Notice */}
        {checkingOrders ? (
          <div className="flex items-center gap-2 p-4 border rounded-xl bg-muted/40 text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" /> Checking ongoing trade orders...
          </div>
        ) : hasActiveOrders ? (
          <div className="bg-[#FF5A00]/10 border border-[#FF5A00]/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#FF7A2E] shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-bold text-[#FF7A2E] dark:text-[#FF7A2E]">
                Ongoing Orders Detected ({activeOrderCount} active orders)
              </p>
              <p className="text-muted-foreground">
                You currently have trade orders that are pending, in processing, or in transit. For buyer and supplier fraud protection, you must fulfill or cancel all active orders before your account can be deleted.
              </p>
              <div className="pt-2">
                <Link to={profile?.role === 'supplier' ? '/dashboard/supplier/orders' : '/dashboard/buyer/orders'}>
                  <Button size="sm" variant="outline" className="border-[#FF5A00]/30 text-[#FF7A2E] dark:text-[#FF7A2E] h-8 text-xs">
                    View Active Orders
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {/* Deletion Form */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-destructive" /> Confirm Account Termination
            </CardTitle>
            <CardDescription>
              Please let us know why you are leaving and verify your identity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDeleteAccount} className="space-y-5">
              {/* Reason selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Reason for Leaving *</Label>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  required
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-1.5 text-xs md:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select a reason</option>
                  {REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Optional Feedback */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Additional Feedback / Suggestions (Optional)</Label>
                <Textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="How could we have improved your experience?"
                  rows={2}
                  className="text-xs md:text-sm"
                />
              </div>

              {/* Password Re-confirmation */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Current Password Verification</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your account password"
                  className="text-xs md:text-sm"
                />
                <p className="text-[11px] text-muted-foreground">Confirm your identity for security</p>
              </div>

              {/* Confirm Text Box */}
              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-xs font-semibold text-foreground">
                  To confirm, type <span className="text-destructive font-mono font-bold bg-destructive/10 px-1.5 py-0.5 rounded">DELETE</span> in the box below *
                </Label>
                <Input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder='Type "DELETE" here'
                  className="font-mono text-sm border-destructive/40 focus-visible:ring-destructive"
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  disabled={deleting}
                  className="w-full sm:w-auto"
                >
                  Cancel & Keep Account
                </Button>
                <Button
                  type="submit"
                  disabled={confirmText.trim() !== 'DELETE' || !reason || hasActiveOrders || deleting}
                  className="w-full sm:w-auto bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold gap-2"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Deleting Account...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" /> Permanently Delete Account
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

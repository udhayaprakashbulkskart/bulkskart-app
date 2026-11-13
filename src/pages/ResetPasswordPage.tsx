import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { pathAfterAuth } from '@/lib/postAuthPath';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import BrandLogo from '@/components/common/BrandLogo';
import PageMeta from '@/components/common/PageMeta';
import { toast } from 'sonner';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
  const { user, loading, passwordRecovery, acknowledgePasswordRecovery, resolvedRole } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSetPassword = Boolean(user) && passwordRecovery;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!user) {
      setError('This reset link is invalid or has expired. Request a new one.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || 'Could not update your password.');
        return;
      }
      acknowledgePasswordRecovery();
      toast.success('Password updated. You are signed in.');
      const role = resolvedRole || (user.user_metadata?.role as string | undefined) || null;
      navigate(await pathAfterAuth(user.id, role), { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not update your password.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <PageMeta
        title="Reset password — BulkSkart"
        description="Choose a new password for your BulkSkart account."
        canonical="/reset-password"
        robots="noindex, nofollow"
      />
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <BrandLogo size="md" variant="auto" linkTo="/" />
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-foreground">Choose a new password</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            {loading
              ? 'Checking your reset link…'
              : canSetPassword
                ? 'This reset link signed you in. Set a new password to continue.'
                : 'This reset link is invalid or has expired. Request a new one from the sign-in page.'}
          </p>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : canSetPassword ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div role="alert" className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">New password (min 8 characters)</Label>
                <div className="relative">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="bg-card border-border pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Confirm new password</Label>
                <Input
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="bg-card border-border"
                />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#1A0C05] text-primary-foreground hover:bg-primary/90 font-bold"
              >
                {submitting ? 'Updating password...' : 'Update password and continue'}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              {error && (
                <div role="alert" className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <Button asChild className="w-full bg-[#C94400] text-white hover:bg-[#B33D00] font-bold">
                <Link to="/login">Back to sign in</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

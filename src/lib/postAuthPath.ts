import { supabase } from '@/db/supabase';

/**
 * Where to send someone after sign-in.
 * An explicit in-app redirect wins. A wizard that was already started (step > 1)
 * and not finished resumes at /business-setup. Brand-new accounts stay on the
 * dashboard banner so existing users are not forced through setup on every login.
 */
export async function pathAfterAuth(
  userId: string,
  role?: string | null,
  explicit?: string | null,
): Promise<string> {
  if (explicit && explicit.startsWith('/') && !explicit.startsWith('//')) return explicit;
  if (role === 'admin') return '/dashboard/admin';

  if (role === 'supplier') {
    const { data } = await supabase
      .from('companies')
      .select('onboarding_step, onboarding_completed')
      .eq('owner_id', userId)
      .maybeSingle();
    const step = Number((data as { onboarding_step?: number } | null)?.onboarding_step || 1);
    const done = Boolean((data as { onboarding_completed?: boolean } | null)?.onboarding_completed);
    if (data && !done && step > 1) return '/business-setup';
    return '/dashboard/supplier';
  }

  if (role === 'buyer') {
    const { data } = await supabase
      .from('buyer_profiles')
      .select('onboarding_step, onboarding_completed')
      .eq('user_id', userId)
      .maybeSingle();
    const step = Number((data as { onboarding_step?: number } | null)?.onboarding_step || 1);
    const done = Boolean((data as { onboarding_completed?: boolean } | null)?.onboarding_completed);
    if (data && !done && step > 1) return '/business-setup';
    return '/dashboard/buyer';
  }

  return '/dashboard/buyer';
}

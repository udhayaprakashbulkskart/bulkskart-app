import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/types';

export type AppRole = 'buyer' | 'supplier' | 'admin';

/** Normalize raw role strings from DB / auth metadata */
export function normalizeAppRole(raw?: string | null): AppRole | null {
  if (!raw) return null;
  const r = raw.trim().toLowerCase();
  if (r === 'supplier' || r === 'manufacturer' || r === 'seller') return 'supplier';
  if (r === 'admin') return 'admin';
  if (r === 'buyer' || r === 'customer') return 'buyer';
  return null;
}

/** Prefer DB profile role; fall back to auth user_metadata.role from signup */
export function resolveUserRole(
  profile?: Pick<Profile, 'role'> | null,
  user?: User | null
): AppRole | null {
  const fromProfile = normalizeAppRole(profile?.role);
  if (fromProfile) return fromProfile;

  // sign-up data comes from the browser, so it can say buyer or supplier but never makes anyone an admin
  const meta = user?.user_metadata || {};
  const fromMeta =
    normalizeAppRole(meta.role as string | undefined) ||
    normalizeAppRole(meta.account_role as string | undefined) ||
    normalizeAppRole(meta.user_role as string | undefined);
  return fromMeta === 'admin' ? 'buyer' : fromMeta;
}

export function getDashboardPathForRole(role?: AppRole | null): string {
  if (role === 'admin') return '/dashboard/admin';
  if (role === 'supplier') return '/dashboard/supplier';
  if (role === 'buyer') return '/dashboard/buyer';
  return '/auth';
}

export function displayNameFromUser(
  profile?: Pick<Profile, 'full_name' | 'email'> | null,
  user?: User | null
): string {
  const fromProfile = profile?.full_name?.trim();
  if (fromProfile) return fromProfile;
  const meta = user?.user_metadata || {};
  const fromMeta = String(meta.full_name || meta.name || '').trim();
  if (fromMeta) return fromMeta;
  const email = profile?.email || user?.email || '';
  if (email.includes('@')) return email.split('@')[0];
  return 'User';
}

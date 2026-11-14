import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/db/supabase';
import type { Profile, Company, BuyerProfile, Subscription } from '@/types/types';
import {
  type AppRole,
  displayNameFromUser,
  getDashboardPathForRole,
  normalizeAppRole,
  resolveUserRole,
} from '@/lib/authRole';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  company: Company | null;
  buyerProfile: BuyerProfile | null;
  subscription: Subscription | null;
  isPaidSubscriber: boolean;
  loading: boolean;
  /** Resolved buyer | supplier | admin from profile or signup metadata */
  resolvedRole: AppRole | null;
  displayName: string;
  dashboardPath: string;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role: 'buyer' | 'supplier') => Promise<{ error: string | null; user?: User | null }>;
  signOut: () => Promise<void>;
  refreshProfile: (targetUserId?: string) => Promise<void>;
  refreshSubscription: () => Promise<void>;
  /** True after a recovery link creates a session, until the new password is saved. */
  passwordRecovery: boolean;
  acknowledgePasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Map gateway / SDK parse failures into a clear user-facing message */
function normalizeAuthError(raw?: string | null): string {
  const msg = (raw || '').trim();
  if (!msg) return 'Authentication failed. Please try again.';
  const lower = msg.toLowerCase();
  if (
    lower === 'unauthorized' ||
    lower.includes('unexpected token') ||
    lower.includes('is not valid json') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror')
  ) {
    return 'Unable to reach the authentication service. Please refresh and try again. If this continues, contact support.';
  }
  if (lower.includes('already registered') || lower.includes('already exists') || lower.includes('user already registered')) {
    return 'An account with this email address already exists. Please sign in instead.';
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return 'Invalid email or password. Please verify your credentials or click "Forgot password?" to reset.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please verify your email address before signing in, or use password reset.';
  }
  return msg;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [buyerProfile, setBuyerProfile] = useState<BuyerProfile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isPaidSubscriber, setIsPaidSubscriber] = useState(false);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(() => {
    if (typeof window === 'undefined') return false;
    const hash = window.location.hash;
    return hash.includes('type=recovery') || hash.includes('type%3Drecovery');
  });

  const fetchSubscription = async (companyId?: string | null, userRole?: string) => {
    if (userRole === 'admin') {
      setIsPaidSubscriber(true);
      return;
    }
    if (!companyId) {
      setSubscription(null);
      setIsPaidSubscriber(false);
      return;
    }
    try {
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .maybeSingle();

      if (subData) {
        setSubscription(subData as Subscription);
        setIsPaidSubscriber(true);
      } else {
        setSubscription(null);
        setIsPaidSubscriber(false);
      }
    } catch (e) {
      console.warn('Failed to fetch subscription:', e);
      setSubscription(null);
      setIsPaidSubscriber(false);
    }
  };

  const fetchProfile = async (userId: string, authUser?: User | null) => {
    const { data: existing, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr) {
      console.warn('Profile fetch failed:', profileErr.message);
    }

    let profileData = existing as Profile | null;
    const metaUser = authUser || user;
    const metaRole = resolveUserRole(null, metaUser);
    const metaName = displayNameFromUser(null, metaUser);
    const metaEmail = (metaUser?.email || existing?.email || '').toLowerCase();

    // Ensure a profile row always exists after signup/login
    if (!profileData) {
      const bootstrapRole = metaRole || 'buyer';
      const { data: created, error: createErr } = await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            email: metaEmail || `${userId}@users.bulkskart`,
            full_name: metaName !== 'User' ? metaName : metaEmail.split('@')[0] || 'User',
            role: bootstrapRole,
            status: 'active',
          },
          { onConflict: 'id' }
        )
        .select('*')
        .maybeSingle();
      if (createErr) {
        console.warn('Profile bootstrap failed:', createErr.message);
      }
      profileData = (created as Profile | null) || {
        id: userId,
        email: metaEmail,
        full_name: metaName,
        role: bootstrapRole,
        status: 'active',
      } as Profile;
    } else {
      // Repair mismatched / incomplete profiles (do not override finished buyer onboarding)
      const repairs: Record<string, unknown> = {};
      const dbRole = normalizeAppRole(profileData.role);
      const onboardingDone = Boolean((profileData as Profile & { onboarding_completed?: boolean }).onboarding_completed);

      if (metaRole && metaRole !== 'buyer' && dbRole === 'buyer' && !onboardingDone) {
        repairs.role = metaRole;
        profileData = { ...profileData, role: metaRole };
      }

      // Owning a company is a strong supplier signal even if role drifted to buyer
      if (normalizeAppRole(profileData.role) === 'buyer') {
        const { count: companyCount } = await supabase
          .from('companies')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', userId);
        if ((companyCount ?? 0) > 0) {
          repairs.role = 'supplier';
          profileData = { ...profileData, role: 'supplier' };
        }
      }

      if ((!profileData.full_name || profileData.full_name === 'User') && metaName && metaName !== 'User') {
        repairs.full_name = metaName;
        profileData = { ...profileData, full_name: metaName };
      }
      if (Object.keys(repairs).length > 0) {
        repairs.updated_at = new Date().toISOString();
        const { error: repairErr } = await supabase.from('profiles').update(repairs).eq('id', userId);
        if (repairErr) console.warn('Profile repair failed:', repairErr.message);
      }
    }

    setProfile(profileData);

    const effectiveRole = normalizeAppRole(profileData?.role) || metaRole;
    let compData: Company | null = null;
    if (effectiveRole === 'supplier' || effectiveRole === 'admin') {
      const { data } = await supabase
        .from('companies')
        .select('*')
        .eq('owner_id', userId)
        .maybeSingle();
      compData = data;
      setCompany(compData);
      await fetchSubscription(compData?.id, effectiveRole || undefined);

      if (compData?.id && effectiveRole === 'supplier') {
        try {
          const { ensureManufacturerWelcomeLeads } = await import('@/lib/api');
          ensureManufacturerWelcomeLeads(compData.id, compData.company_name || 'Your Factory');
        } catch {
          /* non-blocking */
        }
      }
    } else {
      setCompany(null);
      setSubscription(null);
      setIsPaidSubscriber(false);
    }

    if (effectiveRole === 'buyer') {
      const { data: bp } = await supabase
        .from('buyer_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      setBuyerProfile(bp);
    } else {
      setBuyerProfile(null);
    }
  };

  const refreshSubscription = async () => {
    if (company?.id) {
      await fetchSubscription(company.id, profile?.role);
    } else if (profile?.role === 'admin') {
      setIsPaidSubscriber(true);
    }
  };

  const refreshProfile = async (targetUserId?: string) => {
    const uid = targetUserId || user?.id;
    if (uid) {
      await fetchProfile(uid, user);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Failsafe timeout: never allow the app to stay in loading state beyond 5 seconds
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 5000);

    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        if (!isMounted) return;
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          fetchProfile(s.user.id, s.user)
            .catch(() => {})
            .finally(() => {
              if (isMounted) {
                clearTimeout(safetyTimer);
                setLoading(false);
              }
            });
        } else {
          clearTimeout(safetyTimer);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Auth session initialization failed:', err);
        if (isMounted) {
          clearTimeout(safetyTimer);
          setLoading(false);
        }
      });

    // Do not await Supabase calls inside this callback. updateUser holds the auth
    // lock while it notifies subscribers, and getSession() waits on that same lock.
    // Awaiting a profile query here deadlocks the client, so "Completing Profile…" never finishes.
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!isMounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        setSession(s);
        setUser(s?.user ?? null);
        setLoading(false);
        return;
      }

      // Avoid wiping profile on routine token refresh (causes buyer-dashboard flash)
      if (event === 'TOKEN_REFRESHED' && s?.user) {
        setSession(s);
        setUser(s.user);
        return;
      }

      if (!s?.user) {
        setPasswordRecovery(false);
        setProfile(null);
        setCompany(null);
        setBuyerProfile(null);
        setSubscription(null);
        setIsPaidSubscriber(false);
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setSession(s);
      setUser(s.user);
      const uid = s.user.id;
      const authUser = s.user;
      window.setTimeout(() => {
        if (!isMounted) return;
        fetchProfile(uid, authUser)
          .catch(() => {})
          .finally(() => {
            if (isMounted) setLoading(false);
          });
      }, 0);
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      authListener.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) {
        return { error: 'Please enter your email address.' };
      }
      if (!password) {
        return { error: 'Please enter your password.' };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        return { error: normalizeAuthError(error.message) };
      }

      if (data?.user) {
        setSession(data.session);
        setUser(data.user);
        await fetchProfile(data.user.id, data.user).catch(() => {});
      }

      return { error: null };
    } catch (e: any) {
      return { error: normalizeAuthError(e?.message) || 'Login failed. Please check your network connection.' };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: 'buyer' | 'supplier'
  ): Promise<{ error: string | null; user?: User | null }> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = fullName.trim();

      if (!cleanEmail) {
        return { error: 'Email address is required.' };
      }
      if (!password || password.length < 8) {
        return { error: 'Password must be at least 8 characters long.' };
      }

      // 1. Force clear previous session before registering a new user to prevent cross-account leak
      await signOut();

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName || cleanEmail.split('@')[0],
            role,
          },
        },
      });

      if (error) {
        return { error: normalizeAuthError(error.message) };
      }

      // If email is already registered, Supabase returns user with empty identities array
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        return {
          error: normalizeAuthError('User already registered'),
        };
      }

      if (data.user) {
        // Force-write role from the registration form (trigger may race / miss metadata)
        try {
          await supabase.from('profiles').upsert(
            {
              id: data.user.id,
              email: cleanEmail,
              full_name: cleanName || cleanEmail.split('@')[0],
              role,
              status: 'active',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          );
          // Explicit update covers ON CONFLICT paths that skip role
          await supabase
            .from('profiles')
            .update({ role, full_name: cleanName || cleanEmail.split('@')[0] })
            .eq('id', data.user.id);
        } catch {
          // Trigger handles profile creation if client RLS restricts
        }

        // If auto-session was not established, immediately sign in with the new credentials
        if (!data.session) {
          const { data: sData } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });
          if (sData?.session) {
            setSession(sData.session);
            setUser(sData.user);
            await fetchProfile(sData.user.id, sData.user).catch(() => {});
            return { error: null, user: sData.user };
          }
        } else {
          setSession(data.session);
          setUser(data.user);
        }

        await fetchProfile(data.user.id, data.user).catch(() => {});

        return { error: null, user: data.user };
      }

      return { error: null };
    } catch (e: any) {
      return { error: normalizeAuthError(e?.message) || 'Failed to complete registration' };
    }
  };

  const signOut = async () => {
    // 1. Clear session & account-scoped caches while preserving app theme
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          k !== 'bulkskart-theme' &&
          (k.startsWith('bulkskart_') ||
            k.startsWith('sb-') ||
            k.includes('supabase') ||
            k.includes('onboarding') ||
            k.includes('inquiry'))
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {
          // ignore
        }
      });
    } catch (e) {
      console.warn('Error clearing localStorage during signOut:', e);
    }

    // 2. Invoke Supabase signOut safely
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.warn('Supabase auth.signOut warning (proceeding with local cleanup):', err);
    } finally {
      // 3. ALWAYS clear local state so the UI and Header immediately update
      setProfile(null);
      setCompany(null);
      setBuyerProfile(null);
      setSubscription(null);
      setIsPaidSubscriber(false);
      setUser(null);
      setSession(null);
      setPasswordRecovery(false);
      try {
        window.dispatchEvent(new Event('auth:signed_out'));
      } catch {
        // ignore
      }
    }
  };

  const resolvedRole = useMemo(() => resolveUserRole(profile, user), [profile, user]);
  const displayName = useMemo(() => displayNameFromUser(profile, user), [profile, user]);
  const dashboardPath = useMemo(() => getDashboardPathForRole(resolvedRole), [resolvedRole]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        company,
        buyerProfile,
        subscription,
        isPaidSubscriber,
        loading,
        resolvedRole,
        displayName,
        dashboardPath,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        refreshSubscription,
        passwordRecovery,
        acknowledgePasswordRecovery: () => setPasswordRecovery(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

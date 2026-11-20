import { supabase } from '@/db/supabase';
import { buildCompanyRow, buildProfileUpdate, type SignupDraft } from './companyRecord';

export interface SaveResult {
  companyId: string | null;
  /** a message for the person; null when it worked */
  error: string | null;
  /** the company already existed, so nothing of theirs was overwritten */
  reused: boolean;
}

/**
 * Saves what the fast sign-up collected: the person's own profile, and a company for them to own.
 *
 * A company this person already owns is never overwritten: if there is one, it is used as it is.
 */
export async function saveManufacturerCompany(draft: SignupDraft, userId: string): Promise<SaveResult> {
  // The profile is a nice-to-have: the company matters more, so a failure here does not stop the sign-up.
  await supabase.from('profiles').update(buildProfileUpdate(draft)).eq('id', userId);

  const { data: existing } = await supabase.from('companies').select('id').eq('owner_id', userId).maybeSingle();
  if (existing?.id) return { companyId: existing.id as string, error: null, reused: true };

  const { data, error } = await supabase.from('companies').insert(buildCompanyRow(draft, userId)).select('id').maybeSingle();
  if (error || !data?.id) {
    return { companyId: null, error: error?.message || 'We could not save your business details.', reused: false };
  }
  return { companyId: data.id as string, error: null, reused: false };
}

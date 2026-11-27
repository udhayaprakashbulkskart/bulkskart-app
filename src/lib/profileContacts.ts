/**
 * Contact details come from the 00080 SECURITY DEFINER functions, not from a direct profiles.phone / email select.
 */
import { supabase } from '@/db/supabase';
import type { Profile, Requirement } from '@/types/types';
import type { VisibleContacts } from '@/lib/contactAccess';

export async function fetchOwnProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.rpc('my_profile');
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as Profile) ?? null;
}

export async function fetchVisibleContacts(userIds: Array<string | null | undefined>): Promise<Record<string, VisibleContacts>> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return {};
  const { data, error } = await supabase.rpc('profile_contacts_for', { p_user_ids: ids });
  if (error || !Array.isArray(data)) return {};
  const out: Record<string, VisibleContacts> = {};
  for (const row of data as Array<VisibleContacts & { user_id: string }>) {
    out[row.user_id] = { phone: row.phone ?? null, email: row.email ?? null, whatsapp_number: row.whatsapp_number ?? null };
  }
  return out;
}

/** Attach buyer phone/email only when the RPC allows it (owner, admin, or paid supplier). */
export async function withBuyerContacts<T extends Pick<Requirement, 'buyer_id'> & { profiles?: Profile | null; buyer_phone?: string | null; buyer_email?: string | null }>(rows: T[]): Promise<T[]> {
  if (!rows.length) return rows;
  const contacts = await fetchVisibleContacts(rows.map((r) => r.buyer_id));
  return rows.map((row) => {
    const c = contacts[row.buyer_id];
    if (!c) {
      const profiles = row.profiles ? { ...row.profiles, phone: null, email: null, whatsapp_number: null } : row.profiles;
      return { ...row, profiles, buyer_phone: null, buyer_email: null };
    }
    const profiles = { ...(row.profiles ?? { id: row.buyer_id } as Profile), phone: c.phone, email: c.email, whatsapp_number: c.whatsapp_number };
    return { ...row, profiles, buyer_phone: c.phone, buyer_email: c.email };
  });
}

/** Buyer contacts for one RFQ, only when the RPC allows it (owner, admin, or paid supplier). Call this on click — do not preload into a public list. */
export async function fetchRfqBuyerContacts(requirementId: string): Promise<VisibleContacts | null> {
  const { data, error } = await supabase.rpc('rfq_buyer_contacts', { p_requirement_id: requirementId });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    phone: (row as VisibleContacts).phone ?? null,
    email: (row as VisibleContacts).email ?? null,
    whatsapp_number: (row as VisibleContacts).whatsapp_number ?? null,
  };
}

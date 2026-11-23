import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PROFILE_PUBLIC_COLUMNS, canViewContacts, contactUpgradeHref, withoutProfileContacts } from '@/lib/contactAccess';

describe('contact details only for paid subscribers', () => {
  it('lets paid members (admins included) and the person themselves see contacts, nobody else', () => {
    expect(canViewContacts({ isPaidSubscriber: true })).toBe(true);
    expect(canViewContacts({ isPaidSubscriber: false, viewerId: 'u1', ownerId: 'u1' })).toBe(true);
    expect(canViewContacts({ isPaidSubscriber: false, viewerId: 'u1', ownerId: 'u2' })).toBe(false);
    expect(canViewContacts({ isPaidSubscriber: false })).toBe(false);
  });
  it('sends manufacturers to their subscription page and everyone else to the plans', () => {
    expect(contactUpgradeHref('supplier')).toBe('/dashboard/supplier/subscription');
    expect(contactUpgradeHref('buyer')).toBe('/pricing');
    expect(contactUpgradeHref(null)).toBe('/pricing');
  });
});

describe('visitor queries never ask the database for profile contact columns', () => {
  it('drops email, phone and WhatsApp from profile embeds and replaces profiles(*)', () => {
    expect(withoutProfileContacts('*, profiles!buyer_id(id,full_name,email,phone), categories!category_id(id,name,slug)'))
      .toBe('*, profiles!buyer_id(id,full_name), categories!category_id(id,name,slug)');
    expect(withoutProfileContacts('*, profiles!buyer_id(*), categories!category_id(*)'))
      .toBe(`*, profiles!buyer_id(${PROFILE_PUBLIC_COLUMNS}), categories!category_id(*)`);
    expect(withoutProfileContacts('*, profiles(full_name, email, role)')).toBe('*, profiles(full_name,role)');
    expect(PROFILE_PUBLIC_COLUMNS).not.toMatch(/email|phone|whatsapp/);
  });
  it('the database keeps visitors from reading them and masks the buyer profile function', () => {
    const sql = readFileSync('supabase/migrations/00069_hide_contacts_from_public.sql', 'utf8');
    expect(sql).toContain("column_name NOT IN ('phone', 'email', 'whatsapp_number')");
    expect(sql).toContain('REVOKE SELECT ON public.profiles FROM anon;');
    expect(sql).toContain('CASE WHEN public.can_view_contacts(bp.user_id) THEN p.email END');
  });
});

describe('phone numbers and emails inside RFQ text', () => {
  it('are hidden, while quantities, dates and street numbers stay', async () => {
    const { maskContactsInText } = await import('@/lib/contactAccess');
    const text = 'Need 2,000 Pcs by 28/12/2026. Cencora UK, 40-44 Floral Street. WhatsApp Number: +4474723229735, mail buyer@cencora.co.uk or call +91 98765 43210';
    const out = maskContactsInText(text);
    expect(out).not.toContain('4474723229735');
    expect(out).not.toContain('98765 43210');
    expect(out).not.toContain('buyer@cencora.co.uk');
    expect(out).toContain('2,000 Pcs by 28/12/2026');
    expect(out).toContain('40-44 Floral Street');
  });
  it('the RFQ panel shows them only to people allowed to see contacts, and fills the screen', () => {
    const drawer = readFileSync('src/components/common/RequirementDetailDrawer.tsx', 'utf8');
    expect(drawer).toContain('const shown = (text: string) => (canSeeContact ? text : maskContactsInText(text));');
    // hidden tabs must not keep their height (the Chat tab used to take half the screen)
    expect(drawer.match(/data-\[state=inactive\]:hidden/g)?.length).toBe(3);
    expect(drawer).toContain('h-[100dvh]');
  });
});

/**
 * autoQuotationApi.ts
 * Helper to invoke the auto-quotation Edge Function
 * and to fetch/manage auto_quotations from the frontend.
 */
import { supabase } from '@/db/supabase';

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-quotation`;

/** Trigger auto-quotation matching for a newly posted requirement */
export async function invokeAutoQuotation(requirementId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token ?? ''}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
    },
    body: JSON.stringify({ requirement_id: requirementId }),
  });
}

export interface AutoQuotationRow {
  id: string;
  requirement_id: string;
  supplier_company_id: string;
  buyer_id: string;
  status: string;
  unit_price: number;
  quantity: number;
  quantity_unit: string;
  currency: string;
  subtotal: number;
  shipping_cost: number;
  tax_amount: number;
  other_charges: number;
  total_amount: number;
  product_name: string;
  product_specs: string | null;
  moq: number;
  moq_unit: string;
  delivery_days: number | null;
  estimated_delivery_date: string | null;
  validity_days: number;
  valid_until: string | null;
  payment_terms: string | null;
  terms_and_conditions: string | null;
  is_auto_generated: boolean;
  buyer_action: string | null;
  buyer_notes: string | null;
  approved_at: string | null;
  auto_sent_at: string | null;
  created_at: string;
  updated_at: string;
  requirements?: { id: string; title: string; quantity: number; quantity_unit: string; destination_country: string | null; deadline: string | null; priority_tag?: string | null; is_urgent?: boolean | null };
}

/** Supplier: fetch all auto_quotations pending approval for their company */
export async function getPendingApprovalQuotations(companyId: string): Promise<AutoQuotationRow[]> {
  const { data } = await supabase
    .from('auto_quotations')
    .select('*, requirements!requirement_id(id,title,quantity,quantity_unit,destination_country,deadline,priority_tag,is_urgent)')
    .eq('supplier_company_id', companyId)
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: false });
  return Array.isArray(data) ? data : [];
}

/** Supplier: approve a pending auto_quotation — creates a quotations row + sends to buyer */
export async function approveAutoQuotation(aq: AutoQuotationRow, companyOwnerId: string): Promise<{ error: string | null }> {
  // Insert into quotations table
  const { data: quotation, error: qErr } = await supabase
    .from('quotations')
    .insert({
      requirement_id: aq.requirement_id,
      supplier_company_id: aq.supplier_company_id,
      supplier_id: companyOwnerId,
      buyer_id: aq.buyer_id,
      unit_price: aq.unit_price,
      currency: aq.currency,
      moq: aq.moq,
      moq_unit: aq.moq_unit,
      delivery_days: aq.delivery_days,
      payment_terms: aq.payment_terms,
      validity_days: aq.validity_days,
      total_price: aq.total_amount,
      notes: `Auto-generated quotation — approved by supplier`,
      status: 'pending',
      is_draft: false,
    })
    .select('id')
    .single();

  if (qErr) return { error: qErr.message };

  // Update auto_quotation row
  await supabase
    .from('auto_quotations')
    .update({
      status: 'sent',
      quotation_id: quotation?.id ?? null,
      approved_at: new Date().toISOString(),
      approved_by: companyOwnerId,
      auto_sent_at: new Date().toISOString(),
    })
    .eq('id', aq.id);

  // Notify buyer
  const reqTitle = aq.requirements?.title ?? 'your requirement';
  await supabase.from('notifications').insert({
    user_id: aq.buyer_id,
    title: 'New Quotation Received',
    message: `A supplier sent a quotation for "${reqTitle}" — Total: ${aq.currency} ${aq.total_amount.toLocaleString()}`,
    type: 'quote_received',
    link: `/requirements?tab=mine&req=${aq.requirement_id}`,
  });

  return { error: null };
}

/** Supplier: dismiss/decline a pending auto_quotation */
export async function dismissAutoQuotation(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('auto_quotations')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error: error?.message ?? null };
}

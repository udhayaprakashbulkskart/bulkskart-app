import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/supabase', () => ({ supabase: {} }));

import { canRelease, commissionSplit, describePayment, type OrderPaymentFields } from '@/lib/orderPayments';

const order = (over: Partial<OrderPaymentFields> = {}): OrderPaymentFields => ({
  id: 'o1',
  order_number: 'ORD-1',
  total_amount: 5000,
  currency: 'INR',
  order_status: 'confirmed',
  payment_status: 'pending',
  payment_method: null,
  paid_amount: null,
  paid_at: '2026-11-10T10:00:00Z',
  commission_pct: 2,
  ...over,
});

describe('order payments, as the buyer and the manufacturer see them', () => {
  it('splits a released payment 98 / 2, the same as the database does', () => {
    expect(commissionSplit(5000)).toEqual({ commission: 100, payout: 4900 });
    expect(commissionSplit(1234.5)).toEqual({ commission: 24.69, payout: 1209.81 });
  });

  it('a held payment: the buyer is told the maker is paid only on confirmation; the maker sees what will come', () => {
    const held = order({ payment_status: 'escrow', payment_method: 'online', paid_amount: 5000 });
    expect(describePayment(held, 'buyer')).toMatchObject({ badge: 'Held by BulkSkart', tone: 'held' });
    expect(describePayment(held, 'buyer').text).toContain('only when you confirm delivery');
    expect(describePayment(held, 'supplier').text).toContain('₹4,900');
  });

  it('a held payment on a cancelled order is a refund due, not a payout', () => {
    expect(describePayment(order({ payment_status: 'escrow', order_status: 'cancelled', paid_amount: 5000 }), 'buyer').badge).toBe('Refund due');
  });

  it('release is offered only once the order is shipped or delivered', () => {
    expect(canRelease(order({ payment_status: 'escrow', order_status: 'processing' }))).toBe(false);
    expect(canRelease(order({ payment_status: 'escrow', order_status: 'shipped' }))).toBe(true);
    expect(canRelease(order({ payment_status: 'escrow', order_status: 'delivered' }))).toBe(true);
    expect(canRelease(order({ payment_status: 'released', order_status: 'delivered' }))).toBe(false);
  });

  it('pay at the factory: waiting, then paid in full with no commission', () => {
    expect(describePayment(order({ payment_method: 'at_factory' }), 'supplier').text).toContain('Record the payment');
    expect(describePayment(order({ payment_status: 'paid', payment_method: 'at_factory', paid_amount: 5000 }), 'buyer').badge).toBe('Paid at factory');
  });

  it('nothing chosen yet', () => {
    expect(describePayment(order(), 'buyer').text).toBe('Choose how you want to pay for this order.');
    expect(describePayment(order(), 'supplier').text).toBe('Waiting for the buyer to choose how to pay.');
  });
});

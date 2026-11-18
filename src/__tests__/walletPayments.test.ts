import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('wallet: buyer pays BulkSkart, manufacturer is paid after the order is completed', () => {
  it('opens the Wallet page from the manufacturer menu and the old wallet links', () => {
    const routes = src('src/routes.tsx');
    expect(routes).toContain("path: '/dashboard/supplier/wallet', element: <SupplierWalletPage />");
    expect(routes).toContain("path: '/dashboard/manufacturer/wallet', element: <SupplierWalletPage />");
    expect(routes).toContain("path: '/wallet', element: <SupplierWalletPage />");
    expect(routes).toContain("path: '/dashboard/admin/payments', element: <AdminPaymentsPage />");
    expect(routes).not.toContain("path: '/dashboard/supplier/wallet', element: <SupplierLeadCreditsPage />");

    const layout = src('src/components/layouts/DashboardLayout.tsx');
    expect(layout).toContain("{ label: 'Wallet', href: '/dashboard/supplier/wallet', icon: Wallet }");
    expect(layout).toContain("{ label: 'Payments', href: '/dashboard/admin/payments', icon: Wallet }");
    // A manufacturer without a plan can still reach their own money
    expect(layout).toContain("'/dashboard/supplier/wallet', // their own money, plan or not");
  });

  it('shows the order payment panel on every order page', () => {
    expect(src('src/pages/dashboard/shared/OrderTrackingPage.tsx')).toContain('<OrderPaymentPanel order={order} viewer={role} onChanged={fetchAll} />');
  });

  it('takes the order amount from the order on the server, never from the browser', () => {
    const create = src('supabase/functions/razorpay-create-order/index.ts');
    expect(create).toContain("if (type === 'order_payment') {");
    expect(create).toContain('const amountPaise = Math.round(Number(order.total_amount) * 100);');
    // the order case runs before the company check that subscriptions need
    expect(create.indexOf("if (type === 'order_payment') {")).toBeLessThan(create.indexOf('if (!company_id) {'));

    const verify = src('supabase/functions/razorpay-verify-payment/index.ts');
    expect(verify).toContain("(!company_id && type !== 'order_payment')");
    expect(verify).toContain("payment_status: 'escrow'");
    // held only after the signature check
    expect(verify.indexOf("payment_status: 'escrow'")).toBeGreaterThan(verify.indexOf('Payment verification failed: invalid signature'));
  });

  it('moves money into the wallet only through the database steps', () => {
    const wallet = src('supabase/migrations/00065_order_payments_wallet.sql');
    expect(wallet).toContain('CREATE OR REPLACE FUNCTION public.release_order_payment');
    expect(wallet).toContain('SET withdrawable_balance = coalesce(withdrawable_balance, 0) + payout');
    expect(wallet).toContain("'/dashboard/supplier/wallet'");
    const guard = src('supabase/migrations/00064_wallet_money_protections.sql');
    expect(guard).toContain("ARRAY['wallet_balance', 'withdrawable_balance', 'total_revenue', 'commission_balance']");
    expect(guard).toContain('CREATE TRIGGER trg_protect_company_money_fields');
  });

  it('no longer approves payouts straight from the admin control panel', () => {
    const admin = src('src/pages/dashboard/admin/AdminDashboardFull.tsx');
    expect(admin).not.toContain('approveWithdrawal');
    expect(admin).toContain('Settle in Payments');
  });
});

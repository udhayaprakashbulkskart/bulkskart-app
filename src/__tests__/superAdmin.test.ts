import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolveUserRole } from '@/lib/authRole';
import { superAdminError } from '@/lib/superAdmin';

describe('super admin', () => {
  it('sign-up data from the browser never makes anyone an admin', () => {
    const user = { user_metadata: { role: 'admin' } } as never;
    expect(resolveUserRole(null, user)).toBe('buyer');
    expect(resolveUserRole(null, { user_metadata: { role: 'supplier' } } as never)).toBe('supplier');
    expect(resolveUserRole({ role: 'admin' } as never, user)).toBe('admin'); // the database role still counts
  });

  it('the database grants admin only through super admins and logs it', () => {
    const sql = readFileSync('supabase/migrations/00070_super_admin.sql', 'utf8');
    expect(sql).not.toMatch(/raw_role = 'admin'/);
    expect(sql).toContain('CREATE TRIGGER trg_guard_profile_privileges');
    expect(sql).toContain("RAISE EXCEPTION 'last_super_admin'");
    expect(sql).toContain('INSERT INTO public.admin_role_changes');
  });

  it('the menu shows Super Admin only to super admins', () => {
    const layout = readFileSync('src/components/layouts/DashboardLayout.tsx', 'utf8');
    const adminList = layout.slice(layout.indexOf('export const adminNavItems'), layout.indexOf('];', layout.indexOf('export const adminNavItems')));
    expect(adminList).not.toContain('/dashboard/admin/super');
    expect(layout).toContain("superAdminNavItem: NavItem = { label: 'Super Admin', href: '/dashboard/admin/super'");
    expect(layout).toContain('?.is_super_admin ? [...adminNavItems, superAdminNavItem] : adminNavItems');
    expect(readFileSync('src/routes.tsx', 'utf8')).toContain("path: '/dashboard/admin/super', element: <SuperAdminPage />");
  });

  it('explains the database answers in plain words', () => {
    expect(superAdminError({ message: 'last_super_admin' })).toBe('There must always be at least one super admin.');
    expect(superAdminError({ code: 'PGRST202', message: 'Could not find the function' })).toMatch(/migration 00070/);
  });
});

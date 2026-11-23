/** Super admin page helpers (database functions in supabase/migrations/00070_super_admin.sql). */

/** Plain words for the database's answers. */
export function superAdminError(err: { code?: string; message?: string } | null | undefined): string {
  const m = err?.message ?? '';
  if (err?.code === 'PGRST202' || err?.code === '42883' || /could not find the function/i.test(m)) {
    return 'The super admin database update (migration 00070) has not been run yet.';
  }
  if (m.includes('super_admin_only')) return 'Only super admins can do this.';
  if (m.includes('last_super_admin')) return 'There must always be at least one super admin.';
  if (m.includes('cannot_remove_own_admin')) return 'You cannot remove your own admin rights. Ask another super admin.';
  if (m.includes('make_admin_first')) return 'Make this person an admin first.';
  if (m.includes('user_not_found')) return 'That account no longer exists.';
  return m || 'Something went wrong. Please try again.';
}

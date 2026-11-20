import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { claimBrowserStorageFor, LAST_USER_KEY, USER_SCOPED_KEYS } from '@/lib/userScopedStorage';

const fill = () => USER_SCOPED_KEYS.forEach((k) => localStorage.setItem(k, `data-of-${k}`));
const kept = () => USER_SCOPED_KEYS.filter((k) => localStorage.getItem(k) !== null);

describe("a new account never sees the previous person's data", () => {
  beforeEach(() => localStorage.clear());

  it('clears the saved lists when a different person signs in on this browser', () => {
    claimBrowserStorageFor('user-a');
    fill();
    localStorage.setItem('bs-theme', 'dark');
    claimBrowserStorageFor('user-b');
    expect(kept()).toEqual([]);
    expect(localStorage.getItem('bs-theme')).toBe('dark');
    expect(localStorage.getItem(LAST_USER_KEY)).toBe('user-b');
  });

  it('keeps them for the same person, and for a visitor who saved things before signing up', () => {
    fill();
    claimBrowserStorageFor('first-user');
    expect(kept()).toHaveLength(USER_SCOPED_KEYS.length);
    claimBrowserStorageFor('first-user');
    expect(kept()).toHaveLength(USER_SCOPED_KEYS.length);
  });

  it("My Products and the company product list only hold the company's own products", () => {
    const page = readFileSync(join(process.cwd(), 'src/pages/dashboard/supplier/SupplierProductsPage.tsx'), 'utf8');
    expect(page).toContain('p.company_id === companyId');
    expect(page).toContain('Finish your business profile first');
    const api = readFileSync(join(process.cwd(), 'src/lib/api.ts'), 'utf8');
    expect(api).toContain('if (options?.companyId) return combined.filter((p) => p.company_id === options.companyId);');
  });
});

import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import LoanEligibleTag from '@/components/common/LoanEligibleTag';

describe('Loan Eligible tag', () => {
  it('is a plain tag inside product cards that are already links', () => {
    render(<MemoryRouter><a href="/products/x"><LoanEligibleTag /></a></MemoryRouter>);
    const tag = screen.getByText('Loan Eligible');
    expect(tag.tagName).toBe('SPAN');
    expect(tag.closest('a')?.getAttribute('href')).toBe('/products/x');
  });

  it('links to the order loan calculator where it can', () => {
    render(<MemoryRouter><LoanEligibleTag link size="md" /></MemoryRouter>);
    expect(screen.getByText('Loan Eligible').closest('a')?.getAttribute('href')).toBe('/loan-calculator');
  });

  it('is on every place that shows products', () => {
    for (const file of [
      'src/pages/ProductsPage.tsx',
      'src/pages/ProductDetailPage.tsx',
      'src/pages/CompanyProfilePage.tsx',
      'src/pages/RequirementDetailsPage.tsx',
      'src/components/home/FeaturedProductsSection.tsx',
    ]) {
      expect(readFileSync(join(process.cwd(), file), 'utf8'), file).toContain('<LoanEligibleTag');
    }
  });
});

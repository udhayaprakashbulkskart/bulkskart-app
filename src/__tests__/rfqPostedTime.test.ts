import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('public RFQ cards do not show a relative posted time', () => {
  it('the requirements list keeps location and delivery, and drops the clock plus "X ago"', () => {
    const page = src('src/pages/RequirementsPage.tsx');
    expect(page).not.toContain('function timeAgo');
    expect(page).not.toContain('min ago');
    expect(page).not.toContain('hrs ago');
    expect(page).toContain('visual.locationDisplay');
    expect(page).toContain('Delivery');
    expect(page).toContain('Latest First');
    expect(page).toContain("label: 'New'");
    expect(page).toContain("label: 'Closing soon'");
    expect(page).toContain('icon: Clock');
  });

  it('the home Live RFQ cards still omit posted time', () => {
    const section = src('src/components/home/LiveRfqScrollSection.tsx');
    expect(section).not.toContain('timeAgo');
    expect(section).not.toContain('min ago');
    expect(section).not.toContain('postedAgo');
    expect(section).toContain('deliveryDate');
    expect(section).toContain('card.city');
  });

  it('the live buyer alert and the auth ticker no longer print "X ago"', () => {
    expect(src('src/components/common/LiveBuyerOrderAlert.tsx')).not.toContain('function timeAgo');
    expect(src('src/components/common/LiveBuyerOrderAlert.tsx')).not.toContain('min ago');
    expect(src('src/pages/AuthPage.tsx')).not.toContain('function timeSince');
    expect(src('src/pages/AuthPage.tsx')).toContain('Posted on BulkSkart');
    expect(src('src/pages/AuthPage.tsx')).not.toContain('activity.when');
  });
});

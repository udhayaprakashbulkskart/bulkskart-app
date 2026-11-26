import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('public pages use the full desktop width', () => {
  it('has the desktop rule that widens page wrappers inside .site-shell', () => {
    const css = src('src/index.css');
    expect(css).toMatch(/@media \(min-width: 1280px\)\s*\{\s*\.site-shell/);
    expect(css).toContain('max-width: min(100%, 1800px)');
  });

  it('marks the shared layout as the site shell', () => {
    expect(src('src/components/layouts/MainLayout.tsx')).toMatch(/className="site-shell /);
  });

  it('marks every page that draws its own header as the site shell', () => {
    const pages = readdirSync(join(process.cwd(), 'src/pages')).filter((f) => f.endsWith('.tsx'));
    const ownHeader = pages.filter((f) => /<Header\s*\/>/.test(src(`src/pages/${f}`)));
    expect(ownHeader.length).toBeGreaterThan(0);
    for (const f of ownHeader) expect(src(`src/pages/${f}`), f).toMatch(/className="site-shell[ "]/);
  });
});

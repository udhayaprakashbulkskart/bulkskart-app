import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const splash = html.slice(html.indexOf('<div id="app-splash"'), html.indexOf('<div id="root">'));

describe('installed app opening screen', () => {
  it('is an animation with no logo', () => {
    expect(splash).toContain('sp-box');
    expect(splash).not.toMatch(/<img|<svg|logo|bulkskart/i);
  });

  it('only shows for the installed app (or the ?splash preview) and once per launch', () => {
    expect(html).toContain("matchMedia('(display-mode: standalone)')");
    expect(html).toContain("sessionStorage.getItem('bk-splash-shown')");
    expect(html).toMatch(/html\.is-app #app-splash\{display:flex\}/);
  });

  it('respects reduced motion and always gets out of the way', () => {
    expect(html).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\.sp-box\{opacity:1;animation:none\}/);
    expect(html).toContain('setTimeout(hide, 6000)');
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const splash = html.slice(html.indexOf('<div id="app-splash"'), html.indexOf('<div id="root">'));
const manifest = JSON.parse(readFileSync(join(process.cwd(), 'public/site.webmanifest'), 'utf8')) as {
  icons: { src: string; sizes: string }[];
};

describe('installed app opening screen', () => {
  it('is an animation of cartons and the BulkSkart name, with no logo image', () => {
    expect(splash).toContain('sp-box');
    expect(splash).toContain('sp-word');
    const word = [...splash.matchAll(/<span(?: class="sp-o")?>([A-Za-z])<\/span>/g)].map((m) => m[1]).join('');
    expect(word).toBe('BulkSkart');
    expect(splash).not.toMatch(/<img|<svg|logo/i);
  });

  it('only shows for the installed app (or the ?splash preview) and once per launch', () => {
    expect(html).toContain("matchMedia('(display-mode: standalone)')");
    expect(html).toContain("sessionStorage.getItem('bk-splash-shown')");
    expect(html).toMatch(/html\.is-app #app-splash\{display:flex\}/);
  });

  it('respects reduced motion and always gets out of the way', () => {
    expect(html).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\.sp-box,\.sp-word span,\.sp-tag,\.sp-bar\{opacity:1;transform:none;animation:none\}/);
    expect(html).toContain('setTimeout(hide, 6000)');
  });

  it('gives Android a transparent icon, so its own launch screen shows no white box', () => {
    const large = manifest.icons.find((icon) => icon.sizes === '512x512');
    const medium = manifest.icons.find((icon) => icon.sizes === '192x192');
    expect(large?.src).toBe('/app-icon-512.png');
    expect(medium?.src).toBe('/app-icon-192.png');
    for (const file of ['app-icon-512.png', 'app-icon-192.png']) {
      const png = readFileSync(join(process.cwd(), 'public', file));
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      expect(png[25]).toBe(6); // colour type 6: RGBA, so the background can be transparent
    }
  });
});

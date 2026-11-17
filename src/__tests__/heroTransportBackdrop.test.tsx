import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import HeroSection3D from '@/components/home/HeroSection3D';

describe('home hero background', () => {
  it('shows the moving plane, ship and truck instead of the photo and 3D crate', () => {
    const { container } = render(<MemoryRouter><HeroSection3D /></MemoryRouter>);
    const scene = container.querySelector('.tb-scene');
    expect(scene?.getAttribute('aria-hidden')).toBe('true');
    for (const part of ['.tb-plane', '.tb-ship', '.tb-truck', '.tb-port']) {
      expect(scene?.querySelector(part)).not.toBeNull();
    }
    expect(container.querySelector('img[src*="staticflickr"]')).toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.textContent).toContain('Grow Bigger.');
  });

  it('pauses off screen and stays still for reduced motion', () => {
    const css = readFileSync(join(process.cwd(), 'src/components/home/hero/transport-backdrop.css'), 'utf8');
    expect(css).toContain("[data-paused='true']");
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*animation: none !important/);
  });
});

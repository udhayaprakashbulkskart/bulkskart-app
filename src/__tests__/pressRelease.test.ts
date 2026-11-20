import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/supabase', () => ({ supabase: {} }));

import { BLOG_POSTS } from '@/pages/BlogDetailPage';

const SLUG = 'bulkskart-connects-bulk-buyers-with-verified-manufacturers';
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('press release article', () => {
  const post = BLOG_POSTS[SLUG];
  const text = post ? [post.summary, ...post.content.flatMap((s) => [s.heading, ...s.paragraphs])].join('\n') : '';

  it('is published as a news article written by the company', () => {
    expect(post?.slug).toBe(SLUG);
    expect(post.category).toBe('News');
    expect(post.authorType).toBe('Organization');
    expect(post.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('has no unfilled placeholders and no features that are not live yet', () => {
    expect(text).not.toMatch(/\[[^\]]*\]/);
    expect(text).not.toMatch(/escrow|held by BulkSkart|factory visit/i);
  });

  it('is listed on the blog, linked from the SEO hub pages and in the sitemap', () => {
    expect(read('src/pages/BlogPage.tsx')).toContain(`slug: '${SLUG}'`);
    expect(read('src/pages/SEOHubPage.tsx')).toContain(`/blog/${SLUG}`);
    expect(read('public/sitemap-main.xml')).toContain(`https://www.bulkskart.com/blog/${SLUG}`);
  });
});

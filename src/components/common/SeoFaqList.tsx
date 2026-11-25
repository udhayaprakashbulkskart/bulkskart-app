import { Link } from 'react-router-dom';
import type { SeoQuestion } from '@/lib/seoContent';

/**
 * Questions and answers as headings and paragraphs, the way search engines read them for "People also ask".
 * The same questions go into the page's FAQPage data (PageMeta faq), so what is marked up is what is shown.
 */
export default function SeoFaqList({ items, headingLevel = 'h2' }: { items: SeoQuestion[]; headingLevel?: 'h2' | 'h3' }) {
  const Heading = headingLevel;
  return (
    <div className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-[#141414]">
      {items.map((item) => (
        <section key={item.q} className="px-4 py-4 sm:px-5">
          <Heading className="text-[15px] font-extrabold leading-snug text-neutral-900 dark:text-white sm:text-[16px]">{item.q}</Heading>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-600 dark:text-white/70">{item.a}</p>
          {item.links && item.links.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {item.links.map((link) => (
                <Link key={link.href} to={link.href} className="text-[13px] font-bold text-[#C24400] hover:underline dark:text-[#FF8A3D]">
                  {link.label} →
                </Link>
              ))}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

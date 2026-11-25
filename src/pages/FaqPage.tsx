/** /faq — what people ask about BulkSkart, answered in plain words (and marked up as FAQPage for search engines). */
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import MainLayout from '@/components/layouts/MainLayout';
import PageMeta from '@/components/common/PageMeta';
import SeoFaqList from '@/components/common/SeoFaqList';
import { ALTERNATIVES, BRAND_FAQ, FAQ_PAGE } from '@/lib/seoContent';

export default function FaqPage() {
  return (
    <MainLayout>
      <PageMeta
        title={FAQ_PAGE.title}
        description={FAQ_PAGE.description}
        canonical="https://www.bulkskart.com/faq"
        breadcrumbs={[{ name: 'Home', item: '/' }, { name: 'FAQ', item: '/faq' }]}
        faq={BRAND_FAQ.map((item) => ({ question: item.q, answer: item.a }))}
      />
      <div className="bg-[#f5f5f5] text-neutral-900 dark:bg-[#0a0a0a] dark:text-white">
        <div className="mx-auto w-full max-w-[880px] px-4 pb-14 pt-4 sm:px-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] text-neutral-500 dark:text-white/55">
            <Link to="/" className="hover:text-[#FF5A00]">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-semibold text-neutral-800 dark:text-white/85">FAQ</span>
          </nav>
          <h1 className="mt-2 text-[26px] font-black leading-tight tracking-tight sm:text-[32px]">
            BulkSkart <span className="text-[#FF5A00]">FAQ</span>
          </h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-600 dark:text-white/70">
            What buyers and manufacturers most often ask about BulkSkart, the B2B wholesale marketplace.
          </p>

          <div className="mt-5">
            <SeoFaqList items={BRAND_FAQ} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/post-requirement" className="inline-flex h-10 items-center rounded-full bg-[#FF5A00] px-5 text-[13.5px] font-bold text-white hover:bg-[#e04e00]">
              Post a free requirement
            </Link>
            <Link
              to="/auth?tab=supplier"
              className="inline-flex h-10 items-center rounded-full border border-neutral-300 px-5 text-[13.5px] font-bold text-neutral-900 hover:border-[#FF5A00] dark:border-white/20 dark:text-white"
            >
              Register as a manufacturer
            </Link>
          </div>

          <h2 className="mt-8 text-[17px] font-extrabold">Comparing B2B marketplaces?</h2>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
            {ALTERNATIVES.map((page) => (
              <li key={page.slug}>
                <Link to={`/${page.slug}`} className="text-[13.5px] font-bold text-[#C24400] hover:underline dark:text-[#FF8A3D]">
                  BulkSkart as {/^[aeiou]/i.test(page.competitor) ? 'an' : 'a'} {page.competitor} alternative →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </MainLayout>
  );
}

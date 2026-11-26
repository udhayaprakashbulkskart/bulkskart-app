/**
 * /indiamart-alternative, /tradeindia-alternative, /alibaba-alternative — for people comparing B2B marketplaces.
 * Only BulkSkart is described; the other platform is named (with a trademark note), never characterised.
 */
import { Link, Navigate } from 'react-router-dom';
import { Check, ChevronRight, HelpCircle } from 'lucide-react';
import MainLayout from '@/components/layouts/MainLayout';
import PageMeta from '@/components/common/PageMeta';
import SeoFaqList from '@/components/common/SeoFaqList';
import { ALTERNATIVES, ALTERNATIVE_CHECKLIST, alternativeBySlug } from '@/lib/seoContent';

export default function AlternativePage({ slug }: { slug: string }) {
  const page = alternativeBySlug(slug);
  if (!page) return <Navigate to="/faq" replace />;
  const others = ALTERNATIVES.filter((p) => p.slug !== page.slug);

  return (
    <MainLayout>
      <PageMeta
        title={page.title}
        description={page.description}
        canonical={`https://www.bulkskart.com/${page.slug}`}
        breadcrumbs={[{ name: 'Home', item: '/' }, { name: `${page.competitor} alternative`, item: `/${page.slug}` }]}
        faq={page.faq.map((item) => ({ question: item.q, answer: item.a }))}
      />
      <div className="bg-[#f5f5f5] text-neutral-900 dark:bg-[#0a0a0a] dark:text-white">
        <div className="mx-auto w-full max-w-[1400px] px-4 pb-14 pt-4 sm:px-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] text-neutral-500 dark:text-white/55">
            <Link to="/" className="hover:text-[#FF5A00]">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-semibold text-neutral-800 dark:text-white/85">{page.competitor} alternative</span>
          </nav>
          <h1 className="mt-2 text-[24px] font-black leading-tight tracking-tight sm:text-[32px]">{page.h1}</h1>
          <p className="mt-2 max-w-4xl text-[14px] leading-relaxed text-neutral-600 dark:text-white/70">{page.intro}</p>

          <h2 className="mt-7 text-[18px] font-extrabold">What you get on BulkSkart</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {page.points.map((point) => (
              <li key={point} className="flex items-start gap-2.5 rounded-xl border border-neutral-200 bg-white p-3 text-[13.5px] leading-snug dark:border-white/10 dark:bg-[#141414]">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#FF5A00] text-white">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/post-requirement" className="inline-flex h-10 items-center rounded-full bg-[#FF5A00] px-5 text-[13.5px] font-bold text-white hover:bg-[#e04e00]">
              Post a free requirement
            </Link>
            <Link
              to="/auth?tab=supplier"
              className="inline-flex h-10 items-center rounded-full border border-neutral-300 px-5 text-[13.5px] font-bold text-neutral-900 hover:border-[#FF5A00] dark:border-white/20 dark:text-white"
            >
              Sell on BulkSkart
            </Link>
          </div>

          <h2 className="mt-8 text-[18px] font-extrabold">Questions to ask any B2B marketplace</h2>
          <ul className="mt-3 grid gap-2 lg:grid-cols-2">
            {ALTERNATIVE_CHECKLIST.map((question) => (
              <li key={question} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-neutral-700 dark:text-white/75">
                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF5A00]" aria-hidden="true" />
                {question}
              </li>
            ))}
          </ul>

          <h2 className="mt-8 text-[18px] font-extrabold">Frequently asked questions</h2>
          <div className="mt-3">
            <SeoFaqList items={page.faq} headingLevel="h3" wide />
          </div>

          <p className="mt-6 text-[13px]">
            More answers on the <Link to="/faq" className="font-bold text-[#C24400] hover:underline dark:text-[#FF8A3D]">BulkSkart FAQ</Link>
            {others.length > 0 && (
              <>
                {' · '}
                {others.map((other, index) => (
                  <span key={other.slug}>
                    {index > 0 && ' · '}
                    <Link to={`/${other.slug}`} className="font-bold text-[#C24400] hover:underline dark:text-[#FF8A3D]">
                      {other.competitor} alternative
                    </Link>
                  </span>
                ))}
              </>
            )}
          </p>

          <p className="mt-6 border-t border-neutral-200 pt-4 text-[11.5px] leading-relaxed text-neutral-500 dark:border-white/10 dark:text-white/50">
            {page.competitor} is a trademark of its owner. BulkSkart is not affiliated with, endorsed by or sponsored by {page.competitor}. Details of
            other platforms change; check their own websites.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}

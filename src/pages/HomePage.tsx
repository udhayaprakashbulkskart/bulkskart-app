import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PageMeta from '@/components/common/PageMeta';
import { ArrowRight, Globe, Package, Building2, ShieldCheck, FileText } from 'lucide-react';
import MainLayout from '@/components/layouts/MainLayout';
import LandingHero from '@/components/home/LandingHero';

// Below-the-fold sections are split into their own chunks so the first paint only downloads the hero.
const VerifiedSuppliersSection = lazy(() => import('@/components/home/VerifiedSuppliersSection'));
const FeaturedProductsSection = lazy(() => import('@/components/home/FeaturedProductsSection'));
const OrderBenefitsSection = lazy(() => import('@/components/home/OrderBenefitsSection'));
const CategoriesAndStatsSection = lazy(() => import('@/components/home/CategoriesAndStatsSection'));
const VerifiedSupplierQuickActions = lazy(() => import('@/components/home/VerifiedSupplierQuickActions'));
const LiveRequirementsFeed = lazy(() => import('@/components/common/LiveRequirementsFeed'));
const LiveReverseAuctionsRail = lazy(() => import('@/components/home/LiveReverseAuctionsRail'));
const GlobalTradeNetworkSection = lazy(() => import('@/components/home/GlobalTradeNetworkSection'));
const PostRequirementsHomeSection = lazy(() => import('@/components/home/PostRequirementsHomeSection'));
const PlansHomeSection = lazy(() => import('@/components/home/PlansHomeSection'));
const ReviewsHomeSection = lazy(() => import('@/components/home/ReviewsHomeSection'));

// ── Helpers ─────────────────────────────────────────────
function FadeInSection({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(32px)',
      transition: `opacity 0.65s ease ${delay}s, transform 0.65s ease ${delay}s`,
    }}>
      {children}
    </div>
  );
}

function WhenVisible({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShow(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setShow(true);
        observer.disconnect();
      }
    }, { rootMargin: '240px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref}>{show ? <Suspense fallback={null}>{children}</Suspense> : null}</div>;
}

const SHIPPING_BANNER = 'https://live.staticflickr.com/4092/5009413427_3d13b6b445_b.jpg';

export default function HomePage() {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('bulkskart-clear-landing-filters'));
  }, []);

  return (
    <MainLayout background="black">
      <PageMeta
        title="BulkSkart | B2B Wholesale Marketplace & Bulk Suppliers in India"
        description="Find verified manufacturers and wholesale suppliers in India. Every BulkSkart order includes free delivery. Compare bulk prices, estimate an order installment, post free RFQs, and source factory-direct products."
        keywords="B2B marketplace India, wholesale suppliers India, bulk suppliers, manufacturers in India, post RFQ, factory direct wholesale, MOQ, bulk buying"
        canonical="https://www.bulkskart.com/"
        ogImage="https://www.bulkskart.com/brand/bulkskart-logo.jpg"
        ogType="website"
        breadcrumbs={[
          { name: 'Home', item: '/' },
        ]}
        faq={[
          {
            question: "What is BulkSkart?",
            answer: "BulkSkart is India's leading global B2B wholesale marketplace connecting verified bulk buyers directly with verified global manufacturers and industrial exporters across India, USA, UAE, Germany, and 180+ countries.",
          },
          {
            question: "Is posting a bulk requirement (RFQ) free for buyers?",
            answer: "Yes, verified buyers can post unlimited bulk buying requirements (RFQs) 100% free with zero platform commissions or hidden fees.",
          },
          {
            question: "How does BulkSkart verify suppliers and factories?",
            answer: "Every manufacturer undergoes rigorous verification including business license audits, tax identification (GST/IEC), production facility certifications (ISO, CE, FDA), and historical trade performance reviews.",
          },
          {
            question: "What is Trade Assurance on BulkSkart?",
            answer: "Trade Assurance protects buyer purchase orders with guaranteed on-time dispatch, product quality standards, milestone escrow payments, and secure dispute resolution.",
          },
          {
            question: "Can suppliers receive live buyer requirements?",
            answer: "Yes, verified manufacturers receive instant alerts for live buying tenders matching their product categories and can submit direct factory quotations to buyers.",
          },
          {
            question: "Is delivery free on BulkSkart?",
            answer: "Yes. Free delivery applies to every order placed on BulkSkart. No delivery fee is added at checkout, for any order value or product category.",
          },
          {
            question: "Can I estimate a monthly installment for a bulk order?",
            answer: "Yes. The order loan calculator on the homepage estimates a monthly installment from the order value, down payment, interest rate, and tenure. Delivery on that order stays free. The figure is for planning and is not a credit approval.",
          },
        ]}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': 'https://www.bulkskart.com/#webpage',
          url: 'https://www.bulkskart.com/',
          name: 'BulkSkart | B2B Wholesale Marketplace & Bulk Suppliers in India',
          description: 'Find verified manufacturers and wholesale suppliers in India. Every BulkSkart order includes free delivery. Compare bulk prices, estimate an order installment, post free RFQs, and source factory-direct products.',
          isPartOf: { '@id': 'https://www.bulkskart.com/#website' },
          about: { '@id': 'https://www.bulkskart.com/#organization' },
          inLanguage: 'en-IN',
        }}
      />

      {/* Mobile search bar now lives in Header — no duplicate here */}

      {/* ═══════════════════════════════════════════════════
          SECTION 1: BANNER (HERO / PROMOTIONAL BANNER)
      ═══════════════════════════════════════════════════ */}
      <LandingHero />

      {/* ═══════════════════════════════════════════════════
          SECTION 2: VERIFIED SUPPLIERS (POSITIONED IN FRONT OF FEATURED PRODUCTS)
      ═══════════════════════════════════════════════════ */}
      <Suspense fallback={null}><VerifiedSuppliersSection /></Suspense>
      <WhenVisible><FeaturedProductsSection /></WhenVisible>
      <WhenVisible><OrderBenefitsSection /></WhenVisible>
      <WhenVisible><CategoriesAndStatsSection /></WhenVisible>
      <WhenVisible><VerifiedSupplierQuickActions /></WhenVisible>
      <WhenVisible><LiveRequirementsFeed /></WhenVisible>
      <WhenVisible><LiveReverseAuctionsRail /></WhenVisible>
      <WhenVisible><GlobalTradeNetworkSection /></WhenVisible>
      <WhenVisible><PostRequirementsHomeSection /></WhenVisible>
      <WhenVisible><PlansHomeSection /></WhenVisible>
      <WhenVisible><ReviewsHomeSection /></WhenVisible>

      {/* ═══════════════════════════════════════════════════
          CRAWLABLE B2B MARKETPLACE OVERVIEW (SEO & BUYER GUIDE)
      ═══════════════════════════════════════════════════ */}
      <section className="py-12 bg-card/60 border-t border-border">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#FF5A00] bg-[#FF5A00]/10 px-3 py-1 rounded-full mb-2">
                India Sourcing Ecosystem
              </span>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground">
                India’s Premier B2B Bulk Buying & Wholesale Platform
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-2xl mx-auto">
                Bridging verified Indian manufacturing clusters with global procurement professionals through transparent quotation comparison and Trade Assurance.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <div className="space-y-3 bg-background/60 p-5 rounded-2xl border border-border">
                <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#FF5A00]" />
                  <span>What Bulkskart Is & Who It Is For</span>
                </h3>
                <p>
                  Bulkskart is India’s dedicated digital B2B wholesale marketplace connecting commercial buyers directly with verified production facilities. Built specifically for corporate procurement teams, retail distributors, export trading houses, and institutional buyers, Bulkskart eliminates opaque broker tiers and delivers verified factory-direct pricing.
                </p>
                <p>
                  Whether you are an established enterprise sourcing high-volume industrial machinery or a growing retail brand restocking seasonal inventory, Bulkskart streamlines supplier discovery across all major manufacturing corridors.
                </p>
              </div>

              <div className="space-y-3 bg-background/60 p-5 rounded-2xl border border-border">
                <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#FF5A00]" />
                  <span>Manufacturers vs Wholesalers</span>
                </h3>
                <p>
                  Our verified network distinguishes between primary <Link to="/manufacturers" className="text-[#FF5A00] font-semibold hover:underline">Manufacturers</Link> offering custom OEM/ODM production runs and master <Link to="/wholesale-suppliers" className="text-[#FF5A00] font-semibold hover:underline">Wholesalers</Link> maintaining ready-to-ship pallet inventory.
                </p>
                <p>
                  Buyers can filter by business type, production capacity, ISO compliance, and location clusters like <Link to="/manufacturers-in-tamil-nadu" className="text-[#FF5A00] font-semibold hover:underline">Tamil Nadu</Link>, <Link to="/manufacturers-in-coimbatore" className="text-[#FF5A00] font-semibold hover:underline">Coimbatore</Link>, <Link to="/manufacturers-in-chennai" className="text-[#FF5A00] font-semibold hover:underline">Chennai</Link>, and Gujarat.
                </p>
              </div>

              <div className="space-y-3 bg-background/60 p-5 rounded-2xl border border-border">
                <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#FF5A00]" />
                  <span>RFQ Workflow & Quotation Comparison</span>
                </h3>
                <p>
                  Posting a <Link to="/post-requirement" className="text-[#FF5A00] font-semibold hover:underline">Request for Quotation (RFQ)</Link> takes less than 60 seconds. Specify required quantities, target prices, delivery incoterms (FOB, CIF, EXW), and technical drawings.
                </p>
                <p>
                  Qualified suppliers submit itemized quotes with clear breakdowns for unit costs, sample availability, mold tooling fees, and estimated production lead times, allowing buyers to compare bids side-by-side.
                </p>
              </div>

              <div className="space-y-3 bg-background/60 p-5 rounded-2xl border border-border">
                <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#FF5A00]" />
                  <span>MOQ Flexibility & Tiered Bulk Pricing</span>
                </h3>
                <p>
                  Each listing in our <Link to="/bulk-products" className="text-[#FF5A00] font-semibold hover:underline">bulk products catalog</Link> clearly displays the Minimum Order Quantity (MOQ) alongside quantity-discount tiers.
                </p>
                <p>
                  Buyers can order pre-production commercial samples before approving full container volumes, with milestone payments safely protected through Trade Assurance until goods pass quality inspection.
                </p>
              </div>
            </div>

            {/* Quick Sourcing Hub Links */}
            <div className="mt-6 pt-5 border-t border-border flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="font-bold text-foreground mr-1">Popular Sourcing Hubs:</span>
              <Link to="/b2b-marketplace" className="text-muted-foreground hover:text-[#FF5A00] underline">B2B Marketplace</Link>
              <span className="text-muted-foreground">•</span>
              <Link to="/manufacturers-in-india" className="text-muted-foreground hover:text-[#FF5A00] underline">Manufacturers in India</Link>
              <span className="text-muted-foreground">•</span>
              <Link to="/wholesale-suppliers-in-india" className="text-muted-foreground hover:text-[#FF5A00] underline">Wholesale Suppliers India</Link>
              <span className="text-muted-foreground">•</span>
              <Link to="/manufacturers-in-tamil-nadu" className="text-muted-foreground hover:text-[#FF5A00] underline">Tamil Nadu Factories</Link>
              <span className="text-muted-foreground">•</span>
              <Link to="/manufacturers-in-coimbatore" className="text-muted-foreground hover:text-[#FF5A00] underline">Coimbatore Pumps & Textiles</Link>
              <span className="text-muted-foreground">•</span>
              <Link to="/manufacturers-in-chennai" className="text-muted-foreground hover:text-[#FF5A00] underline">Chennai Industrial Hub</Link>
              <span className="text-muted-foreground">•</span>
              <Link to="/blog/what-is-moq" className="text-muted-foreground hover:text-[#FF5A00] underline">What is MOQ?</Link>
              <span className="text-muted-foreground">•</span>
              <Link to="/blog/how-to-find-manufacturers-in-india" className="text-muted-foreground hover:text-[#FF5A00] underline">Finding Indian Factories Guide</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          FINAL CTA BANNER
      ═══════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-[#1A0C05] dark:bg-[#15181F]">
        <div className="absolute inset-0 z-0 opacity-20">
          <img
            src={SHIPPING_BANNER}
            alt="BulkSkart Global Shipping and Logistics Network"
            width={1200}
            height={800}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="absolute inset-0 z-0 bg-[#0b0f17]/80" />
        <FadeInSection className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-5 md:px-6 py-6 sm:py-8 md:py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-primary/40 bg-primary/10 flex items-center justify-center shrink-0">
                <Globe className="w-6 h-6 md:w-8 md:h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-[16px] md:text-[22px] font-black text-white leading-snug">
                  Join thousands of businesses trading smarter with Bulkskart.
                </h2>
              </div>
            </div>
            <Link to="/auth?tab=register" className="w-full md:w-auto shrink-0">
              <Button className="w-full md:w-auto bg-[#C94400] hover:bg-primary/90 text-white font-bold h-12 px-8 text-[14px] rounded-xl shadow-[0_4px_0_hsl(20_100%_30%)] gap-2 transition-all active:shadow-none active:translate-y-0.5">
                Create Free Account <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </FadeInSection>
      </section>

    </MainLayout>
  );
}


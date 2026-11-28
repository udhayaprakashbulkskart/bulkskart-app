import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ClipboardList, Flag, Loader2, Sparkles } from 'lucide-react';
import MainLayout from '@/components/layouts/MainLayout';
import PageMeta from '@/components/common/PageMeta';
import LoanEligibleTag from '@/components/common/LoanEligibleTag';
import Breadcrumbs from '@/components/common/Breadcrumbs';
import SubscribeToContactDialog, { type SubscriptionReason } from '@/components/common/SubscribeToContactDialog';
import AIQuotationModal from '@/components/common/AIQuotationModal';
import ProtectedContact from '@/components/common/ProtectedContact';
import ReportItemModal from '@/components/common/ReportItemModal';
import { RequirementDetailView } from '@/components/common/RequirementDetailDrawer';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import {
  checkSupplierAiMatchingAccess,
  getProducts,
  getRequirementById,
  getRequirements,
  incrementRequirementViewCount,
} from '@/lib/api';
import { calculateProductMatchScore, catalogueInr, generateAIQuotationDraft, type AIQuotationDraft, type MatchedProduct } from '@/lib/aiSalesAssistant';
import type { Product, Requirement } from '@/types/types';
import '@/components/formkit/formkit.css';
import { isOutsideListing, withoutOutsideLinks } from '@/lib/rfqSources';
import { maskContactsInText } from '@/lib/contactAccess';
import { isDeliveryDatePassed } from '@/lib/deliveryDate';
import { isSeededRequirement } from '@/lib/seedData';
import { isPublicListing } from '@/lib/publicListings';





function Card({ title, icon: Icon, children, className = '' }: { title?: string; icon?: React.ElementType; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-card border border-border rounded-2xl p-4 sm:p-5 ${className}`}>
      {title && (
        <h2 className="flex items-center gap-2 text-base font-bold text-foreground mb-3">
          {Icon && <Icon className="w-4 h-4 text-primary" aria-hidden="true" />}
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

/**
 * One buyer requirement (RFQ). Everything shown comes from the saved requirement, its buyer and its quotations:
 * there is no made-up buyer, quote, picture or chat. Suppliers quote through the quotation wizard or the AI draft
 * from their own catalogue, and talk to the buyer in Messages.
 */
export default function RequirementDetailsPage() {
  const { rfqId } = useParams<{ rfqId: string }>();
  const { user, company } = useAuth();

  const [req, setReq] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<Requirement[]>([]);
  const [ownProducts, setOwnProducts] = useState<Product[]>([]);
  const [buyerRfqCount, setBuyerRfqCount] = useState<number | null>(null);

  const [gateReason, setGateReason] = useState<SubscriptionReason>('no_subscription');
  const [gateOpen, setGateOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiProduct, setAiProduct] = useState<MatchedProduct | null>(null);
  const [aiDraft, setAiDraft] = useState<AIQuotationDraft | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!rfqId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const found = await getRequirementById(rfqId);
      setReq(found);
      if (!found) return;
      incrementRequirementViewCount(found.id);
      // the quotations are loaded by the RFQ view itself
      const related = await getRequirements({ categoryId: found.category_id || undefined, limit: 6 });
      setSimilar(related.filter((r) => r.id !== found.id).slice(0, 4));
    } catch (err) {
      console.error('Error loading requirement:', err);
      setLoadError('This requirement could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [rfqId]);

  useEffect(() => {
    loadData();
    window.scrollTo(0, 0);
  }, [loadData]);

  // the supplier's own catalogue, for the AI-drafted quotation
  useEffect(() => {
    if (!company?.id) {
      setOwnProducts([]);
      return;
    }
    getProducts({ companyId: company.id }).then((rows) => setOwnProducts(Array.isArray(rows) ? rows : []));
  }, [company?.id]);

  // how many requirements this buyer has posted on BulkSkart
  useEffect(() => {
    if (!req?.buyer_id) return;
    let active = true;
    supabase
      .from('requirements')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', req.buyer_id)
      .then(({ count }) => {
        if (active) setBuyerRfqCount(typeof count === 'number' ? count : null);
      });
    return () => {
      active = false;
    };
  }, [req?.buyer_id]);

  const isPoster = Boolean(user?.id && req?.buyer_id === user.id);

  const aiMatches = useMemo<MatchedProduct[]>(() => {
    if (!req || ownProducts.length === 0) return [];
    return ownProducts
      .map((p) => ({ p, score: calculateProductMatchScore(p, req) }))
      .filter(({ score }) => score >= 50)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ p, score }) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        categoryName: p.categories?.name,
        price: Number(p.price_min) || 0,
        priceCurrency: p.price_currency || '',
        priceINR: catalogueInr(p.price_min, p.price_currency),
        moq: Number(p.moq) || 0,
        moqUnit: p.moq_unit || req.quantity_unit || 'Pcs',
        availableQuantity: 0,
        estimatedDeliveryDays: 0,
        matchScore: score,
        image: p.images?.[0],
        unitCompatibility: true,
      }));
  }, [ownProducts, req]);

  const gate = (reason: SubscriptionReason) => {
    setGateReason(reason);
    setGateOpen(true);
  };

  /** a supplier with a business profile, or the reason they are not one yet */
  const supplierReady = () => {
    if (!user) {
      gate('not_logged_in');
      return false;
    }
    if (!company) {
      gate('not_registered_business');
      return false;
    }
    return true;
  };

  const handleUseForQuote = async (product: MatchedProduct) => {
    if (!req || !supplierReady() || !user || !company) return;
    setBusy(`ai-${product.id}`);
    const access = await checkSupplierAiMatchingAccess(company.id, user.id);
    setBusy(null);
    if (!access.allowed) {
      gate('ai_matching_subscription');
      return;
    }
    setAiProduct(product);
    setAiDraft(generateAIQuotationDraft(req, product));
    setAiOpen(true);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="bg-background min-h-screen py-8 px-4 sm:px-6" role="status" aria-label="Loading requirement">
          <div className="max-w-6xl mx-auto space-y-4 animate-pulse">
            <div className="h-5 w-56 bg-muted rounded-md" />
            <div className="h-32 bg-muted rounded-2xl" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <div className="h-48 bg-muted rounded-2xl" />
                <div className="h-40 bg-muted rounded-2xl" />
              </div>
              <div className="h-72 bg-muted rounded-2xl" />
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (loadError || !req) {
    return (
      <MainLayout>
        <PageMeta title="Requirement not found | BulkSkart" description="This buyer requirement is not available." robots="noindex, nofollow" />
        <div className="bg-background min-h-[70vh] flex items-center justify-center p-4">
          <div className="fk-skin bg-card border border-border p-8 rounded-2xl max-w-md w-full text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto text-destructive">
              <AlertCircle className="w-6 h-6" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Requirement not found</h1>
            <p className="text-sm text-muted-foreground">{loadError || 'This requirement may have been closed or removed by the buyer.'}</p>
            <div className="fk-actions">
              <Link to="/requirements" className="fk-btn is-primary">
                Browse open requirements
              </Link>
              {loadError && (
                <button type="button" onClick={loadData} className="fk-btn is-ghost">
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // A Public Requirement (collected from a public page elsewhere): its buyer is not on BulkSkart, so no quotation here.
  if (isPublicListing(req)) {
    const qty = req.quantity != null ? `${Number(req.quantity).toLocaleString('en-IN')}${req.quantity_unit ? ` ${req.quantity_unit}` : ''}` : 'Not stated';
    return (
      <MainLayout>
        <PageMeta title={`${req.title} | Public requirement | BulkSkart`} description="A publicly listed buyer requirement." robots="noindex, nofollow" />
        <div className="bg-background min-h-[70vh] px-4 py-8">
          <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-6">
            <span className="inline-block rounded-md border border-[#FF6A14]/60 bg-[#FF6A14]/10 px-2 py-0.5 text-xs font-black tracking-wide text-[#E04E00] dark:text-[#FF8A3D]">PUBLIC REQUIREMENT</span>
            <h1 className="text-xl font-black text-foreground sm:text-2xl">{req.title}</h1>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Quantity</dt><dd className="text-foreground">{qty}</dd>
              <dt className="text-muted-foreground">Delivery location</dt><dd className="text-foreground">{[req.destination_city, req.destination_country].filter(Boolean).join(', ') || 'Not stated'}</dd>
              {req.listing_category && (<><dt className="text-muted-foreground">Category</dt><dd className="text-foreground">{req.listing_category}</dd></>)}
            </dl>
            {req.specifications && <p className="whitespace-pre-line text-sm text-muted-foreground">{req.specifications}</p>}
            <p className="text-sm text-muted-foreground">This requirement was publicly listed by a buyer who is not registered on BulkSkart, so quotations cannot be sent through BulkSkart for it.</p>
            <Link to="/requirements" className="fk-btn is-primary inline-flex">Browse Live RFQs from BulkSkart buyers</Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  const rfqCode = req.req_number || `RFQ-${req.id.slice(0, 8).toUpperCase()}`;
  const place = [req.destination_city, req.destination_country].filter(Boolean).join(', ');
  const hasBudget = Boolean(req.budget_min || req.budget_max);
  const deadlinePassed = isDeliveryDatePassed(req.deadline);
  const isOpen = req.status === 'active' && !deadlinePassed;
  const publicText = (text?: string | null) => maskContactsInText(withoutOutsideLinks(text ?? '')).replace(/\s+/g, ' ').trim();
  // tender imports and demo rows stay out of search results
  const keepOutOfSearch = isOutsideListing(req) || isSeededRequirement(req);
  const buyer = req.profiles as (Requirement['profiles'] & { company_name?: string | null }) | undefined;
  const memberSince = buyer?.created_at ? new Date(buyer.created_at).getFullYear() : null;

  return (
    <MainLayout>
      <PageMeta
        title={`${req.title} (${rfqCode}) — Buying Requirement | BulkSkart`}
        robots={keepOutOfSearch ? 'noindex, follow' : undefined}
        description={
          publicText(req.description).slice(0, 300) ||
          `Buyer requirement for ${req.quantity} ${req.quantity_unit} of ${req.title}${place ? `, delivery to ${place}` : ''}. Send a quotation on BulkSkart.`
        }
        keywords={`${req.title}, bulk RFQ, buy ${req.title}, wholesale requirement, ${req.categories?.name || 'industrial'}, B2B supply lead`}
        canonical={`/requirements/${req.id}`}
        ogType="website"
        breadcrumbs={[
          { name: 'Home', item: '/' },
          { name: 'Requirements', item: '/requirements' },
          { name: `${req.title} (${rfqCode})`, item: `/requirements/${req.id}` },
        ]}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Demand',
          name: req.title,
          description: publicText(req.description) || `Bulk purchase request for ${req.quantity} ${req.quantity_unit} of ${req.title}`,
          sku: rfqCode,
          itemOffered: { '@type': 'Product', name: req.title, category: req.categories?.name },
          ...(hasBudget
            ? { priceSpecification: { '@type': 'UnitPriceSpecification', price: req.budget_min || req.budget_max, priceCurrency: req.currency || 'INR' } }
            : {}),
          ...(req.destination_country ? { eligibleRegion: { '@type': 'Place', name: req.destination_country } } : {}),
        }}
      />
      <div className="fk-skin min-h-screen bg-background pb-16 text-foreground">
        <div className="mx-auto max-w-6xl space-y-4 px-3 pt-4 sm:px-5 md:pt-6">
          <Breadcrumbs
            items={[
              { name: 'Buying Requirements', href: '/requirements' },
              { name: rfqCode, href: `/requirements/${req.id}` },
            ]}
          />
          {/* the same Overview / Quotations / Chat as the RFQ panel, as a full page */}
          <RequirementDetailView
            layout="page"
            requirement={req}
            onRequirementUpdated={setReq}
            headerExtra={<LoanEligibleTag size="sm" />}
            buyerExtra={
              <>
                {(buyerRfqCount !== null || memberSince) && (
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    {buyerRfqCount !== null && (
                      <div className="rounded-xl bg-muted/50 p-2.5">
                        <dt className="text-muted-foreground">Requirements posted</dt>
                        <dd className="text-base font-extrabold text-foreground">{buyerRfqCount}</dd>
                      </div>
                    )}
                    {memberSince && (
                      <div className="rounded-xl bg-muted/50 p-2.5">
                        <dt className="text-muted-foreground">On BulkSkart since</dt>
                        <dd className="text-base font-extrabold text-foreground">{memberSince}</dd>
                      </div>
                    )}
                  </dl>
                )}
                {!isPoster && (
                  <div className="mt-3">
                    <ProtectedContact phone={buyer?.phone} country={req.destination_country} contactType="buyer" variant="card" allowPaidSupplierUnlock seed={req.id} />
                  </div>
                )}
              </>
            }
            below={
              <>
              {/* ── AI draft from the supplier's own catalogue ── */}
              {!isPoster && company && aiMatches.length > 0 && (
                <Card title="Your matching products" icon={Sparkles}>
                  <p className="text-xs text-muted-foreground -mt-1 mb-3">From your own catalogue. Start a quotation from one; you check every number before it is sent.</p>
                  <ul className="space-y-2">
                    {aiMatches.map((product) => (
                      <li key={product.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {product.priceINR > 0
                              ? `₹${product.priceINR.toLocaleString('en-IN')} / ${product.moqUnit}`
                              : product.price > 0
                                ? `${product.priceCurrency} ${product.price.toLocaleString()} / ${product.moqUnit}`
                                : 'Price not set'}
                            {product.moq > 0 && ` · MOQ ${product.moq.toLocaleString('en-IN')}`} · {product.matchScore}% match
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUseForQuote(product)}
                          disabled={!isOpen || busy === `ai-${product.id}`}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                        >
                          {busy === `ai-${product.id}` ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Sparkles className="w-4 h-4" aria-hidden="true" />}
                          Use for Quote
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              </>
            }
            aside={
              <>
              {similar.length > 0 && (
                <Card title="Similar requirements" icon={ClipboardList}>
                  <ul className="space-y-2">
                    {similar.map((item) => (
                      <li key={item.id}>
                        <Link to={`/requirements/${item.id}`} className="block rounded-xl border border-border p-3 hover:border-primary/40">
                          <p className="text-sm font-semibold text-foreground line-clamp-2">{item.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {Number(item.quantity || 0).toLocaleString('en-IN')} {item.quantity_unit}
                            {item.destination_city || item.destination_country ? ` · ${[item.destination_city, item.destination_country].filter(Boolean).join(', ')}` : ''}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              <button type="button" onClick={() => setReportOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive px-1">
                <Flag className="w-3.5 h-3.5" aria-hidden="true" /> Report this requirement
              </button>
              </>
            }
          />
        </div>
      </div>

      <AIQuotationModal
        open={aiOpen}
        onOpenChange={setAiOpen}
        requirement={req}
        product={aiProduct}
        initialDraft={aiDraft}
        onSuccess={loadData}
        onRequireSubscription={() => gate('quotation_subscription')}
      />

      <SubscribeToContactDialog open={gateOpen} onClose={() => setGateOpen(false)} reason={gateReason} />
      <ReportItemModal open={reportOpen} onOpenChange={setReportOpen} targetType="requirement" targetId={req.id} targetTitle={req.title} />
    </MainLayout>
  );
}

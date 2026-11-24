import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Calendar,
  CheckCircle,
  ClipboardList,
  Copy,
  FileText,
  Flag,
  Inbox,
  Loader2,
  LogIn,
  MapPin,
  MessageSquare,
  Package,
  Send,
  Sparkles,
  Tag,
  Target,
  User,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import MainLayout from '@/components/layouts/MainLayout';
import PageMeta from '@/components/common/PageMeta';
import LoanEligibleTag from '@/components/common/LoanEligibleTag';
import Breadcrumbs from '@/components/common/Breadcrumbs';
import { QUOTE_ACCESS_NOTE } from '@/lib/quoteAccess';
import SubscribeToContactDialog, { type SubscriptionReason } from '@/components/common/SubscribeToContactDialog';
import AIQuotationModal from '@/components/common/AIQuotationModal';
import SubmitQuotationWizard from '@/components/rfq/SubmitQuotationWizard';
import ProtectedContact from '@/components/common/ProtectedContact';
import ReportItemModal from '@/components/common/ReportItemModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import {
  checkDirectMessageQuota,
  checkSupplierAiMatchingAccess,
  checkSupplierPaidSubscription,
  getOrCreateConversation,
  getProducts,
  getQuotationsForRequirement,
  getRequirementById,
  getRequirements,
  incrementMessageQuota,
  incrementRequirementViewCount,
} from '@/lib/api';
import { calculateProductMatchScore, catalogueInr, generateAIQuotationDraft, type AIQuotationDraft, type MatchedProduct } from '@/lib/aiSalesAssistant';
import { formatPriceRange } from '@/lib/productPrice';
import type { Product, Quotation, Requirement } from '@/types/types';
import '@/components/formkit/formkit.css';
import { isOutsideListing, isOwnUrl, withoutOutsideLinks } from '@/lib/rfqSources';
import { canViewContacts, maskContactsInText } from '@/lib/contactAccess';
import { isSeededRequirement } from '@/lib/seedData';
import { isPublicListing, postedOnLabel } from '@/lib/publicListings';

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

function postedLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return minutes <= 1 ? 'Posted just now' : `Posted ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Posted ${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Posted yesterday';
  if (days < 30) return `Posted ${days} days ago`;
  return `Posted ${dateLabel(iso)}`;
}

/** "Label: value" lines become a table; anything else is shown as the buyer wrote it. */
function parseSpecs(text: string | null | undefined): Array<{ label: string; value: string }> | null {
  if (!text) return null;
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0 || !lines.every((line) => line.includes(':'))) return null;
  return lines.map((line) => {
    const [label, ...rest] = line.split(':');
    return { label: label.trim(), value: rest.join(':').trim() };
  });
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'B';

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
  const navigate = useNavigate();
  const { user, profile, company, isPaidSubscriber } = useAuth();

  const [req, setReq] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [similar, setSimilar] = useState<Requirement[]>([]);
  const [ownProducts, setOwnProducts] = useState<Product[]>([]);
  const [buyerRfqCount, setBuyerRfqCount] = useState<number | null>(null);
  const [imageBroken, setImageBroken] = useState(false);

  const [gateReason, setGateReason] = useState<SubscriptionReason>('no_subscription');
  const [gateOpen, setGateOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
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
      setImageBroken(false);
      if (!found) return;
      incrementRequirementViewCount(found.id);
      const [quoteRows, related] = await Promise.all([
        getQuotationsForRequirement(found.id),
        getRequirements({ categoryId: found.category_id || undefined, limit: 6 }),
      ]);
      setQuotes(quoteRows);
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
  const role = profile?.role as string | undefined;
  const isSupplier = role === 'supplier' || role === 'manufacturer';
  const myQuotes = useMemo(() => (company?.id ? quotes.filter((q) => q.supplier_company_id === company.id) : []), [quotes, company?.id]);

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

  const handleSendQuote = async () => {
    if (!supplierReady() || !company) return;
    setBusy('quote');
    const check = await checkSupplierPaidSubscription(company.id, company);
    setBusy(null);
    if (!check.allowed) {
      gate(check.reason === 'no_subscription' ? 'quotation_subscription' : (check.reason as SubscriptionReason));
      return;
    }
    setWizardOpen(true);
  };

  const handleMessageBuyer = async () => {
    if (!req || !supplierReady() || !user || !company) return;
    setBusy('message');
    const quota = await checkDirectMessageQuota(company.id, company);
    if (quota !== 'ok') {
      setBusy(null);
      gate(quota);
      return;
    }
    const { id, error } = await getOrCreateConversation(req.buyer_id, user.id, company.id, req.id);
    if (error || !id) {
      setBusy(null);
      toast.error('The chat could not be opened. Please try again.');
      return;
    }
    await incrementMessageQuota(company.id);
    setBusy(null);
    navigate(`/dashboard/supplier/messages?conv=${id}`);
  };

  const handleMessageSupplier = async (q: Quotation) => {
    if (!req || !user) return;
    setBusy(`msg-${q.id}`);
    const { id, error } = await getOrCreateConversation(user.id, q.supplier_id, q.supplier_company_id, req.id);
    setBusy(null);
    if (error || !id) {
      toast.error('The chat could not be opened. Please try again.');
      return;
    }
    navigate(`/dashboard/buyer/messages?conv=${id}`);
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
    const posted = postedOnLabel(req.created_at);
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
              {posted && (<><dt className="text-muted-foreground">Posted</dt><dd className="text-foreground">{posted}</dd></>)}
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
  const budget = hasBudget ? formatPriceRange(req.budget_min, req.budget_max, req.currency, req.currency || 'INR', undefined, { openEnded: false }) : null;
  const deadlinePassed = Boolean(req.deadline && new Date(req.deadline).getTime() < Date.now() - 24 * 60 * 60 * 1000);
  const isOpen = req.status === 'active' && !deadlinePassed;
  // phone numbers and emails a buyer typed into the text: only for paid members (and never in search snippets)
  const showText = (text: string) => (canViewContacts({ isPaidSubscriber, viewerId: user?.id, ownerId: req.buyer_id }) ? text : maskContactsInText(text));
  const publicText = (text?: string | null) => maskContactsInText(withoutOutsideLinks(text ?? '')).replace(/\s+/g, ' ').trim();
  const specText = showText(req.specifications ?? '');
  // tender imports and demo rows stay out of search results
  const keepOutOfSearch = isOutsideListing(req) || isSeededRequirement(req);
  const specs = parseSpecs(specText);
  const buyer = req.profiles as (Requirement['profiles'] & { company_name?: string | null }) | undefined;
  const buyerName = buyer?.company_name || buyer?.full_name || 'Buyer';
  const memberSince = buyer?.created_at ? new Date(buyer.created_at).getFullYear() : null;
  const quoteCount = quotes.length;

  const copyCode = () => {
    navigator.clipboard?.writeText(rfqCode).then(
      () => toast.success(`Copied ${rfqCode}`),
      () => toast.error('Could not copy'),
    );
  };

  const supplierActions = (
    <div className="flex flex-col sm:flex-row gap-2">
      <button type="button" onClick={handleSendQuote} disabled={!isOpen || busy === 'quote'} className="fk-btn is-primary sm:min-w-[220px]">
        {busy === 'quote' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
        {myQuotes.length > 0 ? 'Send a New Quote' : 'Send Quote'}
      </button>
      <button type="button" onClick={handleMessageBuyer} disabled={busy === 'message'} className="fk-btn is-ghost">
        {busy === 'message' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <MessageSquare aria-hidden="true" />}
        Message Buyer
      </button>
    </div>
  );

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

      <div className="fk-skin bg-background text-foreground min-h-screen pb-28 md:pb-16">
        <div className="max-w-6xl mx-auto px-3 sm:px-5 pt-4 md:pt-6 space-y-4 md:space-y-5">
          <Breadcrumbs
            items={[
              { name: 'Buying Requirements', href: '/requirements' },
              { name: rfqCode, href: `/requirements/${req.id}` },
            ]}
          />

          {/* ── the requirement at a glance ── */}
          <section className="bg-card border border-border rounded-2xl p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${
                  isOpen ? 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/30' : 'text-muted-foreground bg-muted border-border'
                }`}
              >
                {isOpen ? 'Open for quotes' : deadlinePassed ? 'Deadline passed' : 'Closed'}
              </span>
              <button type="button" onClick={copyCode} className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg border border-border">
                {rfqCode} <Copy className="w-3 h-3" aria-hidden="true" />
                <span className="sr-only">Copy the requirement number</span>
              </button>
              {req.created_at && <span className="text-xs text-muted-foreground">{postedLabel(req.created_at)}</span>}
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-foreground leading-tight">{req.title}</h1>
            <LoanEligibleTag size="sm" />
            <ul className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <Package className="w-4 h-4 text-primary" aria-hidden="true" />
                <b className="text-foreground">{Number(req.quantity || 0).toLocaleString('en-IN')}</b> {req.quantity_unit}
              </li>
              {place && (
                <li className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-primary" aria-hidden="true" />
                  {place}
                </li>
              )}
              {req.deadline && (
                <li className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-primary" aria-hidden="true" />
                  Needed by {dateLabel(req.deadline)}
                </li>
              )}
              {req.categories?.name && (
                <li className="flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-primary" aria-hidden="true" />
                  {req.categories.name}
                </li>
              )}
              <li className="flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-primary" aria-hidden="true" />
                {quoteCount === 0 ? 'No quotations yet' : `${quoteCount} ${quoteCount === 1 ? 'quotation' : 'quotations'}`}
              </li>
            </ul>

            <div className="mt-5">
              {isPoster ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link to={`/dashboard/buyer/quotes?req=${req.id}`} className="fk-btn is-primary sm:min-w-[220px]">
                    <ClipboardList aria-hidden="true" /> Review Quotations
                  </Link>
                  <Link to="/dashboard/buyer/requirements" className="fk-btn is-ghost">
                    My Requirements
                  </Link>
                </div>
              ) : !user ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link to={`/login?returnUrl=${encodeURIComponent(`/requirements/${req.id}`)}`} className="fk-btn is-primary sm:min-w-[220px]">
                    <LogIn aria-hidden="true" /> Log In to Quote
                  </Link>
                  <Link to="/signup/manufacturer" className="fk-btn is-ghost">
                    Join as a Supplier
                  </Link>
                </div>
              ) : isSupplier || company ? (
                supplierActions
              ) : (
                <p className="text-sm text-muted-foreground">
                  Quotations are sent from supplier accounts. Need something similar?{' '}
                  <Link to="/post-requirement" className="text-primary font-semibold hover:underline">
                    Post your own requirement
                  </Link>
                  .
                </p>
              )}
              {!isPoster && (
                <p className="mt-3 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs sm:text-sm text-muted-foreground" role="note">
                  <Lock className="w-4 h-4 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    <strong className="font-semibold text-foreground">{QUOTE_ACCESS_NOTE}</strong>{' '}
                    {!user ? (
                      <>
                        <Link to={`/login?returnUrl=${encodeURIComponent(`/requirements/${req.id}`)}`} className="text-primary font-semibold hover:underline">Sign in</Link>
                        {' or '}
                        <Link to="/signup/manufacturer" className="text-primary font-semibold hover:underline">register your company</Link>
                        {' to quote.'}
                      </>
                    ) : !company ? (
                      (isSupplier) && (
                        <Link to="/dashboard/supplier/profile" className="text-primary font-semibold hover:underline">Register your company to quote.</Link>
                      )
                    ) : !isPaidSubscriber ? (
                      <>
                        Upgrade to a paid plan to send quotations.{' '}
                        <Link to="/pricing" className="text-primary font-semibold hover:underline">See plans</Link>
                      </>
                    ) : null}
                  </span>
                </p>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 items-start">
            <div className="lg:col-span-2 space-y-4 md:space-y-5 min-w-0">
              {req.attachment_url && !imageBroken && (
                <Card title="Buyer's reference" icon={FileText}>
                  {(() => {
                    const image = (
                      <img
                        src={req.attachment_url}
                        alt={`Reference image for ${req.title}`}
                        loading="lazy"
                        decoding="async"
                        onError={() => setImageBroken(true)}
                        className="w-full max-h-[420px] object-contain rounded-xl bg-muted"
                      />
                    );
                    // Open the file only when BulkSkart stores it; never send people to other websites
                    return isOwnUrl(req.attachment_url) ? (
                      <a href={req.attachment_url} target="_blank" rel="noreferrer" className="block">{image}</a>
                    ) : image;
                  })()}
                </Card>
              )}

              <Card title="What the buyer needs" icon={FileText}>
                {req.description ? (
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{showText(withoutOutsideLinks(req.description))}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">The buyer has not added a description.</p>
                )}
                {specs ? (
                  <dl className="mt-4 divide-y divide-border border border-border rounded-xl overflow-hidden">
                    {specs.map((row, index) => (
                      <div key={`${row.label}-${index}`} className="grid grid-cols-3 gap-3 px-3 py-2.5 text-sm">
                        <dt className="text-muted-foreground">{row.label}</dt>
                        <dd className="col-span-2 font-medium text-foreground break-words">{showText(withoutOutsideLinks(row.value)).replace(/\|(\s*\|)+/g, '|') || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  specText && (
                    <div className="mt-4">
                      <h3 className="text-sm font-bold text-foreground mb-1">Specifications</h3>
                      <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{withoutOutsideLinks(specText)}</p>
                    </div>
                  )
                )}
              </Card>

              <Card title="Order details" icon={Target}>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-muted/50 p-3">
                    <dt className="text-xs text-muted-foreground">Quantity</dt>
                    <dd className="font-bold text-foreground">
                      {Number(req.quantity || 0).toLocaleString('en-IN')} {req.quantity_unit}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <dt className="text-xs text-muted-foreground">Target price per unit</dt>
                    <dd className="font-bold text-foreground">{budget ?? 'Not stated'}</dd>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <dt className="text-xs text-muted-foreground">Deliver to</dt>
                    <dd className="font-bold text-foreground">{place || 'Not stated'}</dd>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <dt className="text-xs text-muted-foreground">Needed by</dt>
                    <dd className="font-bold text-foreground">{req.deadline ? dateLabel(req.deadline) : 'No deadline given'}</dd>
                  </div>
                </dl>
              </Card>

              {/* ── quotations ── */}
              <Card title="Quotations" icon={ClipboardList}>
                {isPoster ? (
                  quotes.length === 0 ? (
                    <div className="text-center py-6">
                      <Inbox className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" aria-hidden="true" />
                      <p className="text-sm font-semibold text-foreground">No quotations yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Suppliers&apos; quotations will appear here and in your dashboard.</p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {quotes.map((q) => {
                        const comp = q.companies as (Quotation['companies'] & { verification_status?: string; city?: string | null; country?: string | null }) | undefined;
                        return (
                          <li key={q.id} className="border border-border rounded-xl p-3.5">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-bold text-foreground flex items-center gap-1.5">
                                  <span className="truncate">{comp?.company_name || 'Supplier'}</span>
                                  {comp?.verification_status === 'verified' && <BadgeCheck className="w-4 h-4 text-primary shrink-0" aria-label="Verified supplier" />}
                                </p>
                                {(comp?.city || comp?.country) && <p className="text-xs text-muted-foreground">{[comp?.city, comp?.country].filter(Boolean).join(', ')}</p>}
                              </div>
                              <p className="text-lg font-extrabold text-primary">
                                {formatPriceRange(q.unit_price, null, q.currency, q.currency || 'INR', undefined, { openEnded: false })}
                                <span className="text-xs font-medium text-muted-foreground"> / {q.moq_unit || req.quantity_unit}</span>
                              </p>
                            </div>
                            <dl className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                              {q.moq ? (
                                <div>
                                  <dt className="inline">MOQ: </dt>
                                  <dd className="inline font-semibold text-foreground">
                                    {q.moq.toLocaleString('en-IN')} {q.moq_unit}
                                  </dd>
                                </div>
                              ) : null}
                              {q.delivery_days ? (
                                <div>
                                  <dt className="inline">Delivery: </dt>
                                  <dd className="inline font-semibold text-foreground">{q.delivery_days} days</dd>
                                </div>
                              ) : null}
                              {q.payment_terms && (
                                <div>
                                  <dt className="inline">Payment: </dt>
                                  <dd className="inline font-semibold text-foreground">{q.payment_terms}</dd>
                                </div>
                              )}
                              {q.total_price ? (
                                <div>
                                  <dt className="inline">Total: </dt>
                                  <dd className="inline font-semibold text-foreground">
                                    {formatPriceRange(q.total_price, null, q.currency, q.currency || 'INR', undefined, { openEnded: false })}
                                  </dd>
                                </div>
                              ) : null}
                              <div>Received {dateLabel(q.created_at)}</div>
                            </dl>
                            {q.notes && <p className="text-sm text-foreground/80 mt-2 whitespace-pre-line">{q.notes}</p>}
                            <div className="flex flex-wrap gap-2 mt-3">
                              <button
                                type="button"
                                onClick={() => handleMessageSupplier(q)}
                                disabled={busy === `msg-${q.id}`}
                                className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border border-border hover:border-primary/50 hover:text-primary"
                              >
                                {busy === `msg-${q.id}` ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <MessageSquare className="w-4 h-4" aria-hidden="true" />}
                                Message Supplier
                              </button>
                              <Link to={`/dashboard/buyer/quotes?req=${req.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl text-primary hover:underline">
                                Accept or decline in your dashboard <ArrowRight className="w-4 h-4" aria-hidden="true" />
                              </Link>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )
                ) : myQuotes.length > 0 ? (
                  <div className="space-y-2">
                    {myQuotes.map((q) => (
                      <div key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-orange-700 dark:text-orange-400">
                          <CheckCircle className="w-4 h-4" aria-hidden="true" /> Your quotation, {dateLabel(q.created_at)}
                        </span>
                        <span className="text-sm font-bold text-foreground">
                          {formatPriceRange(q.unit_price, null, q.currency, q.currency || 'INR', undefined, { openEnded: false })} / {q.moq_unit || req.quantity_unit}
                        </span>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      {quoteCount === 1 ? 'Yours is the only quotation so far.' : `${quoteCount} suppliers have quoted so far.`} Other suppliers&apos; prices are shown only to the buyer.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {quoteCount === 0 ? 'No supplier has quoted yet.' : `${quoteCount} ${quoteCount === 1 ? 'supplier has' : 'suppliers have'} quoted.`} Quotations are shown only to the
                    buyer.
                  </p>
                )}
              </Card>

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
            </div>

            {/* ── right column ── */}
            <div className="space-y-4 md:space-y-5">
              <Card title="Buyer" icon={User}>
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-xl bg-primary/10 text-primary font-extrabold flex items-center justify-center shrink-0">{initials(buyerName)}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate flex items-center gap-1.5">
                      {buyerName}
                      {req.is_verified_buyer && <BadgeCheck className="w-4 h-4 text-primary shrink-0" aria-label="Verified buyer" />}
                    </p>
                    {buyer?.company_name && buyer?.full_name && <p className="text-xs text-muted-foreground truncate">{buyer.full_name}</p>}
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-2 mt-3 text-xs">
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
                {!isPoster && (
                  <div className="mt-3 space-y-2">
                    <ProtectedContact phone={buyer?.phone} country={req.destination_country} contactType="buyer" variant="card" allowPaidSupplierUnlock seed={req.id} />
                    {(isSupplier || company) && (
                      <button
                        type="button"
                        onClick={handleMessageBuyer}
                        disabled={busy === 'message'}
                        className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-3 py-2.5 rounded-xl border border-border hover:border-primary/50 hover:text-primary"
                      >
                        {busy === 'message' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <MessageSquare className="w-4 h-4" aria-hidden="true" />}
                        Message {buyer?.full_name?.split(' ')[0] || 'the buyer'}
                      </button>
                    )}
                  </div>
                )}
              </Card>

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
            </div>
          </div>
        </div>

        {/* actions within reach on a phone */}
        {!isPoster && user && (isSupplier || company) && (
          <div className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur px-3 py-3">{supplierActions}</div>
        )}
      </div>

      <SubmitQuotationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        rfq={{
          id: req.id,
          reqNumber: rfqCode,
          title: req.title,
          quantity: req.quantity,
          quantityUnit: req.quantity_unit,
          targetPriceMin: req.budget_min ?? null,
          targetPriceMax: req.budget_max ?? null,
          deliveryLocation: place || undefined,
          deadline: req.deadline ?? null,
          image: req.attachment_url ?? null,
        }}
        onSuccess={loadData}
      />

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

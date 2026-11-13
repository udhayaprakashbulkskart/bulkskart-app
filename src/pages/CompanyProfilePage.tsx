import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCompanyBySlug, getProducts, getCompanyCertifications, getCompanyReviews } from '@/lib/api';
import { supabase } from '@/db/supabase';
import { copyText, supplierPublicUrl, telLink, waLink } from '@/lib/supplierPublicProfile';
import type { Company, Product, CompanyCertification, CompanyReview } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import SafeImage from '@/components/common/SafeImage';
import { resolveCompanyBranding } from '@/lib/contentImages';
import {
  ShieldCheck, MapPin, ArrowLeft, Globe, Calendar, Users,
  Star, Package, Award, CheckCircle, MessageSquare, FileText,
  Building2, Mail, Phone, Flag, Copy, Check, Camera, Sparkles,
} from 'lucide-react';
import PageMeta from '@/components/common/PageMeta';
import SupplierDirectChatModal from '@/components/common/SupplierDirectChatModal';
import Breadcrumbs from '@/components/common/Breadcrumbs';
import CompanyReviewsAndRatingSection from '@/components/common/CompanyReviewsAndRatingSection';
import ReportItemModal from '@/components/common/ReportItemModal';

const FALLBACK_BANNER = 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1920&q=80';

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1,2,3,4,5].map(i => (
          <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`} />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">({count} {count === 1 ? 'review' : 'reviews'})</span>
    </div>
  );
}

function CertBadge({ cert }: { cert: CompanyCertification }) {
  const labels: Record<string, string> = { gst: 'GST Verified', iec: 'IEC Verified', company_reg: 'Reg. Verified', iso: 'ISO', other: '' };
  const label = cert.cert_type === 'iso' || cert.cert_type === 'other' ? cert.cert_name : labels[cert.cert_type];
  if (!label) return null;
  return (
    <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/25 rounded-lg px-3 py-1.5">
      <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
      <div>
        <p className="text-xs font-medium text-green-400">{label}</p>
        {cert.cert_number && <p className="text-xs text-muted-foreground">{cert.cert_number}</p>}
      </div>
    </div>
  );
}

export default function CompanyProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [certs, setCerts] = useState<CompanyCertification[]>([]);
  const [reviews, setReviews] = useState<CompanyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [directChatProduct, setDirectChatProduct] = useState<Product | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const publicLinkRef = useRef<HTMLInputElement>(null);
  const [owner, setOwner] = useState<{
    full_name: string | null;
    phone: string | null;
    email: string | null;
    whatsapp_number: string | null;
    avatar_url: string | null;
  } | null>(null);

  useEffect(() => {
    if (!slug) return;
    getCompanyBySlug(slug).then(async co => {
      setCompany(co);
      if (co) {
        const [prods, certsData, reviewsData] = await Promise.all([
          getProducts({ companyId: co.id }),
          getCompanyCertifications(co.id),
          getCompanyReviews(co.id),
        ]);
        setProducts(prods);
        setCerts(certsData.filter(c => c.is_verified));
        setReviews(reviewsData);
        if (co.owner_id) {
          const { data: ownerRow } = await supabase
            .from('profiles')
            .select('full_name, phone, email, whatsapp_number, avatar_url')
            .eq('id', co.owner_id)
            .maybeSingle();
          setOwner(ownerRow);
        }
      }
      setLoading(false);
    });
  }, [slug]);

  if (loading) return (
    <MainLayout>
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-12">
        <div className="bg-muted rounded-xl h-56 animate-pulse mb-6" />
        <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}</div>
      </div>
    </MainLayout>
  );

  if (!company) return (
    <MainLayout>
      <PageMeta
        title="Manufacturer Not Found | BulkSkart"
        description="The requested verified company profile does not exist or may have been unlisted."
        robots="noindex, nofollow"
      />
      <div className="max-w-md mx-auto text-center py-24 px-4 space-y-4">
        <Building2 className="w-12 h-12 text-[#FF5A00] mx-auto opacity-80" />
        <h2 className="text-xl font-bold text-foreground">Manufacturer Not Found</h2>
        <p className="text-sm text-muted-foreground">The requested company profile does not exist or may have been unlisted.</p>
        <Link to="/manufacturers">
          <Button className="bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold h-10 px-5 rounded-xl">
            Browse Verified Manufacturers
          </Button>
        </Link>
      </div>
    </MainLayout>
  );

  const yearsInBusiness = company.year_established
    ? new Date().getFullYear() - company.year_established
    : company.years_in_business;

  const companyRecord = company as Company & { whatsapp_number?: string | null };
  const phone = owner?.phone?.trim() || '';
  const whatsapp = companyRecord.whatsapp_number?.trim() || owner?.whatsapp_number?.trim() || phone;
  const email = owner?.email?.trim() || '';
  const logoSrc = company.logo_url || owner?.avatar_url || resolveCompanyBranding({ company_name: company.company_name, industry: company.business_type || undefined }).logo;

  const publicUrl = supplierPublicUrl(company.slug);
  const copyProfileLink = async () => {
    publicLinkRef.current?.focus();
    publicLinkRef.current?.select();
    const ok = await copyText(publicUrl);
    if (!ok) return;
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1800);
  };

  // Comprehensive SEO Metadata & Rich JSON-LD Schemas
  const companyTitle = `${company.company_name} — Verified Global ${company.business_type || 'Manufacturer'} & Wholesale Supplier | BulkSkart`;
  const companyDescription = `${company.company_name} is a verified ${company.business_type || 'manufacturer'} located in ${company.city ? `${company.city}, ` : ''}${company.country || 'India'}${company.year_established ? `, established in ${company.year_established}` : ''}. Specializing in ${company.key_products?.length ? company.key_products.slice(0, 4).join(', ') : company.business_type || 'bulk industrial supplies'}. Verified export capabilities with ${company.rating_avg ? `${company.rating_avg}★ rating` : 'trade assurance'}. Contact for wholesale inquiries, custom OEM/ODM specifications, and direct factory pricing on BulkSkart.`;
  const companyKeywords = [
    company.company_name,
    `${company.company_name} wholesale`,
    `${company.country} manufacturer`,
    `${company.city || ''} supplier`,
    `${company.business_type || 'manufacturer'} supplier`,
    company.business_type,
    ...(company.key_products || []),
    'verified supplier',
    'bulk export',
    'factory direct B2B',
    'trade assurance',
    'ISO certified manufacturer',
  ].filter(Boolean).join(', ');

  const companyCanonical = `/companies/${company.slug}`;
  const companySocialImage = (company.banner_url || company.cover_url || company.logo_url) ?? undefined;

  const companySchemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'Corporation',
      '@id': `https://www.bulkskart.com/companies/${company.slug}#organization`,
      name: company.company_name,
      legalName: company.company_name,
      description: company.description || companyDescription,
      url: `https://www.bulkskart.com/companies/${company.slug}`,
      logo: company.logo_url || '/brand/bulkskart-logo.jpg',
      image: companySocialImage,
      foundingDate: company.year_established ? String(company.year_established) : undefined,
      address: {
        '@type': 'PostalAddress',
        addressCountry: company.country || 'India',
        addressLocality: company.city || undefined,
        streetAddress: company.address || undefined,
      },
      numberOfEmployees: company.employee_count_range ? {
        '@type': 'QuantitativeValue',
        name: company.employee_count_range,
      } : undefined,
      knowsAbout: company.key_products?.length ? company.key_products : [company.business_type || 'B2B Wholesale'],
      areaServed: company.export_destinations?.length ? company.export_destinations : ['Global'],
      ...(company.rating_avg && company.rating_avg > 0 ? {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: company.rating_avg,
          reviewCount: Math.max(company.review_count || 1, 1),
          bestRating: '5',
          worstRating: '1',
        },
      } : {}),
      ...(products.length > 0 ? {
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: `${company.company_name} Product Catalog`,
          itemListElement: products.slice(0, 10).map((prod) => ({
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Product',
              name: prod.name,
              image: prod.images?.[0],
              description: prod.description,
              url: `https://www.bulkskart.com/products/${prod.slug || prod.id}`,
            },
            price: prod.price_min || prod.price_max || '0',
            priceCurrency: prod.price_currency || 'USD',
          })),
        },
      } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      name: `${company.company_name} — Verified Global Supplier Profile`,
      url: `https://www.bulkskart.com/companies/${company.slug}`,
      mainEntity: {
        '@id': `https://www.bulkskart.com/companies/${company.slug}#organization`,
      },
    },
  ];

  return (
    <MainLayout>
      <PageMeta
        title={companyTitle}
        description={companyDescription}
        keywords={companyKeywords}
        canonical={companyCanonical}
        ogType="business.business"
        ogImage={companySocialImage}
        twitterCard="summary_large_image"
        jsonLd={companySchemas}
        breadcrumbs={[
          { name: 'Home', item: '/' },
          { name: 'Verified Manufacturers', item: '/manufacturers' },
          { name: company.company_name, item: companyCanonical },
        ]}
      />
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 pt-6 pb-24 md:pb-6">

        {/* Visual Breadcrumb Trail */}
        <Breadcrumbs
          items={[
            { name: 'Verified Manufacturers', href: '/manufacturers' },
            { name: company.company_name },
          ]}
          className="mb-4"
        />

        {/* Back */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Manufacturers
        </button>

        {/* ── Hero / Banner ── */}
        <div className="bs-glass overflow-hidden rounded-3xl mb-6">
          <div className="relative aspect-[21/9] md:h-56 max-h-56 w-full overflow-hidden bg-muted">
            <SafeImage
              src={company.cover_url || company.banner_url || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80'}
              alt={company.company_name}
              category={company.business_type}
              isRepresentativeImage={true}
              type="banner"
              className="w-full h-full object-cover"
            />
            {/* gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          </div>

          <div className="px-4 md:px-6 pb-5 pt-2">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              {/* Logo + info */}
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-card border-2 border-border/80 flex items-center justify-center overflow-hidden -mt-8 md:-mt-10 shrink-0 shadow-lg relative z-10 p-1">
                  <SafeImage
                    src={logoSrc}
                    alt={company.company_name}
                    type="company"
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
                <div className="pt-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl md:text-2xl font-bold text-foreground break-words">{company.company_name}</h1>
                    {(company.is_verified || company.verification_status === 'verified') && (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs gap-1">
                        <ShieldCheck className="w-3 h-3" /> Verified Business
                      </Badge>
                    )}
                    {company.business_type && (
                      <Badge variant="outline" className="text-xs border-border text-muted-foreground">{company.business_type}</Badge>
                    )}
                  </div>
                  {owner?.full_name && <p className="text-xs text-muted-foreground mt-0.5">{owner.full_name}</p>}
                  {company.tagline && <p className="text-sm text-muted-foreground mt-0.5 italic line-clamp-2">{company.tagline}</p>}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
                    {company.city && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{company.city}, {company.country}</span>
                    )}
                    {yearsInBusiness && (
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{yearsInBusiness} yrs in business</span>
                    )}
                    {(company.employee_count_range ?? company.employee_count) && (
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{company.employee_count_range ?? company.employee_count} employees</span>
                    )}
                  </div>
                  {company.rating_avg > 0 && (
                    <div className="mt-1.5">
                      <StarRating rating={company.rating_avg} count={company.review_count} />
                    </div>
                  )}
                </div>
              </div>

              {/* CTAs */}
              <div className="flex gap-2 shrink-0 flex-wrap items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReportModal(true)}
                  className="border-red-500/40 text-red-500 hover:bg-red-500/10 gap-1.5 h-9"
                  title="Report this Supplier"
                >
                  <Flag className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Report</span>
                </Button>
                {company.website && (
                  <a href={company.website} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" className="border border-border text-muted-foreground hover:text-foreground gap-1 h-9">
                      <Globe className="w-3.5 h-3.5" /><span className="sr-only md:not-sr-only">Website</span>
                    </Button>
                  </a>
                )}
                <button
                  type="button"
                  onClick={copyProfileLink}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#FF5A00]/40 bg-[#FF5A00]/10 px-3 text-xs font-bold text-[#FF5A00]"
                >
                  {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {linkCopied ? 'Link copied' : 'Copy link'}
                </button>
                <Button
                  size="sm"
                  onClick={() => {
                    setDirectChatProduct(null);
                    setChatOpen(true);
                  }}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 h-9 font-bold shadow-sm"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Chat with Supplier
                </Button>
                <Link to={`/post-requirement?supplier=${company.id}`}>
                  <Button variant="secondary" size="sm" className="border-border text-foreground hover:bg-muted h-9 font-semibold">
                    Request Quote
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
          <p className="shrink-0 text-xs font-bold text-foreground">Public profile</p>
          <input
            ref={publicLinkRef}
            readOnly
            value={publicUrl}
            aria-label="Public profile link"
            onFocus={event => event.currentTarget.select()}
            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
          />
          <button
            type="button"
            onClick={copyProfileLink}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#FF5A00] px-3 text-xs font-bold text-white"
          >
            {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {linkCopied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {/* ── Quick Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Products Listed', value: company.total_products, icon: Package },
            { label: 'Quotes Sent', value: company.total_quotes_sent, icon: FileText },
            { label: 'Export Countries', value: company.export_destinations?.length ?? 0, icon: Globe },
            { label: 'Member Since', value: new Date(company.created_at).getFullYear(), icon: Calendar },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-card border border-border rounded-xl p-3 md:p-4 text-center">
                <Icon className="w-4 h-4 text-primary mx-auto mb-1.5" />
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* ── Verification Badges ── */}
        {certs.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-3 md:p-4 mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" /> Verifications & Certifications
            </h3>
            <div className="flex flex-wrap gap-2">
              {certs.map(c => <CertBadge key={c.id} cert={c} />)}
            </div>
          </div>
        )}

        {/* ── Main Content Tabs ── */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Tabs defaultValue="products">
              <TabsList className="bg-muted border border-border mb-4 h-9">
                <TabsTrigger value="products" className="text-xs data-[state=active]:bg-background">
                  Products ({products.length})
                </TabsTrigger>
                <TabsTrigger value="gallery" className="text-xs data-[state=active]:bg-background">
                  Factory Gallery ({Array.isArray((company as any).gallery_images) ? (company as any).gallery_images.length : (company.cover_url ? 1 : 0)})
                </TabsTrigger>
                <TabsTrigger value="capabilities" className="text-xs data-[state=active]:bg-background">
                  Trade Capabilities
                </TabsTrigger>
                <TabsTrigger value="reviews" className="text-xs data-[state=active]:bg-background">
                  Reviews ({reviews.length})
                </TabsTrigger>
              </TabsList>

              {/* Factory & Facility Gallery Tab */}
              <TabsContent value="gallery">
                {(!(company as any).gallery_images || (company as any).gallery_images.length === 0) && !company.cover_url ? (
                  <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
                    <Camera className="w-8 h-8 mx-auto mb-2 opacity-40 text-primary" />
                    Facility photos are being auto-synced. Check back in a moment!
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 border-b border-border">
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        Verified Facility & Production Showcase
                      </span>
                      <span className="text-[11px] text-emerald-400 font-mono">
                        Auto-refreshed via 1-Min Image Engine
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {Array.from(new Set([
                        ...(Array.isArray((company as any).gallery_images) ? (company as any).gallery_images : []),
                        company.cover_url,
                        company.banner_url
                      ].filter(Boolean))).map((imgUrl, i) => (
                        <div key={i} className="aspect-[4/3] rounded-xl overflow-hidden border border-border bg-muted relative group">
                          <SafeImage
                            src={imgUrl as string}
                            alt={`${company.company_name} factory facility ${i + 1}`}
                            category={company.business_type}
                            type="company"
                            isRepresentativeImage={true}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Products tab */}
              <TabsContent value="products">
                {products.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No products listed yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {products.map(p => (
                      <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden card-hover flex flex-col h-full">
                        <Link to={`/products/${p.slug}`} className="aspect-square overflow-hidden bg-muted relative block">
                          <SafeImage
                            src={p.images?.[0]}
                            alt={p.name}
                            productId={p.id}
                            category={(p as any).category?.name || (company as any).business_type}
                            type="product"
                            isRepresentativeImage={true}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                          />
                        </Link>
                        <div className="p-3 flex-1 flex flex-col justify-between">
                          <div>
                            <Link to={`/products/${p.slug}`} className="text-sm font-medium text-foreground hover:text-primary line-clamp-1">
                              {p.name}
                            </Link>
                            <p className="text-xs text-muted-foreground mt-0.5">MOQ: {p.moq.toLocaleString()} {p.moq_unit}</p>
                            {p.price_min && (
                              <p className="text-xs text-primary font-semibold mt-1">
                                {p.price_currency} {p.price_min.toLocaleString()}{p.price_max ? ` – ${p.price_max.toLocaleString()}` : '+'}
                              </p>
                            )}
                          </div>
                          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setDirectChatProduct(p);
                                setChatOpen(true);
                              }}
                              className="w-full border-primary/30 text-primary hover:bg-primary/10 h-7 text-xs font-semibold gap-1"
                            >
                              <MessageSquare className="w-3 h-3" /> Chat about this item
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Capabilities tab */}
              <TabsContent value="capabilities">
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                  {company.key_products?.length ? (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Key Products</p>
                      <div className="flex flex-wrap gap-2">
                        {company.key_products.map(k => (
                          <Badge key={k} variant="outline" className="text-xs border-primary/30 text-primary">{k}</Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {company.production_capacity && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Production Capacity</p>
                      <p className="text-sm text-foreground">{company.production_capacity}</p>
                    </div>
                  )}
                  {company.moq_policy && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">MOQ Policy</p>
                      <p className="text-sm text-foreground">{company.moq_policy}</p>
                    </div>
                  )}
                  {company.payment_terms?.length ? (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Payment Terms</p>
                      <div className="flex flex-wrap gap-2">
                        {company.payment_terms.map(t => (
                          <Badge key={t} variant="outline" className="text-xs border-border text-muted-foreground">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {company.packaging_details && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Packaging & Shipping</p>
                      <p className="text-sm text-foreground text-pretty">{company.packaging_details}</p>
                    </div>
                  )}
                  {!company.production_capacity && !company.moq_policy && !company.payment_terms?.length && (
                    <p className="text-sm text-muted-foreground text-center py-4">No trade capability details added yet.</p>
                  )}
                </div>
              </TabsContent>

              {/* Reviews tab — authenticated only review submission & company rating */}
              <TabsContent value="reviews">
                <CompanyReviewsAndRatingSection
                  companyId={company.id}
                  companyName={company.company_name}
                  reviews={reviews}
                  onReviewAdded={(newRev) => setReviews((prev) => [newRev, ...prev])}
                  avgRating={company.rating_avg || 4.9}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* ── Right Sidebar ── */}
          <div className="space-y-4">
            {/* About */}
            {company.description && (
              <div className="bg-card border border-border rounded-xl p-3 md:p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">About</h3>
                <p className="text-xs text-muted-foreground text-pretty leading-relaxed">{company.description}</p>
              </div>
            )}

            {/* Business details */}
            <div className="bg-card border border-border rounded-xl p-3 md:p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-primary" /> Business Details
              </h3>
              <div className="space-y-2 text-xs">
                {company.business_type && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Business Type</span>
                    <span className="text-foreground font-medium">{company.business_type}</span>
                  </div>
                )}
                {company.gst_number && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GST</span>
                    <span className="text-foreground font-medium font-mono">{company.gst_number}</span>
                  </div>
                )}
                {company.iec_number && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IEC</span>
                    <span className="text-foreground font-medium font-mono">{company.iec_number}</span>
                  </div>
                )}
                {(company.annual_turnover_range ?? company.annual_turnover) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Turnover</span>
                    <span className="text-foreground font-medium">{company.annual_turnover_range ?? company.annual_turnover}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Contact */}
            <div className="bg-card border border-border rounded-xl p-3 md:p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Contact</h3>
              <div className="space-y-2">
                {phone ? (
                  <a href={telLink(phone)} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-foreground">
                    <Phone className="w-4 h-4 text-[#FF5A00] shrink-0" />
                    <span className="truncate">{phone}</span>
                  </a>
                ) : null}
                {whatsapp ? (
                  <a href={waLink(whatsapp)} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <span className="truncate">WhatsApp {whatsapp}</span>
                  </a>
                ) : null}
                {email ? (
                  <a href={`mailto:${email}`} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-foreground">
                    <Mail className="w-4 h-4 text-[#FF5A00] shrink-0" />
                    <span className="truncate">{email}</span>
                  </a>
                ) : null}
                {(company.address || company.city) && (
                  <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{[company.address, company.city, company.state, company.country, company.pincode].filter(Boolean).join(', ')}</span>
                  </p>
                )}
                {!phone && !whatsapp && !email && (
                  <p className="text-xs text-muted-foreground">This supplier has not added a public phone or email yet.</p>
                )}
              </div>

              {/* Fast Direct Chat CTA */}
              <div className="mt-4 space-y-2">
                <Button
                  onClick={() => {
                    setDirectChatProduct(null);
                    setChatOpen(true);
                  }}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 font-bold text-xs gap-1.5 shadow-sm"
                >
                  <MessageSquare className="w-4 h-4" /> Chat with Supplier
                </Button>
                <Link to={`/post-requirement?supplier=${company.id}`}>
                  <Button variant="secondary" size="sm" className="w-full border-border text-foreground hover:bg-muted h-9 text-xs">
                    Request Quote / RFQ
                  </Button>
                </Link>
              </div>

              {!user && (
                <div className="mt-3 rounded-lg bg-muted/50 border border-border/80 p-2.5 text-center">
                  <p className="text-[11px] text-muted-foreground">
                    Anyone can send inquiries directly. <Link to={`/auth?redirect=/companies/${company.slug}`} className="text-primary hover:underline font-medium">Sign in</Link> to sync all chats.
                  </p>
                </div>
              )}
            </div>

            {/* Export destinations */}
            {company.export_destinations?.length ? (
              <div className="bg-card border border-border rounded-xl p-3 md:p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-primary" /> Export Destinations
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {company.export_destinations.map(d => (
                    <span key={d} className="text-xs bg-muted border border-border px-2 py-0.5 rounded-full text-muted-foreground">{d}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Mobile sticky CTA for all users ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground truncate">{company.company_name}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Online • Ready for quotes
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setDirectChatProduct(null);
            setChatOpen(true);
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 font-bold gap-1.5 text-xs shadow-md shrink-0"
        >
          <MessageSquare className="w-3.5 h-3.5" /> Chat
        </Button>
      </div>

      {/* Bottom padding so sticky bar doesn't overlap content on mobile */}
      <div className="md:hidden h-16" />

      {/* Direct Chat with Supplier Modal (open to anyone) */}
      <SupplierDirectChatModal
        open={chatOpen}
        onOpenChange={setChatOpen}
        company={company}
        selectedProduct={directChatProduct}
      />
      <ReportItemModal
        open={showReportModal}
        onOpenChange={setShowReportModal}
        targetType="company"
        targetId={company.id}
        targetTitle={company.company_name}
      />
    </MainLayout>
  );
}

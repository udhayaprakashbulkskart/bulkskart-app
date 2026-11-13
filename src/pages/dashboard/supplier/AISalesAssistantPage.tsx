import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PageMeta from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getProducts, getRequirements, getMyQuotations } from '@/lib/api';
import type { Product, Requirement, Quotation } from '@/types/types';
import {
  analyzeAndMatchOpportunities,
  generateAIOpportunitySummary,
  generateAISalesInsights,
  generateAIQuotationDraft,
  formatPotentialBusinessINR,
  type MatchedOpportunity,
  type MatchedProduct,
  type SalesRecommendation,
  type OpportunityPriority,
  type AIQuotationDraft,
} from '@/lib/aiSalesAssistant';
import AIOpportunityCard from '@/components/common/AIOpportunityCard';
import AIQuotationModal from '@/components/common/AIQuotationModal';
import {
  Sparkles,
  Zap,
  Flame,
  TrendingUp,
  Shield,
  Percent,
  CheckCircle2,
  Clock,
  ArrowRight,
  Package,
  MapPin,
  Building2,
  Filter,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AISalesAssistantPage() {
  const { user, company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [opportunities, setOpportunities] = useState<MatchedOpportunity[]>([]);
  const [selectedPriority, setSelectedPriority] = useState<'all' | OpportunityPriority>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // AI Quotation Modal state
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [activeReq, setActiveReq] = useState<Requirement | null>(null);
  const [activeProduct, setActiveProduct] = useState<MatchedProduct | null>(null);
  const [activeDraft, setActiveDraft] = useState<AIQuotationDraft | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // Only load the logged-in supplier's own company products
      const prods = company?.id ? await getProducts({ companyId: company.id }) : [];
      const [reqs, quotes] = await Promise.all([
        getRequirements({ status: 'active' }),
        user?.id ? getMyQuotations(user.id) : Promise.resolve([]),
      ]);

      setProducts(prods);
      setRequirements(reqs);
      setQuotations(quotes);

      // Analyze real matches between supplier's real catalogue and active RFQs
      const matched = analyzeAndMatchOpportunities(prods, reqs);
      setOpportunities(matched);
    } catch (err) {
      console.error('Failed to load AI Sales data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, company]);

  const summary = generateAIOpportunitySummary(opportunities);
  const insights = generateAISalesInsights(products, requirements, quotations, opportunities);

  const filteredOpportunities = opportunities.filter(opp => {
    if (selectedPriority !== 'all' && opp.priority !== selectedPriority) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = opp.requirement.title.toLowerCase().includes(q);
      const matchBuyer = opp.buyerName.toLowerCase().includes(q);
      const matchLoc = opp.buyerLocation.toLowerCase().includes(q);
      return matchTitle || matchBuyer || matchLoc;
    }
    return true;
  });

  const handleOpenAIQuote = (opp: MatchedOpportunity, prod?: MatchedProduct) => {
    const selectedProd = prod || opp.matchingProducts[0] || null;
    const draft = generateAIQuotationDraft(opp.requirement, selectedProd);
    setActiveReq(opp.requirement);
    setActiveProduct(selectedProd);
    setActiveDraft(draft);
    setQuoteModalOpen(true);
  };

  const getUrgencyBadge = (urgency: string) => {
    if (urgency === 'high') {
      return (
        <span className="text-[10px] font-bold text-[#FF7A2E] bg-[#FF5A00]/10 border border-[#FF5A00]/20 px-2 py-0.5 rounded-full flex items-center gap-1">
          <Flame className="w-3 h-3 text-[#FF7A2E]" /> High Urgency
        </span>
      );
    }
    if (urgency === 'medium') {
      return (
        <span className="text-[10px] font-bold text-[#FF7A2E] bg-[#FF5A00]/10 border border-[#FF5A00]/20 px-2 py-0.5 rounded-full flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-[#FF7A2E]" /> Recommended
        </span>
      );
    }
    return (
      <span className="text-[10px] font-medium text-[#FF7A2E] bg-[#FF5A00]/10 border border-[#FF5A00]/20 px-2 py-0.5 rounded-full flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3 text-[#FF7A2E]" /> Best Practice
      </span>
    );
  };

  const getPriorityBadge = (priority: OpportunityPriority) => {
    if (priority === 'high') {
      return (
        <Badge className="bg-[#FF5A00]/15 text-[#FF7A2E] border-[#FF5A00]/30 text-xs font-bold gap-1">
          <Zap className="w-3 h-3 fill-[#FF5A00] text-[#FF7A2E]" /> High Priority
        </Badge>
      );
    }
    if (priority === 'medium') {
      return (
        <Badge className="bg-[#FF5A00]/15 text-[#FF7A2E] border-[#FF5A00]/30 text-xs font-bold gap-1">
          <TrendingUp className="w-3 h-3 text-[#FF7A2E]" /> Medium Priority
        </Badge>
      );
    }
    return (
      <Badge className="bg-[#0A0A0A]/50 text-slate-300 border-white/10 text-xs font-medium">
        Standard Fit
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <PageMeta
        title="AI Sales Assistant | BulkSkart Manufacturer System"
        description="AI-driven catalog matching, automated RFQ quotation drafts, sales prioritization, and high-potential buyer matching."
      />

      <div className="space-y-6 pb-12 max-w-7xl mx-auto">
        {/* Page Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#FF5A00]/15 text-[#FF5A00]">
                <Sparkles className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white">AI Sales Assistant</h1>
            </div>
            <p className="text-xs sm:text-sm text-white/60 mt-1">
              Autonomous catalog analyzer, real-time RFQ matching engine, and intelligent quotation drafting system.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="border-white/15 hover:bg-white/10 text-xs h-9 rounded-xl gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Matches</span>
            </Button>
            <Link to="/dashboard/supplier/products">
              <Button
                size="sm"
                className="bg-[#C94400] hover:bg-[#B33D00] text-white font-bold text-xs h-9 rounded-xl shadow-md gap-1.5"
              >
                <Package className="w-3.5 h-3.5" />
                <span>Manage Catalogue</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* 1. AI OPPORTUNITY CARD (Prompt Requirement) */}
        <AIOpportunityCard summary={summary} />

        {/* 2. AI SALES INSIGHTS (Prompt Requirement: Daily & Weekly recommendations) */}
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#FF5A00]/15 text-[#FF7A2E]">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">AI Sales Recommendations & Insights</h3>
                <p className="text-[11px] text-white/50">Weekly demand analysis and conversion optimizations for your factory</p>
              </div>
            </div>
            <span className="text-[11px] text-[#FF5A00] font-semibold bg-[#FF5A00]/10 px-2.5 py-1 rounded-full border border-[#FF5A00]/20 hidden sm:inline-block">
              Updated Live
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {insights.map(item => (
              <div
                key={item.id}
                className="bg-card hover:bg-muted/40 border border-border rounded-xl p-3.5 flex flex-col justify-between transition-colors group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground group-hover:text-[#FF5A00] transition-colors">
                      {item.title}
                    </span>
                    {getUrgencyBadge(item.urgency)}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.message}</p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between">
                  <Link
                    to={item.ctaLink}
                    className="text-[11px] font-bold text-[#FF5A00] hover:text-[#ff782e] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                  >
                    <span>{item.ctaLabel}</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. MATCHED REQUIREMENTS FEED (Prompt Requirement) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
                <span>Matched Buyer Requirements</span>
                <span className="px-2 py-0.5 rounded-full bg-[#FF5A00]/20 text-[#FF5A00] text-xs font-mono font-bold">
                  {filteredOpportunities.length}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Sorted by AI Match Score and buyer procurement value
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: `All (${opportunities.length})` },
                { id: 'high', label: `High Priority (${summary.highPriorityCount})` },
                { id: 'medium', label: `Medium (${summary.mediumPriorityCount})` },
                { id: 'low', label: `Standard (${summary.lowPriorityCount})` },
              ].map(tab => {
                const active = selectedPriority === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedPriority(tab.id as any)}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      active
                        ? 'bg-[#C94400] text-white shadow-md'
                        : 'bg-card text-foreground/80 hover:text-foreground border border-border'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* List of matched cards */}
          {filteredOpportunities.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-3">
              <Package className="w-10 h-10 text-white/30 mx-auto" />
              <h4 className="text-sm font-bold text-white">No opportunities found in this filter</h4>
              <p className="text-xs text-white/50 max-w-md mx-auto">
                Try switching the priority tab or add more products with detailed specifications to increase match triggers.
              </p>
              <Button
                size="sm"
                onClick={() => setSelectedPriority('all')}
                className="bg-[#1A0C05] text-white text-xs rounded-xl"
              >
                Reset Priority Filter
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOpportunities.map(opp => {
                const topProd = opp.matchingProducts[0];
                return (
                  <div
                    key={opp.id}
                    className="bg-card hover:border-[#FF5A00]/40 border border-border rounded-2xl p-4 sm:p-5 shadow-xl transition-all space-y-4"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getPriorityBadge(opp.priority)}
                          <span className="text-xs font-mono font-bold text-[#FF7A2E] bg-[#FF5A00]/10 border border-[#FF5A00]/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-[#FF7A2E]" />
                            {opp.topMatchScore}% Match
                          </span>
                          <span className="text-[11px] text-white/50 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-white/40" />
                            {opp.buyerLocation}
                          </span>
                        </div>

                        <Link
                          to={`/requirement/${opp.requirement.id}`}
                          className="text-base sm:text-lg font-bold text-white hover:text-[#FF5A00] transition-colors block"
                        >
                          {opp.requirement.title}
                        </Link>

                        <div className="flex items-center gap-3 text-xs text-white/60 flex-wrap">
                          <span>
                            Buyer: <strong className="text-white">{opp.buyerName}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Volume:{' '}
                            <strong className="text-white">
                              {(Number(opp.requirement.quantity) || 1000).toLocaleString()}{' '}
                              {opp.requirement.quantity_unit || 'Units'}
                            </strong>
                          </span>
                          <span>•</span>
                          <span>
                            Expected Price: <strong className="text-[#FF5A00]">{opp.expectedPrice}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Est. Business:{' '}
                            <strong className="text-[#FF7A2E]">
                              {formatPotentialBusinessINR(opp.estimatedBusinessValueINR)}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Primary Actions */}
                      <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                        <Button
                          onClick={() => handleOpenAIQuote(opp)}
                          className="w-full sm:w-auto bg-[#C94400] hover:bg-[#B33D00] text-white font-extrabold text-xs h-9 px-4 rounded-xl shadow-[0_2px_10px_rgba(255,90,0,0.35)] gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>AI Quote Draft</span>
                        </Button>
                        <Link to={`/requirement/${opp.requirement.id}`} className="w-full sm:w-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-white/15 hover:bg-white/10 text-xs h-9 px-3 rounded-xl gap-1"
                          >
                            <span>View Requirement</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* AI Product Match Drawer (Prompt Requirement: "AI found these products from your catalogue") */}
                    <div className="bg-muted/40 border border-border rounded-xl p-3 sm:p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <Sparkles className="w-3.5 h-3.5 text-[#FF5A00]" />
                          <span>AI found these products from your catalogue:</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          Suggested Pricing: ₹{opp.suggestedPricing.recommended.toLocaleString('en-IN')} / unit
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {opp.matchingProducts.map((p, idx) => (
                          <div
                            key={p.id || idx}
                            className="bg-card border border-border hover:border-[#FF5A00]/40 rounded-xl p-2.5 flex flex-col justify-between space-y-2"
                          >
                            <div className="flex items-start gap-2">
                              {p.image && (
                                <img
                                  src={p.image}
                                  alt={p.name}
                                  className="w-10 h-10 rounded-lg object-cover bg-muted border border-border shrink-0"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-xs font-bold text-foreground truncate block">
                                    {p.name}
                                  </span>
                                  <span className="text-[10px] font-mono font-bold text-[#FF7A2E] bg-[#FF5A00]/10 px-1.5 py-0.2 rounded shrink-0">
                                    {p.matchScore}%
                                  </span>
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  ₹{p.priceINR.toLocaleString('en-IN')} / {p.moqUnit} • MOQ: {p.moq}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] text-white/40">
                              <span>Delivery: {p.estimatedDeliveryDays} days</span>
                              <button
                                onClick={() => handleOpenAIQuote(opp, p)}
                                className="font-bold text-[#FF5A00] hover:text-[#ff7a2e] transition-colors"
                              >
                                Use for Quote →
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* AI Quotation Generator Modal */}
      <AIQuotationModal
        open={quoteModalOpen}
        onOpenChange={setQuoteModalOpen}
        requirement={activeReq}
        product={activeProduct}
        initialDraft={activeDraft}
        onSuccess={() => {
          loadData();
        }}
      />
    </DashboardLayout>
  );
}

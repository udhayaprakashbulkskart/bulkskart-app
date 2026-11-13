import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, Zap, Target, TrendingUp, Package, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AIOpportunitySummary } from '@/lib/aiSalesAssistant';

interface AIOpportunityCardProps {
  summary?: AIOpportunitySummary;
  className?: string;
  onViewAll?: () => void;
  hasProducts?: boolean;
}

export default function AIOpportunityCard({
  summary = {
    totalOpportunities: 0,
    highPriorityCount: 0,
    mediumPriorityCount: 0,
    lowPriorityCount: 0,
    averageMatchScore: 0,
    potentialBusinessINR: 0,
    potentialBusinessINRFormatted: '₹0',
  },
  className = '',
  onViewAll,
  hasProducts = true,
}: AIOpportunityCardProps) {
  const hasOpportunities = summary.totalOpportunities > 0;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#2A1205] via-[#C94400] to-[#B33D00] border border-[#FF5A00]/30 p-4 sm:p-5 md:p-6 shadow-[0_8px_30px_rgba(255,90,0,0.12)] ${className}`}
    >
      {/* Ambient background glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#FF5A00]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[#B33D00]/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left header */}
        <div className="space-y-1.5 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FF5A00]/15 border border-[#FF5A00]/30 text-[#FF5A00] text-[11px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Sales Assistant</span>
          </div>

          <h3 className="text-lg sm:text-xl md:text-2xl font-black text-white tracking-tight">
            {hasOpportunities ? (
              <>
                AI found{' '}
                <span className="text-[#FF5A00]">
                  {summary.totalOpportunities} new {summary.totalOpportunities === 1 ? 'opportunity' : 'opportunities'}
                </span>{' '}
                for your products.
              </>
            ) : (
              <>No matching RFQ opportunities found currently</>
            )}
          </h3>

          <p className="text-xs sm:text-sm text-white/70">
            {hasOpportunities
              ? 'Real-time catalog matching with active buyer RFQs, tailored unit pricing, and instant quotation drafts.'
              : hasProducts
                ? 'Your catalogue is active. As soon as buyers post matching RFQs in your category, AI will alert you here.'
                : 'Add your products to your catalogue with categories, specifications, and MOQs to start receiving AI-matched leads.'}
          </p>
        </div>

        {/* Right CTA */}
        <div className="shrink-0 flex items-center gap-2">
          {hasOpportunities ? (
            <Link to="/dashboard/supplier/ai-assistant">
              <Button
                onClick={onViewAll}
                className="w-full sm:w-auto bg-[#C94400] hover:bg-[#B33D00] text-white font-extrabold text-xs sm:text-sm h-11 px-5 rounded-xl shadow-[0_4px_16px_rgba(255,90,0,0.4)] flex items-center justify-center gap-2 group transition-all"
              >
                <span>View Matched Opportunities ({summary.totalOpportunities})</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          ) : (
            <Link to="/dashboard/supplier/products">
              <Button
                className="w-full sm:w-auto bg-[#C94400] hover:bg-[#B33D00] text-white font-extrabold text-xs sm:text-sm h-11 px-5 rounded-xl shadow-[0_4px_16px_rgba(255,90,0,0.4)] flex items-center justify-center gap-2 group transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{hasProducts ? 'Add More Products' : 'Add First Product'}</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Metrics 4-Column Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 mt-4 pt-4 border-t border-border">
        {/* Metric 1 */}
        <div className="bg-card/90 backdrop-blur-sm border border-border rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-semibold">
            <span>New Requirements</span>
            <Target className="w-3.5 h-3.5 text-[#FF5A00]" />
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-black text-foreground">
            {summary.totalOpportunities}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Matched from catalog</div>
        </div>

        {/* Metric 2 */}
        <div className="bg-card/90 backdrop-blur-sm border border-[#FF5A00]/20 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-semibold">
            <span>High Priority</span>
            <Zap className="w-3.5 h-3.5 text-[#FF7A2E]" />
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-black text-[#FF7A2E] dark:text-[#FF7A2E]">
            {summary.highPriorityCount}
          </div>
          <div className="text-[10px] text-[#FF7A2E]/70 dark:text-[#FF7A2E]/70 mt-0.5">&gt;85% compatibility</div>
        </div>

        {/* Metric 3 */}
        <div className="bg-card/90 backdrop-blur-sm border border-border rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-semibold">
            <span>Average Match</span>
            <Sparkles className="w-3.5 h-3.5 text-[#FF7A2E]" />
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-black text-[#FF7A2E] dark:text-[#FF7A2E]">
            {summary.averageMatchScore}%
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Specifications alignment</div>
        </div>

        {/* Metric 4 */}
        <div className="bg-card/90 backdrop-blur-sm border border-[#FF5A00]/25 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-semibold">
            <span>Potential Business</span>
            <TrendingUp className="w-3.5 h-3.5 text-[#FF5A00]" />
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-black text-[#FF5A00]">
            {summary.potentialBusinessINRFormatted}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Real estimated value</div>
        </div>
      </div>
    </div>
  );
}

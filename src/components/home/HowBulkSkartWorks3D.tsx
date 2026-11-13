import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, TrendingDown, ShieldCheck, Truck,
  ArrowRight, CheckCircle2, ChevronRight, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const STEPS = [
  {
    step: '01',
    title: 'Post Requirement',
    subtitle: 'Define volume, grade & budget',
    description: 'Specify required volume, measurement unit, technical specs, budget ceiling, and target delivery window in under 2 minutes.',
    icon: FileText,
    badge: 'Smart RFQ Engine',
    link: '/post-requirement',
    actionText: 'Create RFQ'
  },
  {
    step: '02',
    title: 'Receive & Compare Bids',
    subtitle: 'Suppliers compete for your order',
    description: 'Verified manufacturers submit itemized quotation proposals (unit rate, MOQ, GST, freight terms). Compare quotes side-by-side.',
    icon: TrendingDown,
    badge: 'Reverse Auction',
    link: '/auctions/reverse',
    actionText: 'View Live Bids'
  },
  {
    step: '03',
    title: 'Escrow & Verification',
    subtitle: '100% Funds & Quality Protected',
    description: 'Accept the winning offer to generate a binding Purchase Order. Payment is held securely in BulkSkart Escrow until goods arrive.',
    icon: ShieldCheck,
    badge: '100% Escrow Protected',
    link: '/how-it-works',
    actionText: 'Learn Protection'
  },
  {
    step: '04',
    title: 'Dispatch & Settlement',
    subtitle: 'Container logistics & confirmation',
    description: 'Track vessel container freight and warehouse dispatches with electronic proof of delivery (POD) prior to escrow release.',
    icon: Truck,
    badge: 'Doorstep Delivery',
    link: '/manufacturers',
    actionText: 'Find Factories'
  }
];

export default function HowBulkSkartWorks3D() {
  return (
    <section className="relative z-20 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mb-8 sm:mb-14">
      
      {/* Header matching Image 1: END-TO-END PROCUREMENT LIFECYCLE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-6">
        <div className="inline-flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#FF5A00]" />
          <span className="text-[10px] sm:text-xs font-bold text-[#FF5A00] uppercase tracking-wider">
            END-TO-END PROCUREMENT LIFECYCLE
          </span>
        </div>

        <h2 className="text-xs sm:text-sm font-extrabold text-white sm:text-right">
          How BulkSkart Streamlines Bulk Sourcing
        </h2>
      </div>

      {/* 4 Interactive Process Steps: 2-col on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.step}
              className="relative p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[#0A0A0A]/85 hover:bg-[#0A0A0A] border border-[#2A2A2A]/90 hover:border-[#FF5A00]/50 shadow-sm transition-all duration-300 flex flex-col justify-between group"
            >
              {/* Step Number Decal */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-base sm:text-lg font-black font-mono text-[#FF5A00]/80 group-hover:text-[#FF5A00] transition-colors">
                  {s.step}
                </span>

                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-orange-500/15 text-[#FF5A00] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-1">
                <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-[#FF5A00] transition-colors leading-tight">
                  {s.title}
                </h3>

                <p className="text-[10px] sm:text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                  {s.description}
                </p>
              </div>

              {/* Action Link */}
              <div className="pt-2 mt-2 border-t border-[#2A2A2A]/70">
                <Link
                  to={s.link}
                  className="text-[10.5px] sm:text-xs font-bold text-[#FF5A00] hover:text-[#e04e00] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                >
                  <span>{s.actionText}</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

            </div>
          );
        })}
      </div>

    </section>
  );
}

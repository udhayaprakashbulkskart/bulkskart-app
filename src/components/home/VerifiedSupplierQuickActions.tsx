import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Factory, Package, FileText, Zap, Globe,
  ArrowRight, Sparkles, Clock, ShieldCheck
} from 'lucide-react';

export default function VerifiedSupplierQuickActions() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handlePostRequirement = () => {
    if (!user) {
      toast.info('Please sign in to post your buying requirements', {
        description: 'Verified buyers can submit RFQs and receive direct factory quotes.'
      });
      navigate('/auth?redirect=/post-requirement&mode=buyer');
    } else {
      navigate('/post-requirement');
    }
  };

  const actions = [
    {
      id: 'mfr',
      title: 'Find a Manufacturer',
      subtitle: 'Browse 1,200+ audited global plants',
      icon: Factory,
      badge: 'Verified',
      badgeColor: 'bg-[#FF5A00]/15 text-[#FF5A00] border-[#FF5A00]/30',
      gradient: 'from-[#C94400]/20 via-[#C94400]/5 to-transparent',
      borderColor: 'hover:border-[#FF5A00]/60',
      action: () => navigate('/manufacturers'),
    },
    {
      id: 'product',
      title: 'Find a Product',
      subtitle: '50,000+ bulk catalog items & raw materials',
      icon: Package,
      badge: 'Wholesale',
      badgeColor: 'bg-[#FF5A00]/15 text-[#FF7A2E] border-[#FF5A00]/30',
      gradient: 'from-[#C94400]/20 via-[#C94400]/5 to-transparent',
      borderColor: 'hover:border-[#FF5A00]/60',
      action: () => navigate('/products'),
    },
    {
      id: 'post-rfq',
      title: 'Post Requirements',
      subtitle: 'Get genuine manufacturer CIF/FOB quotes',
      icon: FileText,
      badge: 'Buyers Only',
      badgeColor: 'bg-[#FF5A00]/15 text-[#FF7A2E] border-[#FF5A00]/30',
      gradient: 'from-[#C94400]/20 via-[#C94400]/5 to-transparent',
      borderColor: 'hover:border-[#FF5A00]/60',
      action: handlePostRequirement,
    },
    {
      id: 'sell-24h',
      title: 'Sell in 24 Hours',
      subtitle: 'Fast-track liquidation auctions & bulk bids',
      icon: Zap,
      badge: 'Hot 24H',
      badgeColor: 'bg-[#FF5A00]/20 text-[#FF5A00] border-[#FF5A00]/40 animate-pulse',
      gradient: 'from-[#C94400]/25 via-[#C94400]/10 to-transparent',
      borderColor: 'hover:border-[#FF5A00]',
      action: () => navigate('/auctions/reverse'),
    },
    {
      id: 'trade-global',
      title: 'Import & Export',
      subtitle: 'HS codes, duties, landed cost & logistics',
      icon: Globe,
      badge: 'Worldwide',
      badgeColor: 'bg-[#FF5A00]/15 text-[#FF7A2E] border-[#FF5A00]/30',
      gradient: 'from-[#C94400]/20 via-[#C94400]/5 to-transparent',
      borderColor: 'hover:border-[#FF5A00]/60',
      action: () => navigate('/trade-assistant?tab=calculator'),
    },
  ];

  return (
    <section className="relative z-20 max-w-[1400px] mx-auto w-full px-4 sm:px-5 md:px-6 -mt-2 mb-8 sm:mb-14">
      {/* Container with subtle glow and header — matches homepage display width */}
      <div className="relative rounded-3xl bg-gradient-to-b from-[#2A1205] to-[#0A0A0A] border border-[#FF5A00]/25 p-4 sm:p-5 md:p-6 lg:p-7 shadow-2xl overflow-hidden">
        
        {/* Ambient Top Glow in Brand Orange */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-gradient-to-b from-[#C94400]/15 to-transparent blur-2xl pointer-events-none" />

        {/* Section Header */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-3 mb-5 pb-4 border-b border-border/60">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF5A00]/10 border border-[#FF5A00]/25 text-[#FF5A00] text-xs font-bold mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#FF5A00]" />
              <span>Direct Trade Workflows</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
              Fast-Track Sourcing & Selling Workflows
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl">
              Accelerate your bulk B2B trade — connect with verified manufacturers or liquidate inventory in 24 hours.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-400 shrink-0">
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <ShieldCheck className="w-3.5 h-3.5 text-[#FF5A00] shrink-0" />
              100% Verified Trade Assurance
            </span>
          </div>
        </div>

        {/* Responsive workflow grid: equal-height cards that fit laptop → wide displays */}
        <div className="relative z-10 grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-3.5 auto-rows-fr">
          {actions.map((act) => {
            const Icon = act.icon;
            return (
              <button
                key={act.id}
                type="button"
                onClick={act.action}
                className={`group relative text-left rounded-2xl bg-[#0c121e]/90 hover:bg-[#1A0C05] border border-[#2A2A2A]/90 ${act.borderColor} p-3.5 sm:p-4 transition-all duration-200 hover:-translate-y-1 shadow-lg hover:shadow-xl active:scale-[0.98] flex flex-col h-full min-h-[168px] overflow-hidden cursor-pointer`}
              >
                {/* Subtle Card Top Gradient */}
                <div className={`absolute top-0 left-0 right-0 h-28 bg-gradient-to-b ${act.gradient} pointer-events-none opacity-80`} />

                {/* Top Row: Icon + Badge */}
                <div className="relative z-10 flex items-start justify-between w-full gap-2 mb-2.5">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#0A0A0A]/90 border border-[#2A2A2A]/80 flex items-center justify-center text-[#FF5A00] group-hover:scale-105 group-hover:bg-[#C94400] group-hover:text-white transition-all shadow-md shrink-0">
                    <Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5 transition-transform duration-200" />
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${act.badgeColor}`}>
                    {act.badge}
                  </span>
                </div>

                {/* Middle: Title & Subtitle */}
                <div className="relative z-10 flex-1 min-w-0 w-full text-left mb-3">
                  <h3 className="w-full text-left font-extrabold text-white text-[13px] sm:text-sm leading-snug group-hover:text-[#FF5A00] transition-colors line-clamp-2">
                    {act.title}
                  </h3>
                  <p className="w-full text-left text-[11px] text-neutral-400 mt-1.5 line-clamp-2 leading-relaxed">
                    {act.subtitle}
                  </p>
                </div>

                {/* Bottom CTA Arrow Button */}
                <div className="relative z-10 mt-auto w-full pt-2.5 border-t border-[#2A2A2A]/80 flex items-center justify-between text-xs font-bold text-slate-300 group-hover:text-[#FF5A00] transition-colors">
                  <span>Explore Now</span>
                  <div className="w-6 h-6 rounded-full bg-[#0A0A0A]/80 group-hover:bg-[#C94400] flex items-center justify-center text-slate-300 group-hover:text-white transition-all shrink-0">
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

import React, { useRef } from 'react';
import { Star, ShieldCheck, Building2, Quote, CheckCircle2, Globe, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const TESTIMONIALS = [
  {
    id: 1,
    name: 'Vikram Malhotra',
    role: 'Procurement Director',
    company: 'Apex Infrastructure & Engineering Ltd',
    country: 'India',
    flag: '🇮🇳',
    avatar: 'https://cdn.pixabay.com/photo/2016/11/21/12/42/beard-1845166_1280.jpg',
    rating: 5,
    tradeVolume: '14,000 Metric Tons Procured',
    verifiedBuyer: true,
    text: 'BulkSkart transformed our structural steel and fastener sourcing. We posted our DIN 933 requirement and received verified quotes with mill test reports within 4 hours. Direct supplier chat saved us weeks of email ping-pong.',
    verifiedTag: 'Verified Enterprise Buyer',
  },
  {
    id: 2,
    name: 'Elena Rostova',
    role: 'VP Global Supply Chain',
    company: 'Nordic Pharma & Medical Devices GmbH',
    country: 'Germany',
    flag: '🇩🇪',
    avatar: 'https://cdn.pixabay.com/photo/2017/08/30/17/27/business-woman-2697954_1280.jpg',
    rating: 5,
    tradeVolume: '€2.4M Orthopedic Implants Procured',
    verifiedBuyer: true,
    text: 'The factory audit and ISO certification badges on BulkSkart are authentic. We connected directly with approved trauma implant manufacturers and audited their cleanroom reports online. The 24-hour fast-track selling also helped us secure urgent spot lots.',
    verifiedTag: 'Verified Medical Importer',
  },
  {
    id: 3,
    name: 'David Chen',
    role: 'Chief Operations Officer',
    company: 'Shenzhen MicroTech Semiconductor Ltd',
    country: 'China',
    flag: '🇨🇳',
    avatar: 'https://cdn.pixabay.com/photo/2016/11/18/19/07/happy-1836445_1280.jpg',
    rating: 5,
    tradeVolume: '$4.8M Export Turnover on BulkSkart',
    verifiedBuyer: false,
    text: 'As an electronics manufacturer, the monthly subscription plan gives us constant access to high-intent global buyers without commissions. We closed multi-container micro-controller deals with clients in Germany and the USA directly through the portal.',
    verifiedTag: 'Verified Tier-1 Manufacturer',
  },
  {
    id: 4,
    name: 'Claire Dubois',
    role: 'Head of Sustainable Packaging',
    company: 'Lumière BioPackaging S.A.',
    country: 'France',
    flag: '🇫🇷',
    avatar: 'https://cdn.pixabay.com/photo/2017/09/21/19/06/woman-2773007_1280.jpg',
    rating: 5,
    tradeVolume: '650,000 Biodegradable Units Sold',
    verifiedBuyer: false,
    text: 'BulkSkart is the most reliable cross-border wholesale marketplace for sustainable packaging. The buyer inquiry inbox with real-time notifications makes lead follow-ups instantaneous. We expanded our export footprint across 12 countries in 6 months.',
    verifiedTag: 'Verified Eco-Supplier',
  },
  {
    id: 5,
    name: 'Tariq Al-Mansoor',
    role: 'Managing Director',
    company: 'Emirates Petrochem & Plastics FZE',
    country: 'UAE',
    flag: '🇦🇪',
    avatar: 'https://cdn.pixabay.com/photo/2015/01/08/18/29/entrepreneur-593358_1280.jpg',
    rating: 5,
    tradeVolume: '35,000 MT Virgin Polymers Sold',
    verifiedBuyer: false,
    text: 'For bulk chemical polymers and HDPE granules, BulkSkart provides direct access to high-volume converting factories. Verified RFQs with exact specifications and payment terms allow us to quote with confidence.',
    verifiedTag: 'Verified Global Exporter',
  },
  {
    id: 6,
    name: 'Marcus Vance',
    role: 'Chief Procurement Officer',
    company: 'Pacific Renewable Energy Group LLC',
    country: 'USA',
    flag: '🇺🇸',
    avatar: 'https://cdn.pixabay.com/photo/2016/03/27/17/42/man-1283235_1280.jpg',
    rating: 5,
    tradeVolume: '$6.2M Tier-1 Solar Modules Procured',
    verifiedBuyer: true,
    text: 'Sourcing 550W bifacial solar panels and mounting structures in multi-megawatt volume was frictionless. Supplier inspection certificates and factory audit documents were verified on-platform before signing.',
    verifiedTag: 'Verified Enterprise Buyer',
  },
];

export default function ReviewsHomeSection() {
  const carouselRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = carouselRef.current.clientWidth * 0.75;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section className="relative z-20 py-10 md:py-14 bg-[#0B0F19] border-t border-border/80">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-5 md:px-6">

        {/* Section Header with Aggregated Score & Left/Right Scroll Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-semibold mb-2.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Global Feedback</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              What Verified Buyers & Manufacturers Say
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl text-pretty">
              Real feedback from enterprises, procurement officers, and certified factories conducting millions of dollars in cross-border bulk trade on BulkSkart.
            </p>
          </div>

          {/* Right Controls: Aggregated Score + Left/Right Scroll Buttons */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Aggregated Score Card */}
            <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-card border border-border/80">
              <div className="flex items-center gap-0.5 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>
              <div className="border-l border-border pl-2.5">
                <div className="flex items-baseline gap-1">
                  <span className="text-base sm:text-lg font-black text-foreground">4.9</span>
                  <span className="text-[11px] text-muted-foreground">/ 5.0</span>
                </div>
                <p className="text-[10px] text-muted-foreground hidden sm:block">2,800+ trade reviews</p>
              </div>
            </div>

            {/* Left and Right Scroll Buttons */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => scroll('left')}
                aria-label="Scroll reviews left"
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-card hover:bg-primary/10 border border-border hover:border-primary text-primary transition-all shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => scroll('right')}
                aria-label="Scroll reviews right"
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-card hover:bg-primary/10 border border-border hover:border-primary text-primary transition-all shadow-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Reviews Horizontal Scroll Carousel */}
        <div
          ref={carouselRef}
          className="flex items-stretch gap-4 sm:gap-5 overflow-x-auto pb-4 pt-1 scrollbar-none snap-x snap-mandatory overscroll-x-contain touch-pan-x -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {TESTIMONIALS.map((review) => (
            <div
              key={review.id}
              className="w-[290px] min-[420px]:w-[340px] md:w-[420px] shrink-0 snap-start bg-card border border-border/80 hover:border-primary/50 rounded-2xl p-5 sm:p-6 transition-all flex flex-col justify-between shadow-sm relative group hover:shadow-[0_8px_24px_rgba(255,90,0,0.12)]"
            >
              <div>
                {/* Header: Stars + Verified Badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(review.rating)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                  <Badge variant="outline" className="text-[10px] font-semibold border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {review.verifiedTag}
                  </Badge>
                </div>

                {/* Review Quote Body */}
                <p className="text-xs sm:text-[13px] text-foreground/90 leading-relaxed italic mb-4 relative line-clamp-4">
                  "{review.text}"
                </p>
              </div>

              {/* Reviewer Bio & Footprint */}
              <div className="pt-3.5 border-t border-border/60 flex items-center justify-between gap-3 mt-auto">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={review.avatar}
                    alt={review.name}
                    className="w-9 h-9 rounded-full object-cover border border-border shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-foreground truncate">{review.name}</p>
                      <span title={review.country} className="text-xs shrink-0">{review.flag}</span>
                    </div>
                    <p className="text-[10.5px] text-muted-foreground truncate">
                      {review.role} • <span className="text-foreground/80">{review.company}</span>
                    </p>
                  </div>
                </div>

                {/* Volume badge */}
                <span className="text-[9.5px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0 max-w-[120px] truncate">
                  {review.tradeVolume}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Badges Strip */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-border/60 text-center">
          <div>
            <p className="text-xl md:text-2xl font-black text-foreground">99.4%</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Supplier Fulfillment Rate</p>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-black text-foreground">&lt; 4 Hours</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Average First RFQ Response</p>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-black text-foreground">30+ Countries</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Cross-Border Trade Coverage</p>
          </div>
          <div>
            <p className="text-xl md:text-2xl font-black text-foreground">Zero Fees</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">For Corporate Buyers Always</p>
          </div>
        </div>

      </div>
    </section>
  );
}

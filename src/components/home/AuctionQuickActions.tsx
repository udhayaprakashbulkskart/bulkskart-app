import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Gavel, Clock, Flame, ShieldCheck, ArrowRight, TrendingUp,
  MapPin, Users, Plus, ChevronRight, Building2, CheckCircle2,
  HardHat, Factory, MessageSquare, Sparkles, UserCheck
} from 'lucide-react';
import SafeImage from '@/components/common/SafeImage';
import { Button } from '@/components/ui/button';
import { supabase } from '@/db/supabase';
import CreateReverseAuctionDialog from '@/components/auctions/CreateReverseAuctionDialog';

export interface LiveReverseAuctionItem {
  id: string;
  auctionNumber: string;
  title: string;
  quantity: string;
  priceRange: string;
  location: string;
  quotedCount: number;
  initialSeconds: number;
  image: string;
  category: string;
}

function formatTimeRemaining(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
export default function AuctionQuickActions() {
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [auctions, setAuctions] = useState<LiveReverseAuctionItem[]>([]);
  const [timers, setTimers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Query live reverse auctions from database
  useEffect(() => {
    let isMounted = true;
    async function loadAuctions() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('auctions')
          .select('*')
          .eq('auction_type', 'reverse')
          .order('created_at', { ascending: false })
          .limit(3);

        if (!error && data && data.length > 0 && isMounted) {
          const now = Date.now();
          const mapped: LiveReverseAuctionItem[] = data.map((d: any) => {
            const end = d.end_time ? new Date(d.end_time).getTime() : now;
            const remainingSec = Math.max(0, Math.floor((end - now) / 1000));

            return {
              id: d.id,
              auctionNumber: d.auction_number || `AUC-${d.id.slice(0, 6)}`,
              title: d.title,
              quantity: d.total_quantity ? `${d.total_quantity.toLocaleString()} ${d.quantity_unit || 'Units'}` : 'Bulk Lot',
              priceRange: d.starting_price ? `₹${Number(d.starting_price).toLocaleString('en-IN')} / ${d.quantity_unit || 'unit'}` : 'Negotiable',
              location: d.delivery_location || 'India',
              quotedCount: Number(d.total_bids) || 0,
              initialSeconds: remainingSec,
              image: d.images?.[0] || '',
              category: d.category_id || 'Industrial'
            };
          });

          setAuctions(mapped);
          const initialTimers: Record<string, number> = {};
          mapped.forEach(item => {
            initialTimers[item.id] = item.initialSeconds;
          });
          setTimers(initialTimers);
        } else if (isMounted) {
          setAuctions([]);
          setTimers({});
        }
      } catch (err) {
        console.error('Failed to load auctions:', err);
        if (isMounted) setAuctions([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadAuctions();
    return () => { isMounted = false; };
  }, []);

  // Live countdown timer ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const next: Record<string, number> = {};
        for (const [id, sec] of Object.entries(prev)) {
          next[id] = Math.max(0, sec - 1);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-5 sm:py-6 bg-[#0B0F17] text-white">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-5 md:px-6">
        
        {/* ══════════════════════════════════════════════════════════════════
            BULKSKART — FOUR ACTION BUTTONS (MOCKUP EXACT 2x2 INDUSTRIAL GRID)
           ══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 mb-7">
          
          {/* Card 1: POST YOUR REQUIREMENT */}
          <Link
            to="/post-requirement"
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1C120C] to-[#120B06] border border-[#FF5A1F]/30 hover:border-[#FF5A1F] p-4 sm:p-5 flex items-center justify-between transition-all duration-200 hover:shadow-[0_4px_24px_rgba(255,90,31,0.18)] active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
              {/* Orange Hardhat / Worker Icon in Rounded Square */}
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#FF5A1F]/20 border border-[#FF5A1F]/40 flex items-center justify-center text-[#FF5A1F] shrink-0 group-hover:scale-105 transition-transform shadow-inner">
                <HardHat className="w-6 h-6 sm:w-7 sm:h-7 text-[#FF5A1F]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug group-hover:text-[#FF5A1F] transition-colors">
                  Post Your Requirement
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 font-normal mt-0.5 truncate">
                  Tell suppliers what you need
                </p>
              </div>
            </div>

            {/* Orange Circular Navigation Button with Chevron */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#C94400] text-white flex items-center justify-center shrink-0 ml-2 group-hover:bg-[#FF773D] group-hover:translate-x-0.5 transition-all shadow-md">
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </div>
          </Link>

          {/* Card 2: MANUFACTURERS DIRECTORY */}
          <Link
            to="/manufacturers"
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0D1526] to-[#080E1A] border border-[#FF5A00]/25 hover:border-[#FF5A00]/60 p-4 sm:p-5 flex items-center justify-between transition-all duration-200 hover:shadow-[0_4px_24px_rgba(255,90,0,0.18)] active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
              {/* Factory Icon in Rounded Square */}
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#FF5A00]/15 border border-[#FF5A00]/30 flex items-center justify-center text-[#FF5A00] shrink-0 group-hover:scale-105 transition-transform shadow-inner">
                <Factory className="w-6 h-6 sm:w-7 sm:h-7 text-[#FF5A00]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug group-hover:text-[#FF5A00] transition-colors">
                  Manufacturers Directory
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 font-normal mt-0.5 truncate">
                  Explore verified manufacturers
                </p>
              </div>
            </div>

            {/* Orange Circular Navigation Button with Chevron */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#C94400] text-white flex items-center justify-center shrink-0 ml-2 group-hover:bg-[#FF7700] group-hover:translate-x-0.5 transition-all shadow-md">
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </div>
          </Link>

          {/* Card 3: 24-HOUR BULK BIDDING */}
          <Link
            to="/auctions"
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0D1526] to-[#080E1A] border border-[#FF5A00]/25 hover:border-[#FF5A00]/60 p-4 sm:p-5 flex items-center justify-between transition-all duration-200 hover:shadow-[0_4px_24px_rgba(255,90,0,0.18)] active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
              {/* Gavel Icon in Rounded Square */}
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#0A0A0A]/60 border border-[#2A2A2A]/60 flex items-center justify-center text-[#FF5A1F] shrink-0 group-hover:scale-105 transition-transform shadow-inner">
                <Gavel className="w-6 h-6 sm:w-7 sm:h-7 text-[#FF5A1F]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug group-hover:text-[#FF5A1F] transition-colors">
                  24-Hour Bulk Bidding
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 font-normal mt-0.5 truncate">
                  Bid on bulk lots
                </p>
              </div>
            </div>

            {/* Orange Circular Navigation Button with Chevron */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#C94400] text-white flex items-center justify-center shrink-0 ml-2 group-hover:bg-[#FF773D] group-hover:translate-x-0.5 transition-all shadow-md">
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </div>
          </Link>

          {/* Card 4: LIVE REVERSE AUCTIONS */}
          <Link
            to="/auctions/reverse"
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1C120C] to-[#120B06] border border-[#FF5A1F]/30 hover:border-[#FF5A1F] p-4 sm:p-5 flex items-center justify-between transition-all duration-200 hover:shadow-[0_4px_24px_rgba(255,90,31,0.18)] active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
              {/* Clock Timer Icon in Rounded Square */}
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#FF5A1F]/20 border border-[#FF5A1F]/40 flex items-center justify-center text-[#FF5A1F] shrink-0 group-hover:scale-105 transition-transform shadow-inner">
                <Clock className="w-6 h-6 sm:w-7 sm:h-7 text-[#FF5A1F]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug group-hover:text-[#FF5A1F] transition-colors">
                  Live Reverse Auctions
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 font-normal mt-0.5 truncate">
                  Get supplier quotes
                </p>
              </div>
            </div>

            {/* Orange Circular Navigation Button with Chevron */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#C94400] text-white flex items-center justify-center shrink-0 ml-2 group-hover:bg-[#FF773D] group-hover:translate-x-0.5 transition-all shadow-md">
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </div>
          </Link>

        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION HEADER: LIVE REVERSE AUCTIONS (MATCHING MOCKUP)
           ══════════════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C94400] animate-pulse shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Live Reverse Auctions
            </h2>
          </div>

          <Link
            to="/auctions/reverse"
            className="text-xs sm:text-sm font-bold text-[#FF5A1F] hover:text-[#FF773D] flex items-center gap-1 transition-colors"
          >
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            LIVE REVERSE AUCTIONS CARDS (MATCHING MOCKUP EXACT LIST)
           ══════════════════════════════════════════════════════════════════ */}
        <div className="space-y-3 sm:space-y-3.5">
          {auctions.map(item => {
            const timeLeft = timers[item.id] ?? item.initialSeconds;
            const timeStr = formatTimeRemaining(timeLeft);

            return (
              <Link
                key={item.id}
                to={`/auctions/reverse/${item.id}`}
                className="group block bg-[#1A0C05] border border-[#2A2A2A]/80 hover:border-[#FF5A1F]/70 rounded-2xl p-3 sm:p-4 transition-all duration-200 hover:shadow-lg active:scale-[0.99] relative overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row gap-3.5 sm:gap-4 items-start sm:items-center">
                  
                  {/* Left Product Image with Category Pill in Lower-Left Corner */}
                  <div className="w-full sm:w-36 h-36 sm:h-28 rounded-xl overflow-hidden bg-[#0A0A0A] shrink-0 relative">
                    <SafeImage
                      src={item.image}
                      alt={item.title}
                      category={item.category}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 text-[10px] font-semibold bg-[#0A0A0A]/80 text-white rounded-md backdrop-blur-xs">
                      {item.category}
                    </span>
                  </div>

                  {/* Middle / Right Content */}
                  <div className="flex-1 min-w-0 w-full space-y-1.5">
                    
                    {/* Top Row: LIVE Badge, Countdown Pill, RFQ ID */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#B33D00] text-white uppercase tracking-wider flex items-center gap-1">
                        LIVE
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#0A0A0A] text-slate-200 flex items-center gap-1 border border-[#2A2A2A]">
                        <Clock className="w-3 h-3 text-[#FF7A2E]" />
                        {timeStr}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-400 font-semibold ml-auto">
                        {item.auctionNumber}
                      </span>
                    </div>

                    {/* Product Title */}
                    <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-[#FF5A1F] transition-colors line-clamp-1">
                      {item.title}
                    </h3>

                    {/* Quantity */}
                    <p className="text-xs sm:text-sm text-slate-300 font-medium">
                      {item.quantity}
                    </p>

                    {/* Target Price Range in Bright Brand Orange */}
                    <p className="text-sm sm:text-base font-bold text-[#FF5A1F]">
                      {item.priceRange}
                    </p>

                    {/* Bottom Metadata: Location on Left, Quoted Count on Right */}
                    <div className="pt-2 border-t border-[#2A2A2A]/80 flex items-center justify-between text-xs text-neutral-400">
                      <span className="flex items-center gap-1.5 truncate max-w-[200px] sm:max-w-none">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate">{item.location}</span>
                      </span>

                      <span className="flex items-center gap-1 font-bold text-white bg-[#0A0A0A]/60 px-2 py-0.5 rounded-md border border-[#2A2A2A]/50">
                        <Users className="w-3.5 h-3.5 text-[#FF5A1F]" />
                        <span>{item.quotedCount} Quoted</span>
                      </span>
                    </div>

                  </div>

                </div>
              </Link>
            );
          })}
        </div>

        {/* Anti-Sniping & Instant Launch Footer Toolbar */}
        <div className="mt-4 p-3 rounded-2xl bg-[#0D1526]/80 border border-[#2A2A2A] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#FF5A1F] shrink-0" />
            <span>
              <strong className="text-white">Anti-Sniping Protection Active:</strong> Bids in the final 120s extend the auction by +2 minutes. Bids are verified server-side.
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => setCreateDialogOpen(true)}
              className="h-8 px-3 bg-[#C94400] hover:bg-[#FF773D] text-white font-bold text-xs rounded-xl shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Post 60-Min Auction
            </Button>
            <Link
              to="/post-requirement"
              className="text-xs font-semibold text-slate-300 hover:text-white underline underline-offset-2"
            >
              Post Buyer RFQ
            </Link>
          </div>
        </div>

      </div>

      {/* 60-Min Reverse Auction Creation Dialog */}
      <CreateReverseAuctionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </section>
  );
}

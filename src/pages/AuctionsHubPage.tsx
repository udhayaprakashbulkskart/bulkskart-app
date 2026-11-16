import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Gavel, Clock, Plus, Search, ShieldCheck,
  MapPin, Users, ArrowRight, CheckCircle2,
  Flame, Building2, Package, RefreshCw, ImageOff
} from 'lucide-react';
import CreateReverseAuctionDialog from '@/components/auctions/CreateReverseAuctionDialog';
import { useAuth } from '@/contexts/AuthContext';
import {
  auctionMoney,
  auctionPhase,
  getAuctionListings,
  secondsLeft,
  type AuctionListing,
} from '@/lib/auctionListing';

export default function AuctionsHubPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const isForwardRoute = location.pathname.includes('/forward');
  const [activeTab, setActiveTab] = useState<'reverse' | 'forward'>(isForwardRoute ? 'forward' : 'reverse');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'sold'>('live');
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [relistData, setRelistData] = useState<any>(null);
  const [allAuctions, setAllAuctions] = useState<AuctionListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // The auctions as stored, refreshed every 30 seconds so bids and endings show up.
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const result = await getAuctionListings();
      if (!isMounted) return;
      setAllAuctions(result.rows);
      setLoadError(result.error);
      setLoading(false);
    };
    load();
    const refresh = setInterval(load, 30_000);
    return () => {
      isMounted = false;
      clearInterval(refresh);
    };
  }, [reloadKey]);

  // Tick the countdowns once a second.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  function formatTime(sec?: number) {
    if (!sec || sec <= 0) return '00:00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Filter auctions
  const displayedAuctions = allAuctions
    .filter(auc => auc.auctionType === activeTab)
    .filter(auc => {
      const phase = auctionPhase(auc, now);
      if (statusFilter === 'live') return !phase.ended;
      if (statusFilter === 'sold') return phase.ended;
      return true;
    })
    .filter(auc => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        auc.title.toLowerCase().includes(q) ||
        auc.auctionNumber.toLowerCase().includes(q) ||
        (auc.deliveryLocation ?? '').toLowerCase().includes(q) ||
        (auc.sellerName ?? '').toLowerCase().includes(q)
      );
    });

  return (
    <MainLayout>
      <div className="bg-background min-h-screen pb-20">
        
        {/* ── Hero Banner ── */}
        <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-black text-white py-8 sm:py-10 border-b border-border">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF5A1F]/20 text-[#FF5A1F] border border-[#FF5A1F]/30 text-xs font-bold mb-3">
                  <Flame className="w-3.5 h-3.5 fill-[#FF5A1F]" />
                  60-Minute Real-Time Bidding Auctions
                </div>
                <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">
                  60-Minute Live Reverse Auctions: Sell Your Bulk Product
                </h1>
                <p className="text-sm sm:text-base text-neutral-400 mt-2 max-w-2xl">
                  A live reverse auction is when a manufacturer has a bulk product they want to sell within 60 minutes through real-time bidding.
                </p>
              </div>

              {/* Quick Action CTAs */}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  className="bg-[#FF5A00] hover:bg-[#e04e00] text-white font-bold text-xs sm:text-sm h-11 px-5 rounded-xl shadow-[0_3px_0_#922f00] flex items-center gap-1.5 transition-all active:translate-y-0.5 active:shadow-none"
                >
                  <Flame className="w-4 h-4 fill-white" />
                  ⚡ Sell Products in 24 Hours (Hot)
                </Button>
                <Link to="/post-requirement">
                  <Button
                    variant="ghost"
                    className="border border-[#FF5A00]/50 text-white hover:bg-[#FF5A00]/15 font-bold text-xs sm:text-sm h-11 px-5 rounded-xl"
                  >
                    <Plus className="w-4 h-4 mr-1.5" /> Post Sourcing RFQ
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Container ── */}
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-6">
          
          {/* Rules & Anti-Sniping Alert */}
          <div className="p-3.5 rounded-2xl bg-orange-50/60 dark:bg-[#FF5A1F]/10 border border-[#FF5A1F]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div className="flex items-center gap-2.5 text-xs text-foreground">
              <ShieldCheck className="w-5 h-5 text-[#FF5A1F] shrink-0" />
              <span>
                <strong>Compulsory ₹5,000 60-Minute Subscription:</strong> Every auction requires a fixed ₹5,000 posting subscription with country-wise statutory tax (e.g., India 18% GST = ₹5,900) and verified tax invoice. Any qualifying bid in the final 120s adds +2 minutes anti-sniping.
              </span>
            </div>
            <span className="text-[11px] font-bold text-[#FF5A1F] shrink-0">
              Verified Subscription Engine
            </span>
          </div>

          {/* Navigation Tabs (Reverse vs Forward) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-border pb-4 mb-6">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setActiveTab('reverse');
                  navigate('/auctions/reverse');
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
                  activeTab === 'reverse'
                    ? 'bg-[#FF5A1F] text-white shadow-sm'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <Flame className="w-4 h-4 fill-current" />
                Live Reverse Auctions (60-Min Bulk Sales)
                <span className="px-1.5 py-0.2 text-[10px] rounded bg-white/20 text-white font-bold">
                  60-Min
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('forward');
                  navigate('/auctions/forward');
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
                  activeTab === 'forward'
                    ? 'bg-[#FF5A1F] text-white shadow-sm'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <Gavel className="w-4 h-4" />
                Forward Auctions (Machinery & Plants)
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => setStatusFilter('live')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    statusFilter === 'live' ? 'bg-card text-[#FF5A1F] shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  Live (Active Lots)
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('sold')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    statusFilter === 'sold' ? 'bg-card text-orange-600 shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  History & Concluded
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    statusFilter === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  All Lots
                </button>
              </div>

              <div className="relative w-full sm:w-60">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search lots..."
                  className="pl-9 h-9 rounded-xl text-xs bg-card"
                />
              </div>
            </div>
          </div>

          {/* Tab Description Banner */}
          {activeTab === 'reverse' && (
            <div className="mb-6 p-4 rounded-2xl bg-card border border-border/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  Live Manufacturer Reverse Auctions
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Manufacturers have listed these bulk inventory lots for immediate sale within a 60-minute live bidding window. Buyers submit bids in real-time.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
                className="shrink-0 text-xs bg-[#FF5A00] hover:bg-[#e04e00] text-white font-bold h-9 px-3.5 rounded-xl shadow-[0_2px_0_#922f00] flex items-center gap-1.5 transition-all active:translate-y-0.5"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                ⚡ List Product in 24h
              </Button>
            </div>
          )}

          {/* Auction Cards Grid */}
          {loading && allAuctions.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map(n => (
                <div key={n} className="h-[420px] rounded-2xl bg-muted/40 animate-pulse border border-border" />
              ))}
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayedAuctions.map(auc => {
              const phase = auctionPhase(auc, now);
              const seconds = secondsLeft(auc.endTime, now);
              const detailPath = auc.auctionType === 'reverse'
                ? `/auctions/reverse/${auc.id}`
                : `/auctions/forward/${auc.id}`;
              const startPrice = auctionMoney(auc.startingPrice, auc.currency);
              const leading = auc.totalBids > 0 ? auctionMoney(auc.currentHighestBid, auc.currency) : null;
              const isMine = Boolean(user && auc.sellerId === user.id);

              return (
                <div
                  key={auc.id}
                  className="bg-card hover:bg-muted/30 border border-border hover:border-[#FF5A00]/70 rounded-2xl overflow-hidden shadow-md hover:shadow-[0_12px_28px_rgba(255,90,0,0.22)] hover:-translate-y-1 transition-all flex flex-col"
                >
                  {/* Top Image Banner: the seller's own photo, or a plain panel */}
                  <div className="relative h-48 bg-muted overflow-hidden">
                    {auc.image ? (
                      <img
                        src={auc.image}
                        alt={auc.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-muted-foreground/70">
                        <ImageOff className="w-8 h-8" />
                        <span className="text-xs font-medium">No photo from the seller</span>
                      </div>
                    )}

                    {/* Status Pill & Auction ID */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                      {phase.key === 'live' ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-600 text-white flex items-center gap-1 shadow-md">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          LIVE
                        </span>
                      ) : phase.key === 'sold' ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-600 text-white flex items-center gap-1 shadow-md">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          SOLD
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-neutral-700 text-white shadow-md uppercase">
                          {phase.label}
                        </span>
                      )}
                      <span className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold bg-black/75 text-white backdrop-blur-sm">
                        {auc.auctionNumber}
                      </span>
                    </div>

                    {/* Countdown to the auction's own end time */}
                    <div className={`absolute bottom-3 right-3 px-3 py-1 rounded-xl text-xs font-bold font-mono shadow-md backdrop-blur-md flex items-center gap-1.5 ${
                      phase.ended
                        ? 'bg-orange-950/80 text-orange-400'
                        : phase.key === 'live' && seconds <= 300
                        ? 'bg-red-600/90 text-white animate-pulse'
                        : 'bg-black/80 text-white'
                    }`}>
                      <Clock className="w-3.5 h-3.5" />
                      {phase.ended
                        ? 'Concluded'
                        : phase.key === 'scheduled'
                        ? (auc.startTime ? `Starts ${new Date(auc.startTime).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Starts soon')
                        : formatTime(seconds)}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Seller and delivery place, when known */}
                      {(auc.sellerName || auc.deliveryLocation) && (
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-1.5">
                          {auc.sellerName ? (
                            <span className="flex items-center gap-1 font-semibold text-foreground truncate max-w-[180px]">
                              <Building2 className="w-3.5 h-3.5 text-[#FF5A1F] shrink-0" />
                              <span className="truncate">{auc.sellerName}</span>
                            </span>
                          ) : <span />}
                          {auc.deliveryLocation && (
                            <span className="flex items-center gap-1 text-[11px] truncate">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate">{auc.deliveryLocation}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Title */}
                      <Link to={detailPath}>
                        <h3 className="text-sm sm:text-base font-bold text-foreground hover:text-[#FF5A1F] transition-colors line-clamp-2 leading-snug">
                          {auc.title}
                        </h3>
                      </Link>

                      {/* Lot Size */}
                      {auc.totalQuantity !== null && (
                        <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-muted-foreground">
                          <Package className="w-3.5 h-3.5 text-[#FF5A1F]" />
                          <span>Bulk Lot: <strong>{auc.totalQuantity.toLocaleString('en-IN')} {auc.quantityUnit}</strong></span>
                          {auc.moq !== null && <span className="text-muted-foreground/60">• MOQ: {auc.moq.toLocaleString('en-IN')}</span>}
                        </div>
                      )}

                      {/* Price Metrics Box */}
                      <div className="grid grid-cols-2 gap-2 mt-3 p-3 rounded-xl bg-muted/40 border border-border/50">
                        <div>
                          <div className="text-[10px] text-muted-foreground font-semibold uppercase">
                            Starting price
                          </div>
                          <div className="text-xs sm:text-sm font-bold text-foreground mt-0.5">
                            {startPrice ? `${startPrice} / ${auc.quantityUnit}` : 'Not stated'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[#FF5A1F] font-bold uppercase">
                            {phase.key === 'sold' ? 'Winning bid' : phase.ended ? 'Highest bid' : 'Leading bid'}
                          </div>
                          <div className="text-sm sm:text-base font-bold text-[#FF5A1F] mt-0.5">
                            {leading ?? 'No bids yet'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-4 mt-3 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1 shrink-0">
                        <Users className="w-3.5 h-3.5 text-[#FF5A1F]" />
                        <span>{auc.totalBids} {auc.totalBids === 1 ? 'Bid' : 'Bids'}</span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        {phase.ended && isMine && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRelistData({
                                title: auc.title,
                                description: auc.description,
                                total_quantity: auc.totalQuantity ?? undefined,
                                quantity_unit: auc.quantityUnit,
                                starting_price: auc.startingPrice ?? undefined,
                                reserve_price: auc.reservePrice ?? undefined,
                                min_bid_increment: auc.minBidIncrement ?? undefined,
                                delivery_location: auc.deliveryLocation ?? undefined,
                              });
                              setCreateDialogOpen(true);
                            }}
                            className="font-bold text-xs h-9 px-2.5 border-[#FF5A1F] text-[#FF5A1F] hover:bg-[#FF5A1F]/10 flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Re-list Lot</span>
                          </Button>
                        )}
                        <Link to={detailPath} className="shrink-0">
                          <Button
                            size="sm"
                            className={`font-bold text-xs h-9 px-3.5 rounded-xl flex items-center gap-1 shadow-sm ${
                              phase.ended
                                ? 'bg-neutral-800 hover:bg-neutral-700 text-white'
                                : 'bg-[#FF5A1F] hover:bg-[#e04e17] text-white'
                            }`}
                          >
                            <span>{phase.ended ? 'View Lot' : 'Enter Live Room'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}

          {!loading && displayedAuctions.length === 0 && (
            <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border p-8">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              {loadError && allAuctions.length === 0 ? (
                <>
                  <h3 className="text-base font-bold text-foreground">Auctions could not be loaded</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">Check your connection and try again.</p>
                  <Button
                    onClick={() => setReloadKey(k => k + 1)}
                    className="mt-4 bg-muted hover:bg-muted/80 text-foreground border border-border font-bold text-xs h-9 px-4 rounded-xl"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Try again
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="text-base font-bold text-foreground">
                    {searchQuery.trim()
                      ? 'No auctions match your search'
                      : statusFilter === 'live'
                      ? `No ${activeTab} auctions are live right now`
                      : `No ${activeTab} auctions here yet`}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    {statusFilter === 'live' && !searchQuery.trim()
                      ? 'Have bulk stock to sell? List it and buyers can bid on it live.'
                      : 'Try another filter, or list your own lot.'}
                  </p>
                  <Button
                    onClick={() => setCreateDialogOpen(true)}
                    className="mt-4 bg-[#FF5A00] hover:bg-[#e04e00] text-white font-bold text-xs h-9 px-4 rounded-xl shadow-[0_2px_0_#922f00] flex items-center gap-1.5 transition-all active:translate-y-0.5 mx-auto"
                  >
                    <Flame className="w-3.5 h-3.5 mr-1" />
                    ⚡ List Product in 24 Hours (Hot)
                  </Button>
                </>
              )}
            </div>
          )}

        </div>

      </div>

      {/* Manufacturer Launch 60-Min Reverse Auction Dialog */}
      <CreateReverseAuctionDialog
        open={createDialogOpen}
        onOpenChange={(op) => {
          setCreateDialogOpen(op);
          if (!op) setRelistData(null);
        }}
        initialData={relistData}
        onSuccess={() => setReloadKey(k => k + 1)}
      />
    </MainLayout>
  );
}

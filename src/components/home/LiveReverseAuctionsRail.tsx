import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Flame, Clock, MapPin, Users, ArrowRight,
  ChevronRight, ChevronLeft,
  Pause, Play, RefreshCw, Sparkles, ImageOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import CreateReverseAuctionDialog from '@/components/auctions/CreateReverseAuctionDialog';
import { getCategories } from '@/lib/api';
import { auctionMoney, auctionPhase, getAuctionListings, secondsLeft, type AuctionListing } from '@/lib/auctionListing';

const CYCLE_SECONDS = 25;
/** 3 roomier cards fit laptop screens better than a cramped 4-up row */
const ITEMS_PER_PAGE = 3;

/** "02:14:09", or "3d 4h" when more than a day is left. */
function formatTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00:00';
  const days = Math.floor(totalSeconds / 86_400);
  if (days > 0) return `${days}d ${Math.floor((totalSeconds % 86_400) / 3600)}h`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Live and upcoming auctions from the database. No sample lots, no restarted clocks on auctions that
 * have ended, and no made-up bid counts: when nothing is live the rail says so.
 */
export default function LiveReverseAuctionsRail() {
  const navigate = useNavigate();
  const [allAuctions, setAllAuctions] = useState<AuctionListing[]>([]);
  const [categoryNames, setCategoryNames] = useState<Map<string, string>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(CYCLE_SECONDS);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const totalPages = Math.max(1, Math.ceil(allAuctions.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (page > totalPages - 1) setPage(0);
  }, [page, totalPages]);

  useEffect(() => {
    getCategories().then((list) => setCategoryNames(new Map(list.map((c) => [c.id, c.name]))));
  }, []);

  // Live and upcoming auctions, as stored
  const fetchLiveAuctions = useCallback(async () => {
    setIsSyncing(true);
    const result = await getAuctionListings(60);
    const open = result.rows.filter((a) => !auctionPhase(a).ended);
    setAllAuctions(open);
    setLoaded(true);
    setIsSyncing(false);
  }, []);

  useEffect(() => {
    fetchLiveAuctions();
  }, [fetchLiveAuctions]);

  // Main 25-Second Auto-Rotation Loop
  useEffect(() => {
    const timer = setInterval(() => {
      if (isPaused || isHovered) return;

      setSecondsRemaining(prev => {
        if (prev <= 1) {
          // Advance to next page and trigger background live refresh
          setPage(currPage => (currPage + 1) % totalPages);
          fetchLiveAuctions();
          return CYCLE_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, isHovered, totalPages, fetchLiveAuctions]);

  // Tick the countdowns once a second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleNextPage = () => {
    setPage(p => (p + 1) % totalPages);
    setSecondsRemaining(CYCLE_SECONDS);
  };

  const handlePrevPage = () => {
    setPage(p => (p - 1 + totalPages) % totalPages);
    setSecondsRemaining(CYCLE_SECONDS);
  };

  const handleSelectPage = (targetIndex: number) => {
    setPage(targetIndex);
    setSecondsRemaining(CYCLE_SECONDS);
  };

  // The cards on the current page
  const startIndex = page * ITEMS_PER_PAGE;
  const displayAuctions = allAuctions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const progressPercent = ((CYCLE_SECONDS - secondsRemaining) / CYCLE_SECONDS) * 100;

  return (
    <section
      className="relative z-20 max-w-[1400px] mx-auto w-full px-4 sm:px-5 md:px-6 mb-8 sm:mb-12"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header — wraps cleanly on laptop widths */}
      <div className="flex flex-col gap-3 mb-3 sm:mb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Flame className="w-4 h-4 text-[#FF5A00] animate-bounce shrink-0" />
          <h2 className="text-xs sm:text-sm font-extrabold text-white tracking-wider uppercase flex items-center gap-2">
            Sell Products in 24 Hours
            <span className="text-[#FF5A00] font-black bg-[#FF5A00]/15 px-1.5 py-0.5 rounded text-[10px] border border-[#FF5A00]/30">
              HOT
            </span>
          </h2>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FF5A00]/15 border border-[#FF5A00]/30 text-white text-[11px] font-medium">
            <RefreshCw className={`w-3 h-3 text-[#FF5A00] ${isSyncing ? 'animate-spin' : ''}`} />
            <span>
              {!loaded ? (
                <span>Loading auctions…</span>
              ) : allAuctions.length === 0 ? (
                <span>No live auctions right now</span>
              ) : totalPages <= 1 ? (
                <span>{allAuctions.length} open {allAuctions.length === 1 ? 'auction' : 'auctions'}</span>
              ) : isHovered ? (
                <span className="text-orange-400 font-semibold">Paused on hover</span>
              ) : isPaused ? (
                <span className="text-orange-400 font-semibold">Feed Paused</span>
              ) : (
                <span>
                  Next batch in <strong className="text-[#FF5A00] font-mono font-bold">{secondsRemaining}s</strong>
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            aria-label={isPaused ? 'Resume 25s auto-cycle' : 'Pause 25s auto-cycle'}
            className="w-7 h-7 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition-all border border-neutral-700/80"
            title={isPaused ? 'Resume auto rotation' : 'Pause auto rotation'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          <div className="flex items-center gap-1.5 px-1 max-w-[140px] overflow-hidden">
            {Array.from({ length: Math.min(totalPages, 8) }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPage(idx)}
                aria-label={`Jump to auction batch ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 shrink-0 ${
                  idx === page
                    ? 'w-5 bg-[#FF5A00] shadow-[0_0_8px_rgba(255,90,0,0.6)]'
                    : 'w-2 bg-neutral-700 hover:bg-neutral-500'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevPage}
              aria-label="Previous auction batch"
              className="w-7 h-7 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition-all border border-neutral-700/80 active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextPage}
              aria-label="Next auction batch"
              className="w-7 h-7 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition-all border border-neutral-700/80 active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="h-4 w-px bg-neutral-800 hidden sm:block" />

          <Button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="bg-[#FF5A00] hover:bg-[#e04e00] text-white text-xs font-bold h-8 px-3 rounded-xl shadow-[0_2px_0_#922f00] flex items-center gap-1.5 shrink-0 transition-all active:translate-y-0.5 active:shadow-none"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden min-[420px]:inline">List Product in 24h</span>
            <span className="min-[420px]:hidden">List 24h</span>
          </Button>

          <Link
            to="/auctions"
            className="text-xs sm:text-sm font-bold text-[#FF5A00] hover:text-[#e04e00] flex items-center gap-1 transition-colors group shrink-0"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      <div className="w-full h-1 bg-neutral-800/80 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-orange-500 via-[#FF5A00] to-orange-400 transition-all duration-1000 ease-linear rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* 3 equal cards on desktop — readable on laptop; swipe on mobile */}
      {loaded && allAuctions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-700/80 bg-neutral-900/60 p-6 text-center">
          <p className="text-sm font-semibold text-white">No auctions are live right now.</p>
          <p className="text-xs text-neutral-400 mt-1">Have bulk stock to sell? List it and buyers can bid on it live.</p>
          <Button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="mt-3 bg-[#FF5A00] hover:bg-[#e04e00] text-white text-xs font-bold h-9 px-4 rounded-xl"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" /> List Product in 24h
          </Button>
        </div>
      ) : (
      <AnimatePresence mode="wait">
        <motion.div
          key={page}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="flex gap-3 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible sm:pb-0"
        >
          {displayAuctions.map((auction) => {
            const phase = auctionPhase(auction, now);
            const timeLeft = secondsLeft(auction.endTime, now);
            const detailPath = `/auctions/${auction.auctionType === 'forward' ? 'forward' : 'reverse'}/${auction.id}`;
            const price = auctionMoney(auction.startingPrice, auction.currency);
            const category = auction.categoryId ? categoryNames.get(auction.categoryId) : undefined;
            const showQuantity = auction.totalQuantity !== null;

            return (
              <div
                key={auction.id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(detailPath)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(detailPath);
                  }
                }}
                className="snap-start shrink-0 w-[78vw] max-w-[320px] sm:w-auto sm:max-w-none group bg-neutral-900/85 hover:bg-neutral-900 border border-neutral-800/90 hover:border-[#FF5A00]/60 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col cursor-pointer min-h-0"
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-neutral-950 shrink-0">
                  {auction.image ? (
                    <img
                      src={auction.image}
                      alt={auction.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-neutral-500">
                      <ImageOff className="w-7 h-7" />
                      <span className="text-[11px] font-medium">No photo from the seller</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent opacity-80" />

                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1.5 text-[10px] font-bold">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {phase.key === 'live' ? (
                        <span className="px-2 py-0.5 rounded-md bg-red-600 text-white font-extrabold flex items-center gap-1 shadow-sm shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          LIVE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-neutral-700 text-white font-extrabold shadow-sm shrink-0 uppercase">
                          {phase.label}
                        </span>
                      )}
                      {phase.key === 'live' && (
                        <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-white border border-neutral-700/80 font-mono flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3 text-[#FF5A1F]" />
                          {formatTime(timeLeft)}
                        </span>
                      )}
                    </div>
                    <span className="px-1.5 py-0.5 rounded-md bg-black/60 text-neutral-300 font-mono text-[9px] truncate max-w-[38%]">
                      {auction.auctionNumber}
                    </span>
                  </div>

                  {category && (
                    <div className="absolute bottom-2 left-2 max-w-[75%]">
                      <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-neutral-200 border border-neutral-700/60 text-[10px] font-semibold truncate inline-block max-w-full">
                        {category}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between gap-2.5 min-w-0">
                  <div className="min-w-0">
                    <h3 className="font-bold text-white text-sm group-hover:text-[#FF5A1F] transition-colors line-clamp-2 leading-snug">
                      {auction.title}
                    </h3>
                    {showQuantity && (
                      <div className="text-xs text-neutral-300 font-medium mt-1 truncate">
                        {auction.totalQuantity!.toLocaleString('en-IN')} {auction.quantityUnit}
                      </div>
                    )}
                    <div className="text-sm sm:text-base font-extrabold text-[#FF5A1F] mt-1 truncate">
                      {price ? `${price} / ${auction.quantityUnit}` : 'Starting price not stated'}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400 gap-2">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      {auction.deliveryLocation && (
                        <>
                          <MapPin className="w-3 h-3 text-[#FF5A1F] shrink-0" />
                          <span className="truncate">{auction.deliveryLocation}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1 font-semibold text-neutral-200 shrink-0">
                      <Users className="w-3 h-3 text-[#FF5A1F]" />
                      <span>{auction.totalBids} {auction.totalBids === 1 ? 'bid' : 'bids'}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>
      )}

      {/* Mobile Indicator Footer with Batch Label */}
      {allAuctions.length > 0 && (
        <div className="flex md:hidden items-center justify-between text-[11px] text-neutral-400 mt-2 px-1">
          <span>Batch {page + 1} of {totalPages} ({allAuctions.length} open {allAuctions.length === 1 ? 'auction' : 'auctions'})</span>
          <span className="text-[#FF5A00] font-medium">Swipe to browse cards</span>
        </div>
      )}

      {/* 24-Hour Product Listing Dialog */}
      <CreateReverseAuctionDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={() => {
          setIsCreateOpen(false);
          fetchLiveAuctions();
        }}
      />
    </section>
  );
}

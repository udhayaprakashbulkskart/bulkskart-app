import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, MessageSquareQuote, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/db/supabase';

/** A review a signed-in buyer left on a manufacturer (company_reviews). */
interface HomeReview {
  id: string;
  rating: number;
  review_text: string;
  order_id: string | null;
  created_at: string;
  reviewer: { full_name: string | null; avatar_url: string | null } | null;
  company: { company_name: string | null; slug: string | null } | null;
}

interface ReviewSummary {
  average: number;
  count: number;
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

async function loadReviews(): Promise<{ reviews: HomeReview[]; summary: ReviewSummary | null }> {
  try {
    const [{ data: rows }, { data: ratings, count }] = await Promise.all([
      supabase
        .from('company_reviews')
        .select('id,rating,review_text,order_id,created_at,reviewer:profiles!reviewer_id(full_name,avatar_url),company:companies!company_id(company_name,slug)')
        .not('review_text', 'is', null)
        .gte('rating', 4)
        .order('created_at', { ascending: false })
        .limit(12),
      supabase.from('company_reviews').select('rating', { count: 'exact' }).limit(1000),
    ]);
    const reviews = (Array.isArray(rows) ? rows : [])
      .map((r: any) => ({ ...r, reviewer: one(r.reviewer), company: one(r.company) }) as HomeReview)
      .filter((r) => r.review_text?.trim());
    const list = Array.isArray(ratings) ? ratings : [];
    const total = typeof count === 'number' ? count : list.length;
    const summary = list.length > 0
      ? { average: list.reduce((s: number, r: any) => s + Number(r.rating || 0), 0) / list.length, count: total }
      : null;
    return { reviews, summary };
  } catch {
    return { reviews: [], summary: null };
  }
}

export default function ReviewsHomeSection() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [reviews, setReviews] = useState<HomeReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);

  useEffect(() => {
    let alive = true;
    loadReviews().then((res) => {
      if (!alive) return;
      setReviews(res.reviews);
      setSummary(res.summary);
    });
    return () => { alive = false; };
  }, []);

  // Nothing to show until buyers have written reviews.
  if (reviews.length === 0) return null;

  const scroll = (direction: 'left' | 'right') => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollBy({ left: (direction === 'left' ? -1 : 1) * el.clientWidth * 0.75, behavior: 'smooth' });
  };

  return (
    <section className="relative z-20 py-10 md:py-14 bg-[#0B0F19] border-t border-border/80">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-5 md:px-6">

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-semibold mb-2.5">
              <MessageSquareQuote className="w-3.5 h-3.5" />
              <span>Buyer reviews</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              What buyers say about manufacturers
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl text-pretty">
              Recent reviews written by buyers on manufacturer profiles.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {summary && (
              <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-card border border-border/80">
                <div className="flex items-center gap-0.5 text-amber-400">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className={`w-4 h-4 ${i < Math.round(summary.average) ? 'fill-current' : ''}`} />
                  ))}
                </div>
                <div className="border-l border-border pl-2.5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-base sm:text-lg font-black text-foreground">{summary.average.toFixed(1)}</span>
                    <span className="text-[11px] text-muted-foreground">/ 5</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground hidden sm:block">
                    {summary.count.toLocaleString('en-IN')} {summary.count === 1 ? 'review' : 'reviews'}
                  </p>
                </div>
              </div>
            )}

            {reviews.length > 1 && (
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
            )}
          </div>
        </div>

        <div
          ref={carouselRef}
          className="flex items-stretch gap-4 sm:gap-5 overflow-x-auto pb-4 pt-1 scrollbar-none snap-x snap-mandatory overscroll-x-contain touch-pan-x -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {reviews.map((review) => {
            const name = review.reviewer?.full_name?.trim() || 'BulkSkart buyer';
            const companyName = review.company?.company_name?.trim();
            return (
              <div
                key={review.id}
                className="w-[290px] min-[420px]:w-[340px] md:w-[420px] shrink-0 snap-start bg-card border border-border/80 hover:border-primary/50 rounded-2xl p-5 sm:p-6 transition-all flex flex-col justify-between shadow-sm hover:shadow-[0_8px_24px_rgba(255,90,0,0.12)]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1 text-amber-400" aria-label={`${review.rating} out of 5`}>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'fill-current' : ''}`} />
                      ))}
                    </div>
                    {review.order_id && (
                      <Badge variant="outline" className="text-[10px] font-semibold border-primary/30 text-primary bg-primary/10">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Verified order
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs sm:text-[13px] text-foreground/90 leading-relaxed italic mb-4 line-clamp-4">
                    "{review.review_text.trim()}"
                  </p>
                </div>

                <div className="pt-3.5 border-t border-border/60 flex items-center justify-between gap-3 mt-auto">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {review.reviewer?.avatar_url ? (
                      <img
                        src={review.reviewer.avatar_url}
                        alt=""
                        loading="lazy"
                        className="w-9 h-9 rounded-full object-cover border border-border shrink-0"
                      />
                    ) : (
                      <span className="w-9 h-9 rounded-full bg-primary/15 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{name}</p>
                      {companyName && (
                        <p className="text-[10.5px] text-muted-foreground truncate">
                          Reviewed{' '}
                          {review.company?.slug ? (
                            <Link to={`/companies/${review.company.slug}`} className="text-foreground/80 hover:text-primary">
                              {companyName}
                            </Link>
                          ) : (
                            <span className="text-foreground/80">{companyName}</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(review.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

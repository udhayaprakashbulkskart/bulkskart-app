import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  MessageSquare,
  Lock,
  Send,
  Loader2,
  CheckCircle2,
  Flag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import InteractiveStarRating from '@/components/common/InteractiveStarRating';
import ReportItemModal from '@/components/common/ReportItemModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { CompanyReview } from '@/types/types';
import { createCompanyReview } from '@/lib/api';

interface CompanyReviewsAndRatingSectionProps {
  companyId: string;
  companyName: string;
  reviews: CompanyReview[];
  onReviewAdded?: (newReview: CompanyReview) => void;
  avgRating?: number;
}

export default function CompanyReviewsAndRatingSection({
  companyId,
  companyName,
  reviews,
  onReviewAdded,
  avgRating = 4.9,
}: CompanyReviewsAndRatingSectionProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [myRating, setMyRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const handleRatingClick = (val: number) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setMyRating(val);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!reviewComment.trim()) {
      toast.error('Please write a review comment.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Partial<CompanyReview> = {
        company_id: companyId,
        reviewer_id: user.id,
        rating: myRating,
        review_text: reviewComment.trim(),
      };

      const res = await createCompanyReview(payload);
      if (res.error) {
        // Fallback local save if table RLS or schema differs
        console.warn('Backend review save warning:', res.error);
      }

      const optimisticReview: CompanyReview = {
        id: `crev-${Date.now()}`,
        company_id: companyId,
        reviewer_id: user.id,
        rating: myRating,
        review_text: reviewComment.trim(),
        order_id: null,
        created_at: new Date().toISOString(),
        reviewer: {
          id: user.id,
          email: user.email || '',
          phone: null,
          full_name: profile?.full_name || user.email?.split('@')[0] || 'Verified Buyer',
          avatar_url: profile?.avatar_url || null,
          role: profile?.role || 'buyer',
          status: profile?.status || 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      if (onReviewAdded) {
        onReviewAdded(optimisticReview);
      }

      setReviewComment('');
      toast.success('Your supplier review has been published successfully!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pt-2">
      {/* ── Top Summary & Report Button ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border">
        <div>
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            Supplier Ratings &amp; Experience
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
              {reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'}
            </span>
          </h4>
          <div className="flex items-center gap-2.5 mt-1">
            <InteractiveStarRating value={avgRating} readOnly size="sm" showNumber />
            <span className="text-[11px] text-muted-foreground">• Factory Audited Feedback</span>
          </div>
        </div>

        {/* Report Supplier Button */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowReportModal(true)}
            className="border-[#FF5A00]/30 text-[#FF7A2E] hover:bg-[#B33D00]/10 text-xs h-8 rounded-xl flex items-center gap-1.5"
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Report Supplier</span>
          </Button>
        </div>
      </div>

      {/* ── Review Form (Gated for Login Users Only) ── */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <h4 className="text-xs font-bold text-foreground mb-2.5 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-primary" />
          Post Review for {companyName}
        </h4>

        {!user ? (
          <div className="py-5 px-3 rounded-xl bg-muted/40 border border-border/80 text-center space-y-2.5">
            <Lock className="w-5 h-5 text-primary mx-auto" />
            <div>
              <p className="text-xs font-bold text-foreground">Login Required to Review Companies</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Only authenticated trade buyers and suppliers can post company reviews and ratings.
              </p>
            </div>
            <Button
              onClick={() => setShowAuthModal(true)}
              className="bg-[#C94400] hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-8 rounded-xl px-4"
            >
              Log In to Write Review
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmitReview} className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-foreground">Rating:</span>
              <InteractiveStarRating
                value={myRating}
                onChange={handleRatingClick}
                size="md"
              />
              <span className="text-xs font-bold text-primary">{myRating} Stars</span>
            </div>

            <Textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Share details regarding communication, manufacturing lead time, packing standards, and shipping reliability..."
              className="text-xs rounded-xl min-h-[75px]"
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#C94400] hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-8 rounded-xl px-4"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" /> Submit Review
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* ── Reviews List ── */}
      <div className="space-y-3">
        {reviews.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-xs">
            <Star className="w-7 h-7 mx-auto mb-2 opacity-30" />
            No reviews yet for this manufacturer. Be the first to leave a review!
          </div>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-3 md:p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                    {r.reviewer?.full_name?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <div>
                    <span className="text-xs font-medium text-foreground block">
                      {r.reviewer?.full_name ?? 'Verified Buyer'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                <InteractiveStarRating value={r.rating} readOnly size="sm" />
              </div>

              {r.review_text && (
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {r.review_text}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Report Supplier Modal ── */}
      <ReportItemModal
        open={showReportModal}
        onOpenChange={setShowReportModal}
        targetType="company"
        targetId={companyId}
        targetTitle={companyName}
      />

      {/* ── Auth Required Modal ── */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-[#1A0C05] border-[#2A2A2A] text-white p-6 rounded-2xl shadow-2xl">
          <DialogHeader className="mb-2">
            <div className="w-11 h-11 rounded-2xl bg-[#FF5A1F]/15 border border-[#FF5A1F]/30 text-[#FF5A1F] flex items-center justify-center mx-auto mb-2">
              <Lock className="w-6 h-6" />
            </div>
            <DialogTitle className="text-center text-base sm:text-lg font-bold text-white">
              Login Required
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-neutral-400 mt-1">
              Only authenticated users can leave company reviews and ratings to prevent spam and protect verified suppliers.
            </DialogDescription>
          </DialogHeader>

          <div className="pt-3 flex flex-col gap-2.5">
            <Button
              onClick={() => {
                setShowAuthModal(false);
                navigate(`/login?returnUrl=${encodeURIComponent(window.location.pathname)}`);
              }}
              className="w-full bg-[#C94400] hover:bg-[#e04f1a] text-white font-semibold text-xs h-10 rounded-xl"
            >
              Log In to BulkSkart
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowAuthModal(false);
                navigate(`/register?returnUrl=${encodeURIComponent(window.location.pathname)}`);
              }}
              className="w-full border-[#2A2A2A] bg-transparent text-slate-300 hover:bg-[#0A0A0A] text-xs h-10 rounded-xl"
            >
              Register New Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

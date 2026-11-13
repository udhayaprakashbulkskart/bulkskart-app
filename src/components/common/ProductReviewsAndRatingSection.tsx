import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Star,
  ShieldCheck,
  MessageSquare,
  AlertTriangle,
  Lock,
  Send,
  Loader2,
  CheckCircle2,
  Flag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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

export interface ProductReviewItem {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title?: string;
  comment: string;
  createdAt: string;
  isVerifiedBuyer: boolean;
}

interface ProductReviewsAndRatingSectionProps {
  productId: string;
  productName: string;
  initialRating?: number;
  initialReviewCount?: number;
}

export default function ProductReviewsAndRatingSection({
  productId,
  productName,
  initialRating = 4.8,
  initialReviewCount = 0,
}: ProductReviewsAndRatingSectionProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [reviews, setReviews] = useState<ProductReviewItem[]>(() => {
    const saved = localStorage.getItem(`bs_prod_reviews_${productId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [myRating, setMyRating] = useState<number>(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Compute average rating
  const totalCount = reviews.length;
  const avgRating = totalCount > 0
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / totalCount
    : (initialReviewCount > 0 ? initialRating : 0);

  const handleRatingClick = (val: number) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setMyRating(val);
  };

  const handleSubmitReview = (e: React.FormEvent) => {
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
    setTimeout(() => {
      const newReview: ProductReviewItem = {
        id: `prev-${Date.now()}`,
        productId,
        userId: user.id,
        userName: profile?.full_name || user.email?.split('@')[0] || 'Verified Buyer',
        userAvatar: profile?.avatar_url || undefined,
        rating: myRating,
        title: reviewTitle.trim() || undefined,
        comment: reviewComment.trim(),
        createdAt: new Date().toISOString(),
        isVerifiedBuyer: true,
      };

      const updated = [newReview, ...reviews];
      setReviews(updated);
      localStorage.setItem(`bs_prod_reviews_${productId}`, JSON.stringify(updated));

      setReviewComment('');
      setReviewTitle('');
      setSubmitting(false);
      toast.success('Your review & rating have been published successfully!');
    }, 500);
  };

  return (
    <div className="space-y-6 pt-2">
      {/* ── Top Summary & Report Button ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-card border border-border">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            Ratings &amp; Verified Reviews
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
              {totalCount} {totalCount === 1 ? 'Review' : 'Reviews'}
            </span>
          </h3>
          <div className="flex items-center gap-3 mt-1.5">
            <InteractiveStarRating value={avgRating} readOnly size="md" showNumber />
            <span className="text-xs text-muted-foreground">• Verified B2B Purchasers</span>
          </div>
        </div>

        {/* Report Button (Fully Functional) */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowReportModal(true)}
            className="border-[#FF5A00]/30 text-[#FF7A2E] hover:bg-[#B33D00]/10 text-xs h-9 rounded-xl flex items-center gap-1.5"
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Report Product</span>
          </Button>
        </div>
      </div>

      {/* ── Rating & Review Submission Form (Login Gated) ── */}
      <div className="p-4 sm:p-6 rounded-2xl bg-card border border-border">
        <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          Write a Review &amp; Comment
        </h4>

        {!user ? (
          /* GUEST / NOT LOGGED IN STATE */
          <div className="py-6 px-4 rounded-xl bg-muted/40 border border-border/80 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Login Required to Post Reviews</p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-sm mx-auto">
                Only authenticated verified buyers and suppliers can submit ratings, product feedback, and reviews.
              </p>
            </div>
            <div>
              <Button
                onClick={() => setShowAuthModal(true)}
                className="bg-[#C94400] hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9 rounded-xl px-5"
              >
                Log In to Review
              </Button>
            </div>
          </div>
        ) : (
          /* AUTHENTICATED USER REVIEW FORM */
          <form onSubmit={handleSubmitReview} className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Your Rating:
              </label>
              <div className="flex items-center gap-3">
                <InteractiveStarRating
                  value={myRating}
                  onChange={handleRatingClick}
                  size="lg"
                />
                <span className="text-xs font-bold text-primary">
                  {myRating} / 5 Stars
                </span>
              </div>
            </div>

            <div>
              <Input
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                placeholder="Review Headline / Summary (Optional, e.g. 'Great quality raw materials and fast shipping')"
                className="text-xs h-9 rounded-xl"
              />
            </div>

            <div>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your experience regarding manufacturing quality, packaging, lead time, and compliance..."
                className="text-xs rounded-xl min-h-[85px]"
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#C94400] hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9 rounded-xl px-4"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Publishing...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" /> Submit Verified Review
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* ── Reviews Feed List ── */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Community Feedback ({reviews.length})
        </h4>

        {reviews.length === 0 ? (
          <div className="text-center py-10 bg-muted/20 rounded-2xl border border-border/50">
            <Star className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">No customer reviews yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Be the first verified buyer to rate and review this product.
            </p>
          </div>
        ) : (
          reviews.map((rev) => (
            <div
              key={rev.id}
              className="p-4 rounded-xl bg-card border border-border space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs border border-primary/20">
                    {rev.userName[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground">{rev.userName}</span>
                      {rev.isVerifiedBuyer && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#FF7A2E] dark:text-[#FF7A2E]">
                          <CheckCircle2 className="w-3 h-3" /> Verified Buyer
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(rev.createdAt).toLocaleDateString('en-US', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                <InteractiveStarRating value={rev.rating} readOnly size="sm" />
              </div>

              {rev.title && (
                <p className="text-xs font-bold text-foreground">{rev.title}</p>
              )}

              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {rev.comment}
              </p>
            </div>
          ))
        )}
      </div>

      {/* ── Report Product Modal ── */}
      <ReportItemModal
        open={showReportModal}
        onOpenChange={setShowReportModal}
        targetType="product"
        targetId={productId}
        targetTitle={productName}
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
              To ensure authentic reviews and protect marketplace integrity, only logged-in users can rate products and post comments.
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
              Log In to Your Account
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowAuthModal(false);
                navigate(`/register?returnUrl=${encodeURIComponent(window.location.pathname)}`);
              }}
              className="w-full border-[#2A2A2A] bg-transparent text-slate-300 hover:bg-[#0A0A0A] text-xs h-10 rounded-xl"
            >
              Create Free Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

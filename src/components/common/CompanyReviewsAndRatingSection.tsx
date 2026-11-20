import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Flag, Loader2, Lock, LogIn, MessageSquare, Send, Star, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import InteractiveStarRating from '@/components/common/InteractiveStarRating';
import ReportItemModal from '@/components/common/ReportItemModal';
import { Actions, CountedTextArea, Field, RatingPicker } from '@/components/formkit';
import type { CompanyReview } from '@/types/types';
import { createCompanyReview } from '@/lib/api';

interface CompanyReviewsAndRatingSectionProps {
  companyId: string;
  companyName: string;
  reviews: CompanyReview[];
  onReviewAdded?: (newReview: CompanyReview) => void;
  /** the supplier's stored average rating; 0 or missing when it has none */
  avgRating?: number;
  /** set when the section is shown on a product page, so the wording says the reviews are about the supplier */
  productName?: string;
}

/**
 * Reviews of a supplier: the list, a form to add one (signed-in members only) and a way to report the supplier.
 * A review is shown as posted only once it has been saved.
 */
export default function CompanyReviewsAndRatingSection({
  companyId,
  companyName,
  reviews,
  onReviewAdded,
  avgRating = 0,
  productName,
}: CompanyReviewsAndRatingSectionProps) {
  const { user, profile } = useAuth();
  const ids = useId();

  const [myRating, setMyRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const listed = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  const rating = avgRating > 0 ? avgRating : listed;
  const back = typeof window !== 'undefined' ? encodeURIComponent(window.location.pathname) : '';

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (reviewComment.trim().length < 10) {
      setCommentError('Please write at least 10 characters about your experience.');
      document.getElementById(`${ids}-comment`)?.focus();
      return;
    }

    setSubmitting(true);
    const text = reviewComment.trim();
    const { error } = await createCompanyReview({ company_id: companyId, reviewer_id: user.id, rating: myRating, review_text: text });
    setSubmitting(false);
    if (error) {
      toast.error('Your review could not be posted. Please try again.');
      return;
    }

    const now = new Date().toISOString();
    onReviewAdded?.({
      id: `crev-${Date.now()}`,
      company_id: companyId,
      reviewer_id: user.id,
      rating: myRating,
      review_text: text,
      order_id: null,
      created_at: now,
      reviewer: {
        id: user.id,
        email: user.email || '',
        phone: null,
        full_name: profile?.full_name || user.email?.split('@')[0] || 'BulkSkart member',
        avatar_url: profile?.avatar_url || null,
        role: profile?.role || 'buyer',
        status: profile?.status || 'active',
        created_at: now,
        updated_at: now,
      },
    });
    setReviewComment('');
    setMyRating(5);
    toast.success('Your review has been posted.');
  };

  return (
    <div className="space-y-5 pt-2">
      {/* ── summary and report ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-foreground flex flex-wrap items-center gap-2">
            {productName ? 'Supplier Reviews' : 'Supplier Ratings & Experience'}
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
              {reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'}
            </span>
          </h4>
          <div className="flex items-center gap-2.5 mt-1">
            {rating > 0 ? (
              <>
                <InteractiveStarRating value={rating} readOnly size="sm" />
                <span className="text-xs font-bold text-foreground">{rating.toFixed(1)} / 5</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">No ratings yet</span>
            )}
          </div>
          {productName && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Reviews on BulkSkart are about the supplier. Bought {productName}? Tell others how {companyName} handled your order.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowReportModal(true)}
            className="border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs h-9 rounded-xl flex items-center gap-1.5"
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Report Supplier</span>
          </Button>
        </div>
      </div>

      {/* ── write a review ── */}
      <div className="fk-form p-4 sm:p-5 rounded-xl bg-card border border-border">
        <h4 className="fk-section" style={{ marginBottom: 14 }}>
          Review {companyName}
        </h4>

        {!user ? (
          <div className="fk-stack items-center text-center py-2">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">Log in to write a review</p>
              <p className="text-xs text-muted-foreground mt-1">Only signed-in members can rate suppliers, which keeps reviews genuine.</p>
            </div>
            <Actions className="is-inline w-full sm:justify-center">
              <Link to={`/login?returnUrl=${back}`} className="fk-btn is-primary">
                <LogIn aria-hidden="true" /> Log In
              </Link>
              <Link to={`/register?returnUrl=${back}`} className="fk-btn is-ghost">
                <UserPlus aria-hidden="true" /> Create Account
              </Link>
            </Actions>
          </div>
        ) : (
          <form onSubmit={handleSubmitReview} noValidate className="fk-stack">
            <div className="fk-field">
              <span id={`${ids}-rating-label`} className="text-[0.93rem] font-bold leading-tight text-foreground">
                Your rating
                <span className="fk-req" aria-hidden="true">
                  *
                </span>
              </span>
              <RatingPicker id={`${ids}-rating`} value={myRating} onChange={setMyRating} labelledBy={`${ids}-rating-label`} />
            </div>

            <Field htmlFor={`${ids}-comment`} label="Your review" required error={commentError}>
              <CountedTextArea
                id={`${ids}-comment`}
                icon={FileText}
                rows={4}
                maxLength={1000}
                value={reviewComment}
                onChange={(e) => {
                  setReviewComment(e.target.value);
                  if (commentError) setCommentError('');
                }}
                placeholder="How was communication, quality, packing, lead time and delivery?"
                invalid={Boolean(commentError)}
                aria-describedby={commentError ? `${ids}-comment-error` : undefined}
              />
            </Field>

            <Actions className="is-inline">
              <button type="submit" className="fk-btn is-primary" disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                {submitting ? 'Posting…' : 'Post Review'}
              </button>
            </Actions>
          </form>
        )}
      </div>

      {/* ── reviews ── */}
      <div className="space-y-3">
        {reviews.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-xs">
            <Star className="w-7 h-7 mx-auto mb-2 opacity-30" aria-hidden="true" />
            No reviews yet for this supplier.
          </div>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-3 md:p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                    {r.reviewer?.full_name?.[0]?.toUpperCase() ?? <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-foreground block truncate">{r.reviewer?.full_name ?? 'BulkSkart member'}</span>
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

              {r.review_text && <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{r.review_text}</p>}
            </div>
          ))
        )}
      </div>

      <ReportItemModal open={showReportModal} onOpenChange={setShowReportModal} targetType="company" targetId={companyId} targetTitle={companyName} />
    </div>
  );
}

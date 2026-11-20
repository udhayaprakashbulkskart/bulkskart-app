import React, { useEffect, useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import CompanyReviewsAndRatingSection from '@/components/common/CompanyReviewsAndRatingSection';
import { getCompanyReviews } from '@/lib/api';
import type { CompanyReview } from '@/types/types';

interface ProductReviewsAndRatingSectionProps {
  productId: string;
  productName: string;
  /** the supplier that sells the product; reviews on BulkSkart are kept per supplier */
  companyId?: string | null;
  companyName?: string | null;
  /** the supplier's stored average rating, if it has one */
  companyRating?: number | null;
}

/**
 * The Reviews tab of a product page. BulkSkart keeps reviews per supplier, so this shows and collects reviews of the
 * supplier that sells the product (the same ones as on the supplier's profile).
 */
export default function ProductReviewsAndRatingSection({ productName, companyId, companyName, companyRating }: ProductReviewsAndRatingSectionProps) {
  const [reviews, setReviews] = useState<CompanyReview[]>([]);
  const [loading, setLoading] = useState(Boolean(companyId));

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    getCompanyReviews(companyId)
      .then((rows) => {
        if (active) setReviews(rows);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [companyId]);

  if (!companyId) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-xs">
        <Star className="w-7 h-7 mx-auto mb-2 opacity-30" aria-hidden="true" />
        Reviews are not available for this product.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground" role="status">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading reviews…
      </div>
    );
  }

  return (
    <CompanyReviewsAndRatingSection
      companyId={companyId}
      companyName={companyName || 'this supplier'}
      reviews={reviews}
      onReviewAdded={(review) => setReviews((prev) => [review, ...prev])}
      avgRating={Number(companyRating) || 0}
      productName={productName}
    />
  );
}

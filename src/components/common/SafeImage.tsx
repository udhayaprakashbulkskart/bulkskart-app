import React, { useState, useEffect } from 'react';
import { Package, Building2, ImageIcon } from 'lucide-react';
import { resolveCompanyBranding, resolveRfqImage, resolveProductImage, generateIsolatedProductFallback, isGenericImage } from '@/lib/contentImages';
import { resolveProductImageBackend } from '@/lib/pixabay';

/**
 * Converts image URL (especially Unsplash) to modern WebP format
 */
export function toWebPUrl(url?: string | null, width: number = 450): string {
  if (!url) return '';
  if (url.includes('images.unsplash.com')) {
    try {
      const u = new URL(url);
      u.searchParams.set('fm', 'webp');
      u.searchParams.set('auto', 'format,compress');
      u.searchParams.set('q', '75');
      if (width) {
        u.searchParams.set('w', String(width));
      }
      return u.toString();
    } catch {
      let res = url;
      if (res.includes('format=')) {
        res = res.replace(/format=[a-zA-Z0-9]+/, 'format=webp');
      } else {
        res += (res.includes('?') ? '&' : '?') + 'format=webp';
      }
      if (!res.includes('fm=webp')) {
        res += '&fm=webp';
      }
      if (!res.includes('q=')) {
        res += '&q=75';
      }
      if (width && !res.includes('w=')) {
        res += '&w=' + width;
      }
      return res;
    }
  }
  return url;
}

/**
 * Builds responsive WebP srcset for Unsplash images
 */
export function buildWebPSrcSet(url?: string | null): string | undefined {
  if (!url || !url.includes('images.unsplash.com')) return undefined;
  const widths = [240, 360, 480, 640, 800];
  return widths.map(w => `${toWebPUrl(url, w)} ${w}w`).join(', ');
}

export function getCategoryFallbackImage(categoryName?: string | null, altText?: string, type?: 'product' | 'company' | 'rfq' | 'banner'): string {
  if (type === 'company') {
    return resolveCompanyBranding({ company_name: altText || 'Verified Supplier', industry: categoryName || undefined }).logo;
  }
  if (type === 'banner') {
    return resolveCompanyBranding({ company_name: altText || 'Verified Supplier', industry: categoryName || undefined }).banner;
  }
  if (type === 'rfq') {
    return resolveRfqImage({ title: altText, category: categoryName });
  }
  return '';
}

interface SafeImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  alt: string;
  category?: string | null;
  productId?: string;
  hasSellerImages?: boolean;
  isDuplicateOnPage?: boolean;
  isRepresentativeImage?: boolean;
  fallbackType?: 'product' | 'company' | 'rfq' | 'banner';
  type?: string;
  fallbackSrc?: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  showRepresentativeBadge?: boolean;
}

export default function SafeImage({
  src,
  alt,
  category,
  productId,
  hasSellerImages = false,
  isDuplicateOnPage = false,
  isRepresentativeImage,
  fallbackType = 'product',
  type,
  fallbackSrc,
  className = '',
  priority = false,
  sizes,
  showRepresentativeBadge,
  ...props
}: SafeImageProps) {
  const effectiveFallbackType = (type === 'banner' || fallbackType === 'banner')
    ? 'banner'
    : (type === 'company' || fallbackType === 'company')
    ? 'company'
    : (type === 'rfq' || fallbackType === 'rfq')
    ? 'rfq'
    : 'product';

  const isProduct = effectiveFallbackType === 'product';

  // For products: ensure we always have an authentic commodity photo (never empty, never blank placeholder)
  const usable = (url?: string | null) => (url && !isGenericImage(url) ? url : '');

  const getInitialUrl = () => {
    const direct = usable(src);
    if (isProduct) {
      if (direct) return toWebPUrl(direct);
      const matched = usable(resolveProductImage({ name: alt, title: alt, category, image: src }));
      return toWebPUrl(matched) || generateIsolatedProductFallback(alt, category || undefined);
    }
    const nonProduct = direct
      || usable(fallbackSrc)
      || usable(getCategoryFallbackImage(category, alt, effectiveFallbackType));
    return toWebPUrl(nonProduct) || generateIsolatedProductFallback(alt, category || undefined);
  };

  const initialUrl = getInitialUrl();
  const [imgSrc, setImgSrc] = useState<string>(initialUrl);
  const [hasError, setHasError] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [loading, setLoading] = useState(Boolean(initialUrl));
  const [isStockResolved, setIsStockResolved] = useState<boolean>(
    Boolean(isRepresentativeImage || (!hasSellerImages && isFallbackOrStock(initialUrl)))
  );

  function isFallbackOrStock(url?: string | null): boolean {
    if (!url) return false;
    return (
      url.includes('images.unsplash.com') ||
      url.includes('pixabay.com') ||
      url.includes('cdn.pixabay.com') ||
      url.includes('/representative/')
    );
  }

  // Effect to resolve backend Pixabay image only if no client-side commodity image was matched
  useEffect(() => {
    let isMounted = true;

    // Skip backend request if already resolved to a valid authentic photo
    if (
      isProduct &&
      productId &&
      !hasSellerImages &&
      (!imgSrc || imgSrc.startsWith('data:image/svg') || isGenericImage(imgSrc))
    ) {
      resolveProductImageBackend(productId, alt, category || undefined).then((res) => {
        if (!isMounted) return;
        if (res.has_image && res.url) {
          setImgSrc(res.url);
          setIsStockResolved(true);
          setHasError(false);
          setLoading(false);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [productId, alt, category, hasSellerImages, imgSrc, isProduct]);

  useEffect(() => {
    const nextUrl = getInitialUrl();
    setImgSrc(nextUrl);
    setHasError(false);
    setErrorCount(0);
    setLoading(Boolean(nextUrl));
    setIsStockResolved(Boolean(isRepresentativeImage || (!hasSellerImages && isFallbackOrStock(nextUrl))));
  }, [src, fallbackSrc, isRepresentativeImage, hasSellerImages, isProduct, category, alt, effectiveFallbackType]);

  const handleError = () => {
    if (errorCount === 0) {
      // First error fallback: try commodity match or category branding
      setErrorCount(1);
      if (isProduct) {
        const fallback = resolveProductImage({ name: alt, title: alt, category });
        if (fallback && fallback !== imgSrc && !isGenericImage(fallback)) {
          setImgSrc(fallback);
          setLoading(false);
          return;
        }
      } else if (effectiveFallbackType === 'company') {
        const brandLogo = resolveCompanyBranding({ company_name: alt, industry: category || undefined }).logo;
        if (brandLogo && brandLogo !== imgSrc && !isGenericImage(brandLogo)) {
          setImgSrc(brandLogo);
          setLoading(false);
          return;
        }
      } else if (effectiveFallbackType === 'rfq') {
        const rfqImg = resolveRfqImage({ title: alt, category });
        if (rfqImg && rfqImg !== imgSrc && !isGenericImage(rfqImg)) {
          setImgSrc(rfqImg);
          setLoading(false);
          return;
        }
      }
    }
    
    // Final foolproof fallback: isolated SVG commodity banner (never blank or missing)
    if (isProduct) {
      setImgSrc(generateIsolatedProductFallback(alt, category || undefined));
      setHasError(false);
    } else {
      const fallbackCat = getCategoryFallbackImage(category, alt, effectiveFallbackType);
      if (fallbackCat && fallbackCat !== imgSrc && !isGenericImage(fallbackCat)) {
        setImgSrc(fallbackCat);
        setHasError(false);
      } else {
        setImgSrc(generateIsolatedProductFallback(alt, category || undefined));
        setHasError(false);
      }
    }
    setLoading(false);
  };

  const handleLoad = () => {
    setLoading(false);
  };

  if (hasError && !imgSrc) {
    return (
      <div className={`bg-[#0A0A0A] border border-[#2A2A2A] flex flex-col items-center justify-center text-neutral-400 p-2 text-center text-xs ${className}`}>
        {effectiveFallbackType === 'company' ? (
          <Building2 className="w-6 h-6 mb-1 text-[#FF5A00]" />
        ) : (
          <ImageIcon className="w-6 h-6 mb-1 text-[#FF5A00]" />
        )}
        <span className="text-[10px] font-semibold text-slate-300 line-clamp-1">{alt}</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden w-full h-full ${className}`}>
      {loading && (
        <div className="absolute inset-0 bg-muted/60 backdrop-blur-[2px] animate-pulse z-10 flex items-center justify-center">
          <Package className="w-6 h-6 text-muted-foreground/30 animate-bounce" />
        </div>
      )}
      <img
        src={imgSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onError={handleError}
        onLoad={handleLoad}
        sizes={sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'}
        srcSet={buildWebPSrcSet(imgSrc)}
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          loading ? 'opacity-0' : 'opacity-100'
        }`}
        {...props}
      />
    </div>
  );
}

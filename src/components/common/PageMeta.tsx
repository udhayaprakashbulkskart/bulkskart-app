import React, { useEffect } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';

export interface BreadcrumbItem {
  name: string;
  item: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface PageMetaProps {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  robots?: string;
  ogType?: 'website' | 'business.business' | 'product' | 'article' | 'profile';
  ogImage?: string;
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
  twitterImage?: string;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  breadcrumbs?: BreadcrumbItem[];
  faq?: FAQItem[];
}

const DEFAULT_IMAGE = 'https://www.bulkskart.com/brand/bulkskart-logo.jpg';
const SITE_NAME = 'BulkSkart';
const BASE_URL = 'https://www.bulkskart.com';

// Tracking parameters that must be stripped from canonical URLs
const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'ref',
  'srsltid',
  'msclkid',
  '_ga',
];

function sanitizeCanonicalUrl(rawCanonical?: string): string {
  try {
    let url: URL;
    if (rawCanonical) {
      url = rawCanonical.startsWith('http')
        ? new URL(rawCanonical)
        : new URL(`${BASE_URL}${rawCanonical.startsWith('/') ? rawCanonical : `/${rawCanonical}`}`);
    } else if (typeof window !== 'undefined') {
      url = new URL(window.location.pathname, BASE_URL);
    } else {
      url = new URL('/', BASE_URL);
    }

    // Strip known tracking query params
    TRACKING_PARAMS.forEach((param) => url.searchParams.delete(param));

    // Remove trailing slash for non-root paths to prevent canonical duplication
    let cleanPath = url.pathname;
    if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
      cleanPath = cleanPath.slice(0, -1);
    }

    const search = url.search;
    return `${BASE_URL}${cleanPath}${search}`;
  } catch {
    return rawCanonical?.startsWith('http') ? rawCanonical : `${BASE_URL}${rawCanonical || '/'}`;
  }
}

export default function PageMeta({
  title,
  description,
  keywords,
  canonical,
  robots = 'index, follow',
  ogType = 'website',
  ogImage,
  twitterCard = 'summary_large_image',
  twitterImage,
  jsonLd,
  breadcrumbs,
  faq,
}: PageMetaProps) {
  useEffect(() => {
    // 1. Formatted Title
    const formattedTitle = title.toLowerCase().includes('bulkskart') ? title : `${title} | BulkSkart`;
    document.title = formattedTitle;

    const setMetaTag = (attr: 'name' | 'property', attrVal: string, content: string) => {
      let tag = document.querySelector(`meta[${attr}="${attrVal}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attr, attrVal);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    // 2. Standard SEO Meta
    if (description) {
      setMetaTag('name', 'description', description);
    }
    if (keywords) {
      setMetaTag('name', 'keywords', keywords);
    }
    setMetaTag('name', 'robots', robots);

    // 3. Open Graph
    setMetaTag('property', 'og:title', formattedTitle);
    if (description) setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:type', ogType);
    setMetaTag('property', 'og:site_name', SITE_NAME);

    const activeImage = ogImage
      ? (ogImage.startsWith('http') ? ogImage : `${BASE_URL}${ogImage.startsWith('/') ? ogImage : `/${ogImage}`}`)
      : DEFAULT_IMAGE;
    setMetaTag('property', 'og:image', activeImage);
    setMetaTag('property', 'og:image:alt', formattedTitle);
    setMetaTag('property', 'og:image:width', '1200');
    setMetaTag('property', 'og:image:height', '630');
    setMetaTag('property', 'og:locale', 'en_IN');

    const fullCanonical = sanitizeCanonicalUrl(canonical);
    setMetaTag('property', 'og:url', fullCanonical);

    const setLink = (rel: string, href: string, extra?: Record<string, string>) => {
      const selector = extra?.hreflang
        ? `link[rel="${rel}"][hreflang="${extra.hreflang}"]`
        : `link[rel="${rel}"]:not([hreflang])`;
      let node = document.querySelector(selector);
      if (!node) {
        node = document.createElement('link');
        node.setAttribute('rel', rel);
        if (extra) {
          Object.entries(extra).forEach(([k, v]) => node!.setAttribute(k, v));
        }
        document.head.appendChild(node);
      }
      node.setAttribute('href', href);
    };
    setLink('alternate', fullCanonical, { hreflang: 'en-IN' });
    setLink('alternate', fullCanonical, { hreflang: 'x-default' });

    // 4. Twitter Card
    setMetaTag('name', 'twitter:card', twitterCard);
    setMetaTag('name', 'twitter:site', '@bulkskart');
    setMetaTag('name', 'twitter:title', formattedTitle);
    if (description) setMetaTag('name', 'twitter:description', description);
    setMetaTag('name', 'twitter:image', twitterImage || activeImage);

    // 5. Canonical Link
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', fullCanonical);

    // 6. JSON-LD Structured Data
    const scriptId = 'bulkskart-dynamic-jsonld';
    let scriptTag = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = scriptId;
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }

    // Build consolidated schema array
    const schemas: Array<Record<string, unknown>> = [];

    // Optional BreadcrumbList Schema
    if (breadcrumbs && breadcrumbs.length > 0) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((b, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: b.name,
          item: b.item.startsWith('http') ? b.item : `${BASE_URL}${b.item.startsWith('/') ? b.item : `/${b.item}`}`,
        })),
      });
    }

    // Optional FAQPage Schema
    if (faq && faq.length > 0) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      });
    }

    // Custom Schemas
    if (jsonLd) {
      if (Array.isArray(jsonLd)) {
        schemas.push(...jsonLd);
      } else {
        schemas.push(jsonLd);
      }
    }

    if (schemas.length > 0) {
      scriptTag.textContent = JSON.stringify(schemas.length === 1 ? schemas[0] : schemas);
    } else {
      scriptTag.textContent = '';
    }

    // Cleanup on unmount
    return () => {
      const currentScript = document.getElementById(scriptId);
      if (currentScript) {
        currentScript.textContent = '';
      }
    };
  }, [
    title,
    description,
    keywords,
    canonical,
    robots,
    ogType,
    ogImage,
    twitterCard,
    twitterImage,
    jsonLd,
    breadcrumbs,
    faq,
  ]);

  return null;
}

export const AppWrapper = ({ children }: { children: React.ReactNode }) => (
  <TooltipProvider>{children}</TooltipProvider>
);

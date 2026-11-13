import React from 'react';
import { lazyRetry as lazy } from '@/lib/lazyRetry';
import type { ReactNode } from 'react';

// ─── Eager: landing shell (must be instant) ──────────────────────────────────
import HomePage from './pages/HomePage';

// ─── Lazy: public pages ───────────────────────────────────────────────────────
const ProductsPage            = lazy(() => import('./pages/ProductsPage'));
const ManufacturersPage       = lazy(() => import('./pages/ManufacturersPage'));
const RequirementsPage        = lazy(() => import('./pages/RequirementsPage'));
const RequirementDetailsPage  = lazy(() => import('./pages/RequirementDetailsPage'));
const AuctionsHubPage         = lazy(() => import('./pages/AuctionsHubPage'));
const ForwardAuctionDetailPage = lazy(() => import('./pages/ForwardAuctionDetailPage'));
const MyQuotationsPage        = lazy(() => import('./pages/MyQuotationsPage'));
const HowItWorksPage          = lazy(() => import('./pages/HowItWorksPage'));
const PricingPage             = lazy(() => import('./pages/PricingPage'));
const AuthPage                = lazy(() => import('./pages/AuthPage'));
const ResetPasswordPage       = lazy(() => import('./pages/ResetPasswordPage'));
const ProductDetailPage       = lazy(() => import('./pages/ProductDetailPage'));
const CompanyProfilePage      = lazy(() => import('./pages/CompanyProfilePage'));
const BuyerPublicProfilePage  = lazy(() => import('./pages/BuyerPublicProfilePage'));
const ContactPage             = lazy(() => import('./pages/ContactPage'));
const ShippingCalculatorPage  = lazy(() => import('./pages/ShippingCalculatorPage'));
const LoanCalculatorPage      = lazy(() => import('./pages/LoanCalculatorPage'));
const TradeAssistantPage      = lazy(() => import('./pages/TradeAssistantPage'));
const SEOHubPage              = lazy(() => import('./pages/SEOHubPage'));
const BlogDetailPage          = lazy(() => import('./pages/BlogDetailPage'));
const CategoriesPage          = lazy(() => import('./pages/CategoriesPage'));

// ─── Lazy: auth-required pages ────────────────────────────────────────────────
const PostRequirementPage     = lazy(() => import('./pages/PostRequirementPage'));
const BusinessSetupWizardPage = lazy(() => import('./pages/BusinessSetupWizardPage'));
const PaymentSuccessPage      = lazy(() => import('./pages/PaymentSuccessPage'));
const DeleteAccountPage       = lazy(() => import('./pages/DeleteAccountPage'));

// ─── Lazy: buyer dashboard ────────────────────────────────────────────────────
const BuyerDashboard                  = lazy(() => import('./pages/dashboard/buyer/BuyerDashboard'));
const BuyerProfilePage                = lazy(() => import('./pages/dashboard/buyer/BuyerProfilePage'));
const BuyerRequirementsPage           = lazy(() => import('./pages/dashboard/buyer/BuyerRequirementsPage'));
const BuyerRequirementsOverviewPage   = lazy(() => import('./pages/dashboard/buyer/BuyerRequirementsOverviewPage'));
const BuyerQuotesPage                 = lazy(() => import('./pages/dashboard/buyer/BuyerQuotesPage'));
const BuyerVerificationPage           = lazy(() => import('./pages/dashboard/buyer/BuyerVerificationPage'));
const SavedManufacturersPage          = lazy(() => import('./pages/dashboard/buyer/SavedManufacturersPage'));
const BuyerOrdersPage                 = lazy(() => import('./pages/dashboard/buyer/BuyerOrdersPage'));
const BuyerRFQMatchPage               = lazy(() => import('./pages/dashboard/buyer/BuyerRFQMatchPage'));

// ─── Lazy: supplier dashboard ─────────────────────────────────────────────────
const SupplierDashboard         = lazy(() => import('./pages/dashboard/supplier/SupplierDashboard'));
const SupplierOverviewPage      = lazy(() => import('./pages/dashboard/supplier/SupplierOverviewPage'));
const SupplierProductsPage      = lazy(() => import('./pages/dashboard/supplier/SupplierProductsPage'));
const SupplierRFQsPage          = lazy(() => import('./pages/dashboard/supplier/SupplierRFQsPage'));
const SupplierQuotesPage        = lazy(() => import('./pages/dashboard/supplier/SupplierQuotesPage'));
const SupplierQuotationsPage    = lazy(() => import('./pages/dashboard/supplier/SupplierQuotationsPage'));
const SupplierSubscriptionPage  = lazy(() => import('./pages/dashboard/supplier/SupplierSubscriptionPage'));
const SupplierProfilePage       = lazy(() => import('./pages/dashboard/supplier/SupplierProfilePage'));
const SupplierVerificationPage  = lazy(() => import('./pages/dashboard/supplier/SupplierVerificationPage'));
const SupplierAnalyticsPage     = lazy(() => import('./pages/dashboard/supplier/SupplierAnalyticsPage'));
const SupplierOrdersPage        = lazy(() => import('./pages/dashboard/supplier/SupplierOrdersPage'));
const SupplierInventoryPage     = lazy(() => import('./pages/dashboard/supplier/SupplierInventoryPage'));
const SupplierLeadCreditsPage   = lazy(() => import('./pages/dashboard/supplier/SupplierLeadCreditsPage'));
const AISalesAssistantPage      = lazy(() => import('./pages/dashboard/supplier/AISalesAssistantPage'));

// ─── Lazy: shared dashboard ───────────────────────────────────────────────────
const MessagesPage          = lazy(() => import('./pages/dashboard/shared/MessagesPage'));
const NegotiationRoomPage   = lazy(() => import('./pages/dashboard/shared/NegotiationRoomPage'));
const OrderTrackingPage     = lazy(() => import('./pages/dashboard/shared/OrderTrackingPage'));
const NotificationsPage     = lazy(() => import('./pages/dashboard/shared/NotificationsPage'));
const DisputeCenterPage     = lazy(() => import('./pages/dashboard/shared/DisputeCenterPage'));

// ─── Lazy: admin dashboard ────────────────────────────────────────────────────
const AdminDashboardFull    = lazy(() => import('./pages/dashboard/admin/AdminDashboardFull'));
const AIMatchAnalyticsPage  = lazy(() => import('./pages/dashboard/admin/AIMatchAnalyticsPage'));

// ─── Lazy: footer / company pages ─────────────────────────────────────────────
const AboutPage         = lazy(() => import('./pages/AboutPage'));
const CareersPage       = lazy(() => import('./pages/CareersPage'));
const BlogPage          = lazy(() => import('./pages/BlogPage'));
const TermsPage         = lazy(() => import('./pages/TermsPage'));
const PrivacyPage       = lazy(() => import('./pages/PrivacyPage'));
const CookiePolicyPage  = lazy(() => import('./pages/CookiePolicyPage'));
const SitemapPage       = lazy(() => import('./pages/SitemapPage'));

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
}

export const routes: RouteConfig[] = [
  // ── Public Core ─────────────────────────────────────────────
  { name: 'Home', path: '/', element: <HomePage />, public: true },
  { name: 'Products', path: '/products', element: <ProductsPage />, public: true },
  { name: 'Manufacturers', path: '/manufacturers', element: <ManufacturersPage />, public: true },
  { name: 'Suppliers Directory', path: '/suppliers', element: <ManufacturersPage />, public: true },
  { name: 'Requirements', path: '/requirements', element: <RequirementsPage />, public: true },
  { name: 'How It Works', path: '/how-it-works', element: <HowItWorksPage />, public: true },
  { name: 'Pricing', path: '/pricing', element: <PricingPage />, public: true },
  { name: 'Auth', path: '/auth', element: <AuthPage />, public: true },
  { name: 'Login', path: '/login', element: <AuthPage />, public: true },
  { name: 'Register', path: '/register', element: <AuthPage />, public: true },
  { name: 'Signup', path: '/signup', element: <AuthPage />, public: true },
  { name: 'Reset Password', path: '/reset-password', element: <ResetPasswordPage />, public: true },

  // ── Public Canonical SEO Landing Pages ───────────────────────
  { name: 'B2B Marketplace Hub', path: '/b2b-marketplace', element: <SEOHubPage forcedSlug="b2b-marketplace" />, public: true },
  { name: 'Wholesale Suppliers Hub', path: '/wholesale-suppliers', element: <SEOHubPage forcedSlug="wholesale-suppliers" />, public: true },
  { name: 'Bulk Products Hub', path: '/bulk-products', element: <SEOHubPage forcedSlug="bulk-products" />, public: true },
  { name: 'Bulk Suppliers Hub', path: '/bulk-suppliers', element: <SEOHubPage forcedSlug="bulk-suppliers" />, public: true },
  { name: 'Manufacturers in India', path: '/manufacturers-in-india', element: <SEOHubPage forcedSlug="manufacturers-in-india" />, public: true },
  { name: 'Manufacturers in Tamil Nadu', path: '/manufacturers-in-tamil-nadu', element: <SEOHubPage forcedSlug="manufacturers-in-tamil-nadu" />, public: true },
  { name: 'Manufacturers in Coimbatore', path: '/manufacturers-in-coimbatore', element: <SEOHubPage forcedSlug="manufacturers-in-coimbatore" />, public: true },
  { name: 'Manufacturers in Chennai', path: '/manufacturers-in-chennai', element: <SEOHubPage forcedSlug="manufacturers-in-chennai" />, public: true },
  { name: 'Wholesale Suppliers in India', path: '/wholesale-suppliers-in-india', element: <SEOHubPage forcedSlug="wholesale-suppliers-in-india" />, public: true },
  { name: 'Dynamic Sourcing Hub', path: '/hub/:slug', element: <SEOHubPage />, public: true },

  // ── Public Dynamic Catalog & Entity Pages ────────────────────
  { name: 'Product Detail', path: '/products/:slug', element: <ProductDetailPage />, public: true },
  { name: 'Categories Hub', path: '/categories', element: <CategoriesPage />, public: true },
  { name: 'Categories Slug Hub', path: '/categories/:slug', element: <CategoriesPage />, public: true },
  { name: 'Category Route', path: '/category/:slug', element: <CategoriesPage />, public: true },
  { name: 'Login Alias', path: '/login', element: <AuthPage />, public: true },
  { name: 'Register Alias', path: '/register', element: <AuthPage />, public: true },
  { name: 'Company Profile', path: '/companies/:slug', element: <CompanyProfilePage />, public: true },
  { name: 'Manufacturer Profile', path: '/manufacturers/:slug', element: <CompanyProfilePage />, public: true },
  { name: 'Supplier Profile Alias', path: '/suppliers/:slug', element: <CompanyProfilePage />, public: true },
  { name: 'Buyer Public Profile', path: '/buyers/:slug', element: <BuyerPublicProfilePage />, public: true },
  { name: 'Requirement Details', path: '/requirement/:rfqId', element: <RequirementDetailsPage />, public: true },
  { name: 'Requirement Details Alias', path: '/requirements/:rfqId', element: <RequirementDetailsPage />, public: true },
  { name: 'Live Auctions Hub', path: '/auctions', element: <AuctionsHubPage />, public: true },
  { name: 'Forward Auctions Hub', path: '/auctions/forward', element: <AuctionsHubPage />, public: true },
  { name: 'Reverse Auctions Hub', path: '/auctions/reverse', element: <AuctionsHubPage />, public: true },
  { name: 'Forward Auction Detail', path: '/auctions/forward/:id', element: <ForwardAuctionDetailPage />, public: true },
  { name: 'Reverse Auction Detail', path: '/auctions/reverse/:id', element: <ForwardAuctionDetailPage />, public: true },
  { name: 'Auction Detail Short', path: '/auctions/:id', element: <ForwardAuctionDetailPage />, public: true },
  { name: 'My Quotations', path: '/my-quotations', element: <MyQuotationsPage />, public: true },
  { name: 'My Bids', path: '/my-bids', element: <AuctionsHubPage />, public: true },
  { name: 'Contact', path: '/contact', element: <ContactPage />, public: true },
  { name: 'Shipping Calculator', path: '/shipping-calculator', element: <ShippingCalculatorPage />, public: true },
  { name: 'Free Delivery & Loan Calculator', path: '/loan-calculator', element: <LoanCalculatorPage />, public: true },
  { name: 'AI Trade Assistant', path: '/trade-assistant', element: <TradeAssistantPage />, public: true },
  { name: 'AI Sourcing Assistant', path: '/ai-sourcing', element: <TradeAssistantPage />, public: true },
  { name: 'AI Import & Export Assistance', path: '/import-export-assistance', element: <TradeAssistantPage />, public: true },
  { name: 'AI Trade Assistant Alias', path: '/ai-trade-assistant', element: <TradeAssistantPage />, public: true },

  // ── Public Blog & Editorial Guides ───────────────────────────
  { name: 'Blog', path: '/blog', element: <BlogPage />, public: true },
  { name: 'Blog Post Detail', path: '/blog/:slug', element: <BlogDetailPage />, public: true },

  // ── Auth-required ────────────────────────────────────────────
  { name: 'Post Requirement', path: '/post-requirement', element: <PostRequirementPage /> },
  { name: 'Business Setup Wizard', path: '/business-setup', element: <BusinessSetupWizardPage /> },
  { name: 'Business Onboarding', path: '/onboarding', element: <BusinessSetupWizardPage /> },
  { name: 'Payment Success', path: '/payment-success', element: <PaymentSuccessPage /> },
  { name: 'Profile Redirect', path: '/profile', element: <BuyerProfilePage /> },
  { name: 'Delete Account', path: '/settings/delete-account', element: <DeleteAccountPage /> },

  // ── Buyer ────────────────────────────────────────────────────
  { name: 'Buyer Dashboard', path: '/dashboard/buyer', element: <BuyerDashboard /> },
  { name: 'Buyer Profile', path: '/dashboard/buyer/profile', element: <BuyerProfilePage /> },
  { name: 'Buyer Requirements', path: '/dashboard/buyer/requirements', element: <BuyerRequirementsOverviewPage /> },
  { name: 'Buyer Requirements Legacy', path: '/dashboard/buyer/my-requirements', element: <BuyerRequirementsPage /> },
  { name: 'Buyer Quotes', path: '/dashboard/buyer/quotes', element: <BuyerQuotesPage /> },
  { name: 'Buyer Messages', path: '/dashboard/buyer/messages', element: <MessagesPage /> },
  { name: 'Buyer Verification', path: '/dashboard/buyer/verification', element: <BuyerVerificationPage /> },
  { name: 'Saved Manufacturers', path: '/dashboard/buyer/saved-manufacturers', element: <SavedManufacturersPage /> },
  { name: 'Buyer Notifications', path: '/dashboard/buyer/notifications', element: <NotificationsPage /> },
  { name: 'Buyer Disputes', path: '/dashboard/buyer/disputes', element: <DisputeCenterPage /> },
  { name: 'Buyer Orders', path: '/dashboard/buyer/orders', element: <BuyerOrdersPage /> },
  { name: 'Buyer Order Tracking', path: '/dashboard/buyer/orders/:orderId', element: <OrderTrackingPage /> },
  { name: 'Buyer RFQ Match', path: '/dashboard/buyer/rfq/:id', element: <BuyerRFQMatchPage /> },
  { name: 'Buyer Negotiation', path: '/dashboard/buyer/negotiation/:conversationId', element: <NegotiationRoomPage /> },

  // ── Supplier ─────────────────────────────────────────────────
  { name: 'Supplier Dashboard', path: '/dashboard/supplier', element: <SupplierDashboard /> },
  { name: 'Supplier Overview', path: '/dashboard/supplier/overview', element: <SupplierOverviewPage /> },
  { name: 'Supplier Products', path: '/dashboard/supplier/products', element: <SupplierProductsPage /> },
  { name: 'Supplier RFQs', path: '/dashboard/supplier/rfqs', element: <SupplierRFQsPage /> },
  { name: 'Supplier Quotes', path: '/dashboard/supplier/quotes', element: <SupplierQuotesPage /> },
  { name: 'Supplier Quotations', path: '/dashboard/supplier/quotations', element: <SupplierQuotationsPage /> },
  { name: 'Supplier Subscription', path: '/dashboard/supplier/subscription', element: <SupplierSubscriptionPage /> },
  { name: 'Supplier Messages', path: '/dashboard/supplier/messages', element: <MessagesPage /> },
  { name: 'Supplier Profile', path: '/dashboard/supplier/profile', element: <SupplierProfilePage /> },
  { name: 'Supplier Verification', path: '/dashboard/supplier/verification', element: <SupplierVerificationPage /> },
  { name: 'Supplier Notifications', path: '/dashboard/supplier/notifications', element: <NotificationsPage /> },
  { name: 'Supplier Disputes', path: '/dashboard/supplier/disputes', element: <DisputeCenterPage /> },
  { name: 'Supplier Orders', path: '/dashboard/supplier/orders', element: <SupplierOrdersPage /> },
  { name: 'Supplier Order Tracking', path: '/dashboard/supplier/orders/:orderId', element: <OrderTrackingPage /> },
  { name: 'Supplier Negotiation', path: '/dashboard/supplier/negotiation/:conversationId', element: <NegotiationRoomPage /> },
  { name: 'Supplier Analytics', path: '/dashboard/supplier/analytics', element: <SupplierAnalyticsPage /> },
  { name: 'Supplier Inventory', path: '/dashboard/supplier/inventory', element: <SupplierInventoryPage /> },
  { name: 'Supplier Lead Credits', path: '/dashboard/supplier/lead-credits', element: <SupplierLeadCreditsPage /> },
  { name: 'AI Sales Assistant', path: '/dashboard/supplier/ai-assistant', element: <AISalesAssistantPage /> },
  { name: 'AI Sales Assistant Alias', path: '/dashboard/manufacturer/ai-assistant', element: <AISalesAssistantPage /> },
  { name: 'AI Sales Assistant Short', path: '/ai-sales-assistant', element: <AISalesAssistantPage /> },

  // ── Manufacturer Aliases ─────────────────────────────────────
  { name: 'Manufacturer Dashboard', path: '/dashboard/manufacturer', element: <SupplierDashboard /> },
  { name: 'Manufacturer Overview', path: '/dashboard/manufacturer/overview', element: <SupplierOverviewPage /> },
  { name: 'Manufacturer Products', path: '/dashboard/manufacturer/products', element: <SupplierProductsPage /> },
  { name: 'Manufacturer RFQs', path: '/dashboard/manufacturer/rfqs', element: <SupplierRFQsPage /> },
  { name: 'Manufacturer Quotes', path: '/dashboard/manufacturer/quotes', element: <SupplierQuotesPage /> },
  { name: 'Manufacturer Quotations', path: '/dashboard/manufacturer/quotations', element: <SupplierQuotationsPage /> },
  { name: 'Manufacturer Subscription', path: '/dashboard/manufacturer/subscription', element: <SupplierSubscriptionPage /> },
  { name: 'Manufacturer Messages', path: '/dashboard/manufacturer/messages', element: <MessagesPage /> },
  { name: 'Manufacturer Profile', path: '/dashboard/manufacturer/profile', element: <SupplierProfilePage /> },
  { name: 'Manufacturer Verification', path: '/dashboard/manufacturer/verification', element: <SupplierVerificationPage /> },
  { name: 'Manufacturer Disputes', path: '/dashboard/manufacturer/disputes', element: <DisputeCenterPage /> },
  { name: 'Manufacturer Orders', path: '/dashboard/manufacturer/orders', element: <SupplierOrdersPage /> },
  { name: 'Manufacturer Order Tracking', path: '/dashboard/manufacturer/orders/:orderId', element: <OrderTrackingPage /> },
  { name: 'Manufacturer Negotiation', path: '/dashboard/manufacturer/negotiation/:conversationId', element: <NegotiationRoomPage /> },
  { name: 'Manufacturer Analytics', path: '/dashboard/manufacturer/analytics', element: <SupplierAnalyticsPage /> },
  { name: 'Manufacturer Inventory', path: '/dashboard/manufacturer/inventory', element: <SupplierInventoryPage /> },
  { name: 'Manufacturer Lead Credits', path: '/dashboard/manufacturer/lead-credits', element: <SupplierLeadCreditsPage /> },
  { name: 'Manufacturer Notifications', path: '/dashboard/manufacturer/notifications', element: <NotificationsPage /> },

  // ── Convenience Short Links ───────────────────────────────────
  { name: 'Categories Shortcut', path: '/categories', element: <CategoriesPage />, public: true },
  { name: 'RFQs Shortcut', path: '/rfqs', element: <RequirementsPage />, public: true },
  { name: 'Requirement Single Shortcut', path: '/requirement', element: <RequirementsPage />, public: true },
  { name: 'Companies Shortcut', path: '/companies', element: <ManufacturersPage />, public: true },
  { name: 'Search Shortcut', path: '/search', element: <ProductsPage />, public: true },
  { name: 'My Products Shortcut', path: '/my-products', element: <SupplierProductsPage /> },
  { name: 'Quotations Shortcut', path: '/quotations', element: <SupplierQuotationsPage /> },
  { name: 'Orders Shortcut', path: '/orders', element: <BuyerOrdersPage /> },
  { name: 'Order Details Shortcut', path: '/orders/:orderId', element: <OrderTrackingPage /> },
  { name: 'Order Pay Shortcut', path: '/orders/:orderId/pay', element: <OrderTrackingPage /> },
  { name: 'Buyer Requirements Shortcut', path: '/buyer/requirements', element: <BuyerRequirementsOverviewPage /> },
  { name: 'Supplier Wallet Alias', path: '/dashboard/supplier/wallet', element: <SupplierLeadCreditsPage /> },
  { name: 'Supplier Credits Alias', path: '/dashboard/supplier/credits', element: <SupplierLeadCreditsPage /> },
  { name: 'Supplier Company Profile Alias', path: '/dashboard/supplier/company', element: <SupplierProfilePage /> },
  { name: 'Messages Shortcut', path: '/messages', element: <MessagesPage /> },
  { name: 'Chat Shortcut', path: '/chat', element: <MessagesPage /> },
  { name: 'Notifications Shortcut', path: '/notifications', element: <NotificationsPage /> },
  { name: 'Wallet Shortcut', path: '/wallet', element: <SupplierLeadCreditsPage /> },

  // ── Admin ─────────────────────────────────────────────────────
  { name: 'Admin Dashboard', path: '/dashboard/admin', element: <AdminDashboardFull /> },
  { name: 'AI Match Analytics', path: '/dashboard/admin/ai-match-analytics', element: <AIMatchAnalyticsPage /> },

  // ── Company / Legal ───────────────────────────────────────────
  { name: 'About Us',      path: '/about',         element: <AboutPage />,        public: true },
  { name: 'Careers',       path: '/careers',        element: <CareersPage />,      public: true },
  { name: 'Terms',         path: '/terms',          element: <TermsPage />,        public: true },
  { name: 'Privacy',       path: '/privacy',        element: <PrivacyPage />,      public: true },
  { name: 'Cookie Policy', path: '/cookie-policy',  element: <CookiePolicyPage />, public: true },
  { name: 'Sitemap',       path: '/sitemap',        element: <SitemapPage />,      public: true },
  { name: 'Sitemap XML View', path: '/sitemap-view', element: <SitemapPage />,      public: true },
];

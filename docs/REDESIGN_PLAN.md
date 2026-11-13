# BulkSkart UI/UX redesign plan

Visual-only redesign. Brand colours stay the existing orange (`#FF5A00`, `--primary: 21 100% 50%`) and ink/navy surfaces. No backend, schema, API, auth, or payment changes.

## Design system

Tokens live in `src/index.css` and `tailwind.config.js`.

- Keep every existing hue. Elevate with gradients, glass, and shadows built only from that orange and the current ink backgrounds (`#0d1117`, `#1a1a2e`, `#15181F`, `#0B0F19`).
- Radius moves from `0.5rem` to `0.75rem`.
- Shared primitives (`button`, `card`, `input`, `badge`, `dialog`) pick up the elevation so every page that already uses them changes together.
- Motion is CSS (`bs-float`, `bs-scan`, `bs-orbit`, `bs-page-enter`). It turns off under `prefers-reduced-motion`. No new animation library and no Three.js on the hero, so the main bundle does not grow for decoration.
- Mobile chrome is a fixed bottom nav: Home, Products, RFQs, Messages, Account. It is hidden on auth, onboarding, checkout, and negotiation rooms.

## Route inventory

Owner page → real route. Aliases share the same screen.

| Requested | What exists |
| --- | --- |
| Homepage | `/` `HomePage` |
| Login / registration | `/auth`, `/login`, `/register`, `/signup` `AuthPage` |
| Buyer dashboard | `/dashboard/buyer` plus requirements, quotes, orders, verification, saved manufacturers |
| Manufacturer dashboard | `/dashboard/manufacturer/*` aliases the supplier dashboard |
| Supplier dashboard | `/dashboard/supplier` plus overview, products, inventory, RFQs, quotations, analytics, subscription, lead credits |
| Product listing | `/products`, `/search` |
| Product details | `/products/:slug` |
| Categories | `/categories`, `/categories/:slug`, `/category/:slug` |
| RFQ marketplace | `/requirements`, `/rfqs`, `/requirement` |
| Post bulk requirement | `/post-requirement` |
| Supplier discovery | `/manufacturers`, `/suppliers`, `/companies` |
| AI supplier matching | `/dashboard/buyer/rfq/:id` `BuyerRFQMatchPage`, plus `/trade-assistant` and admin `/dashboard/admin/ai-match-analytics` |
| Compare quotations | No standalone compare page. Comparison is `BuyerQuotesPage` at `/dashboard/buyer/quotes` and supplier quotation screens |
| Negotiation chat | `/dashboard/{buyer,supplier,manufacturer}/negotiation/:conversationId` and messages at `/messages`, `/chat` |
| Live / forward / reverse auctions | `/auctions`, `/auctions/forward`, `/auctions/reverse`, detail routes, `/my-bids` |
| Bulk price calculator | No standalone page. `BulkPriceCalculator` is on product detail. Freight is `/shipping-calculator`. Order installment is `/loan-calculator` |
| Sample request | No page. `SampleRequestDialog` opens from product and company flows |
| Manufacturer profile | `/manufacturers/:slug`, `/companies/:slug`, `/suppliers/:slug`, and `/dashboard/supplier/profile` |
| Buyer profile | `/buyers/:slug` and `/dashboard/buyer/profile` |
| Orders & tracking | `/dashboard/buyer/orders`, `/dashboard/supplier/orders`, `/orders/:orderId` |
| Wallet | No separate wallet product. `/wallet` and `/dashboard/supplier/wallet` open lead credits (`SupplierLeadCreditsPage`) |
| Notifications | `/notifications` and role dashboard notification routes |
| Settings | No general settings page. Profile pages hold account details. `/settings/delete-account` is the only settings route |
| Admin dashboard | `/dashboard/admin` and AI match analytics |

Also redesigned because they are real routes: pricing, how it works, contact, about, careers, blog, legal pages, sitemap, SEO hubs, business setup wizard, payment success, my quotations, not found.

## Page-by-page

1. Shared chrome first: sticky glass header, footer, dashboard sidebar, mobile bottom nav, page entrance.
2. Homepage hero uses the owner copy exactly. CTAs go to `/products` and `/auth?tab=supplier`. Search still routes to products, manufacturers, or reverse auctions.
3. Listing, category, auction, and trade-assistant screens keep their data and gain the shared atmosphere, glass cards, and scan accents.
4. Auth keeps the same forms and tabs inside a glass panel. Slideshow pauses when reduced motion is requested.
5. Dashboards keep the same metrics and links. Cards pick up elevation only where real stats are already rendered.
6. Product cards keep image, name, manufacturer, location, MOQ, price, and verified state, and add a view affordance. Quote and sample actions stay on the detail and company screens that already implement them.

## Verification

Typecheck, lint, and the existing Vite build script. Smoke public routes in a browser at 390, 768, and 1440. Confirm console errors are absent on those shells and that navigation still hits the same paths.

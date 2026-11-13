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

## Per-page checklist (second pass)

Shared chrome from the first pass still applies everywhere. This pass adds a layout that belongs to the page.

| Page | What changed |
| --- | --- |
| RFQ marketplace `/requirements` | Larger live header. Location, category, and sort move into a phone bottom sheet. Requirement rows use glass cards. Status chips stay on the page. |
| Post requirement `/post-requirement` | Form sits on a glass panel. A live brief on large screens mirrors the fields already typed. Submit, draft, and field names are unchanged. |
| Product listing `/products` | Catalogue hero. Search stays visible. Category and origin filters open in a phone sheet. Skeleton cards while products load. |
| Product details `/products/:slug` | Purchase panel is a sticky glass card. Gallery, quote, and sample actions are the same. |
| Supplier discovery `/manufacturers` | Search stays visible. Country, industry, rating, sort, and verified toggle open in a phone sheet. Hub chips stay swipeable. |
| Manufacturer profile `/manufacturers/:slug` | Profile banner uses the glass frame. Actions are unchanged. |
| AI supplier match `/dashboard/buyer/rfq/:id` | Match summary gets a scan accent. Scores still come from the existing match data. |
| Trade assistant `/trade-assistant` | Existing calculator keeps its scan header from the first pass. No new AI calls. |
| AI sales assistant | Dark header with a scan line over the existing assistant. |
| Received quotes | Header labels the page as compare. A sideways strip shows each real quote’s unit price and MOQ. Accept, revise, and decline are unchanged. |
| Negotiation chat | Full-height thread, round bubbles, composer clear of the home indicator. |
| Messages | Thread list fills the dashboard pane. Bubbles match the negotiation room. |
| Orders | Buyer and supplier order headers. Existing status filters stay. |
| Order tracking | Glass order header. Timeline’s current step pulses unless reduced motion is on. |
| Buyer dashboard | Glass welcome. Counts show a skeleton while the real numbers load. No invented chart. |
| Supplier dashboard | Same skeleton treatment on real counts. |
| Supplier analytics | Glass header on the existing credit and response metrics. |
| Lead credits / wallet | Still the existing redirect to subscription. There is no separate wallet screen to restyle. |
| Notifications | Glass header, unread count, and the existing preference button. |
| Profiles | Buyer and supplier profile titles. Forms are unchanged. |
| Auctions | Scan line on the live auction hero. Lot cards and bid actions are unchanged. |
| Admin | Glass control-panel header. Metrics stay the ones the admin page already loads. |
| Login / registration | Taller tab targets and the glass form panel. |
| Disputes, shipping calculator, my quotations | Page headers and the freight calculator panel. |
| Other public pages | About, contact, legal, blog, pricing, how-it-works, categories, and SEO hubs keep the shared header, footer, buttons, and ink panels. |

## Still thin

Requirement detail, forward-auction detail, and a few dashboard sub-pages (inventory, verification, subscription) mostly inherit the shared system rather than a rebuilt layout. Wallet cannot be redesigned as its own screen because those URLs redirect to subscription.

## Verification

Typecheck, lint, and the existing Vite build script. Smoke public routes in a browser at 390, 768, and 1440. Confirm console errors are absent on those shells and that navigation still hits the same paths.

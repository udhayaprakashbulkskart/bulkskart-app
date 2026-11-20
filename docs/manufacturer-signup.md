# Manufacturer sign-up with the assistant

`/signup/manufacturer` (also `/register/manufacturer`) is the quick way for a manufacturer to join and pay for a plan.
Every old link to `/auth?tab=supplier` (and `/register?role=supplier`) leads here; the long form is still at
`/auth?tab=supplier&form=full`.

## The three steps

1. **Your business.** The person writes a sentence ("We manufacture HDPE pipes and fittings in Vadodara, Gujarat") and
   optionally a GST number. The assistant turns that into editable details: business type, products, categories,
   city and state. Nothing is blocked: everything can be changed or added by hand.
2. **Your account.** Company name, name, mobile, e-mail, password, agreement. The login is created, the profile and a
   `companies` row are saved (`src/lib/signup/saveCompany.ts`), and the person is signed in.
3. **Activate.** The three plans at their real rupee prices, with GST and the gateway fee shown before paying. Payment
   goes through the existing `useRazorpay` hook and the existing `razorpay-create-order` / `razorpay-verify-payment`
   functions. "Skip for now" goes to the dashboard (the account stays unpaid, as before).

A person who is already signed in is not asked twice: a manufacturer with a company lands on step 3, one without a
company is asked only for the business and a mobile number, a manufacturer who has paid goes to the dashboard, a buyer
is told to sign out first.

## What the assistant is

It is **not a language model**. It is a reader built from fixed rules and word lists, in `src/lib/signup/`:

| File | What it does |
| --- | --- |
| `readBusiness.ts` | business type, products, company name, years in business, trade type from a sentence |
| `categories.ts` | scores the 13 marketplace categories from word lists (strong 3, usual 2, hint 1 points) |
| `places.ts` | Indian states, GST state codes and several hundred industrial towns, so "Tiruppur" gives Tamil Nadu |
| `gstin.ts` | GST number: shape, check character, state, PAN, who holds it (company, proprietor ...) |
| `contact.ts` | Indian mobile numbers (any way of writing them) and typos in well-known mail domains |
| `companyRecord.ts` | the exact `companies` row and profile update that are saved |

It works instantly, costs nothing to run, sends nothing anywhere, answers the same way every time, and leaves a field
empty rather than guess. To teach it something, add words to `categories.ts` or towns to `places.ts` and add a case to
`src/__tests__/signupEngine.test.ts`.

A real model could replace `readBusiness()` later (it is one function that returns a `BusinessReading`), but that needs a
server-side API key and an edge function, and a public sign-up endpoint needs rate limiting so it cannot be used to run
up a bill.

## Prices

The sign-up prices plans from India's settings (`COUNTRIES.IN`) whatever country the visitor is in, because the Razorpay
order is created in rupees. The plan list itself is shared with the dashboard's Subscription page
(`src/lib/subscriptionPlans.ts`).

After a payment the app is told to read the account again (`refreshProfile`), so the new plan shows at once instead of
after a reload.

# Developer setup

BulkSkart is the React website for the B2B marketplace at [https://www.bulkskart.com/](https://www.bulkskart.com/). Accounts, catalogs, orders, chat, and payments are stored in a self-hosted Supabase stack. This note is how to install, run, and check the website on a developer machine.

The root `README.md` is an old template from the original app generator. Follow this file instead.

## What you need

- Node.js 20 or newer. This environment used Node 22.23.4.
- pnpm. The lockfile is pnpm’s. GitHub Actions installs with pnpm 9. pnpm 10.33.4 also installs cleanly with `--frozen-lockfile`.

Docker is only needed if you want to run the database yourself from `deploy/bulkskart/stack`. It is not required to compile the website or open the pages.

## Install

```bash
pnpm install --frozen-lockfile
```

## Environment

Copy `.env.example` to `.env` in the repo root. Do not invent or commit real keys. `.env` is gitignored.

The website refuses to start unless `VITE_SUPABASE_URL` is a real `http://` or `https://` address. The Supabase client throws `supabaseUrl is required` when it is empty.

| Variable | Needed to open the UI | What it is |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | API address. Production builds use `https://www.bulkskart.com`. |
| `VITE_SUPABASE_ANON_KEY` | Yes, for login and live data | Public anon key from the Supabase stack. This is not the service-role key. |
| `VITE_GTM_ID` | No | Google Tag Manager. If unset, the production container id is used. Tracking still only runs on `bulkskart.com`. |
| `VITE_SENTRY_DSN` | No | Error reporting. The app boots without it. |
| `VITE_RAZORPAY_KEY_ID` | No | Publishable Razorpay key used by one checkout dialog. A test key is hardcoded as a fallback. |
| `VITE_SIMULATED_AUCTIONS` | No | Defaults to on. Set `false` to hide the fake live-auction feed. |
| `VITE_APP_ID` | No | Listed in `.env.example` and the deploy script. The website code does not read it. |

Payments, product-image search, and invoices also need secrets on the Supabase edge functions (not in the website `.env`):

- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
- `PIXABAY_API_KEY`
- `INTEGRATIONS_API_KEY` (exchange rates)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (normally injected by the Supabase runtime)

`scripts/deploy-prod-ssm.sh` publishes the site to production. It needs AWS credentials and reads the live anon key from the server. Do not run it as part of local setup.

## Run

`pnpm dev` and `pnpm build` are turned off on purpose. Both only print “Do not use this command, only use lint to check”. Start Vite directly:

```bash
pnpm exec vite --host 127.0.0.1 --port 5173
```

Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/).

The production build, which is what the deploy script runs, is:

```bash
pnpm exec vite build --outDir dist
```

That build rewrites `src/version.json` and `public/version.json` with a new timestamp. Leave those files uncommitted unless a release is meant to update them.

## Checks

```bash
pnpm exec tsgo -p tsconfig.check.json
pnpm exec biome lint
pnpm exec tailwindcss -i ./src/index.css -o /dev/null
pnpm exec vitest run
```

Verified on 13 Nov 2026:

- Typecheck with `tsgo` passed.
- Biome lint passed (259 files).
- Tailwind compile passed.
- Vitest is configured (`vitest.config.ts`, `src/__tests__/setup.ts`) but there are no `*.test` or `*.spec` files, so `vitest run` exits 1 with “No test files found”.
- `pnpm exec vite build` succeeded in about 3 seconds. The output is large: about 17 MB, with one JavaScript chunk near 4.7 MB.

`pnpm run lint` chains the typecheck, Biome, `.rules/check.sh`, a Tailwind error scan, and a Vite build (`.rules/testBuild.sh`, output in `/workspace/.dist`). `.rules/check.sh` calls the `ast-grep` command. That program is not installed in a fresh environment, and the script does not stop when the command is missing, so the custom rules never run and the script still exits 0. Install `ast-grep` and put it on `PATH` before trusting `pnpm run lint`.

## What works without the real backend

A placeholder URL such as `http://127.0.0.1:54321` and any non-empty anon string is enough for Vite to boot and for the homepage shell to render (header, search, and marketing sections). Product and account requests then fail with “Failed to fetch”, because nothing is listening on that address. Login, payments, chat, and the dashboards need the real Supabase URL and anon key.

The Docker database in `deploy/bulkskart/stack` was not started here. Docker is not installed in this environment, and that stack’s `.env` holds database passwords and API secrets. Its own README and `CONFIG.md` describe how to run it on a machine that has Docker.

## Where the code lives

- `src/pages` and `src/routes.tsx` — screens and URLs
- `src/lib/api.ts` — most data access, including large local catalogs
- `src/db/supabase.ts` — Supabase browser client
- `supabase/migrations` — 62 SQL migrations
- `supabase/schema.sql` — full database dump
- `supabase/functions` — edge functions (payments, chat, matching, invoices, images)
- `deploy/bulkskart/stack` — self-hosted Supabase Docker compose
- `.github/workflows/deploy-production.yml` — production deploy on push to `master` or `main`

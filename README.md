# Breakout — Trading Terminal

A fast, single-page crypto **trading journal and risk terminal**. It streams live
prices from Kraken, sizes positions against drawdown limits, tracks a trade
journal with performance stats, and fires price / P&L alerts to the browser and
Telegram. State lives in the browser and syncs to a small cloud backend so it
follows you across devices.

> Personal, single-user tool. Access is gated by one shared password. It supports
> multiple independent **accounts** (separate datasets) behind that one password,
> but it is not a multi-tenant / multi-user system.

## Features

- **Live prices** — Kraken WebSocket v2 ticker feed for 70+ assets, batched for smooth rendering.
- **Position sizer** — risk-% and leverage-based sizing with stop distance, fees, and correlation warnings.
- **Multiple accounts** — switch between independent datasets (each with its own balance, positions, journal, and alerts) from the header; one shared login, separate cloud keys per account.
- **Drawdown guardrails** — daily soft/hard and total drawdown tracking with color-coded warnings and "what-if all stops hit" projections.
- **Open positions** — live P&L, editable SL/TP, auto-close on stop-loss with undo, and aggregate margin/exposure stats.
- **Alerts** — price and P&L alerts with crossover arming, cooldowns, persistence, and Telegram delivery.
- **Trade journal** — win rate, R:R, profit factor, fees, filters, and starred/archived trades.
- **Cloud sync** — local-first (localStorage) with debounced last-write-wins sync to a serverless KV store; JSON import/export.
- **Responsive** — works on mobile (bottom tab bar, safe-area aware) and desktop; light/dark themes.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 7, Tailwind CSS 4, Zustand (persisted store), Recharts (lazy-loaded).
- **Data feed:** Kraken WebSocket v2.
- **Backend:** Vercel Edge Functions (`/api/state`, `/api/telegram`) backed by Upstash Redis (KV).
- **Alerts service:** standalone Node/TypeScript worker (`alert-checker/`) that runs server-side so alerts fire even when no browser is open.

## Getting Started

```bash
npm install
npm run dev        # start the dev server
npm run lint       # eslint
npm run typecheck  # tsc project references
npm run build      # production build to dist/
```

## Environment Variables

Set these on the deployment (e.g. Vercel project settings):

| Variable | Purpose |
| --- | --- |
| `BREAKOUT_PASSWORD` | Shared secret. **Required** — the API fails closed if it is unset, and the client sends it as a bearer token. |
| `KV_REST_API_URL` | Upstash Redis REST URL (state storage). |
| `KV_REST_API_TOKEN` | Upstash Redis REST token. |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (optional; enables `/api/telegram`). |
| `TELEGRAM_CHAT_ID` | Telegram chat to notify (optional). |

## Deployment

The web app deploys to **Vercel** (static build + Edge Functions in `api/`).
`vercel.json` sets the security headers (CSP, HSTS, `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`). Provision an Upstash
Redis store and set the environment variables above.

## Architecture

```
breakout/
├── src/              # React frontend (TypeScript)
│   ├── components/   # UI (dashboard, positions, sizer, alerts, journal, settings)
│   ├── hooks/        # Kraken price feed + alert evaluation
│   ├── store/        # Zustand store (persisted + cloud sync)
│   └── utils/        # sizing, drawdown, Kraken pair mapping
├── api/              # Vercel Edge Functions: state (KV) + telegram relay
├── alert-checker/    # Standalone Node worker: server-side price/P&L alerts
└── vercel.json       # Security headers
```

### Alert checker

`alert-checker/` is an optional worker that mirrors the app state, watches the
Kraken feed, and sends Telegram alerts independently of the browser (useful when
the tab isn't open). It runs under systemd (see the included unit file).

```bash
cd alert-checker
cp .env.example .env   # fill in BREAKOUT_API_URL, BREAKOUT_PASSWORD, Telegram creds
npm install
npm run build
npm start
```

To watch multiple accounts, set `BREAKOUT_ACCOUNTS` (comma-separated `id` or
`id:Label` entries, e.g.
`main:100k,second:25k A,third:25k B,fourth:25k C,fifth:25k D`); the label appears
in each Telegram alert. The account ids must match the app's (`src/utils/constants.ts`).
Omit it to watch the single default account.

## Security notes

- API endpoints **fail closed**: with no `BREAKOUT_PASSWORD` configured they return `503` rather than serving/accepting data.
- The shared secret is compared in constant time; all traffic is served over HTTPS.
- Trading data is stored under a per-account KV key and is only as private as the shared password — treat it accordingly.

## Author

**Samuel Jo** — [GitHub](https://github.com/squireaintready) · [LinkedIn](https://linkedin.com/in/samuel-jo)

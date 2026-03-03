# Breakout — Real-Time Trading Terminal

A React/TypeScript terminal for monitoring live cryptocurrency trades with real-time data feeds and portfolio tracking.

## Features

- **Live Trade Monitoring** — Real-time cryptocurrency price feeds and trade execution tracking
- **Portfolio Dashboard** — Track positions, P&L, and portfolio allocation at a glance
- **Alert System** — Configurable price and volume alerts with custom trigger conditions
- **Multi-Asset Support** — Monitor BTC, ETH, SOL, and other major cryptocurrencies simultaneously

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **API Layer:** Custom Node.js/Express backend
- **Data:** Real-time market data via exchange APIs
- **Styling:** Modern terminal-inspired UI

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Architecture

```
breakout/
├── src/           # React frontend (TypeScript)
├── api/           # Backend API server
├── alert-checker/ # Alert monitoring service
└── public/        # Static assets
```

## Author

**Samuel Jo** — [GitHub](https://github.com/squireaintready) · [LinkedIn](https://linkedin.com/in/samuel-jo)

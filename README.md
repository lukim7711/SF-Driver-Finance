# SF Driver Finance 🏍️💰

Personal finance management app for **ShopeeFood/SPX Express Drivers** running as a **Telegram Bot**, hosted on **Cloudflare Workers Free Tier**.

## Key Features

- 📥 **Record Income** — from ShopeeFood / SPX delivery orders
- 📤 **Record Expenses** — fuel, parking, meals, cigarettes, data plan, household, etc.
- 💸 **Loan Tracking** — multi-platform pinjol installments with due dates, late fees, payoff tracking
- 🎯 **Income Targets** — set daily/weekly/monthly targets
- 📸 **OCR Receipt Reading** — receipt, notes, order screenshots → auto-extracted via ocr.space API
- 🤖 **Intent Detection** — send casual messages, bot understands the intent via AI
- 📊 **Financial Reports** — daily, weekly, monthly summaries
- 🔄 **AI Fallback** — auto-fallback to DeepSeek API when Workers AI approaches daily limit

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Cloudflare Workers (Free Tier) |
| Database | Durable Objects + SQLite storage |
| AI Primary | Workers AI — `@cf/qwen/qwen3-30b-a3b-fp8` (intent detection only) |
| AI Fallback | DeepSeek API |
| OCR | ocr.space API (free tier) |
| Bot Platform | Telegram Bot API (webhook mode) |
| Language | TypeScript |
| CI/CD | GitHub Actions (type check + auto-deploy) |

## Project Structure

```
SF-Driver-Finance/
├── .github/
│   └── workflows/
│       ├── ci.yml                # Type check on feature branches
│       └── deploy.yml            # Auto-deploy on merge to main
├── src/
│   └── index.ts              # Worker entry point
├── docs/
│   ├── AI-CONTEXT.md         # AI entry point (read this first)
│   ├── PROGRESS.md           # Current status & next steps
│   ├── ARCHITECTURE.md       # System architecture + conversation state
│   ├── DATABASE.md           # Database schema (7 tables incl. schema versioning)
│   ├── FEATURES.md           # Feature list & status
│   ├── API-FLOW.md           # Request flow diagrams
│   ├── DECISIONS.md          # Design decision log (17 decisions)
│   ├── LIMITS.md             # Free tier limits & strategies
│   ├── DEBT-STUDY-CASE.md    # Real-world loan data reference
│   └── CHANGELOG.md          # Change history
├── .gitignore                # Ignored files (node_modules, .wrangler, etc.)
├── wrangler.jsonc            # Cloudflare Workers configuration
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript strict configuration
└── README.md                 # This file
```

## Documentation

- [AI Context (Start Here)](docs/AI-CONTEXT.md)
- [Progress Tracker](docs/PROGRESS.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [Database Schema](docs/DATABASE.md)
- [Feature List](docs/FEATURES.md)
- [API Flow](docs/API-FLOW.md)
- [Design Decisions](docs/DECISIONS.md)
- [Limits & Strategy](docs/LIMITS.md)
- [Debt Study Case](docs/DEBT-STUDY-CASE.md)
- [Changelog](docs/CHANGELOG.md)

## Setup & Development

> ⚠️ Project is in planning phase. Setup instructions will be added when development begins.

### Prerequisites

- Node.js >= 18
- Cloudflare account (Free Tier)
- Telegram Bot Token (from @BotFather)
- DeepSeek API Key
- ocr.space API Key

### Quick Start

```bash
git clone https://github.com/lukim7711/SF-Driver-Finance.git
cd SF-Driver-Finance
npm install
npx wrangler dev   # Development mode
npx wrangler deploy # Deploy to Cloudflare
```

### Secrets Setup

```bash
# Cloudflare Workers secrets
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put OCR_SPACE_API_KEY

# GitHub Actions secret (for auto-deploy)
# Add CLOUDFLARE_API_TOKEN in GitHub repo Settings → Secrets → Actions
```

## License

Private project — all rights reserved.

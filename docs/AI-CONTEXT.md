# AI Context — SF Driver Finance

> **This file is the AI entry point.** When starting a new thread, ask the AI:
> *"Read `docs/AI-CONTEXT.md` and `docs/PROGRESS.md` from my repo, then confirm your understanding."*

---

## 1. About the Developer

- **Not a programmer** — relies entirely on AI tools (Perplexity.ai Max Enterprise, Claude Opus 4.6 Thinking) to write code.
- **Not a prompt engineer** — uses casual Indonesian language to communicate intent.
- **Workflow**: Perplexity.ai → GitHub MCP connector → code files pushed directly to this repo.
- **Language rule**: All code, comments, variable names, and commit messages **must be in English**. Documentation files (.md) may be in Indonesian or English.

## 2. Project Summary

**SF Driver Finance** is a personal finance Telegram Bot for a ShopeeFood/SPX Express driver (ojol). The bot runs on Cloudflare Workers (free tier) and helps track:

- Daily income from food delivery & package delivery (SPX)
- Daily operational expenses (fuel, parking, meals, cigarettes, data plan)
- Household expenses
- **Multi-platform online loan (pinjol) installments** with due dates, late fees, and payoff tracking
- Income targets per period

This is a **personal-use** application, not multi-tenant.

## 3. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Runtime | Cloudflare Workers (Free Tier) | 100K req/day, 10ms CPU |
| Database | Durable Objects + SQLite | 1 DO per user, 5GB storage |
| AI (Intent Detection) | Cloudflare Workers AI — `@cf/qwen/qwen3-30b-a3b-fp8` (primary) | 10K Neurons/day, ~4.4 Neurons/req |
| AI (Fallback) | DeepSeek API | ~$0.12/month estimated |
| OCR | **ocr.space API** (free tier) | NOT Workers AI vision model |
| Bot Platform | Telegram Bot API | Webhook mode |
| Language | **TypeScript** | Wrangler handles compilation natively |
| CI/CD | GitHub Actions | Type check on push, auto-deploy on merge to main |

### Important: AI Model Choice

**Primary model**: `@cf/qwen/qwen3-30b-a3b-fp8` — a MoE (Mixture of Experts) model with 30B total parameters but only 3B active per request. This means:
- Costs only ~4.4 Neurons per request (same as a 3B model)
- Quality comparable to a 30B model
- Strong multilingual support including Indonesian (Qwen is trained on Asian language data)
- Supports function calling for structured JSON output
- **~2,254 free requests/day** (vs 658 with the previous llama-3.1-8b-instruct)

**Why not `llama-3.1-8b-instruct`?** It costs ~15.2 Neurons/req — **3.4× more expensive** for similar or worse intent detection quality, especially for Indonesian natural language.

### Important: OCR Decision

OCR uses **ocr.space** free API (`https://ocr.space/`), NOT Cloudflare Workers AI image-to-text model. The API key is already obtained. This means:
- OCR does NOT consume Workers AI Neurons
- OCR requests go to ocr.space external API
- Workers AI is used ONLY for intent detection (text LLM) and parsing OCR-extracted text
- This significantly reduces Workers AI Neuron consumption

## 4. Core Feature Overview

See `docs/FEATURES.md` for full details. Key features:

| ID | Feature | Priority |
|---|---|---|
| F01 | Record Income (food/spx) | High |
| F02 | Record Expenses (operational + household) | High |
| F03 | Loan Tracking (pinjol multi-platform) | **Critical** |
| F04 | Income Targets (daily/weekly/monthly) | Medium |
| F05 | OCR Receipt Reading (via ocr.space) | Medium |
| F06 | Intent Detection (natural language) | High |
| F07 | Financial Reports | Medium |
| F08 | AI Fallback (Workers AI → DeepSeek) | High |

### Critical: Loan Feature Complexity

The loan/debt feature is the **most complex and most important** feature. It is NOT a simple "person owes person" tracker. It handles:

- Multiple online lending platforms (Shopee Pinjam, SPayLater, SeaBank, Kredivo, etc.)
- Fixed installment schedules with specific due dates per month
- Different late fee calculations per platform (percentage-based monthly, percentage-based daily)
- Remaining balance tracking (total owed vs already paid)
- Due date reminders and countdown
- Payoff progress tracking

See `docs/DEBT-STUDY-CASE.md` for the real-world data that this feature is based on.

## 5. Docs Map

All planning docs are **finalized** ✅. Read these files in order of relevance:

| Priority | File | When to Read |
|---|---|---|
| 🔴 Must | `docs/AI-CONTEXT.md` | Always — first file to read |
| 🔴 Must | `docs/PROGRESS.md` | Always — current status & next steps |
| 🟡 Important | `docs/FEATURES.md` | When implementing features |
| 🟡 Important | `docs/DATABASE.md` | When working with data/queries |
| 🟡 Important | `docs/ARCHITECTURE.md` | When building new components |
| 🟡 Important | `docs/DEBT-STUDY-CASE.md` | When working on loan feature (F03) |
| 🟢 Reference | `docs/API-FLOW.md` | When handling Telegram webhook flow |
| 🟢 Reference | `docs/DECISIONS.md` | When making architectural decisions |
| 🟢 Reference | `docs/LIMITS.md` | When optimizing for free tier limits |
| 🟢 Reference | `docs/CHANGELOG.md` | When reviewing history of changes |

## 6. Rules for AI Code Generation

1. **Language**: All code in **TypeScript** and in English (variables, functions, comments, logs, error messages).
2. **No pattern restrictions**: Use whatever code patterns, abstractions, or architecture best serve the goal. The developer does not read code — AI maintains it.
3. **Comments**: Add clear English comments explaining WHAT each function does and WHY.
4. **Error handling**: Always handle errors gracefully with user-friendly Telegram messages (in Indonesian for the end-user).
5. **Bot responses**: Telegram bot messages to the user should be in **Indonesian** (the user is Indonesian).
6. **Testing**: After each feature, provide a way to test it manually via Telegram.
7. **Incremental**: Build one feature at a time. Don't try to build everything in one session.
8. **Update PROGRESS.md**: At the end of each session, update `docs/PROGRESS.md` with what was done and what's next.
9. **Type safety**: Use proper TypeScript interfaces/types for Telegram API objects, database rows, AI responses, and intent detection results. Avoid `any` where possible.

## 7. Branching & Deployment Workflow

**CRITICAL: Never push directly to `main`.** All development uses feature branches.

### Branch Naming

| Type | Format | Example |
|---|---|---|
| Feature | `feat/f{ID}-{short-name}` | `feat/f09-onboarding` |
| Bug fix | `fix/{short-description}` | `fix/webhook-validation` |
| Docs only | `docs/{short-description}` | `docs/update-progress` |

### Workflow

1. **Create feature branch** from `main` (e.g., `feat/f09-onboarding`)
2. **Push code** to the feature branch
3. **CI auto-runs** TypeScript type check on every push
4. **Create PR** to `main` when feature is ready
5. **Merge PR** → triggers auto-deploy to Cloudflare Workers

### CI/CD Pipeline

- **On push to any branch (except main)**: `tsc --noEmit` type check
- **On PR to main**: `tsc --noEmit` type check
- **On merge to main** (only if src/, wrangler.jsonc, package.json, or tsconfig.json changed): Deploy to Cloudflare Workers via `wrangler deploy`

### Required GitHub Secrets

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Wrangler deploy authentication |

This must be added in GitHub repo Settings → Secrets and variables → Actions.

## 8. Environment Variables & Secrets

Configured via `wrangler secret put`:

| Secret | Purpose |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API authentication |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook request validation |
| `DEEPSEEK_API_KEY` | DeepSeek API fallback |
| `OCR_SPACE_API_KEY` | ocr.space API for receipt/image reading |

Public vars in `wrangler.jsonc`:

| Variable | Value | Purpose |
|---|---|---|
| `ENVIRONMENT` | production | Runtime environment flag |
| `BOT_NAME` | SF Driver Finance | Display name |
| `WORKERS_AI_DAILY_LIMIT` | 10000 | Neuron daily cap |
| `WORKERS_AI_FALLBACK_THRESHOLD` | 8000 | Trigger fallback at 80% |

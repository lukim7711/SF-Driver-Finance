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
| AI (Intent Detection) | Cloudflare Workers AI (primary) | 10K Neurons/day |
| AI (Fallback) | DeepSeek API | ~$0.12/month estimated |
| OCR | **ocr.space API** (free tier) | NOT Workers AI vision model |
| Bot Platform | Telegram Bot API | Webhook mode |
| Language | JavaScript (ES Modules) | No TypeScript, no build step |

### Important: OCR Decision

OCR uses **ocr.space** free API (`https://ocr.space/`), NOT Cloudflare Workers AI image-to-text model. The API key is already obtained. This means:
- OCR does NOT consume Workers AI Neurons
- OCR requests go to ocr.space external API
- Workers AI is used ONLY for intent detection (text LLM)
- This significantly reduces Workers AI Neuron consumption

## 4. Core Feature Overview

See `docs/FEATURES.md` for full details. Key features:

| ID | Feature | Priority |
|---|---|---|
| F01 | Record Income (food/spx) | High |
| F02 | Record Expenses (operational + household) | High |
| F03 | Debt/Loan Tracking (pinjol multi-platform) | **Critical** |
| F04 | Income Targets (daily/weekly/monthly) | Medium |
| F05 | OCR Receipt Reading (via ocr.space) | Medium |
| F06 | Intent Detection (natural language) | High |
| F07 | Financial Reports | Medium |
| F08 | AI Fallback (Workers AI → DeepSeek) | High |

### Critical: Debt Feature is NOT Simple

The debt feature is the **most complex and most important** feature. It is NOT a simple "person owes person" tracker. It handles:

- Multiple online lending platforms (Shopee Pinjam, SPayLater, SeaBank, Kredivo, etc.)
- Fixed installment schedules with specific due dates per month
- Different late fee calculations per platform (percentage-based, daily-based)
- Remaining balance tracking (total owed vs already paid)
- Due date reminders and countdown
- Payoff strategy and prioritization

See `docs/DEBT-STUDY-CASE.md` for the real-world data that this feature is based on.

## 5. Docs Map

Read these files in order of relevance:

| Priority | File | When to Read |
|---|---|---|
| 🔴 Must | `docs/AI-CONTEXT.md` | Always — first file to read |
| 🔴 Must | `docs/PROGRESS.md` | Always — current status & next steps |
| 🟡 Important | `docs/FEATURES.md` | When implementing features |
| 🟡 Important | `docs/DATABASE.md` | When working with data/queries |
| 🟡 Important | `docs/ARCHITECTURE.md` | When building new components |
| 🟢 Reference | `docs/API-FLOW.md` | When handling Telegram webhook flow |
| 🟢 Reference | `docs/DECISIONS.md` | When making architectural decisions |
| 🟢 Reference | `docs/LIMITS.md` | When optimizing for free tier limits |
| 🟢 Reference | `docs/CHANGELOG.md` | When reviewing history of changes |

## 6. Rules for AI Code Generation

1. **Language**: All code in English (variables, functions, comments, logs, error messages).
2. **Simplicity**: Write simple, readable code. Avoid complex patterns (no abstract factories, no deep inheritance). The developer is not a programmer.
3. **Comments**: Add clear English comments explaining WHAT each function does and WHY.
4. **Single file first**: Start with everything in `src/index.js`, refactor into modules only when the file gets too large (>300 lines per logical section).
5. **Error handling**: Always handle errors gracefully with user-friendly Telegram messages (in Indonesian for the end-user).
6. **Bot responses**: Telegram bot messages to the user should be in **Indonesian** (the user is Indonesian).
7. **Testing**: After each feature, provide a way to test it manually via Telegram.
8. **Incremental**: Build one feature at a time. Don't try to build everything in one session.
9. **Update PROGRESS.md**: At the end of each session, update `docs/PROGRESS.md` with what was done and what's next.

## 7. Environment Variables & Secrets

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

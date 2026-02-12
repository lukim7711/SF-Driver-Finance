# Design Decision Log

This document records important design decisions and their rationale.

---

## 2026-02-11 — Project Initialization

### Decision 1: Cloudflare Workers as Runtime

**Decision**: Use Cloudflare Workers Free Tier as the main runtime.

**Rationale**:
- Free up to 100,000 requests/day (sufficient for personal use)
- Edge computing = low latency globally
- Directly integrated with Workers AI and Durable Objects
- No server management needed

**Trade-off**: Limited to JavaScript/TypeScript/WASM, max 10ms CPU execution time (free tier).

---

### Decision 2: Durable Objects + SQLite as Database

**Decision**: Use Durable Objects with SQLite storage instead of D1 or KV.

**Rationale**:
- SQLite in Durable Objects = proper relational database
- Natural per-user isolation (1 DO per Telegram user)
- Transactional, consistent, and low-latency
- Free tier: 5GB storage, 5M row reads/day, 100K row writes/day

**Trade-off**: Data scattered per user (can't easily query cross-user). For a personal finance app, this is actually ideal.

---

### Decision 3: Workers AI + DeepSeek Fallback

**Decision**: Workers AI as primary AI, DeepSeek API as fallback.

**Rationale**:
- Workers AI: free 10,000 Neurons/day, sufficient for lightweight intent detection
- When approaching limit (~80%), automatically fallback to DeepSeek
- DeepSeek is cheap and reliable as backup
- Two providers = never completely down

**Trade-off**: Need to track daily Neuron usage to trigger fallback.

---

### Decision 4: Telegram Bot with Webhook Mode

**Decision**: Use Telegram Bot API with webhook, not long polling.

**Rationale**:
- Webhook fits serverless architecture (Workers)
- No persistent connection needed
- More efficient — only invoked when a message arrives

---

### Decision 5: Intent Detection, Not Command-Based

**Decision**: User sends natural language messages, bot detects intent via AI.

**Rationale**:
- More natural UX for a busy driver
- No need to memorize commands
- Example: "bensin 20rb" → intent: record_expense, category: fuel, amount: 20000

**Trade-off**: More complex engineering, requires good prompt design.

---

### Decision 6: One Durable Object per User

**Decision**: Each Telegram user gets their own Durable Object (ID = Telegram user ID).

**Rationale**:
- Automatic data isolation between users
- No race conditions between users
- Natural scaling — each user has their own SQLite database
- Perfect for personal finance app

---

### Decision 7: TypeScript

**Decision**: Use TypeScript as the project language.

**Rationale**:
- Type safety makes code more reliable and self-documenting
- AI tools (Perplexity/Claude) generate better, more consistent TypeScript code
- Wrangler supports TypeScript natively — no separate build step needed for deployment
- `tsconfig.json` is used for CI type checking (`tsc --noEmit`), not for build
- Better IDE support and autocompletion (helpful when reviewing AI-generated code)
- Interfaces/types make Telegram API objects, DB schemas, and intent results clearer

**Trade-off**: Slightly more verbose than plain JavaScript, but the safety and clarity benefits outweigh this for a project built entirely by AI.

---

## 2026-02-12 — Planning Revision

### Decision 8: OCR via ocr.space API (Not Workers AI)

**Decision**: Use ocr.space free API for OCR instead of Cloudflare Workers AI vision model.

**Rationale**:
- ocr.space provides a free tier (25,000 requests/month) specifically designed for OCR
- Does NOT consume Workers AI Neurons — this is critical because Neurons are the main bottleneck (only 10K/day)
- Separating OCR from intent detection means more Neurons available for AI tasks
- API key already obtained
- Simple REST API, easy to integrate

**Trade-off**: External dependency (ocr.space uptime), 1MB file size limit on free tier, but acceptable for receipt/screenshot photos.

---

### Decision 9: English Code, Indonesian Bot Responses

**Decision**: All code (variables, functions, comments, logs) must be in English. Telegram bot messages to the user are in Indonesian.

**Rationale**:
- English code is industry standard and more readable
- AI tools generate better code in English
- Stack Overflow / debugging is easier with English variable names
- The end-user is Indonesian, so bot messages must be in Indonesian for UX

**Trade-off**: Developer (non-programmer) is more comfortable in Indonesian, but AI handles the code generation anyway.

---

### Decision 10: Loan Tracking Redesign (Pinjol-Focused)

**Decision**: Replace simple person-to-person debt tracking with a full pinjol (online lending) installment tracking system.

**Rationale**:
- Real use case is tracking multiple online lending platforms (Shopee Pinjam, SPayLater, SeaBank, Kredivo)
- Each platform has different due dates, late fee rules, and installment amounts
- Need to track: loan info (parent) + installment schedule (children)
- Database redesigned: `debts` table replaced with `loans` + `installments` tables
- See `docs/DEBT-STUDY-CASE.md` for the real data that drove this decision

**Trade-off**: More complex database and feature logic, but this is the core value of the app.

---

### Decision 11: Pre-Generated Installment Rows

**Decision**: When a loan is registered, all installment rows are generated upfront (not on-demand).

**Rationale**:
- Makes it easy to query "what's due this month" or "what's the next payment"
- Supports variable last installment amounts (common in pinjol)
- Supports pre-marking installments as paid (for loans taken before bot existed)
- Simple SQL queries for dashboard and reports

**Trade-off**: More rows in database upfront, but SQLite handles this easily with indexes.

---

### Decision 12: Feature Branch Workflow

**Decision**: Never push code directly to `main`. All development happens on feature branches, merged via PR after CI passes.

**Rationale**:
- `main` branch = production. Every merge to `main` triggers auto-deploy to Cloudflare Workers.
- Feature branches isolate work-in-progress code, preventing broken code from reaching production.
- CI (TypeScript type check) runs on every push to feature branches and on PRs to `main`.
- If a feature breaks, `main` remains untouched and production stays stable.
- Branch naming convention: `feat/f01-record-income`, `fix/webhook-validation`, `docs/update-progress`.

**Workflow**:
1. Create feature branch from `main` (e.g., `feat/f09-onboarding`)
2. AI pushes code to feature branch
3. CI runs type check automatically
4. When ready → create PR to `main`
5. PR merge triggers auto-deploy to Cloudflare Workers

**Trade-off**: Slightly more steps than pushing directly to `main`, but prevents production breakage — critical since the developer is not a programmer and cannot manually fix broken deploys.

---

### Decision 13: No Code Pattern Restrictions for AI

**Decision**: Do not instruct AI to "write simple code" or limit code patterns.

**Rationale**:
- The developer does not read or maintain code directly — AI does.
- Constraining AI to "simple" patterns may prevent it from using the most effective or robust solution for a given problem.
- AI should be free to use any pattern (factory, strategy, etc.) if it genuinely serves the goal.
- Code quality is ensured by TypeScript strict mode, CI type checks, and AI code reviews — not by limiting patterns.

**Trade-off**: Code may be harder to read for a human, but since the developer relies entirely on AI for code generation and maintenance, this is acceptable.

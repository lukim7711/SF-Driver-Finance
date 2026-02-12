# Changelog

All notable changes to this project are documented here.

Format: `[Date] — Description`

---

## 2026-02-12 — Phase 2: Core Recording + AI Intent Detection (Session #10)

### Added (via PR #4: `feat/phase2-core-recording`)

- `src/types/intent.ts` — Intent detection types: 10 intent types, IncomeParams, ExpenseParams, ExpenseCategory (10 categories)
- `src/ai/prompt.ts` — AI prompt builder for Indonesian natural language → structured JSON intent detection
- `src/ai/parser.ts` — AI response parser with JSON extraction (handles markdown code blocks, `<think>` tags), intent/param validation
- `src/ai/workers-ai.ts` — Workers AI provider using Qwen3-30B-A3B model. Handles both OpenAI chat completion and simple response formats
- `src/ai/deepseek.ts` — DeepSeek API fallback provider via standard fetch
- `src/ai/intent-detector.ts` — Dual-provider orchestrator: Workers AI (primary, free) → DeepSeek (fallback, paid) at 80% daily Neuron threshold
- `src/ai/neuron-tracker.ts` — Daily Neuron usage tracking in `_neuron_usage` SQLite table
- `src/database/income.ts` — recordIncome, getTodayIncome (grouped by food/spx type)
- `src/database/expense.ts` — recordExpense, getTodayExpenses (grouped by category), CATEGORY_LABELS with Indonesian names
- `src/handlers/income.ts` — Income confirmation flow: show parsed data with inline keyboard → save on confirm → display today's food/spx/total breakdown
- `src/handlers/expense.ts` — Expense confirmation flow: show parsed data with category emoji → save on confirm → display today's per-category breakdown

### Updated

- `src/durable-object/finance-do.ts` — Full Phase 2 message routing: command → cancel → conversation state → AI intent detection → route to handler. Added callback query handling for inline keyboard confirm/cancel.

### Fixed (hotfixes after merge)

- **`.one()` crash** — Replaced all `SqlStorage.one()` calls with `.toArray()` in 6 files. Cloudflare's `.one()` throws on empty results instead of returning null. (commit `38cb19e`)
- **Workers AI response format** — Added support for OpenAI chat completion format (`choices[0].message.content`) returned by Qwen3-30B-A3B, in addition to simple `{ response }` format. (commit `0375de1`)
- **TypeScript type error** — `BaseAiTextGenerationModels` doesn't exist in Cloudflare types. Used `(ai as any).run()` with explicit response type cast. (commits `c6fa98c`, `a47d625`)

---

## 2026-02-12 — Phase 1: Foundation (Session #9)

### Added (via PR #2: `feat/phase1-foundation` → PR #3: `feat/phase1-foundation-v2`)

- `src/index.ts` — Worker entry point: webhook validation, POST routing, user ID extraction (from message or callback_query), Durable Object routing with `waitUntil` fire-and-forget pattern, `/health` endpoint
- `src/telegram/webhook.ts` — Webhook secret validation via `X-Telegram-Bot-Api-Secret-Token` header
- `src/telegram/api.ts` — Telegram Bot API client: sendMessage (HTML parse mode), sendText, sendWithKeyboard, editMessageText, answerCallbackQuery
- `src/types/telegram.ts` — Full Telegram type definitions: TelegramUser, TelegramChat, TelegramPhotoSize, TelegramCallbackQuery, TelegramMessage, TelegramUpdate, InlineKeyboardButton/Markup, SendMessageParams, AnswerCallbackQueryParams, EditMessageTextParams
- `src/types/conversation.ts` — ConversationState interface, PendingAction union type (6 actions: confirm_ocr, confirm_income, confirm_expense, register_loan_step, confirm_payment, edit_transaction)
- `src/durable-object/finance-do.ts` — Durable Object class with SQLite initialization, basic /start and /help command handling
- `src/database/schema.ts` — Schema initialization with version tracking via `_schema_meta` table. Creates 7 tables: users, income, expenses, loans, installments, targets, _schema_meta
- `src/database/user.ts` — getUserByTelegramId, registerUser (insert or update)
- `src/database/conversation.ts` — ensureConversationStateTable, getConversationState, setConversationState, clearConversationState with auto-expiry (5 min)
- `src/handlers/commands.ts` — handleStartCommand (welcome message in Indonesian), handleHelpCommand (usage guide with examples), handleCancelCommand

### Notes

- PR #2 had CI failure due to missing `Env` import in finance-do.ts. Fixed in PR #3 (recreated branch with all files).
- Bot successfully deployed and responding to `/start` in Telegram after PR #3 merge.

---

## 2026-02-12 — Post-Discussion Updates (Session #8)

### Revised

- `docs/AI-CONTEXT.md` — Tech stack: specified `@cf/qwen/qwen3-30b-a3b-fp8` as primary AI model. Added "AI Model Choice" section explaining MoE architecture and why it's 3.4× cheaper.
- `docs/LIMITS.md` — Complete recalculation: ~4.4 Neurons/req (was ~100-300). Daily budget table rewritten — 10 users now fit in free tier. Model comparison table added.
- `docs/API-FLOW.md` — Workers AI code example updated to `qwen3-30b-a3b-fp8`. Added conversation state check step to main flow diagram.
- `docs/DATABASE.md` — Added `_schema_meta` table for schema versioning. Added "Schema Versioning" section with migration mechanism and TypeScript code example. Updated data architecture diagram and important notes.
- `docs/ARCHITECTURE.md` — Added "Conversation State" section with flow diagram, TypeScript interface, pending_action table, and key rules. Added "Future: Mini App (Phase 4)" section. Updated system components, AI model references, and architecture patterns.
- `docs/PROGRESS.md` — Session #8 logged. Phase plan updated: Phase 1 includes conversation state infra, Phase 4 includes F11 Export + Mini App. Next steps updated.
- `docs/DECISIONS.md` — Added Decisions #14–#17: AI model change, schema versioning, conversation state, hybrid Mini App.
- `docs/FEATURES.md` — F05 OCR updated with conversation state note. Mini App added to Future Roadmap.
- `docs/CHANGELOG.md` — This entry.
- `README.md` — Updated tech stack (AI model name), database table count (7), decisions count (17).

---

## 2026-02-12 — Consistency Audit & Fixes (Session #7)

### Added

- `.gitignore` — Ignores node_modules, .wrangler, .dev.vars, dist, IDE files, OS files

### Fixed

- `.github/workflows/ci.yml` — Changed `npm ci` to `npm install` (no package-lock.json in repo)
- `.github/workflows/deploy.yml` — Changed `npm ci` to `npm install` (same reason)

### Revised

- `README.md` — Updated project structure tree: added .github/workflows, tsconfig.json, .gitignore. Added CI/CD to tech stack. Added GitHub Actions secret to setup instructions.
- `docs/DECISIONS.md` — Decision 7 clarified: tsconfig.json is for CI type checking, not for Wrangler build.
- `docs/LIMITS.md` — Added GitHub Actions free tier section (2,000 min/month for private repos, usage estimates).
- `docs/ARCHITECTURE.md` — Added CI/CD (GitHub Actions) to tech stack table.

---

## 2026-02-12 — Branching Strategy & CI/CD (Session #6)

### Added

- `.github/workflows/ci.yml` — TypeScript type check on every push to feature branches and PRs to main
- `.github/workflows/deploy.yml` — Auto-deploy to Cloudflare Workers on merge to main (only when src/, wrangler, package.json, or tsconfig changes)
- `tsconfig.json` — Strict TypeScript config targeting ES2022 with Cloudflare Workers types

### Revised

- `docs/DECISIONS.md` — Added Decision #12 (feature branch workflow) and Decision #13 (removed "write simple" code constraint)
- `docs/AI-CONTEXT.md` — New Section 7: Branching & Deployment Workflow. Updated Rule #2 (no pattern restrictions). Added CI/CD to tech stack. Added CLOUDFLARE_API_TOKEN to required secrets.
- `docs/PROGRESS.md` — Added CI/CD, branching, tsconfig to planning status. Added development workflow section. Updated next steps to include PR workflow.

---

## 2026-02-12 — Language Change: TypeScript (Session #5)

### Revised

- **All documentation** — JavaScript references changed to TypeScript across all docs
- `README.md` — Tech stack: TypeScript, project structure: `src/index.ts`
- `docs/AI-CONTEXT.md` — Tech stack, code generation rules updated for TypeScript (added Rule #10: type safety)
- `docs/ARCHITECTURE.md` — Tech stack table updated
- `docs/DECISIONS.md` — Decision 7 rewritten: TypeScript chosen (was JavaScript)
- `docs/API-FLOW.md` — Code examples converted to TypeScript syntax
- `wrangler.jsonc` — `main` changed from `src/index.js` to `src/index.ts`
- `package.json` — `main` changed to `src/index.ts`, added `typescript` and `@cloudflare/workers-types` devDependencies
- `src/index.ts` — New TypeScript entry point with `Env` interface and proper type annotations (replaces `src/index.js`)

---

## 2026-02-12 — Planning Finalization Part 2 (Session #4)

### Revised

- `README.md` — Rewritten in English. Updated tech stack (added ocr.space), project structure (added new docs), prerequisites (added ocr.space API key), secrets setup section.
- `docs/ARCHITECTURE.md` — Rewritten in English. Added ocr.space as separate component in architecture diagram. Updated database tables (loans + installments). Clarified AI layer only handles intent detection + OCR text parsing.
- `docs/CHANGELOG.md` — Rewritten in English. Added all session entries.
- `docs/AI-CONTEXT.md` — Updated to reflect all planning docs are finalized.

---

## 2026-02-12 — Planning Revision (Session #3)

### Revised

- `docs/DATABASE.md` — Complete rewrite: removed `debts` table, added `loans` + `installments` tables for pinjol tracking. Expanded expense categories (10 categories). All in English.
- `docs/FEATURES.md` — Rewritten in English. F03 expanded from 1 feature to 7 sub-features (F03a–F03g) for pinjol installment tracking. Added F12 (Debt Payoff Strategy) to roadmap.
- `docs/DECISIONS.md` — Rewritten in English. Added 4 new decisions (#8–#11): ocr.space for OCR, English code rule, loan tracking redesign, pre-generated installment rows.
- `docs/LIMITS.md` — Rewritten in English. OCR removed from Workers AI Neuron budget. Added ocr.space free tier limits. Recalculated daily budget estimates.
- `docs/API-FLOW.md` — Rewritten in English. OCR flow updated to 2-step process (ocr.space → AI text parsing). Added ocr.space API call details and response format.
- `wrangler.jsonc` — Added `OCR_SPACE_API_KEY` to secrets documentation.

### Added

- `docs/DEBT-STUDY-CASE.md` — Real-world loan data from 5 pinjol platforms (Shopee Pinjam, SPayLater, SeaBank, Kredivo ×2) as design reference for debt feature.

---

## 2026-02-12 — AI-Assisted Development Setup (Session #2)

### Added

- `docs/AI-CONTEXT.md` — AI entry point file for new thread context. Contains developer profile, project summary, tech stack, docs map, and code generation rules.
- `docs/PROGRESS.md` — Progress tracker with planning status, implementation status, known issues, next steps, and session log.

### Identified

- 3 major revisions needed: OCR → ocr.space, English code rule, debt feature redesign for pinjol.

---

## 2026-02-11 — Project Initialization (Session #1)

### Added

- Initial repository structure
- `wrangler.jsonc` — Cloudflare Workers + Durable Objects configuration
- `package.json` — Project metadata and base dependencies
- `src/index.js` — Placeholder entry point Worker + Durable Object class
- Complete documentation in `/docs`:
  - `ARCHITECTURE.md` — System architecture and flow diagram
  - `DECISIONS.md` — Initial design decision log (7 decisions)
  - `FEATURES.md` — Feature list (8 core + 2 supporting + 3 roadmap)
  - `CHANGELOG.md` — This file
  - `DATABASE.md` — SQLite database schema (5 tables)
  - `API-FLOW.md` — Detailed request flow from Telegram to response
  - `LIMITS.md` — Free tier limits and optimization strategies
- `README.md` — Project overview, tech stack, folder structure

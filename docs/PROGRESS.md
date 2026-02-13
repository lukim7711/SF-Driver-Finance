# Progress Tracker

> **AI Instruction**: Read this file to understand the current state of the project.
> Update this file at the end of every development session.

---

## Current Phase: Phase 3 IN PROGRESS 🔧

**Last Updated**: 2026-02-13  
**Last Session Summary**: F03e Late Fee Calculator — /denda command shows projected penalties for all overdue loans with per-installment breakdown, fee type explanation, subtotals, and actionable tips.

---

## Planning Status

| Task | Status | Notes |
|---|---|---|
| Project structure | ✅ Done | Folders and base files created |
| README.md | ✅ Done | English, TypeScript, all latest decisions |
| Architecture design | ✅ Done | Includes ocr.space, CI/CD, conversation state |
| Database schema | ✅ Done | loans + installments tables, 10 expense categories, schema versioning |
| Feature list | ✅ Done | F03 expanded to 7 sub-features for pinjol |
| API flow design | ✅ Done | 2-step OCR flow, TypeScript code examples |
| Decisions log | ✅ Done | 13 decisions documented |
| Limits & strategy | ✅ Done | All services covered incl. GitHub Actions |
| AI Context file | ✅ Done | `docs/AI-CONTEXT.md` with model info |
| Progress tracker | ✅ Done | This file |
| Debt study case doc | ✅ Done | `docs/DEBT-STUDY-CASE.md` with 5 platform data |
| Changelog | ✅ Done | All sessions documented |
| Wrangler config | ✅ Done | main → src/index.ts, all bindings and secrets |
| CI/CD pipeline | ✅ Done | GitHub Actions: type check + auto-deploy |
| Branching strategy | ✅ Done | Feature branches, merge to main via PR |
| tsconfig.json | ✅ Done | Strict mode, Cloudflare Workers types |
| .gitignore | ✅ Done | node_modules, .wrangler, .dev.vars, dist |

**All planning documentation is complete and consistent.** ✅

---

## Implementation Status

### Source Files (28 files on `feat/f03e-late-fee-calculator` branch)

#### Entry Point & Config

| File | Status | Description |
|---|---|---|
| `src/index.ts` | ✅ Done | Worker entry point — webhook validation, DO routing for message + callback_query |
| `wrangler.jsonc` | ✅ Done | DO binding, AI binding, vars, secrets |
| `package.json` | ✅ Done | wrangler + typescript + @cloudflare/workers-types |
| `tsconfig.json` | ✅ Done | Strict TypeScript for Cloudflare Workers |
| `.github/workflows/ci.yml` | ✅ Done | Type check on push to feature branches + PRs |
| `.github/workflows/deploy.yml` | ✅ Done | Auto-deploy to Cloudflare on merge to main |
| `.gitignore` | ✅ Done | node_modules, .wrangler, .dev.vars, dist, IDE files |

#### Telegram Layer (`src/telegram/`)

| File | Status | Description |
|---|---|---|
| `src/telegram/api.ts` | ✅ Done | Bot API client: sendMessage, sendText, sendWithKeyboard, editMessageText, answerCallbackQuery |
| `src/telegram/webhook.ts` | ✅ Done | Webhook secret validation via `X-Telegram-Bot-Api-Secret-Token` header |

#### Type Definitions (`src/types/`)

| File | Status | Description |
|---|---|---|
| `src/types/telegram.ts` | ✅ Done | TelegramUpdate, TelegramMessage, TelegramCallbackQuery, InlineKeyboardMarkup, SendMessageParams, etc. |
| `src/types/conversation.ts` | ✅ Done | PendingAction union type (`confirm_ocr`, `confirm_income`, `confirm_expense`, `confirm_loan`, `loan_fill_missing`, `loan_edit_select`, `loan_edit_field`, `confirm_payment`, `edit_transaction`), ConversationState interface |
| `src/types/intent.ts` | ✅ Done | IntentType (10 intents), IncomeType, ExpenseCategory (10 categories), IncomeParams, ExpenseParams, RegisterLoanParams (8 optional fields), PayInstallmentParams, IntentResult, IntentResultWithProvider |
| `src/types/loan.ts` | ✅ Done | LateFeeType, LoanStatus, InstallmentStatus, LoanRegistrationData, LoanRow, InstallmentRow |

#### Durable Object (`src/durable-object/`)

| File | Status | Description |
|---|---|---|
| `src/durable-object/finance-do.ts` | ✅ Done | Main DO class — DB init, proactive alerts (Step 0), message routing (command → cancel → conversation state → intent guard → AI intent → route), callback query handling. /hutang and /denda shortcut commands. |

#### Database Layer (`src/database/`)

| File | Status | Description |
|---|---|---|
| `src/database/schema.ts` | ✅ Done | Schema init + migration with `_schema_meta` version tracking. Creates 7 tables: users, income, expenses, loans, installments, targets, _schema_meta |
| `src/database/user.ts` | ✅ Done | getUserByTelegramId, registerUser (upsert) |
| `src/database/conversation.ts` | ✅ Done | ensureConversationStateTable, getConversationState, setConversationState, clearConversationState |
| `src/database/income.ts` | ✅ Done | recordIncome, getTodayIncome (grouped by food/spx) |
| `src/database/expense.ts` | ✅ Done | recordExpense, getTodayExpenses (grouped by category), CATEGORY_LABELS map |
| `src/database/loan.ts` | ✅ Done | registerLoan (insert loan + auto-generate installment rows), getLoans, getLoanById, getInstallmentsByLoan, getUpcomingInstallments, markInstallmentPaid (update status + late fee + increment counter + auto-mark loan as paid_off) |

#### AI Layer (`src/ai/`)

| File | Status | Description |
|---|---|---|
| `src/ai/prompt.ts` | ✅ Done | buildIntentPrompt — Indonesian NLP prompt with all 10 intents, loan param extraction (8 fields with examples), expense categories, Rp shorthand parsing rules |
| `src/ai/parser.ts` | ✅ Done | parseIntentResponse — extracts JSON from AI response (handles markdown code blocks, thinking tags), validates intent/params |
| `src/ai/workers-ai.ts` | ✅ Done | detectIntentWorkersAI — Qwen3-30B-A3B via Workers AI binding. Handles both OpenAI chat completion format and simple response format |
| `src/ai/deepseek.ts` | ✅ Done | detectIntentDeepSeek — DeepSeek chat API via fetch, used as paid fallback |
| `src/ai/intent-detector.ts` | ✅ Done | detectIntent — orchestrator: uses Workers AI when Neurons < 80% threshold, falls back to DeepSeek on failure or budget exceeded |
| `src/ai/neuron-tracker.ts` | ✅ Done | ensureNeuronTable, getNeuronCount, incrementNeuronCount — tracks daily Neuron usage in `_neuron_usage` SQLite table |

#### Handlers (`src/handlers/`)

| File | Status | Description |
|---|---|---|
| `src/handlers/commands.ts` | ✅ Done | handleStartCommand (welcome + register), handleHelpCommand (usage guide), handleCancelCommand |
| `src/handlers/income.ts` | ✅ Done | handleIncomeConfirmation (show confirmation keyboard), processIncomeConfirmed (save + show today's totals), formatRupiah helper |
| `src/handlers/expense.ts` | ✅ Done | handleExpenseConfirmation (show confirmation keyboard with category emoji), processExpenseConfirmed (save + show category breakdown) |
| `src/handlers/loan.ts` | ✅ Done | Hybrid conversational loan registration: handleLoanFromAI (AI extraction → smart confirmation), handleMissingFieldInput (mini-wizard for gaps), handleLoanConfirmSave/Edit, handleLateFeeTypeCallback, handleEditSelection/EditFieldInput, parseAmount (supports jt/rb/k shorthand) |
| `src/handlers/payment.ts` | ✅ Done | Installment payment recording: handlePaymentFromAI (fuzzy platform matching → find next unpaid installment → show confirmation with due date + late fee), handlePaymentConfirmed (mark as paid + update loan counter + check if paid_off), calculateLateFee (percent_monthly, percent_daily, fixed) |
| `src/handlers/dashboard.ts` | ✅ Done | Loan dashboard: handleLoanDashboard — shows all active loans sorted by nearest due date, visual progress bars (█░), urgency icons (🔴🟠🟡🟢), due date countdowns, summary totals (remaining debt, monthly obligation), paid-off loan list, empty state. /hutang shortcut. |
| `src/handlers/alerts.ts` | ✅ Done | Proactive due date alerts: checkAndSendAlerts (throttled 1x/6hr via _alert_meta table), getAlertableInstallments (overdue + within 3 days), ensureAlertMetaTable. Urgency levels: 🔴 TELAT BAYAR, ⚠️ JATUH TEMPO HARI INI, 🟡 SEGERA JATUH TEMPO. |
| `src/handlers/late-fee-calc.ts` | ✅ Done | Late fee calculator: handleLateFeeCalculator — /denda or /denda [platform]. Per-installment breakdown (days late, pokok, denda, total), fee type explanation, subtotals per loan, grand total across all loans. Exported calculateLateFee for reuse. Actionable tips. |

### Features Implementation

| ID | Feature | Status | Phase | Key Files |
|---|---|---|---|---|
| F09 | User Onboarding | ✅ Done | 1 | `database/user.ts`, `handlers/commands.ts` |
| F10 | Basic Commands | ✅ Done | 1 | `handlers/commands.ts`, `durable-object/finance-do.ts` |
| F06 | Intent Detection | ✅ Done | 2 | `ai/prompt.ts`, `ai/parser.ts`, `ai/intent-detector.ts` |
| F08 | AI Fallback | ✅ Done | 2 | `ai/workers-ai.ts`, `ai/deepseek.ts`, `ai/intent-detector.ts`, `ai/neuron-tracker.ts` |
| F01 | Record Income | ✅ Done | 2 | `handlers/income.ts`, `database/income.ts` |
| F02 | Record Expenses | ✅ Done | 2 | `handlers/expense.ts`, `database/expense.ts` |
| F03a | Register Loan | ✅ Done | 3 | `handlers/loan.ts`, `database/loan.ts`, `types/loan.ts`, `types/intent.ts` |
| F03b | Record Installment Payment | ✅ Done | 3 | `handlers/payment.ts`, `database/loan.ts` (markInstallmentPaid) |
| F03c | View Loan Dashboard | ✅ Done | 3 | `handlers/dashboard.ts`, `durable-object/finance-do.ts` (/hutang) |
| F03d | Due Date Alerts | ✅ Done | 3 | `handlers/alerts.ts`, `durable-object/finance-do.ts` (Step 0) |
| F03e | Late Fee Calculator | ✅ Done | 3 | `handlers/late-fee-calc.ts`, `durable-object/finance-do.ts` (/denda) |
| F03f | Monthly Obligation Summary | 🔲 Not Started | 3 | — |
| F03g | Payoff Progress | 🔲 Not Started | 3 | — |
| F04 | Income Targets | 🔲 Not Started | 4 | — |
| F05 | OCR (ocr.space) | 🔲 Not Started | 4 | — |
| F07 | Financial Reports | 🔲 Not Started | 4 | — |

---

## Known Issues & Lessons Learned

### Resolved Issues

| Issue | Root Cause | Fix | Commit |
|---|---|---|---|
| Bot crashes on every message | Cloudflare `SqlStorage.one()` throws on empty results (doesn't return null) | Replaced all `.one()` with `.toArray()` + length check in 6 files | `38cb19e` |
| Workers AI always falls back to DeepSeek | Qwen3-30B-A3B returns OpenAI chat completion format (`choices[0].message.content`) not simple `{ response }` | Added `extractResponseText()` handling both formats | `0375de1` |
| TypeScript CI fails | `BaseAiTextGenerationModels` type doesn't exist in Cloudflare types | Used `(ai as any).run()` with explicit response type cast | `a47d625` |
| New PendingAction values not in union type | `conversation.ts` PendingAction didn't include new loan states | Added `confirm_loan`, `loan_fill_missing`, `loan_edit_select`, `loan_edit_field` to PendingAction | `6b439a0` |
| User types new intent during active wizard → confusing validation error | Conversation state takes priority; wizard tries to parse "hutang di warung..." as a number | Added `looksLikeNewIntent()` keyword heuristic guard — warns user to /batal first | `d0e35a5` |

### Active Notes

- **`CLOUDFLARE_API_TOKEN`** must be set in GitHub repo Settings → Secrets for auto-deploy.
- **Durable Object SQLite**: Always use `.toArray()` instead of `.one()` when a query might return 0 rows.
- **Workers AI response format**: Newer models (Qwen3) return OpenAI-compatible chat completion format, not the simple `{ response }` format shown in Cloudflare docs.
- **CI runs twice per push to PR branch**: GitHub Actions fires both `push` and `pull_request` events. Can optimize later by restricting `push` trigger to `main` only.
- **Loan UX design**: Conversational-first (AI extraction → confirm) is much better than step-by-step wizards for chat-based interfaces. Users provide most info in one message.
- **Payment recording**: Fuzzy platform name matching (case-insensitive substring) works well for natural language ("bayar shopee" matches "Shopee Pinjam").
- **Late fee calculation**: Duplicated in `payment.ts` (private) and `late-fee-calc.ts` (exported). Could refactor to shared utility later.
- **Dashboard**: `/hutang` shortcut command bypasses AI — saves Neurons for a purely read-only operation.
- **Alert throttling**: Using `_alert_meta` key-value table with timestamp. 6-hour cooldown prevents spam while ensuring driver sees warnings at least twice per active day.
- **Penalty calculator**: `/denda` also bypasses AI. Shows projected penalties based on current date — good for drivers deciding which loan to pay first.

---

## Implementation Order (Recommended)

Phased approach — build foundation first, then layer features:

### Phase 1: Foundation ✅ COMPLETE
1. ~~**F09 — User Onboarding** + **F10 — Basic Commands**~~ → Done
2. ~~**Database initialization**~~ → Done (7 tables + schema versioning)
3. ~~**Conversation state**~~ → Done (pending_action infrastructure)

### Phase 2: Core Recording ✅ COMPLETE
4. ~~**F06 — Intent Detection**~~ → Done (Workers AI + Indonesian NLP prompt)
5. ~~**F08 — AI Fallback**~~ → Done (Workers AI → DeepSeek at 80% Neurons)
6. ~~**F01 — Record Income**~~ → Done (confirmation keyboard → save → today's totals)
7. ~~**F02 — Record Expenses**~~ → Done (confirmation keyboard → save → category breakdown)

### Phase 3: Loan Tracking (Critical) ← IN PROGRESS
8. ~~**F03a — Register Loan**~~ → ✅ Done (hybrid conversational flow + intent guard)
9. ~~**F03b — Record Payment**~~ → ✅ Done (fuzzy platform match + late fee calc + auto paid_off)
10. ~~**F03c — Loan Dashboard**~~ → ✅ Done (progress bars, urgency icons, summary totals, /hutang command)
11. ~~**F03d — Due Date Alerts**~~ → ✅ Done (proactive alerts, throttled 1x/6hr, 3 urgency levels)
12. ~~**F03e — Late Fee Calculator**~~ → ✅ Done (/denda command, per-installment breakdown, grand totals)
13. **F03f — Monthly Summary** → Aggregate obligations ← NEXT
14. **F03g — Payoff Progress** → Track overall progress

### Phase 4: Advanced
15. **F04 — Income Targets** → Goal setting
16. **F05 — OCR** → Receipt/screenshot reading (chat-based confirmation)
17. **F07 — Financial Reports** → Comprehensive summaries
18. **F11 — Export CSV** → Data export for backup
19. **Telegram Mini App** → Bulk OCR review, loan registration form, table editing UI

---

## Development Workflow

**For each feature:**
1. Create branch: `feat/f{ID}-{name}` from `main`
2. Push code to feature branch
3. CI auto-checks TypeScript types
4. Create PR to `main`
5. Merge → auto-deploy to Cloudflare Workers

---

## Next Steps (For Next Session)

**Continue Phase 3: Loan Tracking**

1. **F03f — Monthly Summary**: "ringkasan bulan ini" → aggregate all loan obligations for current month
2. **F03g — Payoff Progress**: Overall debt reduction tracker with percentage
3. Consider combining F03f + F03g into a single comprehensive summary view

---

## Session Log

| Date | Session | Summary |
|---|---|---|
| 2026-02-11 | #1 | Initial project setup: README, architecture, database schema, features, decisions, limits, API flow, changelog |
| 2026-02-12 | #2 | Added AI-CONTEXT.md & PROGRESS.md. Identified 3 major revisions needed |
| 2026-02-12 | #3 | Major revision: DATABASE, FEATURES, DECISIONS, LIMITS, API-FLOW, wrangler. Added DEBT-STUDY-CASE.md |
| 2026-02-12 | #4 | Finalized all docs: README, ARCHITECTURE, CHANGELOG, AI-CONTEXT updated |
| 2026-02-12 | #5 | Language change: JavaScript → TypeScript. All docs, config, entry point updated |
| 2026-02-12 | #6 | Branching strategy + CI/CD + tsconfig. Removed "write simple" constraint. Decisions #12–13 |
| 2026-02-12 | #7 | Consistency audit: added .gitignore, fixed CI (npm install), updated README/DECISIONS/LIMITS/ARCHITECTURE |
| 2026-02-12 | #8 | Post-discussion updates: AI model → qwen3-30b-a3b-fp8, schema versioning, conversation state design, Mini App for Phase 4 |
| 2026-02-12 | #9 | **Phase 1 complete**: F09 Onboarding + F10 Commands. Telegram webhook, /start, /help, /batal, DB schema init (7 tables), conversation state infra, Telegram API client. Deployed via PR #2 → PR #3 |
| 2026-02-12 | #10 | **Phase 2 complete**: F06 Intent Detection + F08 AI Fallback + F01 Income + F02 Expense. AI prompt for Indonesian NLP, dual-provider orchestrator (Workers AI + DeepSeek), income/expense recording with inline keyboard confirmation, Neuron tracking. Fixed 3 runtime bugs: .one() crash, Workers AI response format, TS type error. Deployed via PR #4 + hotfixes |
| 2026-02-13 | #11 | **F03a Register Loan complete**: Redesigned 7-step wizard → hybrid conversational flow. AI extracts loan params from natural language → smart confirmation → mini-wizard for missing fields only. Edit mode (pick 1-7). Intent guard for active wizard. Deployed via PR #5 → PR #6 → PR #7 |
| 2026-02-13 | #12 | **F03b Record Payment complete**: Installment payment recording with fuzzy platform matching, late fee calculation (percent_monthly/daily/fixed), auto loan status update to paid_off. Deployed via PR #8 |
| 2026-02-13 | #13 | **F03c Loan Dashboard complete**: Visual dashboard with progress bars, urgency icons, due date countdowns, summary totals. /hutang shortcut command. Deployed via PR #9 |
| 2026-02-13 | #14 | **F03d Due Date Alerts complete**: Proactive alerts on every message (throttled 1x/6hr via _alert_meta table). 3 urgency levels. Deployed via PR #10 |
| 2026-02-13 | #15 | **F03e Late Fee Calculator complete**: /denda command — per-installment penalty breakdown, fee type display, subtotals per loan, grand total across all loans, actionable tips. /denda [platform] for specific loan. New handler: `late-fee-calc.ts`. |

# Progress Tracker

> **AI Instruction**: Read this file to understand the current state of the project.
> Update this file at the end of every development session.

---

## Current Phase: 📋 PLANNING (Pre-Development)

**Last Updated**: 2026-02-12
**Last Session Summary**: Initial project setup — documentation only, no code implementation yet.

---

## Planning Status

| Task | Status | Notes |
|---|---|---|
| Project structure | ✅ Done | Folders and base files created |
| README.md | ✅ Done | Overview documentation |
| Architecture design | ✅ Done | See `docs/ARCHITECTURE.md` |
| Database schema | ⚠️ Needs Revision | Debt table needs major redesign for pinjol installments |
| Feature list | ⚠️ Needs Revision | Debt feature needs expansion, OCR source changed |
| API flow design | ✅ Done | See `docs/API-FLOW.md` |
| Decisions log | ⚠️ Needs Revision | Add OCR.space decision, update OCR-related decisions |
| Limits & strategy | ⚠️ Needs Revision | OCR no longer uses Workers AI Neurons |
| AI Context file | ✅ Done | `docs/AI-CONTEXT.md` |
| Progress tracker | ✅ Done | This file |
| Debt study case doc | 🔲 Not Started | Need to add `docs/DEBT-STUDY-CASE.md` from user's research |
| Wrangler config | ⚠️ Needs Revision | Add `OCR_SPACE_API_KEY` to secrets list |

## Pending Revisions (Before Coding Starts)

These docs need to be updated to reflect the latest decisions:

### 1. DATABASE.md — Debt Table Redesign
**Why**: Current `debts` table is designed for simple person-to-person debt. Real use case is multi-platform pinjol with installment schedules.

**What needs to change**:
- Add `loans` table (platform info, total amount, interest, late fee rules)
- Add `installments` table (per-month schedule with due dates, amounts, paid status)
- Remove or repurpose simple `debts` table
- Support platforms: Shopee Pinjam, SPayLater, SeaBank Pinjam, Kredivo (multiple)
- Track: original amount, remaining balance, monthly installment, due date (day of month), late fee calculation method, paid installments vs remaining

### 2. FEATURES.md — Debt Feature Expansion
**Why**: F03 (Tracking Hutang) is too simple. Needs to match real pinjol use case.

**What needs to change**:
- Add loan registration (add new platform + schedule)
- Installment payment recording
- Due date countdown & reminders
- Late fee calculation (different per platform: percentage/month vs percentage/day)
- Payoff progress visualization
- Priority suggestion (which loan to pay first)

### 3. DECISIONS.md — New Decisions
**What to add**:
- Decision: OCR via ocr.space API (not Workers AI vision)
- Decision: Code language is English, bot responses in Indonesian
- Decision: Debt architecture redesign for pinjol installments

### 4. LIMITS.md — OCR Impact
**What to change**:
- OCR no longer consumes Workers AI Neurons
- Add ocr.space free tier limits (25,000 requests/month, 1MB file size)
- Recalculate daily Neuron budget (more Neurons available for intent detection now)

### 5. wrangler.jsonc
**What to change**:
- Add `OCR_SPACE_API_KEY` to secrets documentation/comments

---

## Implementation Status

### Files Created

| File | Status | Description |
|---|---|---|
| `src/index.js` | 🔲 Placeholder | Returns "Coming Soon" — no logic yet |
| `wrangler.jsonc` | ✅ Configured | DO binding, AI binding, vars set |
| `package.json` | ✅ Configured | Only wrangler as devDependency |

### Features Implementation

| ID | Feature | Status | File(s) |
|---|---|---|---|
| F01 | Record Income | 🔲 Not Started | — |
| F02 | Record Expenses | 🔲 Not Started | — |
| F03 | Debt/Loan Tracking | 🔲 Not Started | — |
| F04 | Income Targets | 🔲 Not Started | — |
| F05 | OCR (ocr.space) | 🔲 Not Started | — |
| F06 | Intent Detection | 🔲 Not Started | — |
| F07 | Financial Reports | 🔲 Not Started | — |
| F08 | AI Fallback | 🔲 Not Started | — |
| F09 | User Onboarding | 🔲 Not Started | — |
| F10 | Basic Commands | 🔲 Not Started | — |

---

## Known Issues & Bugs

*No issues yet — development has not started.*

---

## Next Steps (For Next Session)

1. **Revise `docs/DATABASE.md`** — Redesign debt tables for pinjol installment tracking (loans + installments tables)
2. **Add `docs/DEBT-STUDY-CASE.md`** — Document the real-world debt data as reference for the debt feature
3. **Revise `docs/FEATURES.md`** — Expand F03 debt feature with pinjol-specific functionality
4. **Revise `docs/DECISIONS.md`** — Add new decisions (ocr.space, English code, debt redesign)
5. **Revise `docs/LIMITS.md`** — Update Neuron calculations now that OCR doesn't use Workers AI
6. **Update `wrangler.jsonc`** — Add OCR_SPACE_API_KEY to secrets comments
7. After all docs are finalized → Start implementation with F09 (Onboarding) + F10 (Basic Commands) as foundation

---

## Session Log

| Date | Session | Summary |
|---|---|---|
| 2026-02-11 | #1 | Initial project setup: README, architecture, database schema, features, decisions, limits, API flow, changelog |
| 2026-02-12 | #2 | Added AI-CONTEXT.md & PROGRESS.md. Identified 3 major revisions needed: OCR→ocr.space, English code, debt feature redesign for pinjol |

# Changelog

All notable changes to this project are documented here.

Format: `[Date] — Description`

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

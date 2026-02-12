# System Architecture

## Overview

SF Driver Finance uses a **serverless** architecture based on Cloudflare Workers with Durable Objects as the database. The system receives messages from Telegram via webhook, processes intent using AI, extracts text from images using ocr.space, and stores financial data in SQLite (within Durable Objects).

## Architecture Diagram

```
┌─────────────┐     webhook      ┌──────────────────────┐
│  Telegram    │ ──────────────→ │  Cloudflare Worker    │
│  User Chat   │                 │  (Router/Handler)     │
└─────────────┘                  └──────────┬───────────┘
                                            │
                    ┌───────────┬───────────┼───────────┬───────────┐
                    │           │           │           │           │
                    ▼           ▼           ▼           ▼           ▼
          ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐
          │ Workers AI │ │ DeepSeek   │ │ ocr.space  │ │ Durable Objects│
          │ (Primary)  │ │ (Fallback) │ │ (OCR)      │ │ SQLite Storage │
          │            │ │            │ │            │ │                │
          │ • Intent   │ │ • Intent   │ │ • Image to │ │ • _schema_meta │
          │   Detection│ │   Detection│ │   text     │ │ • users        │
          │ • OCR text │ │ • OCR text │ │ • Receipt  │ │ • income       │
          │   parsing  │ │   parsing  │ │   reading  │ │ • expenses     │
          └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ │ • loans        │
                │              │               │        │ • installments │
                └──────┬───────┘               │        │ • targets      │
                       │              ┌────────┘        └───────┬────────┘
                       ▼              ▼                         │
                ┌─────────────────────────────┐                 │
                │   Handler                   │ ◄───────────────┘
                │   (Business Logic)          │
                │                             │
                │   • Income recording        │
                │   • Expense recording       │
                │   • Loan management         │
                │   • Target tracking         │
                │   • Report generation       │
                └────────────┬────────────────┘
                             │
                             ▼
                   ┌─────────────────┐
                   │ Telegram Bot API│
                   │ (Send Response) │
                   └─────────────────┘
```

## System Components

### 1. Cloudflare Worker (Entry Point)

- Receives webhook POST from Telegram
- Validates request (webhook secret)
- **Checks conversation state** before routing to AI (see Conversation State section)
- Routes to appropriate handler
- Manages AI provider selection (Workers AI vs DeepSeek)

### 2. AI Layer (Intent Detection + OCR Text Parsing)

- **Primary**: Cloudflare Workers AI — `@cf/qwen/qwen3-30b-a3b-fp8` (free, 10,000 Neurons/day, ~4.4 Neurons/req)
- **Fallback**: DeepSeek API (paid, used when approaching AI limit)
- **Purpose**: Detect intent from user messages and parse OCR-extracted text into structured data
- **NOT used for**: Image-to-text OCR (that's ocr.space's job)

### 3. ocr.space (OCR — Image to Text)

- **External API**: `https://api.ocr.space/parse/image`
- **Purpose**: Extract raw text from receipt photos, screenshots, notes
- **Free tier**: 25,000 requests/month, 1MB file size limit
- **Does NOT consume** Workers AI Neurons
- Extracted text is then sent to AI layer for data parsing

### 4. Durable Objects + SQLite

- One Durable Object per user (based on Telegram user ID)
- Built-in SQLite storage for all financial data
- 7 tables: _schema_meta, users, income, expenses, loans, installments, targets
- Schema versioning via `_schema_meta` table (see `DATABASE.md`)
- Consistent, low-latency, included in free tier

### 5. Telegram Bot API

- Mode: Webhook (not polling)
- Sends responses back to user via sendMessage
- Downloads user photos via getFile
- Supports inline keyboard buttons for confirmation flows
- Supports `editMessageText` for updating previous bot messages

## Conversation State

Several features require **multi-step interactions** where the bot needs to "remember" what the user is doing across multiple messages. Since each Telegram message is a separate Worker request (stateless), conversation state is stored in the user's Durable Object.

### Why Needed

- **OCR confirmation**: User sends photo → bot shows parsed result → user replies "Ya"/"Tidak" → bot must know this reply is a confirmation, not a new message to send to AI
- **Loan registration**: Requires multiple data points (platform, amount, installments, due day, etc.) that may be collected step-by-step via chat
- **Data editing**: User wants to edit a recorded transaction — bot shows options, user picks one, bot asks for new value

### Design

Conversation state is stored as a simple JSON object in the user's Durable Object (in-memory or in a dedicated SQLite row). The state is checked **before** AI intent detection to save Neurons.

```
Incoming message
      │
      ▼
┌─────────────────────┐
│ Check pending_action │
│ in Durable Object   │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
   Has state   No state
     │           │
     ▼           ▼
  Handle      Send to AI
  based on    for intent
  context     detection
  (no AI      (uses Neurons)
   needed)
```

### State Structure

```typescript
interface ConversationState {
  /** The action awaiting user response */
  pending_action: string;
  /** Data collected so far in this multi-step flow */
  pending_data: Record<string, unknown>;
  /** Auto-expire to prevent stale state (ISO 8601) */
  expires_at: string;
}
```

**Examples of `pending_action` values:**

| pending_action | Trigger | Expected User Response |
|---|---|---|
| `confirm_ocr` | Bot parsed OCR result, awaiting confirmation | "Ya" / "Tidak" / edit value |
| `confirm_income` | Bot parsed income, awaiting confirmation | "Ya" / "Tidak" |
| `confirm_expense` | Bot parsed expense, awaiting confirmation | "Ya" / "Tidak" |
| `register_loan_step` | Collecting loan data step-by-step | Platform name, amount, etc. |
| `confirm_payment` | Bot asks which installment to mark paid | Installment selection |
| `edit_transaction` | User wants to edit a record | New value |

### Key Rules

1. **State is checked before AI** — if `pending_action` exists and is not expired, the message is handled by the state handler (no Neurons consumed)
2. **Auto-expiry** — state expires after a timeout (e.g., 5 minutes). If expired, treat as a fresh message and send to AI
3. **Cancel keyword** — user can always type "batal" or "/batal" to clear pending state and start fresh
4. **One state at a time** — only one `pending_action` per user. Starting a new multi-step flow clears the old one
5. **Inline keyboard preferred** — where possible, use Telegram inline keyboard buttons (✅ Ya / ❌ Tidak) instead of expecting text replies. This avoids ambiguity

### Neurons Savings

Without conversation state, every user reply (including "Ya", "Tidak", "batal") would be sent to AI for intent detection (~4.4 Neurons each). With conversation state, only genuinely new messages need AI processing. For a typical session with 3-5 confirmation exchanges, this saves ~13-22 Neurons per session.

## Architecture Patterns

- **Serverless**: No servers to manage
- **Event-driven**: Each Telegram message = 1 Worker invocation
- **AI-first**: Intent detection replaces command-based bot
- **Per-user isolation**: Each user has their own Durable Object + SQLite database
- **Dual AI providers**: Workers AI (free) + DeepSeek (cheap fallback) = never fully down
- **Separated OCR**: ocr.space handles image→text, AI handles text→data (saves Neurons)
- **Stateful conversations**: Durable Object stores conversation state for multi-step flows (saves Neurons + better UX)

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Runtime | Cloudflare Workers | Free: 100K req/day |
| Database | Durable Objects SQLite | Free: 5GB, 5M reads/day |
| AI Primary | Workers AI — `@cf/qwen/qwen3-30b-a3b-fp8` | Free: 10K Neurons/day (~2,254 req/day) |
| AI Fallback | DeepSeek API | Paid, usage-based (~$0.12/mo) |
| OCR | ocr.space API | Free: 25K req/month |
| Bot | Telegram Bot API | Free, webhook mode |
| Language | TypeScript | Wrangler compiles natively |
| CI/CD | GitHub Actions | Type check + auto-deploy on merge |

## Future: Telegram Mini App (Phase 4)

For bulk data operations (OCR screenshots with multiple items, loan registration forms), a **Telegram Mini App** (WebApp) will be introduced in Phase 4. This provides a full HTML/CSS/JS UI inside Telegram for:

- Reviewing and editing multiple OCR-extracted items in a table
- Filling loan registration forms with all fields at once
- Bulk confirmation (check/uncheck items, edit values, submit all)

Until Phase 4, all interactions are **chat-based** with inline keyboards and conversation state.

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
          │ • Intent   │ │ • Intent   │ │ • Image to │ │ • users        │
          │   Detection│ │   Detection│ │   text     │ │ • income       │
          │ • OCR text │ │ • OCR text │ │ • Receipt  │ │ • expenses     │
          │   parsing  │ │   parsing  │ │   reading  │ │ • loans        │
          └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ │ • installments │
                │              │               │        │ • targets      │
                └──────┬───────┘               │        └───────┬────────┘
                       │              ┌────────┘                │
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
- Routes to appropriate handler
- Manages AI provider selection (Workers AI vs DeepSeek)

### 2. AI Layer (Intent Detection + OCR Text Parsing)

- **Primary**: Cloudflare Workers AI (free, 10,000 Neurons/day limit)
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
- 6 tables: users, income, expenses, loans, installments, targets
- Consistent, low-latency, included in free tier

### 5. Telegram Bot API

- Mode: Webhook (not polling)
- Sends responses back to user via sendMessage
- Downloads user photos via getFile

## Architecture Patterns

- **Serverless**: No servers to manage
- **Event-driven**: Each Telegram message = 1 Worker invocation
- **AI-first**: Intent detection replaces command-based bot
- **Per-user isolation**: Each user has their own Durable Object + SQLite database
- **Dual AI providers**: Workers AI (free) + DeepSeek (cheap fallback) = never fully down
- **Separated OCR**: ocr.space handles image→text, AI handles text→data (saves Neurons)

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Runtime | Cloudflare Workers | Free: 100K req/day |
| Database | Durable Objects SQLite | Free: 5GB, 5M reads/day |
| AI Primary | Workers AI | Free: 10K Neurons/day (intent only) |
| AI Fallback | DeepSeek API | Paid, usage-based (~$0.12/mo) |
| OCR | ocr.space API | Free: 25K req/month |
| Bot | Telegram Bot API | Free, webhook mode |
| Language | TypeScript | Wrangler compiles natively |
| CI/CD | GitHub Actions | Type check + auto-deploy on merge |

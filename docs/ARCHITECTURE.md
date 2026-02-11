# Arsitektur Sistem

## Overview

SF Driver Finance menggunakan arsitektur **serverless** berbasis Cloudflare Workers dengan Durable Objects sebagai database. Sistem menerima pesan dari Telegram via webhook, memproses intent menggunakan AI, dan menyimpan data keuangan di SQLite (dalam Durable Objects).

## Diagram Alur

```
┌─────────────┐     webhook      ┌─────────────────────┐
│  Telegram    │ ──────────────→ │  Cloudflare Worker   │
│  User Chat   │                 │  (Router/Handler)    │
└─────────────┘                  └──────────┬──────────┘
                                            │
                        ┌───────────────────┼───────────────────┐
                        │                   │                   │
                        ▼                   ▼                   ▼
              ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
              │ Workers AI   │   │ DeepSeek API │   │ Durable Objects  │
              │ (Primary)    │   │ (Fallback)   │   │ SQLite Storage   │
              │              │   │              │   │                  │
              │ • Intent     │   │ • Intent     │   │ • users          │
              │   Detection  │   │   Detection  │   │ • income         │
              │ • OCR API    │   │ • OCR        │   │ • expenses       │
              └──────┬───────┘   └──────┬───────┘   │ • debts          │
                     │                  │           │ • targets        │
                     └────────┬─────────┘           └────────┬─────────┘
                              │                              │
                              ▼                              │
                     ┌──────────────┐                        │
                     │   Handler    │ ◄──────────────────────┘
                     │  (Business   │
                     │   Logic)     │
                     └──────┬───────┘
                            │
                            ▼
                  ┌─────────────────┐
                  │ Telegram Bot API│
                  │ (Send Response) │
                  └─────────────────┘
```

## Komponen Sistem

### 1. Cloudflare Worker (Entry Point)

- Menerima webhook POST dari Telegram
- Memvalidasi request (webhook secret)
- Meneruskan ke handler yang sesuai

### 2. AI Layer (Intent Detection & OCR)

- **Primary**: Cloudflare Workers AI (gratis, limit 10.000 Neurons/hari)
- **Fallback**: DeepSeek API (berbayar, digunakan saat mendekati limit)
- Tugas: mendeteksi intent dari pesan user dan ekstrak data dari gambar

### 3. Durable Objects + SQLite

- Satu Durable Object per user (berdasarkan Telegram user ID)
- SQLite storage built-in untuk menyimpan semua data keuangan
- Konsisten, low-latency, dan termasuk free tier

### 4. Telegram Bot API

- Mode: Webhook (bukan polling)
- Mengirim respons kembali ke user via sendMessage / sendPhoto

## Pola Arsitektur

- **Serverless**: Tidak ada server yang perlu dikelola
- **Event-driven**: Setiap pesan Telegram = 1 Worker invocation
- **AI-first**: Intent detection menggantikan command-based bot
- **Per-user isolation**: Setiap user punya Durable Object sendiri

## Tech Stack

| Layer | Teknologi | Catatan |
|---|---|---|
| Runtime | Cloudflare Workers | Free: 100K req/hari |
| Database | Durable Objects SQLite | Free: 5GB, 5M reads/hari |
| AI Primary | Workers AI | Free: 10K Neurons/hari |
| AI Fallback | DeepSeek API | Berbayar, usage-based |
| Bot | Telegram Bot API | Gratis, webhook mode |
| Language | JavaScript (ES Modules) | Native di Workers |

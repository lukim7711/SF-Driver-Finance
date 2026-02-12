# Free Tier Limits & Optimization Strategy

This document records all relevant free tier limits and strategies to maximize usage.

## Cloudflare Workers

| Resource | Free Tier Limit | Notes |
|---|---|---|
| Requests | 100,000/day | 1 Telegram message = 1 Worker request |
| CPU time | 10ms per request | Sufficient for parsing + DB query |
| Memory | 128 MB | Per isolate |
| Script size | 10 MB (compressed) | More than enough |
| Subrequests | 50 per request | For API calls (Telegram, AI, ocr.space) |
| Cron triggers | 5 | Can be used for daily counter reset |

**Usage estimate**: An active driver sends ~50-100 messages/day. With 100K limit, can support ~1,000 active users.

## Cloudflare Workers AI

| Resource | Free Tier Limit | Notes |
|---|---|---|
| Neurons | 10,000/day | Used **only for intent detection** (text LLM) |

**Important**: OCR does NOT use Workers AI. OCR goes through ocr.space API.

**Estimate per request**:
- Intent detection (text): ~100-300 Neurons (LLM inference)

**Daily capacity estimate (intent detection only)**:
- Conservative (300 Neurons/req): ~33 requests/day
- Optimistic (100 Neurons/req): ~100 requests/day
- With fallback at 80%: 26-80 free requests, then DeepSeek kicks in

⚠️ **Still the main bottleneck**, but significantly better now that OCR is separated.

## Cloudflare Durable Objects

| Resource | Free Tier Limit | Notes |
|---|---|---|
| Requests | 100,000/day | 1 message ≈ 1-3 DO requests |
| Storage | 5 GB total | Sufficient for thousands of users |
| Row reads | 5,000,000/day | SELECT queries |
| Row writes | 100,000/day | INSERT/UPDATE/DELETE |

**Per user estimate**: ~1 KB per transaction. 5 GB can hold millions of transactions.

## ocr.space API (OCR)

| Resource | Free Tier Limit | Notes |
|---|---|---|
| Requests | 25,000/month | ~833/day |
| File size | 1 MB | Sufficient for phone photos (compressed) |
| Rate limit | Not specified | Reasonable use expected |
| Response | JSON with extracted text | Needs AI post-processing for data extraction |

**Usage estimate**: A driver might send 2-5 receipt photos per day. 25K/month is more than sufficient for personal use.

**OCR Flow**: Image → ocr.space (text extraction) → Workers AI or DeepSeek (data parsing from text) → structured data.

Note: The AI step after OCR for parsing the extracted text DOES consume Neurons. But text-to-structured-data is lighter than image-to-text.

## DeepSeek API (Fallback)

| Resource | Price | Notes |
|---|---|---|
| Input tokens | $0.14/1M tokens | Cheap |
| Output tokens | $0.28/1M tokens | Cheap |
| Cache hit | $0.014/1M tokens | Even cheaper |

**Cost estimate**: Intent detection prompt ~200 tokens, output ~50 tokens. Per request ≈ $0.00004. 100 requests/day ≈ $0.004/day ≈ $0.12/month.

## GitHub Actions (CI/CD)

| Resource | Free Tier Limit | Notes |
|---|---|---|
| Minutes (private repo) | 2,000 min/month | Ubuntu runners |
| Minutes (public repo) | Unlimited | If repo is made public |
| Storage (artifacts) | 500 MB | Not used currently |

**Usage estimate per CI run**:
- `npm install` + `tsc --noEmit`: ~1-2 minutes
- `npm install` + `tsc --noEmit` + `wrangler deploy`: ~2-3 minutes

**Monthly estimate**: 10 feature branches × 5 pushes each × 2 min = ~100 min. Plus 10 deploys × 3 min = 30 min. **Total: ~130 min/month** (well within 2,000 min limit).

⚠️ **Important**: If the repo is private, GitHub Actions minutes are limited. Consider making the repo public if minutes become a concern.

---

## Optimization Strategies

### 1. AI Fallback Mechanism

```
Check daily Neuron counter
  │
  ├─ < 8,000 → Use Workers AI (free)
  │
  └─ >= 8,000 → Use DeepSeek API (cheap)
```

- Track Neurons in Durable Object (global counter)
- Threshold: 80% of limit (8,000/10,000)
- Reset counter at 00:00 UTC via Cron Trigger

### 2. Prompt Optimization

- Use shortest possible prompts that are still accurate
- Cache prompt templates (don't regenerate per request)
- Use lightweight but accurate models:
  - Workers AI: `@cf/meta/llama-3.1-8b-instruct` (lightweight, sufficient for intent)
  - DeepSeek: `deepseek-chat` (cheap, accurate)

### 3. Command Shortcut (Bypass AI)

Commands that don't need AI processing:
- `/start` → direct welcome message
- `/help` → direct guide
- `/laporan` → direct DB query, format, send
- `/hutang` → direct loan dashboard
- `/reset` → direct confirmation

This saves Neurons for messages that truly need intent detection.

### 4. OCR Budget (Separate from AI)

Since OCR uses ocr.space (not Workers AI):
- OCR requests do NOT reduce AI Neuron budget
- Budget is 25,000 OCR requests/month (more than enough)
- Only the post-OCR text parsing step uses Neurons
- Post-OCR parsing is lighter than full image processing

### 5. Batch Limit for OCR

- If user sends many images, process one by one but limit to max 5 images per session
- Each image = 1 ocr.space request + 1 AI parsing request
- Daily estimate: 5 images × 150 Neurons (text parsing) = 750 Neurons for OCR-related AI

### 6. Daily Budget Estimate

| Scenario | Workers AI Neurons | DeepSeek | ocr.space | Est. Cost |
|---|---|---|---|---|
| 1 user, 50 msgs, 3 OCR | ~5,450 | 0 | 3 | Free |
| 1 user, 100 msgs, 5 OCR | ~8,750 | ~20 req | 5 | ~$0.001 |
| 3 users, 50 msgs each, 3 OCR each | ~8,000+ | ~50 req | 9 | ~$0.002 |

**Conclusion**: For 1-3 active users, DeepSeek fallback cost is minimal (~$0.10/month or less). OCR is effectively free.

---

## Monitoring

Items to monitor regularly:

1. **Workers AI Neurons** — Cloudflare dashboard, daily
2. **Durable Objects storage** — ensure not approaching 5 GB
3. **DeepSeek API usage** — check billing dashboard
4. **ocr.space usage** — track monthly request count (25K limit)
5. **Worker request count** — ensure under 100K/day
6. **GitHub Actions minutes** — check monthly usage in repo Settings → Actions → Usage
7. **Error rate** — log errors for debugging

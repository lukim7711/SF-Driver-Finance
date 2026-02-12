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

### Model: `@cf/qwen/qwen3-30b-a3b-fp8`

MoE (Mixture of Experts) — 30B total params, 3B active per request. Costs ~4.4 Neurons per request (~300 token input, ~100 token output).

**Why this model?**
- MoE architecture: 30B quality at 3B price
- Strong multilingual (including Indonesian) — trained on Asian language data
- Function calling support for structured JSON output
- 3.4× cheaper than the previous `llama-3.1-8b-instruct` (15.2 Neurons/req)

**Daily capacity estimate (intent detection only)**:
- Per request: ~4.4 Neurons
- **Free requests/day: ~2,254** (10,000 ÷ 4.4)
- With fallback at 80% (8,000 Neurons): ~1,818 free requests, then DeepSeek kicks in

**Comparison with previous model:**

| Model | Neurons/req | Free req/day | Status |
|---|---|---|---|
| `@cf/qwen/qwen3-30b-a3b-fp8` | ~4.4 | ~2,254 | ✅ Current |
| `@cf/meta/llama-3.1-8b-instruct` | ~15.2 | ~658 | ❌ Previous (retired) |

**Alternative model to test later**: `@cf/ibm-granite/granite-4.0-h-micro` (~1.5 Neurons/req, ~6,764 free req/day). Smaller model, may be less accurate for Indonesian natural language.

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
  - Workers AI: `@cf/qwen/qwen3-30b-a3b-fp8` (~4.4 Neurons/req, MoE 30B quality)
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
- Daily estimate: 5 images × 4.4 Neurons (text parsing) = ~22 Neurons for OCR-related AI

### 6. Daily Budget Estimate

| Scenario | Workers AI Neurons | DeepSeek | ocr.space | Est. Cost |
|---|---|---|---|---|
| 1 user, 50 msgs, 3 OCR | ~233 | 0 | 3 | Free |
| 1 user, 100 msgs, 5 OCR | ~462 | 0 | 5 | Free |
| 3 users, 50 msgs each, 3 OCR each | ~699 | 0 | 9 | Free |
| 10 users, 100 msgs each, 5 OCR each | ~4,620 | 0 | 50 | Free |
| Extreme: 20 users, 100 msgs each | ~8,800 | ~200 req | 60 | ~$0.008 |

**Conclusion**: With the new `qwen3-30b-a3b-fp8` model, even 10+ active users stay within the free tier. DeepSeek fallback is only needed in extreme usage scenarios. This is a massive improvement over the previous model (which could only handle ~33-100 requests before needing fallback).

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

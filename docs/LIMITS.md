# Limit Free Tier & Strategi Penghematan

Dokumen ini mencatat semua limit Cloudflare Free Tier yang relevan dan strategi untuk memaksimalkan penggunaan.

## Cloudflare Workers

| Resource | Limit Free Tier | Catatan |
|---|---|---|
| Requests | 100.000/hari | 1 pesan Telegram = 1 request Worker |
| CPU time | 10ms per request | Cukup untuk parsing + DB query |
| Memory | 128 MB | Per isolate |
| Script size | 10 MB (compressed) | Lebih dari cukup |
| Subrequests | 50 per request | Untuk API calls (Telegram, AI) |
| Cron triggers | 5 | Bisa dipakai untuk daily reset counter |

**Estimasi penggunaan**: Seorang driver aktif mengirim ~50-100 pesan/hari. Dengan 100K limit, bisa menampung ~1.000 user aktif.

## Cloudflare Workers AI

| Resource | Limit Free Tier | Catatan |
|---|---|---|
| Neurons | 10.000/hari | Dipakai untuk intent detection + OCR |

**Estimasi per request**:
- Intent detection (text): ~100-300 Neurons (LLM inference)
- OCR (gambar): ~500-1.000 Neurons (vision model)

**Estimasi kapasitas harian**:
- Hanya intent detection: ~30-100 requests/hari
- Campuran intent + OCR: ~15-30 requests/hari

⚠️ **Ini adalah bottleneck utama**. Harus hemat dan fallback ke DeepSeek.

## Cloudflare Durable Objects

| Resource | Limit Free Tier | Catatan |
|---|---|---|
| Requests | 100.000/hari | 1 pesan ≈ 1-3 DO requests |
| Storage | 5 GB total | Cukup untuk ribuan user |
| Row reads | 5.000.000/hari | Query SELECT |
| Row writes | 100.000/hari | INSERT/UPDATE/DELETE |

**Estimasi per user**: ~1 KB per transaksi. 5 GB bisa menampung jutaan transaksi.

## DeepSeek API (Fallback)

| Resource | Harga | Catatan |
|---|---|---|
| Input tokens | $0.14/1M tokens | Murah |
| Output tokens | $0.28/1M tokens | Murah |
| Cache hit | $0.014/1M tokens | Lebih murah lagi |

**Estimasi biaya**: Prompt intent detection ~200 tokens, output ~50 tokens. Per request ≈ $0.00004. 100 requests/hari ≈ $0.004/hari ≈ $0.12/bulan.

---

## Strategi Penghematan

### 1. AI Fallback Mechanism

```
Cek counter Neurons harian
  │
  ├─ < 8.000 → Pakai Workers AI (gratis)
  │
  └─ >= 8.000 → Pakai DeepSeek API (murah)
```

- Tracking Neurons di Durable Object (counter global)
- Threshold: 80% dari limit (8.000/10.000)
- Reset counter setiap 00:00 UTC via Cron Trigger

### 2. Prompt Optimization

- Gunakan prompt sesingkat mungkin tapi tetap akurat
- Cache prompt template (jangan generate ulang tiap request)
- Gunakan model yang paling ringan tapi cukup akurat:
  - Workers AI: `@cf/meta/llama-3.1-8b-instruct` (ringan, cukup untuk intent)
  - DeepSeek: `deepseek-chat` (murah, akurat)

### 3. Response Caching

- Cache respons untuk pesan yang identik (dalam DO)
- Contoh: "/help" selalu sama → tidak perlu AI

### 4. Command Shortcut (Bypass AI)

Command yang tidak perlu AI processing:
- `/start` → langsung welcome message
- `/help` → langsung panduan
- `/laporan` → langsung query DB, format, kirim
- `/reset` → langsung konfirmasi

Ini menghemat Neurons untuk pesan yang benar-benar butuh intent detection.

### 5. Batch Processing untuk OCR

- Jika user kirim banyak gambar, proses satu-satu tapi batasi maks 5 gambar per sesi
- Estimasi OCR berat (~500-1.000 Neurons per gambar), jadi perlu dibatasi

### 6. Estimasi Budget Harian

| Skenario | Workers AI | DeepSeek | Total Cost |
|---|---|---|---|
| 1 user, 50 pesan, 5 OCR | ~4.500 Neurons | 0 | Gratis |
| 1 user, 100 pesan, 10 OCR | ~10.000 Neurons | ~50 req | ~$0.002 |
| 5 user, 50 pesan each | ~10.000 Neurons | ~150 req | ~$0.006 |
| 10 user, 30 pesan each | ~8.000 Neurons | ~200 req | ~$0.008 |

**Kesimpulan**: Untuk penggunaan 1-5 user aktif, biaya DeepSeek fallback sangat kecil (~$0.20/bulan atau kurang).

---

## Monitoring

Yang perlu dimonitor secara rutin:

1. **Workers AI Neurons** — dashboard Cloudflare, daily
2. **Durable Objects storage** — pastikan tidak mendekati 5 GB
3. **DeepSeek API usage** — cek billing dashboard
4. **Worker request count** — pastikan di bawah 100K/hari
5. **Error rate** — log errors untuk debugging

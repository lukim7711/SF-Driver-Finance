# Alur API Request

Dokumen ini menjelaskan alur lengkap dari pesan user di Telegram hingga respons bot dikirim kembali.

## Alur Utama: Pesan Teks

```
User kirim pesan di Telegram
        │
        ▼
┌─────────────────────────┐
│ 1. Telegram Server      │
│    POST webhook ke      │
│    Worker URL           │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 2. Worker: Validasi     │
│    - Cek webhook secret │
│    - Parse request body │
│    - Ekstrak message    │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 3. Worker: Cek AI Usage │
│    - Baca counter       │
│    - < 8000 Neurons?    │
│      → Workers AI       │
│    - >= 8000 Neurons?   │
│      → DeepSeek API     │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 4. AI: Intent Detection │
│    Input: pesan user    │
│    Output:              │
│    - intent (string)    │
│    - params (object)    │
│    - confidence (float) │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 5. Worker: Route Intent │
│    Switch berdasarkan   │
│    intent yang terdeteksi│
│    → handler yang sesuai│
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 6. Durable Object       │
│    - Ambil DO by user ID│
│    - Execute SQL query  │
│    - Return result      │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 7. Worker: Format       │
│    Response              │
│    - Format teks Bahasa │
│      Indonesia          │
│    - Kirim via Telegram │
│      sendMessage API    │
└─────────────────────────┘
```

## Alur Gambar: OCR Flow

```
User kirim foto/gambar
        │
        ▼
┌─────────────────────────┐
│ 1. Worker: Terima       │
│    - Deteksi ada photo  │
│    - Download file via  │
│      Telegram getFile   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 2. AI: OCR + Ekstraksi  │
│    - Kirim gambar ke AI │
│    - Ekstrak teks       │
│    - Identifikasi data: │
│      jumlah, kategori,  │
│      tanggal, dll.      │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 3. Worker: Konfirmasi   │
│    - Tampilkan hasil    │
│      OCR ke user        │
│    - Minta konfirmasi:  │
│      "Benar? (Ya/Tidak)"│
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 4. User konfirmasi "Ya" │
│    → Simpan ke DB       │
│    → Kirim konfirmasi   │
└─────────────────────────┘
```

## Detail Endpoint

### Webhook URL

```
POST https://sf-driver-finance.<subdomain>.workers.dev/webhook
Header: X-Telegram-Bot-Api-Secret-Token: <WEBHOOK_SECRET>
Body: Telegram Update object (JSON)
```

### Telegram API Calls (Outgoing)

| Method | Kegunaan |
|---|---|
| `sendMessage` | Kirim teks respons ke user |
| `getFile` | Download foto yang dikirim user |
| `setWebhook` | Setup webhook URL (saat deploy) |
| `deleteWebhook` | Hapus webhook (saat maintenance) |

### AI API Calls

**Workers AI (Primary)**
```
env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
  messages: [{ role: 'user', content: prompt }]
})
```

**DeepSeek API (Fallback)**
```
POST https://api.deepseek.com/chat/completions
Header: Authorization: Bearer <DEEPSEEK_API_KEY>
Body: { model: 'deepseek-chat', messages: [...] }
```

## Intent Detection Format

### Input ke AI

```
Kamu adalah asisten keuangan ShopeeFood Driver.
Deteksi intent dari pesan berikut dan ekstrak parameternya.

Pesan: "{user_message}"

Respons dalam JSON:
{
  "intent": "nama_intent",
  "params": { ... },
  "confidence": 0.0-1.0
}
```

### Output dari AI (Contoh)

```json
// Input: "bensin 20rb"
{
  "intent": "catat_pengeluaran",
  "params": {
    "amount": 20000,
    "category": "bensin"
  },
  "confidence": 0.95
}

// Input: "dapet 45000 dari food"
{
  "intent": "catat_pemasukan",
  "params": {
    "amount": 45000,
    "type": "food"
  },
  "confidence": 0.92
}

// Input: "hutang ke Budi 50rb"
{
  "intent": "catat_hutang",
  "params": {
    "person_name": "Budi",
    "amount": 50000,
    "type": "piutang"
  },
  "confidence": 0.88
}
```

## Error Handling

| Skenario | Penanganan |
|---|---|
| Webhook secret tidak valid | Return 401, abaikan request |
| AI gagal / timeout | Coba fallback, jika gagal juga → pesan error ramah |
| Intent tidak dikenali | Minta user ulangi dengan lebih jelas + contoh |
| OCR tidak yakin | Tampilkan hasil + minta konfirmasi manual |
| DB error | Log error, kirim pesan "coba lagi nanti" |
| Telegram API error | Retry 1x, lalu log dan skip |

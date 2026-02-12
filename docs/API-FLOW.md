# API Request Flow

This document describes the complete flow from a user's Telegram message to the bot's response.

## Main Flow: Text Message

```
User sends message in Telegram
        │
        ▼
┌─────────────────────────┐
│ 1. Telegram Server      │
│    POST webhook to      │
│    Worker URL           │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 2. Worker: Validate     │
│    - Check webhook      │
│      secret             │
│    - Parse request body │
│    - Extract message    │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 3. Worker: Check AI     │
│    Usage                │
│    - Read Neuron counter│
│    - < 8000 Neurons?    │
│      → Workers AI       │
│    - >= 8000 Neurons?   │
│      → DeepSeek API     │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 4. AI: Intent Detection │
│    Input: user message  │
│    Output:              │
│    - intent (string)    │
│    - params (object)    │
│    - confidence (float) │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 5. Worker: Route Intent │
│    Switch based on      │
│    detected intent      │
│    → appropriate handler│
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 6. Durable Object       │
│    - Get DO by user ID  │
│    - Execute SQL query  │
│    - Return result      │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 7. Worker: Format       │
│    Response             │
│    - Format text in     │
│      Indonesian         │
│    - Send via Telegram  │
│      sendMessage API    │
└─────────────────────────┘
```

## Image Flow: OCR via ocr.space

```
User sends photo/image
        │
        ▼
┌─────────────────────────┐
│ 1. Worker: Receive      │
│    - Detect photo in    │
│      message            │
│    - Download file via  │
│      Telegram getFile   │
│      API                │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 2. ocr.space API        │
│    - Send image to      │
│      ocr.space          │
│    - Receive raw text   │
│      extraction         │
│    (Does NOT use        │
│     Workers AI Neurons) │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 3. AI: Parse OCR Text   │
│    - Send extracted text│
│      to Workers AI or   │
│      DeepSeek           │
│    - Identify data:     │
│      amount, category,  │
│      date, etc.         │
│    (Uses Neurons, but   │
│     text-only = lighter)│
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 4. Worker: Confirm      │
│    - Display OCR result │
│      to user            │
│    - Ask confirmation:  │
│      "Benar? (Ya/Tidak)"│
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 5. User confirms "Ya"   │
│    → Save to DB         │
│    → Send confirmation  │
└─────────────────────────┘
```

**Key difference from previous design**: OCR is now a 2-step process:
1. **ocr.space** extracts raw text from image (free, no Neurons)
2. **Workers AI / DeepSeek** parses the text into structured data (uses Neurons, but lighter than vision model)

## Endpoint Details

### Webhook URL

```
POST https://sf-driver-finance.<subdomain>.workers.dev/webhook
Header: X-Telegram-Bot-Api-Secret-Token: <WEBHOOK_SECRET>
Body: Telegram Update object (JSON)
```

### Telegram API Calls (Outgoing)

| Method | Purpose |
|---|---|
| `sendMessage` | Send text response to user |
| `getFile` | Download photo sent by user |
| `setWebhook` | Setup webhook URL (on deploy) |
| `deleteWebhook` | Remove webhook (maintenance) |

### ocr.space API Call

```
POST https://api.ocr.space/parse/image
Header: apikey: <OCR_SPACE_API_KEY>
Body (multipart/form-data):
  - file: <image file or base64>
  - language: ind (Indonesian) or eng
  - isOverlayRequired: false
  - OCREngine: 2 (recommended for receipts)
```

**Response** (simplified):
```json
{
  "ParsedResults": [
    {
      "ParsedText": "SPBU 34.10102\nPremium\n4.50 Liter\nRp 47.250\n..."
    }
  ],
  "IsErroredOnProcessing": false
}
```

### AI API Calls

**Workers AI (Primary) — `@cf/qwen/qwen3-30b-a3b-fp8`**
```typescript
const result = await env.AI.run('@cf/qwen/qwen3-30b-a3b-fp8', {
  messages: [{ role: 'user', content: prompt }]
});
```

**DeepSeek API (Fallback)**
```typescript
const response = await fetch('https://api.deepseek.com/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
  }),
});
```

## Intent Detection Format

### AI Input Prompt

```
You are a financial assistant for a ShopeeFood/SPX driver.
Detect the intent from the following message and extract parameters.

Message: "{user_message}"

Respond in JSON:
{
  "intent": "intent_name",
  "params": { ... },
  "confidence": 0.0-1.0
}
```

### AI Output Examples

```json
// Input: "bensin 20rb"
{
  "intent": "record_expense",
  "params": {
    "amount": 20000,
    "category": "fuel"
  },
  "confidence": 0.95
}

// Input: "dapet 45000 dari food"
{
  "intent": "record_income",
  "params": {
    "amount": 45000,
    "type": "food"
  },
  "confidence": 0.92
}

// Input: "bayar cicilan kredivo"
{
  "intent": "pay_installment",
  "params": {
    "platform": "Kredivo"
  },
  "confidence": 0.90
}

// Input: "lihat semua hutang"
{
  "intent": "view_loans",
  "params": {},
  "confidence": 0.93
}
```

## Error Handling

| Scenario | Handling |
|---|---|
| Invalid webhook secret | Return 401, ignore request |
| AI failure / timeout | Try fallback; if both fail → friendly error message |
| Unrecognized intent | Ask user to rephrase + show examples |
| OCR uncertain | Show result + ask manual confirmation |
| ocr.space API error | Show "OCR gagal, coba kirim ulang" message |
| DB error | Log error, send "coba lagi nanti" message |
| Telegram API error | Retry 1x, then log and skip |

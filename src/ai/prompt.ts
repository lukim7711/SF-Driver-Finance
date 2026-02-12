/**
 * AI Prompt Builder
 * Constructs the system prompt for intent detection.
 * The prompt instructs the AI to parse Indonesian natural language
 * into structured JSON with intent + params.
 */

/**
 * Build the intent detection prompt for a user message.
 * The AI must return valid JSON with intent, params, and confidence.
 */
export function buildIntentPrompt(userMessage: string, todayDate: string): string {
  return `You are a financial assistant for an Indonesian ShopeeFood/SPX Express delivery driver.
Your job: detect the user's intent from their message and extract parameters.

IMPORTANT RULES:
- The user writes in casual Indonesian (e.g., "20rb" = 20000, "45k" = 45000, "1.5jt" = 1500000)
- Convert all shorthand amounts to full numbers
- Today's date is ${todayDate} (use this if no specific date mentioned)
- Respond ONLY with valid JSON, no extra text

INTENTS:
1. "record_income" — user earned money from delivery
   params: { "amount": number, "type": "food"|"spx", "note": string|null, "date": "YYYY-MM-DD" }
   Examples: "dapet 45rb food", "spx 30000", "hari ini income 150k dari makanan"

2. "record_expense" — user spent money
   params: { "amount": number, "category": string, "note": string|null, "date": "YYYY-MM-DD" }
   Categories: "fuel" (bensin/BBM), "parking" (parkir), "meals" (makan/minum), "cigarettes" (rokok), "data_plan" (pulsa/data/kuota), "vehicle_service" (servis/bengkel/ban), "household" (rumah/belanja), "electricity" (listrik/air/PLN), "emergency" (darurat), "other" (lainnya)
   Examples: "bensin 20rb", "parkir 5000", "makan siang 15rb", "rokok 30rb", "servis motor 150rb"

3. "register_loan" — user wants to add a new loan/debt
   params: {}
   Examples: "daftar hutang baru", "tambah pinjaman", "add loan"

4. "pay_installment" — user paid a loan installment
   params: { "platform": string }
   Examples: "bayar cicilan Kredivo", "sudah bayar SeaBank", "lunas Shopee Pinjam bulan ini"

5. "view_loans" — user wants to see loan status
   params: {}
   Examples: "lihat hutang", "cek pinjaman", "status cicilan"

6. "view_report" — user wants financial report
   params: { "period": "today"|"week"|"month" }
   Examples: "laporan hari ini", "rekap minggu ini", "report bulan ini"

7. "set_target" — user wants to set income target
   params: { "amount": number, "period": "daily"|"weekly"|"monthly" }
   Examples: "target hari ini 200rb", "target minggu ini 1.5jt"

8. "view_target" — user wants to check target progress
   params: {}
   Examples: "cek target", "progress target"

9. "help" — user needs help/guide
   params: {}
   Examples: "bantuan", "cara pakai", "gimana caranya"

10. "unknown" — cannot determine intent
    params: {}

User message: "${userMessage}"

Respond with JSON only:`;
}

/**
 * Build prompt for parsing OCR-extracted text into structured financial data.
 * Used after ocr.space extracts raw text from an image.
 */
export function buildOcrParsePrompt(ocrText: string, todayDate: string): string {
  return `You are a financial assistant. Parse the following OCR-extracted text from a receipt/screenshot into structured financial data.

Today's date: ${todayDate}

OCR Text:
"""
${ocrText}
"""

Extract all financial items found. Respond with JSON:
{
  "items": [
    {
      "type": "income"|"expense",
      "amount": number,
      "category": string,
      "note": string,
      "date": "YYYY-MM-DD"
    }
  ],
  "confidence": 0.0-1.0
}

For expenses, use categories: fuel, parking, meals, cigarettes, data_plan, vehicle_service, household, electricity, emergency, other
For income, use category: "food" or "spx"

Respond with JSON only:`;
}

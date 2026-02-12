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

3. "register_loan" — user wants to add a new loan/debt. EXTRACT ALL loan details mentioned.
   params: {
     "platform": string|null,
     "original_amount": number|null,
     "total_with_interest": number|null,
     "total_installments": number|null,
     "monthly_amount": number|null,
     "due_day": number|null,
     "late_fee_type": "percent_monthly"|"percent_daily"|"fixed"|"none"|null,
     "late_fee_value": number|null
   }
   IMPORTANT: Extract as many fields as possible from the message. Only use null for fields NOT mentioned.
   - "platform" = lending platform name (Shopee Pinjam, SPayLater, SeaBank, Kredivo, Akulaku, etc.) or person name for personal loans
   - "original_amount" = amount borrowed (pokok/pinjaman)
   - "total_with_interest" = total amount to repay including interest
   - "total_installments" = number of installments/months (tenor)
   - "monthly_amount" = amount per installment
   - "due_day" = day of month when payment is due (1-31)
   - "late_fee_type" = "percent_monthly" (X% per month), "percent_daily" (X% per day), "fixed" (flat fee), "none" (no late fee)
   - "late_fee_value" = the number for late fee (e.g., 5 for 5%, 50000 for fixed)
   - If user says "no denda" or "tanpa denda", set late_fee_type="none", late_fee_value=0
   - If user says "X% per bulan" or "X%/bln", set late_fee_type="percent_monthly", late_fee_value=X
   - If user says "X% per hari", set late_fee_type="percent_daily", late_fee_value=X
   Examples:
   - "pinjol kredivo 5jt 12 bulan 500rb per bulan no denda" → platform="Kredivo", original_amount=5000000, total_installments=12, monthly_amount=500000, late_fee_type="none", late_fee_value=0
   - "hutang shopee 3.5jt total 4.9jt 10x tanggal 13 denda 5%/bln" → platform="Shopee Pinjam", original_amount=3500000, total_with_interest=4900000, total_installments=10, due_day=13, late_fee_type="percent_monthly", late_fee_value=5
   - "pinjam seabank 1.5jt 7 bulan 232rb tanggal 5 denda 0.25% per hari" → platform="SeaBank Pinjam", original_amount=1500000, total_installments=7, monthly_amount=232000, due_day=5, late_fee_type="percent_daily", late_fee_value=0.25
   - "daftar hutang" → all params null (user just wants to start)
   - "pinjam uang ke yono 500rb" → platform="Yono", original_amount=500000

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

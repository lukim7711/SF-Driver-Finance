# Feature List

Status: ✅ Done | 🔧 In Progress | 📋 Planned

---

## Core Features

### 📋 F01 — Record Income

Record earnings from ShopeeFood and SPX Express delivery orders.

- Input: natural language message (e.g., "dapet 45rb dari food", "spx 30000")
- Data: amount, type (food/spx), date, optional note
- Output: confirmation + today's total income

### 📋 F02 — Record Expenses

Record daily operational and household expenses.

- Input: natural language message (e.g., "bensin 20rb", "parkir 5000", "makan siang 15rb", "listrik 150rb")
- Categories: fuel, parking, meals, cigarettes, data_plan, vehicle_service, household, electricity, emergency, other
- Data: amount, category, date, optional note
- Output: confirmation + today's total expenses

### 📋 F03 — Loan/Debt Tracking (Pinjol)

Track multiple online lending platform (pinjol) installments with schedules, due dates, and late fees.

> ⚠️ This is the **most complex and critical** feature. See `docs/DEBT-STUDY-CASE.md` for real data reference.

**Sub-features:**

**F03a — Register Loan**
- Input: platform name, total amount, monthly installment, number of installments, due day, late fee rule
- Example: "tambah hutang Shopee Pinjam, total 4.9jt, cicilan 435rb, 10x, jatuh tempo tanggal 13, denda 5% per bulan"
- Action: create loan record + auto-generate all installment rows
- Support: already-paid installments (for loans taken before bot was created)
- Note: In Phase 1-3, loan registration uses multi-step chat with conversation state. In Phase 4, a Mini App form will be available for faster input.

**F03b — Record Installment Payment**
- Input: platform name + confirmation of payment
- Example: "bayar cicilan Kredivo 2" or "sudah bayar SeaBank bulan ini"
- Action: mark installment as paid, update paid_installments counter, record paid_date
- Support: partial payments

**F03c — View Loan Dashboard**
- Show all active loans with:
  - Platform name
  - Remaining balance
  - Next due date + countdown (e.g., "3 hari lagi")
  - Monthly installment amount
  - Progress (X/Y installments paid)
- Sorted by nearest due date

**F03d — Due Date Alerts**
- When user opens bot or sends any message, check for upcoming due dates
- Alert levels:
  - ⚠️ 7 days before due: "Cicilan [platform] jatuh tempo 7 hari lagi"
  - 🔴 3 days before due: "URGENT: Cicilan [platform] jatuh tempo 3 hari lagi!"
  - 💀 Past due: "TELAT: Cicilan [platform] sudah lewat jatuh tempo X hari! Denda: Rp..."
- Calculate and show estimated late fee

**F03e — Late Fee Calculator**
- Automatically calculate late fees based on platform rules:
  - percent_monthly: X% of installment amount per month late
  - percent_daily: X% of installment amount per day late
- Show: original amount + late fee = total to pay

**F03f — Monthly Obligation Summary**
- Show total installments due in a given month across all platforms
- Example: "Bulan Maret 2026: Total cicilan Rp1,380,282 (dari 5 platform)"
- Compare with average income to show feasibility

**F03g — Payoff Progress**
- Overall: total debt remaining vs total original debt
- Per platform: installments paid / total installments
- Visual: progress bar or percentage

### 📋 F04 — Income Targets

Set and track income targets per period.

- Input: "target hari ini 200rb", "target minggu ini 1.5jt"
- Periods: daily, weekly, monthly
- Output: progress percentage
- Notification: when target is achieved

### 📋 F05 — OCR Receipt Reading

Extract financial data from images/screenshots automatically via **ocr.space API**.

- Input: photo of fuel receipt, parking ticket, order screenshot, loan statement
- Process: Download image from Telegram → send to ocr.space API → extract text → AI parses data → confirm with user
- Output: detected data + confirmation before saving
- Important: ALWAYS ask user confirmation before saving OCR results
- Confirmation uses **conversation state** (`pending_action: confirm_ocr`) — user reply "Ya"/"Tidak" is handled without AI, saving Neurons
- API: ocr.space free tier (NOT Workers AI vision model)
- Note: In Phase 4, a Mini App will enable bulk review of screenshots with multiple items (e.g., 8+ orders in one screenshot)

### 📋 F06 — Intent Detection

Detect user intent from natural language messages.

- AI processes message → determines intent + extracts parameters
- Model: `@cf/qwen/qwen3-30b-a3b-fp8` (primary), DeepSeek (fallback)
- **Conversation state is checked first** — if a pending_action exists, the message is routed to the state handler without consuming AI Neurons
- Supported intents:
  - `record_income` — record delivery earnings
  - `record_expense` — record an expense
  - `register_loan` — add a new loan/debt
  - `pay_installment` — mark installment as paid
  - `view_loans` — show loan dashboard
  - `view_report` — request financial report
  - `view_target` — check target progress
  - `set_target` — set income target
  - `help` — show help/guide
  - `unknown` — fallback

### 📋 F07 — Financial Reports

Display financial summary per period.

- Periods: today, this week, this month
- Report contents:
  - Total income (food/spx breakdown)
  - Total expenses (per category breakdown)
  - Net profit (income - expenses)
  - Target progress (if set)
  - Upcoming loan payments this month
  - Total monthly loan obligation
- Format: neatly formatted text in Telegram

### 📋 F08 — AI Fallback (Workers AI → DeepSeek)

Automatically switch to DeepSeek API when Workers AI approaches daily limit.

- Track daily Neuron usage
- Threshold: 80% of limit (8,000/10,000 Neurons)
- Transparent fallback — user notices no difference
- Reset counter at midnight UTC via Cron Trigger

---

## Supporting Features

### 📋 F09 — New User Onboarding

- Welcome message on first chat
- Brief usage guide
- Timezone setup (default: WIB)

### 📋 F10 — Basic Commands

- `/start` — start bot / onboarding
- `/help` — usage guide
- `/laporan` — shortcut for today's report
- `/hutang` — shortcut for loan dashboard
- `/batal` — cancel current multi-step flow (clears conversation state)
- `/reset` — reset data (with double confirmation)

---

## Future Roadmap

### 📋 F11 — Export Data (Phase 4)
- Export to CSV
- Send via Telegram as file

### 📋 F12 — Debt Payoff Strategy
- Suggest optimal payment order (avalanche vs snowball method)
- Calculate estimated payoff date based on average daily income
- "What if" scenarios (e.g., "kalau nabung 50rb/hari, lunas kapan?")

### 📋 F13 — Analytics & Insights
- Expense trends over time
- Savings recommendations
- Period-over-period comparison

### 📋 F14 — Telegram Mini App (Phase 4)
- Full HTML/CSS/JS UI inside Telegram for bulk operations
- Bulk OCR review: table with checkboxes, edit values, submit all at once
- Loan registration form: all fields in one screen instead of multi-step chat
- Hosted on Cloudflare Workers/Pages (free)
- Replaces chat-based multi-step for complex data entry

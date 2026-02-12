/**
 * Loan Registration Handler
 * Multi-step conversation flow to register a new loan.
 */

import type { LoanRegistrationData, LateFeeType } from "../types/loan";
import { sendText, sendWithKeyboard } from "../telegram/api";
import { setConversationState, getConversationState, clearConversationState } from "../database/conversation";
import { registerLoan } from "../database/loan";
import { formatRupiah } from "./income";

/**
 * Start the loan registration flow.
 * Step 1: Ask for platform name.
 */
export async function startLoanRegistration(
  token: string,
  chatId: number,
  db: SqlStorage
): Promise<void> {
  const text = `\ud83c\udfe6 <b>Daftar Pinjaman Baru</b>\n\n` +
    `Aku akan bantu kamu mencatat pinjaman baru. Proses ini ada 7 langkah.\n\n` +
    `<b>Langkah 1/7: Nama Platform</b>\n` +
    `Ketik nama platform pinjaman (contoh: Shopee Pinjam, Kredivo, SPayLater, SeaBank):`;

  setConversationState(db, "register_loan_step", {
    step: 1,
    platform: "",
    original_amount: 0,
    total_with_interest: 0,
    total_installments: 0,
    monthly_amount: 0,
    due_day: 0,
    late_fee_type: "none",
    late_fee_value: 0,
    start_date: "",
  });

  await sendText(token, chatId, text);
}

/**
 * Handle a message during the loan registration flow.
 * Routes to the appropriate step handler.
 */
export async function handleLoanRegistrationStep(
  token: string,
  chatId: number,
  db: SqlStorage,
  userMessage: string,
  todayDate: string
): Promise<void> {
  const state = getConversationState(db);
  if (!state || state.pending_action !== "register_loan_step") {
    await sendText(token, chatId, "\u26a0\ufe0f Sesi pendaftaran pinjaman tidak ditemukan. Ketik /batal untuk membatalkan.");
    return;
  }

  const data = state.pending_data as LoanRegistrationData;
  const step = data.step ?? 1;

  switch (step) {
    case 1:
      await handleStep1(token, chatId, db, userMessage, data);
      break;
    case 2:
      await handleStep2(token, chatId, db, userMessage, data);
      break;
    case 3:
      await handleStep3(token, chatId, db, userMessage, data);
      break;
    case 4:
      await handleStep4(token, chatId, db, userMessage, data);
      break;
    case 5:
      await handleStep5(token, chatId, db, userMessage, data);
      break;
    case 6:
      await handleStep6(token, chatId, db, userMessage, data);
      break;
    case 7:
      await handleStep7(token, chatId, db, userMessage);
      break;
    default:
      await sendText(token, chatId, "\u274c Step tidak valid. Ketik /batal untuk membatalkan.");
      clearConversationState(db);
  }
}

/** Step 1: Platform name */
async function handleStep1(
  token: string,
  chatId: number,
  db: SqlStorage,
  userMessage: string,
  data: LoanRegistrationData
): Promise<void> {
  data.platform = userMessage.trim();
  data.step = 2;
  setConversationState(db, "register_loan_step", data);

  const text = `\u2705 Platform: <b>${data.platform}</b>\n\n` +
    `<b>Langkah 2/7: Jumlah Pinjaman Awal</b>\n` +
    `Berapa jumlah uang yang kamu pinjam (pokok/principal)? Contoh: 3500000`;

  await sendText(token, chatId, text);
}

/** Step 2: Original amount */
async function handleStep2(
  token: string,
  chatId: number,
  db: SqlStorage,
  userMessage: string,
  data: LoanRegistrationData
): Promise<void> {
  const amount = parseAmount(userMessage);
  if (!amount || amount <= 0) {
    await sendText(token, chatId, "\u274c Jumlah tidak valid. Coba lagi dengan angka, contoh: 3500000");
    return;
  }

  data.original_amount = amount;
  data.step = 3;
  setConversationState(db, "register_loan_step", data);

  const text = `\u2705 Jumlah pinjaman: <b>${formatRupiah(amount)}</b>\n\n` +
    `<b>Langkah 3/7: Total Harus Dibayar</b>\n` +
    `Berapa total yang harus kamu bayar (termasuk bunga)? Contoh: 4904446`;

  await sendText(token, chatId, text);
}

/** Step 3: Total with interest */
async function handleStep3(
  token: string,
  chatId: number,
  db: SqlStorage,
  userMessage: string,
  data: LoanRegistrationData
): Promise<void> {
  const amount = parseAmount(userMessage);
  if (!amount || amount <= 0) {
    await sendText(token, chatId, "\u274c Jumlah tidak valid. Coba lagi dengan angka, contoh: 4904446");
    return;
  }

  data.total_with_interest = amount;
  data.step = 4;
  setConversationState(db, "register_loan_step", data);

  const text = `\u2705 Total bayar: <b>${formatRupiah(amount)}</b>\n` +
    `\ud83d\udca1 Bunga: <b>${formatRupiah(amount - data.original_amount)}</b>\n\n` +
    `<b>Langkah 4/7: Jumlah Cicilan</b>\n` +
    `Berapa kali cicilan? Contoh: 10`;

  await sendText(token, chatId, text);
}

/** Step 4: Total installments */
async function handleStep4(
  token: string,
  chatId: number,
  db: SqlStorage,
  userMessage: string,
  data: LoanRegistrationData
): Promise<void> {
  const count = parseInt(userMessage.trim(), 10);
  if (isNaN(count) || count <= 0) {
    await sendText(token, chatId, "\u274c Jumlah cicilan tidak valid. Coba lagi dengan angka, contoh: 10");
    return;
  }

  data.total_installments = count;
  data.step = 5;
  setConversationState(db, "register_loan_step", data);

  const text = `\u2705 Jumlah cicilan: <b>${count}x</b>\n\n` +
    `<b>Langkah 5/7: Cicilan Bulanan</b>\n` +
    `Berapa cicilan per bulan? Contoh: 435917`;

  await sendText(token, chatId, text);
}

/** Step 5: Monthly amount */
async function handleStep5(
  token: string,
  chatId: number,
  db: SqlStorage,
  userMessage: string,
  data: LoanRegistrationData
): Promise<void> {
  const amount = parseAmount(userMessage);
  if (!amount || amount <= 0) {
    await sendText(token, chatId, "\u274c Jumlah tidak valid. Coba lagi dengan angka, contoh: 435917");
    return;
  }

  data.monthly_amount = amount;
  data.step = 6;
  setConversationState(db, "register_loan_step", data);

  const text = `\u2705 Cicilan bulanan: <b>${formatRupiah(amount)}/bulan</b>\n\n` +
    `<b>Langkah 6/7: Tanggal Jatuh Tempo</b>\n` +
    `Tanggal berapa setiap bulan cicilan harus dibayar? (1-31)\n` +
    `Contoh: 13`;

  await sendText(token, chatId, text);
}

/** Step 6: Due day */
async function handleStep6(
  token: string,
  chatId: number,
  db: SqlStorage,
  userMessage: string,
  data: LoanRegistrationData
): Promise<void> {
  const day = parseInt(userMessage.trim(), 10);
  if (isNaN(day) || day < 1 || day > 31) {
    await sendText(token, chatId, "\u274c Tanggal tidak valid. Masukkan angka 1-31, contoh: 13");
    return;
  }

  data.due_day = day;
  data.step = 7;
  setConversationState(db, "register_loan_step", data);

  const text = `\u2705 Jatuh tempo: <b>Tanggal ${day} setiap bulan</b>\n\n` +
    `<b>Langkah 7/7: Denda Keterlambatan</b>\n` +
    `Pilih jenis denda:`;

  await sendWithKeyboard(token, chatId, text, {
    inline_keyboard: [
      [
        { text: "\ud83d\udcca Persen per bulan (5%/bln)", callback_data: "loan_late_fee:percent_monthly" },
      ],
      [
        { text: "\ud83d\udcc5 Persen per hari (0.25%/hari)", callback_data: "loan_late_fee:percent_daily" },
      ],
      [
        { text: "\ud83d\udcb5 Nominal tetap", callback_data: "loan_late_fee:fixed" },
      ],
      [
        { text: "\u2705 Tidak ada denda", callback_data: "loan_late_fee:none" },
      ],
    ],
  });
}

/** Step 7: Prompt user to use buttons */
async function handleStep7(
  token: string,
  chatId: number,
  db: SqlStorage,
  userMessage: string
): Promise<void> {
  await sendText(
    token,
    chatId,
    "\u23f3 Gunakan tombol di atas untuk memilih jenis denda, atau ketik /batal untuk membatalkan."
  );
}

/**
 * Handle late fee type selection (callback query).
 * Then ask for late fee value if needed.
 */
export async function handleLateFeeTypeSelection(
  token: string,
  chatId: number,
  db: SqlStorage,
  lateFeeType: LateFeeType
): Promise<void> {
  const state = getConversationState(db);
  if (!state || state.pending_action !== "register_loan_step") {
    await sendText(token, chatId, "\u26a0\ufe0f Sesi pendaftaran pinjaman tidak ditemukan.");
    return;
  }

  const data = state.pending_data as LoanRegistrationData;
  data.late_fee_type = lateFeeType;

  if (lateFeeType === "none") {
    data.late_fee_value = 0;
    await finalizeLoanRegistration(token, chatId, db, data);
  } else {
    setConversationState(db, "register_loan_step", { ...data, step: 8 });

    let prompt = "";
    if (lateFeeType === "percent_monthly") {
      prompt = "Berapa persen per bulan? Contoh: 5";
    } else if (lateFeeType === "percent_daily") {
      prompt = "Berapa persen per hari? Contoh: 0.25";
    } else if (lateFeeType === "fixed") {
      prompt = "Berapa nominal denda tetap? Contoh: 50000";
    }

    const text = `\u2705 Jenis denda: <b>${formatLateFeeType(lateFeeType)}</b>\n\n` +
      `<b>Nilai Denda</b>\n${prompt}`;

    await sendText(token, chatId, text);
  }
}

/**
 * Handle late fee value input (step 8).
 */
export async function handleLateFeeValue(
  token: string,
  chatId: number,
  db: SqlStorage,
  userMessage: string,
  todayDate: string
): Promise<void> {
  const state = getConversationState(db);
  if (!state || state.pending_action !== "register_loan_step") {
    await sendText(token, chatId, "\u26a0\ufe0f Sesi pendaftaran pinjaman tidak ditemukan.");
    return;
  }

  const data = state.pending_data as LoanRegistrationData;
  const value = parseFloat(userMessage.trim());

  if (isNaN(value) || value < 0) {
    await sendText(token, chatId, "\u274c Nilai tidak valid. Coba lagi dengan angka, contoh: 5 atau 0.25");
    return;
  }

  data.late_fee_value = value;
  await finalizeLoanRegistration(token, chatId, db, data, todayDate);
}

/**
 * Finalize loan registration: save to DB and show confirmation.
 */
async function finalizeLoanRegistration(
  token: string,
  chatId: number,
  db: SqlStorage,
  data: LoanRegistrationData,
  todayDate?: string
): Promise<void> {
  data.start_date = todayDate ?? new Date().toISOString().split("T")[0]!;

  const loanId = registerLoan(db, data);

  clearConversationState(db);

  const interest = data.total_with_interest - data.original_amount;
  const interestRate = ((interest / data.original_amount) * 100).toFixed(1);

  const text = `\u2705 <b>Pinjaman Berhasil Didaftarkan!</b>\n\n` +
    `\ud83c\udfe6 Platform: <b>${data.platform}</b>\n` +
    `\ud83d\udcb0 Pinjaman: ${formatRupiah(data.original_amount)}\n` +
    `\ud83d\udcb8 Total bayar: ${formatRupiah(data.total_with_interest)}\n` +
    `\ud83d\udcc8 Bunga: ${formatRupiah(interest)} (${interestRate}%)\n` +
    `\ud83d\udd22 Cicilan: ${data.total_installments}x \u00d7 ${formatRupiah(data.monthly_amount)}/bulan\n` +
    `\ud83d\udcc5 Jatuh tempo: Tanggal ${data.due_day}\n` +
    `\u26a0\ufe0f Denda: ${formatLateFeeType(data.late_fee_type)}${data.late_fee_value > 0 ? ` (${data.late_fee_value}${data.late_fee_type.includes("percent") ? "%" : ""})` : ""}\n\n` +
    `\ud83d\udcca Semua cicilan sudah otomatis terjadwal. Ketik "lihat hutang" untuk melihat detail.`;

  await sendText(token, chatId, text);
}

/**
 * Parse amount from user input.
 * Supports: "3500000", "3.5jt", "3,5jt", "3500rb", "3.5m"
 */
function parseAmount(input: string): number | null {
  const cleaned = input.trim().toLowerCase().replace(/[,\s]/g, "");

  if (/^\d+$/.test(cleaned)) {
    return parseInt(cleaned, 10);
  }

  if (/^\d+(\.\d{3})+$/.test(cleaned)) {
    return parseInt(cleaned.replace(/\./g, ""), 10);
  }

  const jtMatch = cleaned.match(/^([\d.]+)(?:jt|juta)$/);
  if (jtMatch) {
    return Math.round(parseFloat(jtMatch[1]!) * 1_000_000);
  }

  const rbMatch = cleaned.match(/^([\d.]+)(?:rb|ribu)$/);
  if (rbMatch) {
    return Math.round(parseFloat(rbMatch[1]!) * 1_000);
  }

  const mMatch = cleaned.match(/^([\d.]+)m$/);
  if (mMatch) {
    return Math.round(parseFloat(mMatch[1]!) * 1_000_000);
  }

  const kMatch = cleaned.match(/^([\d.]+)k$/);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1]!) * 1_000);
  }

  return null;
}

/**
 * Format late fee type for display.
 */
function formatLateFeeType(type: LateFeeType): string {
  switch (type) {
    case "percent_monthly":
      return "Persen per bulan";
    case "percent_daily":
      return "Persen per hari";
    case "fixed":
      return "Nominal tetap";
    case "none":
      return "Tidak ada denda";
    default:
      return type;
  }
}

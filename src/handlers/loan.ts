/**
 * Loan Registration Handler — Hybrid Conversational Flow
 *
 * Design: AI extracts as many loan fields as possible from the user's
 * natural language message. Then we show a confirmation with detected
 * fields and list missing ones. User can save directly if all required
 * fields are present, or enter a mini-wizard for missing fields only.
 */

import type { LoanRegistrationData, LateFeeType } from "../types/loan";
import type { RegisterLoanParams } from "../types/intent";
import { sendText, sendWithKeyboard } from "../telegram/api";
import { setConversationState, getConversationState, clearConversationState } from "../database/conversation";
import { registerLoan } from "../database/loan";
import { formatRupiah } from "./income";

/** Fields that MUST be present before we can save a loan */
const REQUIRED_FIELDS: Array<keyof RegisterLoanParams> = [
  "platform",
  "original_amount",
  "total_installments",
  "monthly_amount",
  "due_day",
];

/** Human-readable labels for each field (Indonesian) */
const FIELD_LABELS: Record<keyof RegisterLoanParams, string> = {
  platform: "Platform/Nama",
  original_amount: "Jumlah pinjaman (pokok)",
  total_with_interest: "Total harus dibayar (termasuk bunga)",
  total_installments: "Jumlah cicilan",
  monthly_amount: "Cicilan per bulan",
  due_day: "Tanggal jatuh tempo",
  late_fee_type: "Jenis denda",
  late_fee_value: "Nilai denda",
};

/** Field prompts for mini-wizard (Indonesian) */
const FIELD_PROMPTS: Record<keyof RegisterLoanParams, string> = {
  platform: "Ketik nama platform pinjaman (contoh: Shopee Pinjam, Kredivo, SeaBank):",
  original_amount: "Berapa jumlah pinjaman (pokok)? Contoh: 3500000 atau 3.5jt",
  total_with_interest: "Berapa total yang harus dibayar (termasuk bunga)? Contoh: 4904446\n\nKetik 0 atau \"skip\" jika tidak tahu.",
  total_installments: "Berapa kali cicilan? Contoh: 10",
  monthly_amount: "Berapa cicilan per bulan? Contoh: 435917 atau 435rb",
  due_day: "Tanggal berapa jatuh tempo setiap bulan? (1-31)",
  late_fee_type: "Pilih jenis denda:",
  late_fee_value: "Berapa nilai dendanya? Contoh: 5 (untuk 5%) atau 50000 (nominal tetap)",
};

/**
 * Handle register_loan intent from AI detection.
 * Checks how many fields AI extracted and routes accordingly.
 */
export async function handleLoanFromAI(
  token: string,
  chatId: number,
  db: SqlStorage,
  aiParams: RegisterLoanParams
): Promise<void> {
  // Count how many fields AI extracted
  const extracted = getExtractedFields(aiParams);

  if (extracted.length === 0) {
    // No fields extracted — user just said "daftar pinjaman" etc.
    await promptLoanInput(token, chatId);
    return;
  }

  // Build partial registration data from AI params
  const data = buildRegistrationData(aiParams);
  const missing = getMissingRequiredFields(aiParams);

  if (missing.length === 0) {
    // All required fields present — show confirmation with save button
    await showLoanConfirmation(token, chatId, db, data);
  } else {
    // Some fields detected, some missing — show summary + start mini-wizard
    await showPartialAndStartWizard(token, chatId, db, data, missing);
  }
}

/**
 * Prompt user to provide loan info when no params were extracted.
 */
async function promptLoanInput(token: string, chatId: number): Promise<void> {
  const text = `\ud83c\udfe6 <b>Daftar Pinjaman Baru</b>\n\n` +
    `Kirim info pinjaman kamu dalam satu pesan, contoh:\n\n` +
    `\u2022 <i>\"kredivo 5jt 12 bulan 500rb/bln no denda\"</i>\n` +
    `\u2022 <i>\"shopee 3.5jt total 4.9jt 10x tanggal 13 denda 5%/bln\"</i>\n` +
    `\u2022 <i>\"seabank 1.5jt 7 bulan 232rb tgl 5 denda 0.25%/hari\"</i>\n` +
    `\u2022 <i>\"hutang ke yono 500rb\"</i>\n\n` +
    `Tulis sebanyak mungkin yang kamu tahu. Yang kurang nanti aku tanyakan.`;

  await sendText(token, chatId, text);
}

/**
 * Show full confirmation when all required fields are present.
 * User can save directly or enter edit mode.
 */
async function showLoanConfirmation(
  token: string,
  chatId: number,
  db: SqlStorage,
  data: LoanRegistrationData
): Promise<void> {
  const text = buildConfirmationText(data);

  // Save data to conversation state for callback handling
  setConversationState(db, "confirm_loan", { ...data });

  await sendWithKeyboard(token, chatId, text, {
    inline_keyboard: [
      [
        { text: "\u2705 Simpan", callback_data: "loan_confirm_yes" },
        { text: "\u270f\ufe0f Edit", callback_data: "loan_confirm_edit" },
      ],
      [
        { text: "\u274c Batal", callback_data: "loan_confirm_no" },
      ],
    ],
  });
}

/**
 * Show detected fields + immediately start mini-wizard for missing fields.
 */
async function showPartialAndStartWizard(
  token: string,
  chatId: number,
  db: SqlStorage,
  data: LoanRegistrationData,
  missing: Array<keyof RegisterLoanParams>
): Promise<void> {
  // Build summary of what we detected
  let text = `\ud83d\udccb <b>Saya tangkap:</b>\n`;
  text += buildDetectedFieldsText(data);
  text += `\n\u2757 <b>Masih kurang ${missing.length} info:</b>\n`;

  for (const field of missing) {
    text += `\u2022 ${FIELD_LABELS[field]}\n`;
  }

  // Determine first missing field to ask
  const firstMissing = missing[0]!;
  text += `\n${FIELD_PROMPTS[firstMissing]}`;

  // Save state: data so far + which fields are missing + current field index
  setConversationState(db, "loan_fill_missing", {
    ...data,
    _missing_fields: missing,
    _current_missing_index: 0,
  });

  // late_fee_type uses inline keyboard instead of text input
  if (firstMissing === "late_fee_type") {
    await sendLateFeeKeyboard(token, chatId, text);
  } else {
    await sendText(token, chatId, text);
  }
}

/**
 * Handle user text input during mini-wizard for missing fields.
 */
export async function handleMissingFieldInput(
  token: string,
  chatId: number,
  db: SqlStorage,
  userMessage: string,
  todayDate: string
): Promise<void> {
  const state = getConversationState(db);
  if (!state || state.pending_action !== "loan_fill_missing") {
    await sendText(token, chatId, "\u26a0\ufe0f Sesi tidak ditemukan. Coba daftar pinjaman lagi.");
    return;
  }

  const stateData = state.pending_data as Record<string, unknown>;
  const missingFields = stateData._missing_fields as Array<keyof RegisterLoanParams>;
  const currentIndex = stateData._current_missing_index as number;
  const currentField = missingFields[currentIndex]!;

  // Parse and validate the input for this field
  const parsed = parseFieldValue(currentField, userMessage);
  if (parsed === null) {
    await sendText(token, chatId, getValidationError(currentField));
    return;
  }

  // Store the value
  stateData[currentField] = parsed;

  // If this is total_with_interest and user typed 0 or "skip", set to 0
  if (currentField === "total_with_interest" && parsed === 0) {
    stateData[currentField] = 0;
  }

  // Move to next missing field
  const nextIndex = currentIndex + 1;

  if (nextIndex >= missingFields.length) {
    // All fields filled — show confirmation
    const data = extractRegistrationData(stateData);
    data.start_date = todayDate;
    await showLoanConfirmation(token, chatId, db, data);
    return;
  }

  // Ask for next missing field
  const nextField = missingFields[nextIndex]!;
  stateData._current_missing_index = nextIndex;
  setConversationState(db, "loan_fill_missing", stateData);

  const prompt = `\u2705 ${FIELD_LABELS[currentField]} tercatat!\n\n${FIELD_PROMPTS[nextField]}`;

  if (nextField === "late_fee_type") {
    await sendLateFeeKeyboard(token, chatId, prompt);
  } else {
    await sendText(token, chatId, prompt);
  }
}

/**
 * Handle late fee type selection via inline keyboard.
 * Works for both mini-wizard and edit mode.
 */
export async function handleLateFeeTypeCallback(
  token: string,
  chatId: number,
  db: SqlStorage,
  lateFeeType: LateFeeType,
  todayDate: string
): Promise<void> {
  const state = getConversationState(db);
  if (!state) {
    await sendText(token, chatId, "\u26a0\ufe0f Sesi tidak ditemukan.");
    return;
  }

  const stateData = state.pending_data as Record<string, unknown>;
  stateData.late_fee_type = lateFeeType;

  if (lateFeeType === "none") {
    stateData.late_fee_value = 0;
  }

  if (state.pending_action === "loan_fill_missing") {
    const missingFields = stateData._missing_fields as Array<keyof RegisterLoanParams>;
    const currentIndex = stateData._current_missing_index as number;
    const nextIndex = currentIndex + 1;

    // If "none" and late_fee_value is also in missing, skip it
    if (lateFeeType === "none") {
      const valueMissingIdx = missingFields.indexOf("late_fee_value");
      if (valueMissingIdx > currentIndex) {
        // Remove late_fee_value from missing since it's now 0
        missingFields.splice(valueMissingIdx, 1);
        stateData._missing_fields = missingFields;
      }
    }

    if (nextIndex >= missingFields.length) {
      // All fields filled — show confirmation
      const data = extractRegistrationData(stateData);
      data.start_date = todayDate;
      await showLoanConfirmation(token, chatId, db, data);
    } else {
      // Ask next field
      const nextField = missingFields[nextIndex]!;
      stateData._current_missing_index = nextIndex;
      setConversationState(db, "loan_fill_missing", stateData);

      const prompt = `\u2705 Jenis denda: <b>${formatLateFeeType(lateFeeType)}</b>\n\n${FIELD_PROMPTS[nextField]}`;
      await sendText(token, chatId, prompt);
    }
  } else if (state.pending_action === "loan_edit_field") {
    // Edit mode — go back to confirmation
    if (lateFeeType !== "none" && !stateData.late_fee_value) {
      // Need to ask for value too
      stateData._editing_field = "late_fee_value";
      setConversationState(db, "loan_edit_field", stateData);
      await sendText(token, chatId, `\u2705 Jenis denda: <b>${formatLateFeeType(lateFeeType)}</b>\n\n${FIELD_PROMPTS.late_fee_value}`);
    } else {
      const data = extractRegistrationData(stateData);
      data.start_date = todayDate;
      await showLoanConfirmation(token, chatId, db, data);
    }
  }
}

/**
 * Handle loan_confirm_yes callback — save the loan.
 */
export async function handleLoanConfirmSave(
  token: string,
  chatId: number,
  db: SqlStorage,
  todayDate: string
): Promise<void> {
  const state = getConversationState(db);
  if (!state || state.pending_action !== "confirm_loan") {
    await sendText(token, chatId, "\u26a0\ufe0f Sesi konfirmasi tidak ditemukan.");
    return;
  }

  const data = extractRegistrationData(state.pending_data as Record<string, unknown>);
  data.start_date = data.start_date || todayDate;

  // Save to database
  registerLoan(db, data);
  clearConversationState(db);

  // Build success message
  const interest = data.total_with_interest > 0
    ? data.total_with_interest - data.original_amount
    : 0;
  const interestRate = data.original_amount > 0 && interest > 0
    ? ((interest / data.original_amount) * 100).toFixed(1)
    : null;

  let text = `\u2705 <b>Pinjaman Berhasil Didaftarkan!</b>\n\n` +
    `\ud83c\udfe6 ${data.platform}\n` +
    `\ud83d\udcb0 Pinjaman: ${formatRupiah(data.original_amount)}\n`;

  if (data.total_with_interest > 0) {
    text += `\ud83d\udcb8 Total bayar: ${formatRupiah(data.total_with_interest)}\n`;
    if (interestRate) {
      text += `\ud83d\udcc8 Bunga: ${formatRupiah(interest)} (${interestRate}%)\n`;
    }
  }

  text += `\ud83d\udd22 Cicilan: ${data.total_installments}x \u00d7 ${formatRupiah(data.monthly_amount)}/bulan\n` +
    `\ud83d\udcc5 Jatuh tempo: Tanggal ${data.due_day}\n` +
    `\u26a0\ufe0f Denda: ${formatLateFeeType(data.late_fee_type)}`;

  if (data.late_fee_value > 0) {
    text += ` (${data.late_fee_value}${data.late_fee_type.includes("percent") ? "%" : ""})`;
  }

  text += `\n\n\ud83d\udcca ${data.total_installments} cicilan otomatis terjadwal. Ketik \"lihat hutang\" untuk detail.`;

  await sendText(token, chatId, text);
}

/**
 * Handle loan_confirm_edit callback — enter edit mode.
 * Shows each field with an edit button.
 */
export async function handleLoanConfirmEdit(
  token: string,
  chatId: number,
  db: SqlStorage
): Promise<void> {
  const state = getConversationState(db);
  if (!state || state.pending_action !== "confirm_loan") {
    await sendText(token, chatId, "\u26a0\ufe0f Sesi konfirmasi tidak ditemukan.");
    return;
  }

  const stateData = state.pending_data as Record<string, unknown>;
  const data = extractRegistrationData(stateData);

  let text = `\u270f\ufe0f <b>Pilih yang ingin diedit:</b>\n\n`;
  text += `1. Platform: <b>${data.platform}</b>\n`;
  text += `2. Pinjaman: <b>${formatRupiah(data.original_amount)}</b>\n`;
  text += `3. Total bayar: <b>${data.total_with_interest > 0 ? formatRupiah(data.total_with_interest) : "-"}</b>\n`;
  text += `4. Cicilan: <b>${data.total_installments}x</b>\n`;
  text += `5. Per bulan: <b>${formatRupiah(data.monthly_amount)}</b>\n`;
  text += `6. Jatuh tempo: <b>Tgl ${data.due_day}</b>\n`;
  text += `7. Denda: <b>${formatLateFeeType(data.late_fee_type)}${data.late_fee_value > 0 ? ` (${data.late_fee_value}${data.late_fee_type.includes("percent") ? "%" : ""})` : ""}</b>\n`;
  text += `\nKetik nomor (1-7) untuk edit, atau /batal untuk membatalkan.`;

  setConversationState(db, "loan_edit_select", stateData);
  await sendText(token, chatId, text);
}

/**
 * Handle edit field selection (user sends a number 1-7).
 */
export async function handleEditSelection(
  token: string,
  chatId: number,
  db: SqlStorage,
  userMessage: string
): Promise<void> {
  const state = getConversationState(db);
  if (!state || state.pending_action !== "loan_edit_select") {
    return;
  }

  const num = parseInt(userMessage.trim(), 10);
  const fieldMap: Record<number, keyof RegisterLoanParams> = {
    1: "platform",
    2: "original_amount",
    3: "total_with_interest",
    4: "total_installments",
    5: "monthly_amount",
    6: "due_day",
    7: "late_fee_type",
  };

  const field = fieldMap[num];
  if (!field) {
    await sendText(token, chatId, "\u274c Ketik angka 1-7 untuk memilih field yang ingin diedit.");
    return;
  }

  const stateData = state.pending_data as Record<string, unknown>;
  stateData._editing_field = field;
  setConversationState(db, "loan_edit_field", stateData);

  if (field === "late_fee_type") {
    await sendLateFeeKeyboard(token, chatId, FIELD_PROMPTS[field]);
  } else {
    await sendText(token, chatId, FIELD_PROMPTS[field]);
  }
}

/**
 * Handle text input during edit mode for a single field.
 */
export async function handleEditFieldInput(
  token: string,
  chatId: number,
  db: SqlStorage,
  userMessage: string,
  todayDate: string
): Promise<void> {
  const state = getConversationState(db);
  if (!state || state.pending_action !== "loan_edit_field") {
    return;
  }

  const stateData = state.pending_data as Record<string, unknown>;
  const field = stateData._editing_field as keyof RegisterLoanParams;

  const parsed = parseFieldValue(field, userMessage);
  if (parsed === null) {
    await sendText(token, chatId, getValidationError(field));
    return;
  }

  stateData[field] = parsed;

  // Show updated confirmation
  const data = extractRegistrationData(stateData);
  data.start_date = todayDate;
  await showLoanConfirmation(token, chatId, db, data);
}

// ─── Utility Functions ───────────────────────────────────────────────

/** Get list of fields that AI successfully extracted (non-null, non-zero for numbers) */
function getExtractedFields(params: RegisterLoanParams): Array<keyof RegisterLoanParams> {
  const fields: Array<keyof RegisterLoanParams> = [];
  if (params.platform) fields.push("platform");
  if (params.original_amount && params.original_amount > 0) fields.push("original_amount");
  if (params.total_with_interest && params.total_with_interest > 0) fields.push("total_with_interest");
  if (params.total_installments && params.total_installments > 0) fields.push("total_installments");
  if (params.monthly_amount && params.monthly_amount > 0) fields.push("monthly_amount");
  if (params.due_day && params.due_day > 0) fields.push("due_day");
  if (params.late_fee_type) fields.push("late_fee_type");
  if (params.late_fee_type === "none" || (params.late_fee_value !== undefined && params.late_fee_value !== null)) {
    fields.push("late_fee_value");
  }
  return fields;
}

/** Get required fields that are still missing */
function getMissingRequiredFields(params: RegisterLoanParams): Array<keyof RegisterLoanParams> {
  const missing: Array<keyof RegisterLoanParams> = [];
  if (!params.platform) missing.push("platform");
  if (!params.original_amount || params.original_amount <= 0) missing.push("original_amount");
  if (!params.total_installments || params.total_installments <= 0) missing.push("total_installments");
  if (!params.monthly_amount || params.monthly_amount <= 0) missing.push("monthly_amount");
  if (!params.due_day || params.due_day <= 0) missing.push("due_day");

  // Also add optional fields that weren't provided so user can fill them
  if (!params.total_with_interest) missing.push("total_with_interest");
  if (!params.late_fee_type) {
    missing.push("late_fee_type");
    missing.push("late_fee_value");
  }

  return missing;
}

/** Build LoanRegistrationData from AI params */
function buildRegistrationData(params: RegisterLoanParams): LoanRegistrationData {
  return {
    platform: params.platform ?? "",
    original_amount: params.original_amount ?? 0,
    total_with_interest: params.total_with_interest ?? 0,
    total_installments: params.total_installments ?? 0,
    monthly_amount: params.monthly_amount ?? 0,
    due_day: params.due_day ?? 0,
    late_fee_type: params.late_fee_type ?? "none",
    late_fee_value: params.late_fee_value ?? 0,
    start_date: "",
  };
}

/** Extract LoanRegistrationData from conversation state data */
function extractRegistrationData(stateData: Record<string, unknown>): LoanRegistrationData {
  return {
    platform: (stateData.platform as string) ?? "",
    original_amount: (stateData.original_amount as number) ?? 0,
    total_with_interest: (stateData.total_with_interest as number) ?? 0,
    total_installments: (stateData.total_installments as number) ?? 0,
    monthly_amount: (stateData.monthly_amount as number) ?? 0,
    due_day: (stateData.due_day as number) ?? 0,
    late_fee_type: (stateData.late_fee_type as LateFeeType) ?? "none",
    late_fee_value: (stateData.late_fee_value as number) ?? 0,
    start_date: (stateData.start_date as string) ?? "",
    note: (stateData.note as string) ?? undefined,
  };
}

/** Build confirmation text for display */
function buildConfirmationText(data: LoanRegistrationData): string {
  let text = `\ud83d\udccb <b>Ringkasan Pinjaman</b>\n\n`;
  text += `\ud83c\udfe6 Platform: <b>${data.platform}</b>\n`;
  text += `\ud83d\udcb0 Pinjaman: <b>${formatRupiah(data.original_amount)}</b>\n`;

  if (data.total_with_interest > 0) {
    text += `\ud83d\udcb8 Total bayar: <b>${formatRupiah(data.total_with_interest)}</b>\n`;
    const interest = data.total_with_interest - data.original_amount;
    if (interest > 0) {
      const rate = ((interest / data.original_amount) * 100).toFixed(1);
      text += `\ud83d\udcc8 Bunga: ${formatRupiah(interest)} (${rate}%)\n`;
    }
  }

  text += `\ud83d\udd22 Cicilan: <b>${data.total_installments}x \u00d7 ${formatRupiah(data.monthly_amount)}/bln</b>\n`;
  text += `\ud83d\udcc5 Jatuh tempo: <b>Tanggal ${data.due_day}</b>\n`;
  text += `\u26a0\ufe0f Denda: <b>${formatLateFeeType(data.late_fee_type)}`;
  if (data.late_fee_value > 0) {
    text += ` (${data.late_fee_value}${data.late_fee_type.includes("percent") ? "%" : ""})`;
  }
  text += `</b>`;

  return text;
}

/** Build text showing only the fields we detected */
function buildDetectedFieldsText(data: LoanRegistrationData): string {
  let text = "";
  if (data.platform) text += `\ud83c\udfe6 Platform: <b>${data.platform}</b>\n`;
  if (data.original_amount > 0) text += `\ud83d\udcb0 Pinjaman: <b>${formatRupiah(data.original_amount)}</b>\n`;
  if (data.total_with_interest > 0) text += `\ud83d\udcb8 Total bayar: <b>${formatRupiah(data.total_with_interest)}</b>\n`;
  if (data.total_installments > 0) text += `\ud83d\udd22 Cicilan: <b>${data.total_installments}x</b>\n`;
  if (data.monthly_amount > 0) text += `\ud83d\udcb5 Per bulan: <b>${formatRupiah(data.monthly_amount)}/bln</b>\n`;
  if (data.due_day > 0) text += `\ud83d\udcc5 Jatuh tempo: <b>Tanggal ${data.due_day}</b>\n`;
  if (data.late_fee_type !== "none" || data.late_fee_value > 0) {
    text += `\u26a0\ufe0f Denda: <b>${formatLateFeeType(data.late_fee_type)}`;
    if (data.late_fee_value > 0) {
      text += ` (${data.late_fee_value}${data.late_fee_type.includes("percent") ? "%" : ""})`;
    }
    text += `</b>\n`;
  }
  return text;
}

/** Parse user input for a specific field */
function parseFieldValue(field: keyof RegisterLoanParams, input: string): string | number | null {
  const cleaned = input.trim();

  switch (field) {
    case "platform":
      return cleaned.length > 0 ? cleaned : null;

    case "original_amount":
    case "total_with_interest":
    case "monthly_amount": {
      if (cleaned.toLowerCase() === "skip" || cleaned === "0") {
        return field === "total_with_interest" ? 0 : null;
      }
      return parseAmount(cleaned);
    }

    case "total_installments": {
      const num = parseInt(cleaned, 10);
      return (!isNaN(num) && num > 0) ? num : null;
    }

    case "due_day": {
      const day = parseInt(cleaned, 10);
      return (!isNaN(day) && day >= 1 && day <= 31) ? day : null;
    }

    case "late_fee_value": {
      const val = parseFloat(cleaned);
      return (!isNaN(val) && val >= 0) ? val : null;
    }

    default:
      return null;
  }
}

/** Get validation error message for a field */
function getValidationError(field: keyof RegisterLoanParams): string {
  switch (field) {
    case "platform":
      return "\u274c Nama platform tidak boleh kosong.";
    case "original_amount":
    case "monthly_amount":
      return "\u274c Jumlah tidak valid. Coba: 3500000, 3.5jt, atau 500rb";
    case "total_with_interest":
      return "\u274c Jumlah tidak valid. Ketik angka atau \"skip\" jika tidak tahu.";
    case "total_installments":
      return "\u274c Masukkan jumlah cicilan (angka), contoh: 10";
    case "due_day":
      return "\u274c Tanggal harus antara 1-31.";
    case "late_fee_value":
      return "\u274c Masukkan angka, contoh: 5 (untuk 5%) atau 50000";
    default:
      return "\u274c Input tidak valid. Coba lagi.";
  }
}

/** Send late fee type inline keyboard */
async function sendLateFeeKeyboard(token: string, chatId: number, text: string): Promise<void> {
  await sendWithKeyboard(token, chatId, text, {
    inline_keyboard: [
      [{ text: "\ud83d\udcca Persen/bulan (5%/bln)", callback_data: "loan_late_fee:percent_monthly" }],
      [{ text: "\ud83d\udcc5 Persen/hari (0.25%/hari)", callback_data: "loan_late_fee:percent_daily" }],
      [{ text: "\ud83d\udcb5 Nominal tetap", callback_data: "loan_late_fee:fixed" }],
      [{ text: "\u2705 Tidak ada denda", callback_data: "loan_late_fee:none" }],
    ],
  });
}

/**
 * Parse amount from user input.
 * Supports: "3500000", "3.5jt", "3,5jt", "3500rb", "3.5m", "500k"
 */
function parseAmount(input: string): number | null {
  const cleaned = input.trim().toLowerCase().replace(/[,\s]/g, "");

  if (/^\d+$/.test(cleaned)) return parseInt(cleaned, 10);
  if (/^\d+(\.\d{3})+$/.test(cleaned)) return parseInt(cleaned.replace(/\./g, ""), 10);

  const jtMatch = cleaned.match(/^([\d.]+)(?:jt|juta)$/);
  if (jtMatch) return Math.round(parseFloat(jtMatch[1]!) * 1_000_000);

  const rbMatch = cleaned.match(/^([\d.]+)(?:rb|ribu)$/);
  if (rbMatch) return Math.round(parseFloat(rbMatch[1]!) * 1_000);

  const mMatch = cleaned.match(/^([\d.]+)m$/);
  if (mMatch) return Math.round(parseFloat(mMatch[1]!) * 1_000_000);

  const kMatch = cleaned.match(/^([\d.]+)k$/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]!) * 1_000);

  return null;
}

/** Format late fee type for display */
function formatLateFeeType(type: LateFeeType): string {
  switch (type) {
    case "percent_monthly": return "Persen per bulan";
    case "percent_daily": return "Persen per hari";
    case "fixed": return "Nominal tetap";
    case "none": return "Tidak ada denda";
    default: return type;
  }
}

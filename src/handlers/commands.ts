/**
 * Bot Command Handlers
 * Handles /start, /help, and /batal commands.
 * All bot responses are in Indonesian (user's language).
 */

import { sendText } from "../telegram/api";

/** Welcome message shown when user first starts the bot or sends /start */
const WELCOME_MESSAGE = `\ud83c\udfcd\ufe0f\ud83d\udcb0 <b>Selamat datang di SF Driver Finance!</b>

Bot ini membantu kamu mencatat keuangan sebagai driver ojol.

\ud83d\udcac <b>Cara Pakai:</b>
Cukup kirim pesan biasa, bot mengerti bahasa sehari-hari:
\u2022 <i>"Dapet 150rb food"</i> \u2014 catat pendapatan
\u2022 <i>"Bensin 20rb"</i> \u2014 catat pengeluaran
\u2022 <i>"Kredivo 5jt 12 bulan 500rb/bln"</i> \u2014 daftar pinjaman
\u2022 <i>"Bayar cicilan Kredivo"</i> \u2014 catat pembayaran
\u2022 <i>"Hutang gue berapa"</i> \u2014 cek pinjaman
\u2022 <i>"Ada denda ga"</i> \u2014 hitung denda
\u2022 <i>"Ringkasan bulan ini"</i> \u2014 ringkasan keuangan
\u2022 <i>"Progres hutang"</i> \u2014 progres pelunasan

Ketik /help untuk panduan lengkap.`;

/** Help message with detailed usage guide */
const HELP_MESSAGE = `\ud83d\udcd6 <b>Panduan SF Driver Finance</b>

Kirim pesan biasa \u2014 bot mengerti bahasa sehari-hari kamu.

<b>\ud83d\udcdd Catat Pendapatan:</b>
\u2022 <i>"Dapet 150rb food"</i>
\u2022 <i>"SPX hari ini 80rb"</i>
\u2022 <i>"Gue dapet 200rb dari makanan"</i>

<b>\ud83d\udcb8 Catat Pengeluaran:</b>
\u2022 <i>"Bensin 20rb"</i>
\u2022 <i>"Parkir 5000"</i>
\u2022 <i>"Makan siang 15rb"</i>
\u2022 <i>"Rokok 30rb"</i>
\u2022 <i>"Servis motor 150rb"</i>

<b>\ud83c\udfe6 Pinjaman / Hutang:</b>
\u2022 <i>"Kredivo 5jt 12 bulan 500rb/bln"</i> \u2014 daftar baru
\u2022 <i>"Bayar cicilan Kredivo"</i> \u2014 catat pembayaran
\u2022 <i>"Hutang gue berapa"</i> \u2014 cek semua pinjaman
\u2022 <i>"Ada denda ga"</i> \u2014 hitung denda telat
\u2022 <i>"Progres hutang"</i> \u2014 progres pelunasan

<b>\ud83d\udcca Laporan:</b>
\u2022 <i>"Ringkasan bulan ini"</i> \u2014 ringkasan keuangan
\u2022 <i>"Rekap minggu ini"</i> \u2014 rekap mingguan

<b>\u2328\ufe0f Shortcut Perintah:</b>
/hutang \u2014 Dashboard pinjaman
/denda \u2014 Hitung denda telat
/ringkasan \u2014 Ringkasan bulanan
/progres \u2014 Progres pelunasan
/batal \u2014 Batalkan proses
/help \u2014 Panduan ini

<b>\ud83d\udca1 Tips:</b>
\u2022 Pakai bahasa sehari-hari, bot ngerti bahasa gaul
\u2022 Ketik \"batal\" kapan saja untuk membatalkan
\u2022 Slash command (/hutang dll) = shortcut cepat`;

/** Message shown when user cancels an ongoing operation */
const CANCEL_MESSAGE = `\u2705 Proses dibatalkan. Silakan mulai pesan baru.`;

/** Message shown when there's nothing to cancel */
const NOTHING_TO_CANCEL_MESSAGE = `\u2139\ufe0f Tidak ada proses yang sedang berjalan.`;

/**
 * Handle /start command \u2014 sends welcome message and registers user if new.
 */
export async function handleStartCommand(
  token: string,
  chatId: number
): Promise<void> {
  await sendText(token, chatId, WELCOME_MESSAGE);
}

/**
 * Handle /help command \u2014 sends usage guide.
 */
export async function handleHelpCommand(
  token: string,
  chatId: number
): Promise<void> {
  await sendText(token, chatId, HELP_MESSAGE);
}

/**
 * Handle /batal command \u2014 clears conversation state and confirms cancellation.
 * @param hadPendingAction Whether there was an active pending action to cancel
 */
export async function handleCancelCommand(
  token: string,
  chatId: number,
  hadPendingAction: boolean
): Promise<void> {
  const message = hadPendingAction ? CANCEL_MESSAGE : NOTHING_TO_CANCEL_MESSAGE;
  await sendText(token, chatId, message);
}

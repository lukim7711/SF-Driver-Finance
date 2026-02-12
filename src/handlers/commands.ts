/**
 * Bot Command Handlers
 * Handles /start, /help, and /batal commands.
 * All bot responses are in Indonesian (user's language).
 */

import { sendText } from "../telegram/api";

/** Welcome message shown when user first starts the bot or sends /start */
const WELCOME_MESSAGE = `\ud83c\udfcd\ufe0f\ud83d\udcb0 <b>Selamat datang di SF Driver Finance!</b>

Bot ini membantu kamu mencatat keuangan sebagai driver ojol:

\ud83d\udcca <b>Fitur Utama:</b>
\u2022 Catat pendapatan harian (food delivery & SPX)
\u2022 Catat pengeluaran (bensin, parkir, makan, dll)
\u2022 Tracking cicilan pinjaman online (pinjol)
\u2022 Target pendapatan harian/mingguan/bulanan
\u2022 Baca struk/screenshot via foto (OCR)

\ud83d\udcac <b>Cara Pakai:</b>
Cukup kirim pesan biasa seperti:
\u2022 <i>"Hari ini dapat 150rb food"</i>
\u2022 <i>"Bensin 20rb"</i>
\u2022 <i>"Bayar cicilan Shopee Pinjam"</i>

Atau kirim foto struk/screenshot untuk pencatatan otomatis.

Ketik /help untuk panduan lengkap.`;

/** Help message with detailed usage guide */
const HELP_MESSAGE = `\ud83d\udcd6 <b>Panduan SF Driver Finance</b>

<b>\ud83d\udcdd Catat Pendapatan:</b>
Kirim pesan seperti:
\u2022 <i>"Dapat 150rb food"</i>
\u2022 <i>"SPX hari ini 80rb"</i>
\u2022 <i>"Income 200k food delivery"</i>

<b>\ud83d\udcb8 Catat Pengeluaran:</b>
Kirim pesan seperti:
\u2022 <i>"Bensin 20rb"</i>
\u2022 <i>"Parkir 5000"</i>
\u2022 <i>"Makan siang 15rb"</i>
\u2022 <i>"Rokok 30rb"</i>

<b>\ud83c\udfe6 Pinjaman Online:</b>
Kirim pesan seperti:
\u2022 <i>"Daftar pinjaman baru"</i>
\u2022 <i>"Bayar cicilan Kredivo"</i>
\u2022 <i>"Lihat semua pinjaman"</i>

<b>\ud83d\udcf8 Foto/Screenshot:</b>
Kirim foto struk atau screenshot \u2014 bot akan baca dan catat otomatis.

<b>\u2328\ufe0f Perintah:</b>
/start \u2014 Mulai ulang & pesan selamat datang
/help \u2014 Tampilkan panduan ini
/batal \u2014 Batalkan proses yang sedang berjalan

<b>\ud83d\udca1 Tips:</b>
\u2022 Gunakan bahasa sehari-hari, bot mengerti bahasa Indonesia
\u2022 Ketik \"batal\" kapan saja untuk membatalkan proses
\u2022 Semua data tersimpan aman per akun kamu`;

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

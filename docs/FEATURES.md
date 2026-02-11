# Daftar Fitur

Status: ✅ Selesai | 🔧 Dalam Proses | 📋 Rencana

---

## Fitur Inti

### 📋 F01 — Catat Pemasukan

Mencatat pemasukan dari orderan ShopeeFood dan SPX Express.

- Input: pesan natural language (contoh: "dapet 45rb dari food", "spx 30000")
- Data: jumlah, tipe (food/spx), tanggal, catatan opsional
- Output: konfirmasi pencatatan + total hari ini

### 📋 F02 — Catat Pengeluaran

Mencatat pengeluaran operasional harian.

- Input: pesan natural language (contoh: "bensin 20rb", "parkir 5000", "makan siang 15rb")
- Kategori: bensin, parkir, makan, servis motor, lain-lain
- Data: jumlah, kategori, tanggal, catatan opsional
- Output: konfirmasi pencatatan + total pengeluaran hari ini

### 📋 F03 — Tracking Hutang

Mencatat dan melacak hutang (memberi pinjaman atau meminjam).

- Input: "hutang ke Budi 50rb", "Ani bayar hutang 30rb"
- Data: nama orang, jumlah, tipe (piutang/utang), tanggal, status
- Fitur: tandai lunas, reminder (opsional)
- Output: konfirmasi + daftar hutang aktif

### 📋 F04 — Target Pendapatan

Set dan tracking target pendapatan per periode.

- Input: "target hari ini 200rb", "target minggu ini 1.5jt"
- Periode: harian, mingguan, bulanan
- Output: progress bar / persentase pencapaian
- Notifikasi: saat target tercapai

### 📋 F05 — Baca Gambar (OCR)

Ekstrak data keuangan dari gambar/screenshot secara otomatis.

- Input: foto struk bensin, nota parkir, screenshot orderan, screenshot hutang
- Proses: OCR via Workers AI / DeepSeek → ekstrak data → konfirmasi ke user
- Output: data yang terdeteksi + konfirmasi sebelum disimpan
- Penting: selalu minta konfirmasi user sebelum menyimpan hasil OCR

### 📋 F06 — Intent Detection

Mendeteksi maksud user dari pesan natural language.

- AI memproses pesan → menentukan intent + ekstrak parameter
- Intent yang didukung:
  - `catat_pemasukan` — mencatat income
  - `catat_pengeluaran` — mencatat expense
  - `catat_hutang` — mencatat debt
  - `bayar_hutang` — update status hutang
  - `set_target` — set target pendapatan
  - `lihat_laporan` — minta laporan
  - `lihat_hutang` — daftar hutang
  - `lihat_target` — progress target
  - `bantuan` — help/panduan
  - `tidak_dikenali` — fallback

### 📋 F07 — Laporan Keuangan

Menampilkan ringkasan keuangan per periode.

- Periode: hari ini, minggu ini, bulan ini
- Isi laporan:
  - Total pemasukan (breakdown food/spx)
  - Total pengeluaran (breakdown per kategori)
  - Laba bersih (pemasukan - pengeluaran)
  - Progress target (jika ada)
  - Hutang aktif
- Format: teks terformat rapi di Telegram

### 📋 F08 — AI Fallback (Workers AI → DeepSeek)

Otomatis beralih ke DeepSeek API saat Workers AI mendekati limit.

- Tracking usage Neurons harian
- Threshold: 80% dari limit (8.000/10.000 Neurons)
- Fallback transparan — user tidak merasakan perbedaan
- Reset counter setiap tengah malam UTC

---

## Fitur Pendukung

### 📋 F09 — Onboarding User Baru

- Welcome message saat pertama kali chat
- Panduan singkat cara pakai bot
- Setup timezone (default: WIB)

### 📋 F10 — Command Dasar

- `/start` — mulai bot / onboarding
- `/help` — panduan penggunaan
- `/laporan` — shortcut laporan hari ini
- `/reset` — reset data (dengan konfirmasi ganda)

---

## Roadmap Masa Depan

### 📋 F11 — Export Data

- Export ke CSV/Excel
- Kirim via Telegram sebagai file

### 📋 F12 — Multi-Currency Support

- Support mata uang selain Rupiah (jika ada driver luar negeri)

### 📋 F13 — Analisis & Insight

- Tren pengeluaran
- Rekomendasi penghematan
- Perbandingan antar periode

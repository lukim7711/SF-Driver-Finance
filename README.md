# SF Driver Finance 🏍️💰

Aplikasi manajemen keuangan untuk **ShopeeFood Driver** (Food & SPX) yang berjalan sebagai **Telegram Bot**, di-hosting di **Cloudflare Workers Free Tier**.

## Fitur Utama

- 📥 **Catat Pemasukan** — dari orderan ShopeeFood / SPX
- 📤 **Catat Pengeluaran** — bensin, parkir, makan, servis motor, dll.
- 💸 **Tracking Hutang** — siapa, berapa, kapan, status lunas
- 🎯 **Target Pendapatan** — set target harian/mingguan/bulanan
- 📸 **Baca Gambar** — struk, nota, screenshot orderan → otomatis jadi data
- 🤖 **Intent Detection** — kirim pesan biasa, bot mengerti maksudnya
- 📊 **Laporan Keuangan** — harian, mingguan, bulanan
- 🔄 **AI Fallback** — otomatis fallback ke DeepSeek API jika Workers AI mendekati limit

## Tech Stack

| Komponen | Teknologi |
|---|---|
| Runtime | Cloudflare Workers (Free Tier) |
| Database | Durable Objects + SQLite storage |
| AI Primary | Cloudflare Workers AI |
| AI Fallback | DeepSeek API |
| Bot Platform | Telegram Bot API (webhook mode) |
| Bahasa | JavaScript |

## Struktur Proyek

```
SF-Driver-Finance/
├── src/
│   └── index.js          # Entry point Worker
├── docs/
│   ├── ARCHITECTURE.md   # Arsitektur sistem
│   ├── DECISIONS.md      # Log keputusan desain
│   ├── FEATURES.md       # Daftar fitur & status
│   ├── CHANGELOG.md      # Riwayat perubahan
│   ├── DATABASE.md       # Skema database
│   ├── API-FLOW.md       # Alur request
│   └── LIMITS.md         # Limit free tier & strategi
├── wrangler.jsonc        # Konfigurasi Cloudflare Workers
├── package.json          # Dependencies
└── README.md             # Dokumentasi utama
```

## Dokumentasi

- [Arsitektur Sistem](docs/ARCHITECTURE.md)
- [Keputusan Desain](docs/DECISIONS.md)
- [Daftar Fitur](docs/FEATURES.md)
- [Changelog](docs/CHANGELOG.md)
- [Skema Database](docs/DATABASE.md)
- [Alur API](docs/API-FLOW.md)
- [Limit & Strategi](docs/LIMITS.md)

## Setup & Development

> ⚠️ Proyek masih dalam tahap perencanaan. Instruksi setup akan ditambahkan setelah fase development dimulai.

### Prasyarat

- Node.js >= 18
- Akun Cloudflare (Free Tier)
- Telegram Bot Token (dari @BotFather)
- DeepSeek API Key

### Quick Start

```bash
git clone https://github.com/lukim7711/SF-Driver-Finance.git
cd SF-Driver-Finance
npm install
npx wrangler dev   # Development mode
npx wrangler deploy # Deploy ke Cloudflare
```

## Lisensi

Proyek pribadi — hak cipta dilindungi.

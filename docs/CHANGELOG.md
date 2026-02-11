# Changelog

Semua perubahan penting pada proyek ini didokumentasikan di sini.

Format: `[Tanggal] — Deskripsi perubahan`

---

## 2025-02-11 — Inisialisasi Proyek

### Ditambahkan

- Struktur repository awal
- `wrangler.jsonc` — konfigurasi Cloudflare Workers + Durable Objects
- `package.json` — metadata proyek dan dependencies dasar
- `src/index.js` — placeholder entry point Worker + Durable Object class
- Dokumentasi lengkap di `/docs`:
  - `ARCHITECTURE.md` — arsitektur sistem dan diagram alur
  - `DECISIONS.md` — log keputusan desain awal (7 keputusan)
  - `FEATURES.md` — daftar 13 fitur (8 inti + 2 pendukung + 3 roadmap)
  - `CHANGELOG.md` — file ini
  - `DATABASE.md` — skema database SQLite (5 tabel)
  - `API-FLOW.md` — alur request detail dari Telegram ke response
  - `LIMITS.md` — catatan limit free tier dan strategi penghematan
- `README.md` — overview proyek, tech stack, struktur folder

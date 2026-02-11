# Log Keputusan Desain

Dokumen ini mencatat keputusan desain penting beserta alasannya.

---

## 2025-02-11 — Inisialisasi Proyek

### Keputusan 1: Cloudflare Workers sebagai Runtime

**Keputusan**: Menggunakan Cloudflare Workers Free Tier sebagai runtime utama.

**Alasan**:
- Gratis hingga 100.000 requests/hari (cukup untuk penggunaan personal)
- Edge computing = low latency global
- Terintegrasi langsung dengan Workers AI dan Durable Objects
- Tidak perlu manage server

**Trade-off**: Terbatas di JavaScript/WASM, execution time max 10ms CPU (free tier).

---

### Keputusan 2: Durable Objects + SQLite sebagai Database

**Keputusan**: Menggunakan Durable Objects dengan SQLite storage, bukan D1 atau KV.

**Alasan**:
- SQLite di Durable Objects = relational database yang proper
- Per-user isolation secara natural (1 DO per Telegram user)
- Transactional, konsisten, dan low-latency
- Free tier: 5GB storage, 5M row reads/hari, 100K row writes/hari

**Trade-off**: Data tersebar per user (tidak bisa query cross-user dengan mudah). Untuk aplikasi keuangan personal, ini justru ideal.

---

### Keputusan 3: Workers AI + DeepSeek Fallback

**Keputusan**: Workers AI sebagai AI primary, DeepSeek API sebagai fallback.

**Alasan**:
- Workers AI gratis 10.000 Neurons/hari, cukup untuk intent detection ringan
- Jika mendekati limit (~80%), otomatis fallback ke DeepSeek
- DeepSeek murah dan reliable sebagai backup
- Dua provider = tidak pernah down total

**Trade-off**: Perlu tracking usage Neurons harian untuk trigger fallback.

---

### Keputusan 4: Telegram Bot dengan Webhook Mode

**Keputusan**: Menggunakan Telegram Bot API dengan webhook, bukan long polling.

**Alasan**:
- Webhook cocok dengan arsitektur serverless (Workers)
- Tidak perlu persistent connection
- Lebih efisien — hanya dipanggil saat ada pesan masuk

---

### Keputusan 5: Intent Detection, Bukan Command-Based

**Keputusan**: User cukup kirim pesan natural language, bot mendeteksi intent via AI.

**Alasan**:
- UX lebih natural untuk driver yang sibuk
- Tidak perlu hafal command
- Contoh: "bensin 20rb" → intent: catat_pengeluaran, kategori: bensin, jumlah: 20000

**Trade-off**: Lebih kompleks dari sisi engineering, butuh prompt engineering yang baik.

---

### Keputusan 6: Satu Durable Object per User

**Keputusan**: Setiap Telegram user mendapat Durable Object sendiri (ID = Telegram user ID).

**Alasan**:
- Isolasi data otomatis antar user
- Tidak ada race condition antar user
- Skala natural — setiap user punya SQLite database sendiri
- Cocok untuk aplikasi keuangan personal

---

### Keputusan 7: JavaScript (ES Modules)

**Keputusan**: Menggunakan JavaScript murni (bukan TypeScript) untuk fase awal.

**Alasan**:
- Lebih cepat untuk prototyping
- Native di Cloudflare Workers tanpa build step
- Bisa migrasi ke TypeScript nanti jika perlu

**Trade-off**: Tidak ada type safety. Bisa ditambahkan TypeScript di fase berikutnya.

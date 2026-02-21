# 🚂 War Thunder Tank Expert System

Sistem pakar rekomendasi tank War Thunder

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Jalankan server
npm start

# 3. Buka di browser
# http://localhost:3000
```

---

## 📁 Struktur Proyek

```
warthunder-expert/
├── server.js           ← Express API server
├── engine.js           ← Inference engine (forward chaining)
│
├── data/               ← 📦 DATA MODULAR (mudah diedit!)
│   ├── loader.js       ← Auto-load semua file nation
│   ├── tags.js         ← Definisi tags + inference rules
│   ├── usa.js          ← Tank Amerika
│   ├── germany.js      ← Tank Jerman
│   ├── ussr.js         ← Tank Soviet
│   └── others.js       ← UK, Japan, Sweden
│
├── scraper/
│   └── scrape.js       ← Wiki scraper (jalankan: npm run scrape)
│
└── public/
    └── index.html      ← UI
```

---

## ➕ Cara Tambah Tank Baru

### Option A: Edit file nation yang ada

Buka `data/usa.js` (atau nation lain), copy salah satu objek dan isi:

```js
{
  id: "m1a2",                          // ID unik (no spasi)
  name: "M1A2",                        // Nama singkat
  fullName: "M1A2 SEPv3 Abrams",       // Nama lengkap
  nation: "USA",                       // Nation
  rank: 8,                             // Rank 1-8
  br: 11.7,                            // Battle Rating
  type: "MBT",                         // Tank type
  image: "https://wiki.warthunder.com/images/.../tank.png",  // Gambar dari wiki
  wikiUrl: "https://wiki.warthunder.com/M1A2_SEPv3",         // Link wiki
  tags: ["top_tier", "mbt", "modern", "heavy_armor"],        // Lihat tags.js
  playstyle: ["frontline", "sniping"],
  pros: ["TUSK armor sangat kuat", "DM63 APFSDS top"],
  cons: ["Harga SL mahal", "Ammo rack turret ring"],
  stats: { armor: 9, firepower: 10, mobility: 8, survivability: 8 }, // Nilai 1-10
  description: "Upgrade terbaru Abrams dengan armor TUSK..."
}
```

### Option B: Buat nation baru

Buat file baru `data/china.js`:

```js
module.exports = [
  { id: "ztz99a", name: "ZTZ99A", ... },
  { id: "type59", name: "Type 59", ... },
];
```

File akan otomatis terdeteksi oleh `loader.js`!

---

## 🏷️ Daftar Tags Tersedia

| Tag                 | Deskripsi                  |
| ------------------- | -------------------------- |
| `beginner_friendly` | Cocok untuk pemula         |
| `versatile`         | Serbaguna                  |
| `sniper`            | Efektif dari jauh          |
| `flanker`           | Kecepatan untuk flank      |
| `heavy_armor`       | Armor sangat tebal         |
| `glass_cannon`      | Damage tinggi, armor tipis |
| `fast`              | Kecepatan tinggi           |
| `top_tier`          | BR 11.0+                   |
| `mbt`               | Main Battle Tank           |
| `atgm`              | Dilengkapi missile         |
| `aps`               | Active Protection System   |

Tambah tag baru di `data/tags.js`!

---

## 🔬 Cara Kerja Sistem Pakar

1. **User memilih** preferensi (nation, tags, BR range)
2. **Forward Chaining Engine** memproses:
   - Direct match: tag cocok langsung → skor +10
   - Playstyle match → skor +5
   - Inferred match via rules → skor +3
3. **Hasil diurutkan** berdasarkan total skor
4. **Top Pick** adalah tank dengan skor tertinggi

### Inference Rules

Di `data/tags.js`, rules memperluas pencarianmu:

```js
{ if: "beginner_friendly", boost: ["versatile", "heavy_armor"] }
// Kalau pilih "Pemula" → sistem juga cari tank "serbaguna" dan "armor tebal"
```

---

## 🕷️ Scraper Wiki

Untuk scrape data otomatis dari wiki:

```bash
npm run scrape
```

Ini akan membuat `data/scraped.js` dengan template tank.
Edit file tersebut untuk mengisi tags, stats, pros/cons.

**Catatan**: Scraper menggunakan MediaWiki API War Thunder,
lebih stabil dari HTML scraping biasa.

---

## 🌐 API Endpoints

| Endpoint         | Method | Deskripsi                                |
| ---------------- | ------ | ---------------------------------------- |
| `/api/meta`      | GET    | Info KB: nations, tags, BR range         |
| `/api/recommend` | POST   | **Core:** Rekomendasi berdasarkan filter |
| `/api/tank/:id`  | GET    | Detail satu tank                         |
| `/api/tanks`     | GET    | List semua tank                          |

### Contoh Request Recommend

```json
POST /api/recommend
{
  "tags": ["heavy_armor", "beginner_friendly"],
  "nations": ["Germany"],
  "minBr": 5.0,
  "maxBr": 7.0
}
```

---

## 💡 Tips

- Gambar tank: Ambil URL dari halaman wiki → klik gambar → copy link
- Format BR: Selalu gunakan format `5.7` (float dengan 1 desimal)
- Tags: Gunakan kombinasi tag yang relevan (max 5-6 tags per tank)

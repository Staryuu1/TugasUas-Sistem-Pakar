const express = require("express");
const path = require("path");
const loadAllTanks = require("./data/loader");
const TankExpertSystem = require("./engine");
const { TAGS } = require("./data/tags");

const app = express();
const PORT = 3000;

// Muat data
const tanks = loadAllTanks();
const expert = new TankExpertSystem(tanks);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ENDPOINT API

// Info database: total tank, negara, tipe, tags, dan range BR
app.get("/api/meta", (req, res) => {
  res.json({
    totalTanks: tanks.length,
    nations: expert.getNations(),
    types: expert.getTypes(),
    tags: TAGS,
    brRange: {
      min: Math.min(...tanks.map((t) => t.br)),
      max: Math.max(...tanks.map((t) => t.br)),
    },
  });
});

// Endpoint utama untuk rekomendasi tank
app.post("/api/recommend", (req, res) => {
  const {
    tags: selectedTags = [],
    nations: selectedNations = [],
    maxBr = null,
    minBr = null,
  } = req.body;

  const results = expert.recommend({
    selectedTags,
    selectedNations,
    maxBr: maxBr ? parseFloat(maxBr) : null,
    minBr: minBr ? parseFloat(minBr) : null,
  });

  res.json({
    count: results.length,
    results,
    appliedFilters: { selectedTags, selectedNations, maxBr, minBr },
  });
});

// Detail lengkap satu tank
app.get("/api/tank/:id", (req, res) => {
  const tank = expert.getTank(req.params.id);
  if (!tank) return res.status(404).json({ error: "Tank not found" });
  res.json(tank);
});

// Daftar semua tank dengan filter opsional
app.get("/api/tanks", (req, res) => {
  const { nation, vehicleType } = req.query;
  let result = tanks;
  if (nation) result = result.filter((t) => t.nation === nation);
  if (vehicleType) result = result.filter((t) => t.vehicleType === vehicleType);
  res.json(result);
});

// ─── START ────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚂 War Thunder Expert System`);
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   → Tanks loaded: ${tanks.length}`);
  console.log(`   → API: /api/meta, /api/recommend, /api/tank/:id\n`);
});

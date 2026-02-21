const fs = require("fs");
const path = require("path");

function loadAllTanks() {
  const dataDir = __dirname;
  const skipFiles = ["tags.js", "loader.js"];
  const allowed = ["usa", "germany", "ussr", "great britain", "japan"];
  const allTanks = [];

  const files = fs
    .readdirSync(dataDir)
    .filter((f) => f.endsWith(".js") && !skipFiles.includes(f))
    .filter((f) => allowed.some((a) => f.toLowerCase().includes(a)));

  // Muat setiap file dan ambil data tanknya
  for (const file of files) {
    try {
      const tanks = require(path.join(dataDir, file));
      if (Array.isArray(tanks)) {
        // Filter: hanya ambil tank dari negara yang diizinkan
        const filtered = tanks.filter((t) =>
          allowed.includes((t.nation || "").toLowerCase()),
        );
        allTanks.push(...filtered);
        console.log(
          `✅ Dimuat: ${file} → ${filtered.length} tank (asli ${tanks.length})`,
        );
      }
    } catch (err) {
      console.error(`❌ Error saat muat ${file}:`, err.message);
    }
  }

  console.log(`🚂 Total tank terbaca: ${allTanks.length}`);
  return allTanks;
}

module.exports = loadAllTanks;

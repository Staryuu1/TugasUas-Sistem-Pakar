const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// ==============================
// CONFIG
// ==============================

const BASE = "https://wiki.warthunder.com";
const DELAY = 400;
const HEADLESS = true;

//const NATIONS = ["usa", "germany", "ussr", "britain", "japan"]; // untuk scrape semua negara sekaligus
const NATIONS = ["japan"]; // untuk 1 negara saja
const PREFIX_MAP = {
  //usa: "us_",
  //germany: "germ_",
  //ussr: "ussr_",
  //britain: "uk_",
  japan: "jp_",
};

const NATION_LABEL = {
  //usa: "USA",
  //germany: "Germany",
  //ussr: "USSR",
  // britain: "Britain",
  japan: "Japan",
};

const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const makeId = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, "_");
const clean = (t) => (t ? t.replace(/\s+/g, " ").trim() : "");

// ==============================
// GET UNITS FROM TECH TREE
// ==============================

async function getTreeUnits(page, nation) {
  const url = `${BASE}/ground?v=t&t_c=${nation}`;
  console.log(`  📡 Loading tech tree: ${url}`);

  await page.goto(url, { waitUntil: "networkidle2" });
  await page.waitForSelector(".wt-tree_item", { timeout: 20000 });

  const prefix = PREFIX_MAP[nation];

  return await page.evaluate((prefix) => {
    const results = [];
    document.querySelectorAll(".wt-tree_item").forEach((item) => {
      const unitId = item.getAttribute("data-unit-id");
      if (!unitId || !unitId.startsWith(prefix)) return;

      const name = item
        .querySelector(".wt-tree_item-text span")
        ?.innerText?.trim();
      const href = item
        .querySelector("a.wt-tree_item-link")
        ?.getAttribute("href");
      const br = item.querySelector(".br")?.innerText?.trim();

      if (name && href) {
        results.push({ name, href, br });
      }
    });
    return results;
  }, prefix);
}

// ==============================
// EXTRACT RANK & BR FROM PAGE
// (helper, dipakai 2x untuk basic unit dan sub-unit)
// ==============================

async function extractRankBR(page) {
  return await page.evaluate((ROMAN) => {
    const clean = (t) => (t ? t.replace(/\s+/g, " ").trim() : "");

    const rankRoman = clean(
      document.querySelector(".game-unit_rank .game-unit_card-info_value")
        ?.innerText,
    );
    const rank = ROMAN[rankRoman] ?? null;

    let brRB = null;
    document.querySelectorAll(".game-unit_br-item").forEach((item) => {
      const mode = clean(item.querySelector(".mode")?.innerText);
      const val = parseFloat(clean(item.querySelector(".value")?.innerText));
      if (mode === "RB") brRB = val;
    });

    return { rank, brRB };
  }, ROMAN);
}

// ==============================
// SCRAPE UNIT DETAIL PAGE
// ==============================

async function scrapeUnit(page, specUrl) {
  await page.goto(specUrl, { waitUntil: "networkidle2" });

  try {
    await page.waitForSelector(".game-unit_name", { timeout: 8000 });
  } catch (_) {}

  // ── Ambil data utama dari halaman ──────────────────────
  const data = await page.evaluate((ROMAN) => {
    const clean = (t) => (t ? t.replace(/\s+/g, " ").trim() : "");

    // Full name
    const fullName = clean(
      document.querySelector(".game-unit_name")?.innerText,
    );

    // Nation
    const nation = clean(
      [
        ...document.querySelectorAll(
          ".game-unit_card-info_value .text-truncate",
        ),
      ].find((el) => !el.closest(".game-unit_br"))?.innerText,
    );

    // Vehicle type
    let vehicleType = "";
    document.querySelectorAll(".game-unit_card-info_item").forEach((item) => {
      const title = clean(
        item.querySelector(".game-unit_card-info_title")?.innerText,
      );
      if (title === "Main role") {
        vehicleType = clean(
          item.querySelector(".game-unit_card-info_value .text-truncate")
            ?.innerText,
        );
      }
    });

    // Rank & BR dari halaman ini
    const rankRoman = clean(
      document.querySelector(".game-unit_rank .game-unit_card-info_value")
        ?.innerText,
    );
    const rank = ROMAN[rankRoman] ?? null;

    let brRB = null;
    document.querySelectorAll(".game-unit_br-item").forEach((item) => {
      const mode = clean(item.querySelector(".mode")?.innerText);
      const val = parseFloat(clean(item.querySelector(".value")?.innerText));
      if (mode === "RB") brRB = val;
    });

    // Research & Purchase cost
    let researchCost = null;
    let purchaseCost = null;
    document.querySelectorAll(".game-unit_card-info_item").forEach((item) => {
      const title = clean(
        item.querySelector(".game-unit_card-info_title")?.innerText,
      );
      const val = clean(
        item.querySelector(".game-unit_card-info_value div:first-child")
          ?.innerText,
      );
      if (title === "Research")
        researchCost = parseInt(val.replace(/,/g, "")) || null;
      if (title === "Purchase")
        purchaseCost = parseInt(val.replace(/,/g, "")) || null;
    });

    // Image
    const image =
      document.querySelector(".game-unit_template-image")?.src || "";

    // ── Multi-vehicle system detection ─────────────────────
    // Cek apakah halaman ini punya multi-unit selector
    const isMultiVehicle = !!document.querySelector(".game-unit_multiunit");

    // Cek apakah unit ini adalah SUB-unit:
    // Sub-unit = active item adalah <span> tapi item ini sendiri bukan basic unit
    // Atau lebih tepat: kalau rank/BR null DAN ada multi-vehicle selector
    // → ini sub-unit, perlu ambil rank/BR dari basic unit
    let basicUnitHref = null;
    if (isMultiVehicle && (rank === null || brRB === null)) {
      // Cari link basic unit — item yang punya subtitle "Basic unit"
      const items = document.querySelectorAll(".game-unit_multiunit-item");
      items.forEach((item) => {
        const subtitle = clean(item.querySelector(".subtitle")?.innerText);
        if (subtitle === "Basic unit") {
          // Basic unit bisa berupa <span> (ini halaman basic unit)
          // atau <a> (link ke basic unit dari sub-unit page)
          const href = item.getAttribute("href"); // null kalau <span>
          if (href) basicUnitHref = href; // ini sub-unit, basic unit ada di href ini
        }
      });
    }

    // Armor
    const armorData = {};
    document.querySelectorAll(".game-unit_chars-subline").forEach((row) => {
      const label = clean(row.querySelector("span:first-child")?.innerText);
      const val = clean(row.querySelector(".game-unit_chars-value")?.innerText);
      if (label && val) armorData[label] = val;
    });

    const parseArmor = (str) => {
      if (!str) return null;
      const m = str.match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/);
      return m ? { front: +m[1], side: +m[2], back: +m[3] } : null;
    };

    const hullArmor = parseArmor(armorData["Hull"]);
    const turretArmor = parseArmor(armorData["Turret"]);

    // Speed
    let speedForward = null;
    let speedBackward = null;
    document.querySelectorAll(".game-unit_chars-block").forEach((block) => {
      const header = clean(
        block.querySelector(".game-unit_chars-header")?.innerText,
      );
      if (header !== "Max speed") return;
      block.querySelectorAll(".game-unit_chars-subline").forEach((row) => {
        const label = clean(row.querySelector("span:first-child")?.innerText);
        const rbSpan = row.querySelector(".show-char-rb");
        const val = rbSpan
          ? +rbSpan.innerText
          : parseFloat(
              clean(row.querySelector(".game-unit_chars-value")?.innerText),
            );
        if (label === "Forward") speedForward = val;
        if (label === "Backward") speedBackward = val;
      });
    });

    // Weight & Engine power
    let weight = null;
    let enginePower = null;
    document.querySelectorAll(".game-unit_chars-subline").forEach((row) => {
      const label = clean(row.querySelector("span:first-child")?.innerText);
      const valText = clean(
        row.querySelector(".game-unit_chars-value")?.innerText,
      );
      if (label === "Weight") weight = parseFloat(valText);
      if (label === "Engine power") {
        const span = row.querySelector(".show-char-rb-mod-ref");
        enginePower = span
          ? +span.innerText.replace(/,/g, "")
          : parseFloat(valText);
      }
    });

    // Crew & Visibility
    let crew = null;
    let visibility = null;
    document.querySelectorAll(".game-unit_chars-line").forEach((line) => {
      const header = clean(
        line.querySelector(".game-unit_chars-header")?.innerText,
      );
      const val = clean(
        line.querySelector(".game-unit_chars-value")?.innerText,
      );
      if (header === "Crew") crew = parseInt(val);
      if (header === "Visibility") visibility = parseInt(val);
    });

    // Main Gun
    const mainGun = clean(
      document.querySelector(".game-unit_weapon-title a")?.innerText,
    );
    const caliberMatch = mainGun?.match(/^(\d+(?:\.\d+)?)\s*mm/);
    const caliberMm = caliberMatch ? +caliberMatch[1] : null;

    // Best Penetration
    let bestPenetration = null;
    document
      .querySelectorAll(".game-unit_belt-list tbody tr")
      .forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length >= 3) {
          const val = parseInt(cells[2]?.innerText);
          if (
            !isNaN(val) &&
            (bestPenetration === null || val > bestPenetration)
          ) {
            bestPenetration = val;
          }
        }
      });

    // Reload
    let reloadBasic = null;
    document
      .querySelectorAll(".game-unit_weapon .game-unit_chars-block")
      .forEach((block) => {
        const header = clean(
          block.querySelector(".game-unit_chars-header")?.innerText,
        );
        if (header === "Reload" && reloadBasic === null) {
          const val = clean(
            block.querySelector(".game-unit_chars-value")?.innerText,
          );
          const m = val.match(/([\d.]+)\s*→/);
          if (m) reloadBasic = parseFloat(m[1]);
        }
      });

    // Turret rotation
    let turretRotation = null;
    document.querySelectorAll(".game-unit_chars-subline").forEach((row) => {
      const label = clean(row.querySelector("span:first-child")?.innerText);
      if (label !== "Horizontal" || turretRotation !== null) return;
      const span = row.querySelector(".show-char-rb-mod-ref");
      if (span) turretRotation = parseFloat(span.innerText);
    });

    // Features
    const features = [];
    document.querySelectorAll(".game-unit_feature").forEach((btn) => {
      const label = clean(btn.querySelector("span")?.innerText);
      if (label) features.push(label);
    });

    return {
      fullName,
      nation,
      vehicleType,
      rank,
      brRB,
      researchCost,
      purchaseCost,
      image,
      features,
      isMultiVehicle,
      basicUnitHref,
      rawSpecs: {
        hullArmor,
        turretArmor,
        crew,
        visibility,
        speedForward,
        speedBackward,
        weight,
        enginePower,
        mainGun,
        caliberMm,
        bestPenetration,
        reloadBasic,
        turretRotation,
      },
    };
  }, ROMAN);

  // ── Kalau sub-unit: ambil rank/BR dari halaman basic unit ──
  // basicUnitHref ada artinya ini sub-unit, basic unit ada di href tsb
  if (data.basicUnitHref) {
    console.log(
      `\n    🔗 Sub-unit detected, fetching rank/BR from basic unit...`,
    );
    try {
      const basicUrl = `${BASE}${data.basicUnitHref}`;
      await page.goto(basicUrl, { waitUntil: "networkidle2" });
      await page.waitForSelector(".game-unit_rank", { timeout: 5000 });

      const basicData = await page.evaluate((ROMAN) => {
        const clean = (t) => (t ? t.replace(/\s+/g, " ").trim() : "");
        const rankRoman = clean(
          document.querySelector(".game-unit_rank .game-unit_card-info_value")
            ?.innerText,
        );
        const rank = ROMAN[rankRoman] ?? null;

        let brRB = null;
        document.querySelectorAll(".game-unit_br-item").forEach((item) => {
          const mode = clean(item.querySelector(".mode")?.innerText);
          const val = parseFloat(
            clean(item.querySelector(".value")?.innerText),
          );
          if (mode === "RB") brRB = val;
        });

        let researchCost = null;
        let purchaseCost = null;
        document
          .querySelectorAll(".game-unit_card-info_item")
          .forEach((item) => {
            const title = clean(
              item.querySelector(".game-unit_card-info_title")?.innerText,
            );
            const val = clean(
              item.querySelector(".game-unit_card-info_value div:first-child")
                ?.innerText,
            );
            if (title === "Research")
              researchCost = parseInt(val.replace(/,/g, "")) || null;
            if (title === "Purchase")
              purchaseCost = parseInt(val.replace(/,/g, "")) || null;
          });

        return { rank, brRB, researchCost, purchaseCost };
      }, ROMAN);

      // Override rank/BR/cost dari basic unit ke sub-unit
      data.rank = basicData.rank;
      data.brRB = basicData.brRB;
      // Cost sub-unit inherit dari basic unit (karena beli sebagai satu sistem)
      if (!data.researchCost) data.researchCost = basicData.researchCost;
      if (!data.purchaseCost) data.purchaseCost = basicData.purchaseCost;

      console.log(
        `    ✅ Got rank=${data.rank}, BR=${data.brRB} from basic unit`,
      );
    } catch (err) {
      console.warn(`    ⚠ Failed to fetch basic unit: ${err.message}`);
    }
  }

  return data;
}

// ==============================
// NORMALIZE STATS 1-10
// ==============================

function normalizeStats(specs) {
  const { hullArmor, speedForward, bestPenetration } = specs;

  const frontArmor = hullArmor?.front ?? 50;
  let armor = 5;
  if (frontArmor >= 300) armor = 10;
  else if (frontArmor >= 200) armor = 9;
  else if (frontArmor >= 150) armor = 8;
  else if (frontArmor >= 100) armor = 7;
  else if (frontArmor >= 60) armor = 6;
  else if (frontArmor >= 40) armor = 4;
  else armor = 3;

  const pen = bestPenetration ?? 0;
  let firepower = 5;
  if (pen >= 400) firepower = 10;
  else if (pen >= 300) firepower = 9;
  else if (pen >= 200) firepower = 8;
  else if (pen >= 150) firepower = 7;
  else if (pen >= 100) firepower = 6;
  else if (pen >= 60) firepower = 5;
  else firepower = 4;

  const spd = speedForward ?? 30;
  const mobility = Math.max(1, Math.min(10, Math.round((spd / 75) * 10)));
  const survivability = Math.round((armor + mobility) / 2);

  return { armor, firepower, mobility, survivability };
}

// ==============================
// MAIN
// ==============================

async function main() {
  const browser = await puppeteer.launch({
    headless: HEADLESS,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  );

  const outputDir = path.join(__dirname, "../data");
  fs.mkdirSync(outputDir, { recursive: true });

  const summary = {};

  for (const nation of NATIONS) {
    console.log(`\n${"=".repeat(55)}`);
    console.log(`  SCRAPING: ${NATION_LABEL[nation]}`);
    console.log(`${"=".repeat(55)}`);

    let treeUnits;
    try {
      treeUnits = await getTreeUnits(page, nation);
    } catch (err) {
      console.error(`  ❌ Gagal load tech tree ${nation}:`, err.message);
      continue;
    }

    console.log(`  📦 Unit ditemukan di tree: ${treeUnits.length}`);

    const results = [];
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    for (let i = 0; i < treeUnits.length; i++) {
      const unit = treeUnits[i];
      const progress = `(${i + 1}/${treeUnits.length})`;

      // Skip dari tech tree kalau tidak ada BR (premium/event)
      if (!unit.br || unit.br === "" || unit.br === "—") {
        console.log(`  ${progress} ⏭  SKIP (no BR in tree) : ${unit.name}`);
        skipCount++;
        continue;
      }

      const wikiUrl = `${BASE}${unit.href}`;
      const specUrl = `${wikiUrl}#specification`;

      process.stdout.write(`  ${progress} ${unit.name} ... `);

      let detail;
      try {
        detail = await scrapeUnit(page, specUrl);

        // Setelah scrape (termasuk basic unit fetch kalau sub-unit),
        // kalau rank/BR masih null → ini premium/event → skip
        if (detail.rank === null || detail.brRB === null) {
          process.stdout.write(`⏭  SKIP (no rank/BR after scrape)\n`);
          skipCount++;
          continue;
        }

        process.stdout.write("✅\n");
        successCount++;
      } catch (err) {
        process.stdout.write(`❌ ${err.message}\n`);
        failCount++;
        continue;
      }

      const stats = normalizeStats(detail.rawSpecs);

      results.push({
        id: makeId(unit.name),
        name: unit.name,
        fullName: detail.fullName || unit.name,
        nation: detail.nation || NATION_LABEL[nation],
        vehicleType: detail.vehicleType,
        rank: detail.rank,
        br: detail.brRB,
        wikiUrl,
        researchCost: detail.researchCost,
        purchaseCost: detail.purchaseCost,
        image: detail.image,
        features: detail.features,
        stats,
        rawSpecs: detail.rawSpecs,
      });

      await sleep(DELAY);
    }

    const outputPath = path.join(outputDir, `${nation}.js`);
    fs.writeFileSync(
      outputPath,
      `module.exports = ${JSON.stringify(results, null, 2)};\n`,
    );

    summary[nation] = {
      total: treeUnits.length,
      saved: results.length,
      skip: skipCount,
      fail: failCount,
    };

    console.log(`\n  💾 Saved → ${outputPath}`);
    console.log(
      `  ✅ Saved: ${results.length} | ⏭ Skip: ${skipCount} | ❌ Gagal: ${failCount}`,
    );
  }

  await browser.close();

  console.log(`\n${"=".repeat(55)}`);
  console.log("  SELESAI - RINGKASAN");
  console.log(`${"=".repeat(55)}`);
  for (const [nation, s] of Object.entries(summary)) {
    console.log(
      `  ${NATION_LABEL[nation].padEnd(10)} : ${s.saved} disimpan, ${s.skip} di-skip, ${s.fail} gagal (dari ${s.total} total)`,
    );
  }
}

main().catch(console.error);

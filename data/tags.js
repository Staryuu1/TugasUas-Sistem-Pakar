const TAGS = {
  beginner_friendly: { label: "Pemula", icon: "🌱", group: "Playstyle" },
  versatile: { label: "Serbaguna", icon: "⚡", group: "Playstyle" },
  sniper: { label: "Sniper", icon: "🎯", group: "Playstyle" },
  flanker: { label: "Flanker", icon: "💨", group: "Playstyle" },
  frontline: { label: "Frontline", icon: "🛡️", group: "Playstyle" },
  hull_down: { label: "Hull-Down", icon: "⛰️", group: "Playstyle" },
  support: { label: "Support", icon: "🤝", group: "Playstyle" },
  heavy_armor: { label: "Armor Tebal", icon: "🔒", group: "Armor" },
  glass_cannon: { label: "Glass Cannon", icon: "💥", group: "Armor" },
  fast: { label: "Cepat", icon: "🏎️", group: "Armor" },
  high_damage: { label: "Damage Tinggi", icon: "💣", group: "Firepower" },
  one_shot_king: { label: "One-Shot", icon: "☠️", group: "Firepower" },
  atgm: { label: "ATGM", icon: "🚀", group: "Firepower" },
  aps: { label: "APS", icon: "🛸", group: "Special" },
  unique: { label: "Unik", icon: "🦄", group: "Special" },
  no_turret: { label: "No Turret", icon: "📐", group: "Special" },
  scout: { label: "Scout", icon: "👁️", group: "Special" },
  anti_air: { label: "Anti-Air", icon: "✈️", group: "Special" },
  iconic: { label: "Ikonik", icon: "⭐", group: "Special" },
  low_br: { label: "BR Rendah (1-4.7)", icon: "🔰", group: "BR" },
  medium_br: { label: "BR Sedang (5.0-8.7)", icon: "🎖️", group: "BR" },
  high_br: { label: "BR Tinggi (9.0-10.7)", icon: "🏆", group: "BR" },
  top_tier: { label: "Top Tier (11.0+)", icon: "👑", group: "BR" },
  light_tank: { label: "Light Tank", icon: "🐆", group: "Type" },
  medium_tank: { label: "Medium Tank", icon: "🚂", group: "Type" },
  heavy_tank: { label: "Heavy Tank", icon: "🐘", group: "Type" },
  td: { label: "Tank Destroyer", icon: "🎯", group: "Type" },
  spaa: { label: "SPAA", icon: "✈️", group: "Type" },
  ifv: { label: "IFV", icon: "🚌", group: "Type" },
  mbt: { label: "MBT", icon: "🚂", group: "Type" },
};

const INFERENCE_RULES = [
  {
    if: "beginner_friendly",
    boost: ["versatile", "heavy_armor", "medium_br", "frontline"],
    description: "Pemula cocok dengan tank serbaguna dan armor tebal",
  },
  {
    if: "sniper",
    boost: ["fast", "hull_down"],
    description: "Sniper butuh mobilitas untuk reposisi",
  },
  {
    if: "top_tier",
    boost: ["mbt"],
    description: "Top tier identik dengan MBT modern",
  },
  {
    if: "flanker",
    boost: ["fast", "glass_cannon", "light_tank"],
    description: "Flanker membutuhkan kecepatan",
  },
  {
    if: "hull_down",
    boost: ["heavy_armor", "sniper"],
    description: "Hull-down cocok dengan tank sniper berarmor tebal di depan",
  },
  {
    if: "heavy_armor",
    boost: ["frontline", "hull_down"],
    description: "Tank berarmor tebal cocok untuk frontline",
  },
  {
    if: "fast",
    boost: ["flanker", "scout"],
    description: "Tank cepat cocok untuk flanking dan scouting",
  },
  {
    if: "atgm",
    boost: ["high_damage", "glass_cannon"],
    description: "ATGM biasanya glass cannon tapi damage tinggi",
  },
];

/**
 * Generate tags untuk sebuah tank berdasarkan statsnya.
 * Dipanggil saat engine init — data tank tidak punya field 'tags' bawaan.
 */
function getTankTags(tank) {
  const tags = new Set();
  const armor = tank.stats?.armor || 0;
  const firepower = tank.stats?.firepower || 0;
  const mobility = tank.stats?.mobility || 0;
  const type = (tank.vehicleType || "").toLowerCase();
  const features = (tank.features || []).join(" ").toLowerCase();
  const mainGun = (tank.rawSpecs?.mainGun || "").toLowerCase();
  const frontArmor = tank.rawSpecs?.hullArmor?.front || 0;
  const br = tank.br || 0;

  // ── BR tags ──────────────────────────────────────────────────────────────────
  if (br < 5.0) tags.add("low_br");
  else if (br < 9.0) tags.add("medium_br");
  else if (br < 11.0) tags.add("high_br");
  else tags.add("top_tier");

  // ── Vehicle type tags ─────────────────────────────────────────────────────────
  if (type.includes("light")) tags.add("light_tank");
  else if (type.includes("medium")) tags.add("medium_tank");
  else if (type.includes("heavy")) tags.add("heavy_tank");
  else if (type.includes("spaa")) {
    tags.add("spaa");
    tags.add("anti_air");
  } else if (type.includes("tank destroyer")) tags.add("td");
  else if (type.includes("ifv")) {
    tags.add("ifv");
    tags.add("light_tank");
  }

  // MBT = medium tank di BR tinggi
  if (type.includes("medium") && br >= 7.0) tags.add("mbt");

  // ── Armor tags ────────────────────────────────────────────────────────────────
  if (armor >= 7) {
    tags.add("heavy_armor");
    tags.add("frontline");
  }
  if (armor >= 6 && frontArmor >= 100) {
    tags.add("hull_down");
  }
  if (armor <= 3) {
    tags.add("glass_cannon");
  }

  // ── Mobility tags ─────────────────────────────────────────────────────────────
  if (mobility >= 8) {
    tags.add("fast");
    tags.add("flanker");
  }
  if (mobility >= 9 && armor <= 4) {
    tags.add("scout");
  }

  // ── Firepower tags ────────────────────────────────────────────────────────────
  if (firepower >= 8) {
    tags.add("high_damage");
  }
  if (firepower >= 9) {
    tags.add("one_shot_king");
  }

  // Sniper: firepower tinggi tapi lambat
  if (firepower >= 7 && mobility <= 5) {
    tags.add("sniper");
  }

  // Support: SPAA atau firepower tinggi tapi armor rendah
  if (type.includes("spaa") || (firepower >= 7 && armor <= 3)) {
    tags.add("support");
  }

  // ── ATGM / missile ───────────────────────────────────────────────────────────
  if (
    mainGun.includes("atgm") ||
    mainGun.includes("missile") ||
    mainGun.includes("tow") ||
    mainGun.includes("milan") ||
    mainGun.includes("hot") ||
    mainGun.includes("spike") ||
    mainGun.includes("ss.11") ||
    mainGun.includes("9m")
  ) {
    tags.add("atgm");
    tags.add("high_damage");
  }

  // ── No turret (tank destroyer casemate) ───────────────────────────────────────
  if (
    type.includes("tank destroyer") &&
    (tank.rawSpecs?.turretRotation || 0) <= 10
  ) {
    tags.add("no_turret");
  }

  // ── APS ───────────────────────────────────────────────────────────────────────
  if (features.includes("aps") || features.includes("electro-optical")) {
    tags.add("aps");
  }

  // ── Unique / special ──────────────────────────────────────────────────────────
  if (features.includes("amphibious")) tags.add("unique");
  if (features.includes("reverse gearbox")) tags.add("unique");

  // ── Beginner friendly: BR rendah, armor oke ──────────────────────────────────
  if (br <= 3.0 && armor >= 4) {
    tags.add("beginner_friendly");
    tags.add("versatile");
  }

  // ── Versatile: stats seimbang ─────────────────────────────────────────────────
  const statValues = [armor, firepower, mobility];
  const maxStat = Math.max(...statValues);
  const minStat = Math.min(...statValues);
  if (maxStat - minStat <= 3 && armor >= 4 && firepower >= 5 && mobility >= 5) {
    tags.add("versatile");
  }

  // ── Scout UAV ─────────────────────────────────────────────────────────────────
  if (features.includes("scout uav")) {
    tags.add("scout");
  }

  // ── Iconic tanks ─────────────────────────────────────────────────────────────
  const iconicIds = [
    "tiger_h1",
    "tiger_e",
    "tiger_ii",
    "panther_d",
    "panther_a",
    "panther_g",
    "maus",
    "ferdinand",
    "jagdtiger",
    "t_34_747",
    "kv_1",
    "is_2",
    "m4a3e2",
    "m26",
    "m48a2_c",
    "leopard_i",
    "leopard_2a4",
  ];
  if (iconicIds.includes(tank.id)) tags.add("iconic");

  return tags;
}

module.exports = { TAGS, INFERENCE_RULES, getTankTags };

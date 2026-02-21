const { INFERENCE_RULES, getTankTags } = require("./data/tags");

class TankExpertSystem {
  constructor(tanks) {
    this.tanks = tanks.map((tank) => ({
      ...tank,
      tags: [...getTankTags(tank)],
      playstyle: [],
    }));
  }

  recommend({
    selectedTags = [],
    selectedNations = [],
    maxBr = null,
    minBr = null,
  }) {
    const expandedTags = this._forwardChain(selectedTags);

    let results = this.tanks.map((tank) => {
      const score = this._score(tank, expandedTags, selectedTags);
      return {
        ...tank,
        score,
        matchedTags: this._getMatchedTags(tank, selectedTags),
      };
    });

    if (selectedNations.length > 0)
      results = results.filter((t) => selectedNations.includes(t.nation));

    if (maxBr !== null) results = results.filter((t) => t.br <= maxBr);
    if (minBr !== null) results = results.filter((t) => t.br >= minBr);

    // Kalau ada tag dipilih, hanya tampilkan score > 0
    if (selectedTags.length > 0) results = results.filter((t) => t.score > 0);

    results = results.sort((a, b) => b.score - a.score || a.br - b.br);

    // Tidak ada filter sama sekali → return semua tank
    if (
      selectedTags.length === 0 &&
      selectedNations.length === 0 &&
      !maxBr &&
      !minBr
    )
      return this.tanks.map((t) => ({ ...t, score: 0, matchedTags: [] }));

    return results;
  }

  _forwardChain(selectedTags) {
    const expanded = new Set(selectedTags);
    let changed = true;

    while (changed) {
      changed = false;
      for (const rule of INFERENCE_RULES) {
        if (expanded.has(rule.if)) {
          for (const boostTag of rule.boost) {
            if (!expanded.has(boostTag)) {
              expanded.add(boostTag);
              changed = true;
            }
          }
        }
      }
    }

    return expanded;
  }

  _score(tank, expandedTags, originalTags) {
    let score = 0;
    const tt = tank.tags || [];
    const tp = tank.playstyle || [];

    // Direct match: skor tinggi (+10 tag, +5 playstyle)
    for (const tag of originalTags) {
      if (tt.includes(tag)) score += 10;
      if (tp.includes(tag)) score += 5;
    }

    // Inferred/expanded tags: skor rendah (+3 tag, +2 playstyle)
    for (const tag of expandedTags) {
      if (originalTags.includes(tag)) continue;
      if (tt.includes(tag)) score += 3;
      if (tp.includes(tag)) score += 2;
    }

    // Bonus dari inference rules
    for (const rule of INFERENCE_RULES) {
      if (originalTags.includes(rule.if)) {
        for (const boostTag of rule.boost) {
          if (tt.includes(boostTag)) score += 2;
        }
      }
    }

    return score;
  }

  _getMatchedTags(tank, selectedTags) {
    const tt = tank.tags || [];
    const tp = tank.playstyle || [];
    return selectedTags.filter((t) => tt.includes(t) || tp.includes(t));
  }

  getTank(id) {
    return this.tanks.find((t) => t.id === id);
  }

  getNations() {
    return [...new Set(this.tanks.map((t) => t.nation))].filter(Boolean);
  }

  getTypes() {
    return [...new Set(this.tanks.map((t) => t.vehicleType || t.type))].filter(
      Boolean,
    );
  }
}

module.exports = TankExpertSystem;

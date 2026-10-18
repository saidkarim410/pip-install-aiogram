// Building blueprints for the colonists. Layers are listed bottom-up, rows are z (north -> south), columns are x.
// Legend: '.' clear to air, ' ' leave as is, C cobblestone, W wall material, F floor, R roof, S slab, G glass, D door (2 high),
// d skip (upper door), T torch, H chest, K crafting table, B barrel, A farmland, h wheat, w water, f fence, E stone bricks, Y hay, L log, b bell
export const BUILDINGS = {
  town_hall: {
    size: 7, height: 6, cost: { wood: 20, stone: 30 }, stoneCost: { stone: 50 }, nameKey: "mech.bld.town_hall",
    layers: [
      ["CCCCCCC", "CFFFFFC", "CFFFFFC", "CFFFFFC", "CFFFFFC", "CFFFFFC", "CCCCCCC"],
      ["EEEDEEE", "E.....E", "E..H..E", "E.....E", "E.K.b.E", "ET...TE", "EEEEEEE"],
      ["EEGdGEE", "G.....G", "E.....E", "G.....G", "E.....E", "G.....G", "EEGEGEE"],
      ["EEEEEEE", "E.....E", "E.....E", "E.....E", "E.....E", "E.....E", "EEEEEEE"],
      ["RRRRRRR", "RRRRRRR", "RRRRRRR", "RRRRRRR", "RRRRRRR", "RRRRRRR", "RRRRRRR"],
      [".......", ".SSSSS.", ".SSSSS.", ".SSSSS.", ".SSSSS.", ".SSSSS.", "......."],
    ],
  },
  house: {
    size: 5, height: 5, cost: { wood: 16, stone: 12 }, stoneCost: { stone: 30 }, nameKey: "mech.bld.house",
    layers: [
      ["CCCCC", "CFFFC", "CFFFC", "CFFFC", "CCCCC"],
      ["WWDWW", "WT..W", "W...W", "W.K.W", "WWWWW"],
      ["WGdGW", "G...G", "G...G", "G...G", "WWGWW"],
      ["RRRRR", "RRRRR", "RRRRR", "RRRRR", "RRRRR"],
      [".....", ".SSS.", ".SSS.", ".SSS.", "....."],
    ],
  },
  storage: {
    size: 5, height: 5, cost: { wood: 20, stone: 16 }, stoneCost: { stone: 36 }, nameKey: "mech.bld.storage",
    layers: [
      ["CCCCC", "CFFFC", "CFFFC", "CFFFC", "CCCCC"],
      ["WWDWW", "WH.HW", "W...W", "WB.BW", "WWWWW"],
      ["WWdWW", "W...W", "WT.TW", "W...W", "WWWWW"],
      ["RRRRR", "RRRRR", "RRRRR", "RRRRR", "RRRRR"],
      [".....", ".SSS.", ".SSS.", ".SSS.", "....."],
    ],
  },
  farm: {
    size: 7, height: 3, cost: { wood: 4, stone: 10 }, stoneCost: { stone: 14 }, nameKey: "mech.bld.farm",
    layers: [
      ["CCCCCCC", "CAAAAAC", "CAAAAAC", "CAAwAAC", "CAAAAAC", "CAAAAAC", "CCCCCCC"],
      ["f.....f", ".hhhhh.", ".hhhhh.", ".hh.hh.", ".hhhhh.", ".hhhhh.", "f.....f"],
      [".......", ".......", ".......", ".......", ".......", ".......", "......."],
    ],
  },
  well: {
    size: 3, height: 5, base: -2, cost: { wood: 2, stone: 14 }, stoneCost: { stone: 16 }, nameKey: "mech.bld.well",
    layers: [
      ["CCC", "CwC", "CCC"],
      ["CCC", "CwC", "CCC"],
      ["CCC", "C.C", "CCC"],
      ["f.f", "...", "f.f"],
      ["SSS", "SSS", "SSS"],
    ],
  },
  tower: {
    size: 5, height: 8, cost: { wood: 10, stone: 40 }, stoneCost: { stone: 50 }, nameKey: "mech.bld.tower",
    layers: [
      [".....", ".CCC.", ".CCC.", ".CCC.", "....."],
      [".....", ".CCC.", ".CCC.", ".CCC.", "....."],
      [".....", ".CCC.", ".CCC.", ".CCC.", "....."],
      [".....", ".CCC.", ".CCC.", ".CCC.", "....."],
      [".....", ".CCC.", ".CCC.", ".CCC.", "....."],
      [".....", ".CCC.", ".CCC.", ".CCC.", "....."],
      ["RRRRR", "RRRRR", "RRRRR", "RRRRR", "RRRRR"],
      ["TfffT", "f...f", "f...f", "f...f", "TfffT"],
    ],
  },
};
export const ERAS = [
  { key: "camp", ru: "Стоянка", cap: 8 },
  { key: "village", ru: "Деревня", cap: 16 },
  { key: "town", ru: "Город", cap: 28 },
  { key: "industrial", ru: "Индустриальный город", cap: 40 },
];
Object.assign(BUILDINGS, {
  smithy: {
    size: 5, height: 5, era: 1, cost: { wood: 10, stone: 30, iron: 2 }, stoneCost: { stone: 40, iron: 2 }, nameKey: "mech.bld.smithy",
    layers: [
      ["CCCCC", "CCCCC", "CCCCC", "CCCCC", "CCCCC"],
      ["EEDEE", "E...E", "EU.nE", "Eu..E", "EEEEE"],
      ["EEdEE", "G...G", "E...E", "E..TE", "EEGEE"],
      ["RRRRR", "RRRRR", "RRRRR", "RRRRR", "RRRRR"],
      [".....", ".c...", ".....", ".....", "....."],
    ],
  },
  market: {
    size: 7, height: 4, era: 2, cost: { wood: 24, stone: 20 }, stoneCost: { stone: 44 }, nameKey: "mech.bld.market",
    layers: [
      ["ppppppp", "ppppppp", "ppppppp", "ppppppp", "ppppppp", "ppppppp", "ppppppp"],
      ["fHf.fBf", ".......", "f.f.f.f", ".......", "f.f.f.f", ".......", "fBf.fHf"],
      ["f...f.f", ".......", "f.l.f.f", ".......", "f.f.l.f", ".......", "f.f...f"],
      ["yyy.yyy", "yyy.yyy", "yyy.yyy", ".......", "yyy.yyy", "yyy.yyy", "yyy.yyy"],
    ],
  },
  barracks: {
    size: 7, height: 5, era: 2, cost: { wood: 12, stone: 50, iron: 4 }, stoneCost: { stone: 60, iron: 4 }, nameKey: "mech.bld.barracks",
    layers: [
      ["CCCCCCC", "CFFFFFC", "CFFFFFC", "CFFFFFC", "CFFFFFC", "CFFFFFC", "CCCCCCC"],
      ["EEEDEEE", "E.....E", "EH...HE", "E.....E", "EH...HE", "E..T..E", "EEEEEEE"],
      ["EErdrEE", "r.....r", "E.....E", "r.....r", "E.....E", "r.....r", "EErErEE"],
      ["EEEEEEE", "EEEEEEE", "EEEEEEE", "EEEEEEE", "EEEEEEE", "EEEEEEE", "EEEEEEE"],
      ["c.c.c.c", ".......", "c.....c", ".......", "c.....c", ".......", "c.c.c.c"],
    ],
  },
  library: {
    size: 5, height: 5, era: 2, cost: { wood: 30, stone: 16 }, stoneCost: { stone: 40 }, nameKey: "mech.bld.library",
    layers: [
      ["CCCCC", "CFFFC", "CFFFC", "CFFFC", "CCCCC"],
      ["WWDWW", "Wk.kW", "W...W", "Wk.kW", "WWWWW"],
      ["WGdGW", "Wk.kW", "G.T.G", "Wk.kW", "WWGWW"],
      ["RRRRR", "RRRRR", "RRRRR", "RRRRR", "RRRRR"],
      [".....", ".SSS.", ".SSS.", ".SSS.", "....."],
    ],
  },
  workshop: {
    size: 7, height: 6, era: 3, cost: { wood: 20, stone: 40, iron: 6 }, stoneCost: { stone: 60, iron: 6 }, nameKey: "mech.bld.workshop",
    layers: [
      ["CCCCCCC", "CFFFFFC", "CFFFFFC", "CFFFFFC", "CFFFFFC", "CFFFFFC", "CCCCCCC"],
      ["EEEDEEE", "E.....E", "EM.z.HE", "E.....E", "Ej...jE", "E..T..E", "EEEEEEE"],
      ["EEGdGEE", "G.....G", "EX....E", "G.....G", "E.....E", "G.....G", "EEGEGEE"],
      ["EEEEEEE", "E.....E", "Eq....E", "E.....E", "E.....E", "E.....E", "EEEEEEE"],
      ["RRRRRRR", "RRRRRRR", "RRRRRRR", "RRRRRRR", "RRRRRRR", "RRRRRRR", "RRRRRRR"],
      [".c...c.", ".......", ".......", ".......", ".......", ".......", ".c...c."],
    ],
  },
});
export const WALL_RADIUS = 31;
export const WALL_COST = { stone: 180 };

const NON_GROUND = new Set([
  "minecraft:air", "minecraft:water", "minecraft:flowing_water", "minecraft:lava", "minecraft:flowing_lava", "minecraft:tallgrass", "minecraft:short_grass",
  "minecraft:fern", "minecraft:large_fern", "minecraft:snow_layer", "minecraft:deadbush", "minecraft:torch", "minecraft:wheat", "minecraft:sweet_berry_bush",
  "minecraft:bamboo", "minecraft:sugar_cane", "minecraft:cactus", "minecraft:vine", "minecraft:web", "minecraft:brown_mushroom", "minecraft:red_mushroom",
]);
export function isGroundBlock(b) {
  if (!b || b.isAir || b.isLiquid) return false;
  const t = b.typeId;
  if (NON_GROUND.has(t)) return false;
  if (t.endsWith("_leaves") || t.endsWith("_log") || t.endsWith("_wood") || t.endsWith("_sapling") || t.endsWith("_flower") || t.endsWith("_fence") || t.includes("tulip") || t.includes("mushroom")) return false;
  if (t.startsWith("mech:")) return false;
  return true;
}

const ERA_MATS = [
  { wall: "minecraft:oak_planks", floor: "minecraft:oak_planks", roof: "minecraft:oak_planks", slab: ["minecraft:oak_slab", { "minecraft:vertical_half": "bottom" }], bricks: "minecraft:cobblestone", light: ["minecraft:torch", { torch_facing_direction: "top" }], road: "minecraft:grass_path" },
  { wall: "minecraft:oak_planks", floor: "minecraft:cobblestone", roof: "minecraft:spruce_planks", slab: ["minecraft:spruce_slab", { "minecraft:vertical_half": "bottom" }], bricks: "minecraft:stone_bricks", light: ["minecraft:torch", { torch_facing_direction: "top" }], road: "minecraft:grass_path" },
  { wall: "minecraft:stone_bricks", floor: "minecraft:polished_andesite", roof: "minecraft:dark_oak_planks", slab: ["minecraft:dark_oak_slab", { "minecraft:vertical_half": "bottom" }], bricks: "minecraft:stone_bricks", light: ["minecraft:lantern", { hanging: false }], road: "minecraft:stone_bricks" },
  { wall: "minecraft:brick_block", floor: "minecraft:polished_andesite", roof: "minecraft:copper_block", slab: ["minecraft:cut_copper_slab", { "minecraft:vertical_half": "bottom" }], bricks: "mech:brass_casing", light: ["minecraft:lantern", { hanging: false }], road: "minecraft:stone_bricks" },
];
const DESERT_MATS = [
  { wall: "minecraft:sandstone", floor: "minecraft:sandstone", roof: "minecraft:sandstone", slab: ["minecraft:sandstone_slab", { "minecraft:vertical_half": "bottom" }], bricks: "minecraft:cut_sandstone" },
  { wall: "minecraft:smooth_sandstone", floor: "minecraft:sandstone", roof: "minecraft:cut_sandstone", slab: ["minecraft:sandstone_slab", { "minecraft:vertical_half": "bottom" }], bricks: "minecraft:cut_sandstone" },
  { wall: "minecraft:cut_sandstone", floor: "minecraft:smooth_sandstone", roof: "minecraft:terracotta", slab: ["minecraft:smooth_sandstone_slab", { "minecraft:vertical_half": "bottom" }], bricks: "minecraft:chiseled_sandstone" },
  { wall: "minecraft:brick_block", floor: "minecraft:smooth_sandstone", roof: "minecraft:copper_block", slab: ["minecraft:cut_copper_slab", { "minecraft:vertical_half": "bottom" }], bricks: "mech:brass_casing" },
];
const STONE_MATS = { wall: "minecraft:cobblestone", floor: "minecraft:cobblestone", roof: "minecraft:cobblestone", slab: ["minecraft:cobblestone_slab", { "minecraft:vertical_half": "bottom" }], bricks: "minecraft:stone_bricks" };

/** Materials for a building of the given era. variant: "wood" (normal) or "stone" (no wood available). */
export function eraMaterials(era, sandy, variant) {
  const e = Math.max(0, Math.min(ERA_MATS.length - 1, era));
  const base = { ...ERA_MATS[e] };
  if (variant === "stone") Object.assign(base, sandy ? DESERT_MATS[e] : (e >= 2 ? ERA_MATS[e] : STONE_MATS));
  else if (sandy) Object.assign(base, DESERT_MATS[e]);
  base.variant = variant;
  return base;
}
export function materialsFor(res, sandy, costWood, costStone, era = 0) {
  const enough = (cost) => Object.entries(cost).every(([r, c]) => (res[r] || 0) >= c);
  if (enough(costWood)) return Object.assign(eraMaterials(era, sandy, "wood"), { cost: costWood });
  if (enough(costStone)) return Object.assign(eraMaterials(era, sandy, "stone"), { cost: costStone });
  return null;
}

function blockFor(ch, mats) {
  switch (ch) {
    case "C": return ["minecraft:cobblestone"];
    case "W": return [mats.wall];
    case "F": return [mats.floor];
    case "R": return [mats.roof];
    case "S": return mats.slab;
    case "G": return ["minecraft:glass"];
    case "T": return mats.light;
    case "l": return ["minecraft:lantern", { hanging: false }];
    case "U": return ["minecraft:furnace", { "minecraft:cardinal_direction": "north" }];
    case "u": return ["minecraft:blast_furnace", { "minecraft:cardinal_direction": "north" }];
    case "n": return ["minecraft:anvil", { "minecraft:cardinal_direction": "north" }];
    case "c": return ["minecraft:cobblestone_wall"];
    case "p": return [mats.road || "minecraft:grass_path"];
    case "k": return ["minecraft:bookshelf"];
    case "y": return ["minecraft:red_wool"];
    case "r": return ["minecraft:iron_bars"];
    case "M": return ["mech:millstone"];
    case "X": return ["mech:shaft", { "minecraft:block_face": "up" }];
    case "q": return ["mech:hand_crank", { "minecraft:block_face": "up" }];
    case "z": return ["mech:depot"];
    case "j": return ["mech:andesite_casing"];
    case "H": return ["minecraft:chest", { "minecraft:cardinal_direction": "north" }];
    case "K": return ["minecraft:crafting_table"];
    case "B": return ["minecraft:barrel", { facing_direction: 1 }];
    case "A": return ["minecraft:farmland", { moisturized_amount: 7 }];
    case "h": return ["minecraft:wheat", { growth: 0 }];
    case "w": return ["minecraft:water"];
    case "f": return ["minecraft:oak_fence"];
    case "E": return [mats.bricks];
    case "Y": return ["minecraft:hay_block"];
    case "L": return ["minecraft:oak_log"];
    case "b": return ["minecraft:bell"];
    default: return null;
  }
}

/** Expands a blueprint into an ordered list of placement steps (foundation, clearing, then layers bottom-up). */
export function buildSteps(type, origin, mats) {
  const bp = BUILDINGS[type];
  const steps = [];
  const base = bp.base || 0;
  const n = bp.size;
  // foundation under the footprint (only where the ground is missing)
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) steps.push({ x: origin.x + x, y: origin.y + base - 1, z: origin.z + z, id: "minecraft:cobblestone", foundation: true });
  // clearing
  for (let li = 0; li < bp.layers.length; li++) {
    const layer = bp.layers[li];
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
      if (layer[z][x] === ".") steps.push({ x: origin.x + x, y: origin.y + base + li, z: origin.z + z, id: "minecraft:air", clear: true });
    }
  }
  for (let y = bp.layers.length + base; y < bp.height + base + 2; y++) {
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) steps.push({ x: origin.x + x, y: origin.y + y, z: origin.z + z, id: "minecraft:air", clear: true });
  }
  // placement
  for (let li = 0; li < bp.layers.length; li++) {
    const layer = bp.layers[li];
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
      const ch = layer[z][x];
      const px = origin.x + x, py = origin.y + base + li, pz = origin.z + z;
      if (ch === "D") {
        steps.push({ x: px, y: py, z: pz, id: "minecraft:wooden_door", states: { direction: 3, door_hinge_bit: false, open_bit: false, upper_block_bit: false }, door: true });
        steps.push({ x: px, y: py + 1, z: pz, id: "minecraft:wooden_door", states: { direction: 3, door_hinge_bit: false, open_bit: false, upper_block_bit: true }, door: true });
        continue;
      }
      const b = blockFor(ch, mats);
      if (!b) continue;
      steps.push({ x: px, y: py, z: pz, id: b[0], states: b[1], chest: ch === "H" });
    }
  }
  return steps;
}

/** Ring wall around the settlement center; `groundAt(x,z)` returns the top ground y or null. */
export function wallSteps(center, groundAt) {
  const steps = [];
  const r = WALL_RADIUS;
  let idx = 0;
  const cells = [];
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
    if ((Math.abs(dx) === r && Math.abs(dz) <= 1) || (Math.abs(dz) === r && Math.abs(dx) <= 1)) continue; // gates
    cells.push([dx, dz]);
  }
  // order cells along the perimeter so the wall grows continuously
  cells.sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  for (const [dx, dz] of cells) {
    const x = center.x + dx, z = center.z + dz;
    const g = groundAt(x, z);
    if (g === null || g === undefined) continue;
    steps.push({ x, y: g, z, id: "minecraft:cobblestone", foundation: true });
    steps.push({ x, y: g + 1, z, id: "minecraft:cobblestone" });
    steps.push({ x, y: g + 2, z, id: "minecraft:cobblestone" });
    if (idx % 7 === 0) steps.push({ x, y: g + 3, z, id: "minecraft:torch", states: { torch_facing_direction: "top" } });
    idx++;
  }
  return steps;
}

/** Road from the settlement center to a building: the top ground block along the line becomes `material`. */
export function roadSteps(center, target, groundAt, material) {
  const steps = [];
  let x0 = center.x, z0 = center.z;
  const x1 = target.x, z1 = target.z;
  const dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0);
  const sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1;
  let err = dx - dz;
  let guard = 0;
  while ((x0 !== x1 || z0 !== z1) && guard++ < 200) {
    const g = groundAt(x0, z0);
    if (g !== null && g !== undefined) steps.push({ x: x0, y: g, z: z0, id: material, road: true });
    const e2 = 2 * err;
    if (e2 > -dz) {
      err -= dz;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      z0 += sz;
    }
  }
  return steps;
}

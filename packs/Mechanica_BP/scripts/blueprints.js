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
export const WALL_RADIUS = 15;
export const WALL_COST = { stone: 100 };

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

export function materialsFor(res, sandy, costWood, costStone) {
  if (res.wood >= costWood.wood && res.stone >= costWood.stone) {
    return { variant: "wood", wall: "minecraft:oak_planks", floor: "minecraft:oak_planks", roof: "minecraft:oak_planks", slab: ["minecraft:oak_slab", { "minecraft:vertical_half": "bottom" }], bricks: "minecraft:stone_bricks", cost: costWood };
  }
  if (res.stone >= costStone.stone) {
    const w = sandy ? "minecraft:sandstone" : "minecraft:cobblestone";
    return { variant: "stone", wall: w, floor: w, roof: w, slab: [sandy ? "minecraft:sandstone_slab" : "minecraft:cobblestone_slab", { "minecraft:vertical_half": "bottom" }], bricks: sandy ? "minecraft:cut_sandstone" : "minecraft:stone_bricks", cost: costStone };
  }
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
    case "T": return ["minecraft:torch", { torch_facing_direction: "top" }];
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

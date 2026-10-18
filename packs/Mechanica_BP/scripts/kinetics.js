// Rotational power network (Create-style): shafts, cogwheels, sources, machines.
import { world, system } from "@minecraft/server";
import {
  NS, DIR, OPP, FACE_AXIS, AXIS_FACES, PERP, add, key, parseKey, center, getBlock, st, tr, actionbar,
  spawnItems, handItem, setHand, isWrench, MachineState, safeDimension, DIM_IDS, runCommand, now, prettyId,
} from "./common.js";

export const EVAL_EVERY = 10; // ticks between network evaluations
export const DEFS = {};
export const netInfo = new Map(); // `${dimId}|${x,y,z}` -> { speed, stress, capacity, over, sources }
export const beltNodes = new Map(); // dimId -> Map<key, { pos, facing, speed }> (refreshed on every evaluation)
const memState = new Map(); // non-persistent per-block state (progress counters, timers)

export function defineKinetic(id, def) {
  DEFS[id] = def;
}
export function mem(dimId, pos) {
  const k = `${dimId}|${key(pos)}`;
  let s = memState.get(k);
  if (!s) {
    s = {};
    memState.set(k, s);
  }
  return s;
}

// ---------------------------------------------------------------- registry of kinetic blocks
let registry = null; // Map<dimId, Set<key>>
function regProp(dimId) {
  return `${NS}:reg:${dimId}`;
}
function ensureRegistry() {
  if (registry) return true;
  const r = new Map();
  for (const d of DIM_IDS) {
    let raw;
    try {
      raw = world.getDynamicProperty(regProp(d));
    } catch {
      return false;
    }
    const set = new Set();
    if (typeof raw === "string") {
      try {
        for (const k of JSON.parse(raw)) set.add(k);
      } catch {}
    }
    r.set(d, set);
  }
  registry = r;
  return true;
}
const dirtyDims = new Set();
function saveRegistry() {
  if (!registry) return;
  for (const d of dirtyDims) {
    try {
      world.setDynamicProperty(regProp(d), JSON.stringify([...registry.get(d)]));
    } catch {}
  }
  dirtyDims.clear();
}
export function registerBlock(dimId, pos) {
  if (!ensureRegistry()) return;
  if (!registry.has(dimId)) registry.set(dimId, new Set());
  registry.get(dimId).add(key(pos));
  dirtyDims.add(dimId);
  saveRegistry();
}
export function unregisterBlock(dimId, pos) {
  if (!ensureRegistry()) return;
  registry.get(dimId)?.delete(key(pos));
  dirtyDims.add(dimId);
  saveRegistry();
  netInfo.delete(`${dimId}|${key(pos)}`);
  memState.delete(`${dimId}|${key(pos)}`);
}

// ---------------------------------------------------------------- helpers for definitions
export const axisFromBlockFace = (p) => FACE_AXIS[st(p, "minecraft:block_face")] ?? "y";
export const axisFromFacing = (p) => FACE_AXIS[st(p, "minecraft:facing_direction")] ?? "z";
export const facingOf = (p) => st(p, "minecraft:facing_direction") ?? "north";
export const bothFacesOfAxis = (axisFn) => (p) => AXIS_FACES[axisFn(p)];

function infoOf(dimId, pos) {
  return netInfo.get(`${dimId}|${key(pos)}`);
}
export function showInfo(player, dimId, pos, extra) {
  const info = infoOf(dimId, pos);
  const parts = [];
  if (!info || info.sources === 0) parts.push({ translate: "mech.msg.nosource" });
  else if (info.over) parts.push({ translate: "mech.msg.over" });
  else parts.push({ translate: "mech.msg.info", with: [String(Math.abs(info.speed)), String(info.stress), String(info.capacity)] });
  if (extra) {
    parts.push({ text: "\n" });
    parts.push(...(extra.rawtext ?? [{ text: String(extra) }]));
  }
  actionbar(player, { rawtext: parts });
}

// ---------------------------------------------------------------- network evaluation
let evalCounter = 0;
export function evaluate() {
  if (!ensureRegistry()) return;
  evalCounter++;
  for (const [dimId, set] of registry) {
    if (set.size === 0) continue;
    const dim = safeDimension(dimId);
    if (!dim) continue;
    const nodes = new Map();
    for (const k of [...set]) {
      const pos = parseKey(k);
      const block = getBlock(dim, pos);
      if (!block) continue; // chunk not loaded
      const def = DEFS[block.typeId];
      if (!def) {
        set.delete(k);
        dirtyDims.add(dimId);
        MachineState.clear(dimId, pos);
        continue;
      }
      const perm = block.permutation;
      let n;
      try {
        n = { k, pos, block, perm, def, dim, dimId, axis: def.passive ? null : def.axis(perm), faces: def.passive ? [] : def.faces(perm), cog: def.cog || 0, speed: 0, edges: [], comp: -1 };
      } catch {
        continue;
      }
      nodes.set(k, n);
    }
    // edges
    for (const n of nodes.values()) {
      if (n.def.passive) continue;
      for (const f of n.faces) {
        const m = nodes.get(key(add(n.pos, DIR[f])));
        if (m && !m.def.passive && m.axis === n.axis && m.faces.includes(OPP[f])) n.edges.push({ to: m, ratio: 1 });
      }
      if (n.cog) {
        for (const f of PERP[n.axis]) {
          const m = nodes.get(key(add(n.pos, DIR[f])));
          if (m && m.cog && m.axis === n.axis) n.edges.push({ to: m, ratio: -(n.cog / m.cog) });
        }
      }
      if (n.def.chain) {
        // belts: consecutive segments with the same direction form one drive line
        for (const f of n.def.chain(n.perm)) {
          const m = nodes.get(key(add(n.pos, DIR[f])));
          if (m && m.block.typeId === n.block.typeId && facingOf(m.perm) === facingOf(n.perm)) n.edges.push({ to: m, ratio: 1 });
        }
      }
    }
    // components
    let compId = 0;
    for (const start of nodes.values()) {
      if (start.def.passive || start.comp >= 0) continue;
      const comp = [];
      const stack = [start];
      start.comp = compId;
      while (stack.length) {
        const n = stack.pop();
        comp.push(n);
        for (const e of n.edges) {
          if (e.to.comp < 0) {
            e.to.comp = compId;
            stack.push(e.to);
          }
        }
      }
      compId++;
      // sources
      let root = null;
      let capacity = 0;
      let sources = 0;
      for (const n of comp) {
        if (!n.def.source) continue;
        let s = null;
        try {
          s = n.def.source(n);
        } catch {}
        if (!s || !s.speed) continue;
        sources++;
        capacity += s.capacity;
        if (!root || Math.abs(s.speed) > Math.abs(root.s.speed)) root = { n, s };
      }
      if (root) {
        root.n.speed = root.s.speed;
        const q = [root.n];
        const seen = new Set([root.n.k]);
        while (q.length) {
          const n = q.shift();
          for (const e of n.edges) {
            if (seen.has(e.to.k)) continue;
            seen.add(e.to.k);
            e.to.speed = n.speed * e.ratio;
            q.push(e.to);
          }
        }
      }
      let stress = 0;
      for (const n of comp) if (n.def.impact) stress += n.def.impact * Math.abs(n.speed);
      stress = Math.round(stress);
      const over = sources > 0 && stress > capacity;
      for (const n of comp) {
        if (over) n.speed = 0;
        n.speed = Math.round(n.speed * 100) / 100;
        netInfo.set(`${dimId}|${n.k}`, { speed: n.speed, stress, capacity, over, sources });
      }
    }
    // apply
    const belts = new Map();
    beltNodes.set(dimId, belts);
    for (const n of nodes.values()) {
      if (n.def.belt) belts.set(n.k, { pos: n.pos, facing: facingOf(n.perm), speed: n.speed });
      if (!n.def.passive) {
        const spin = n.speed !== 0;
        try {
          if (st(n.perm, `${NS}:spin`) !== spin) n.block.setPermutation(n.perm.withState(`${NS}:spin`, spin));
        } catch {}
      }
      if (n.def.tick) {
        try {
          n.def.tick(n, n.speed, evalCounter);
        } catch (e) {
          console.warn(`[mech] tick error at ${n.k}: ${e}`);
        }
      }
    }
  }
  saveRegistry();
}

// ---------------------------------------------------------------- custom component
function dropContents(dim, pos, typeId) {
  const def = DEFS[typeId];
  if (def?.drop) {
    try {
      def.drop(dim, pos);
    } catch {}
  }
}
export const kineticComponent = {
  onPlace(e) {
    registerBlock(e.dimension.id, e.block.location);
  },
  onPlayerDestroy(e) {
    const typeId = e.destroyedBlockPermutation?.type?.id;
    dropContents(e.dimension, e.block.location, typeId);
    unregisterBlock(e.dimension.id, e.block.location);
    MachineState.clear(e.dimension.id, e.block.location);
  },
  onPlayerInteract(e) {
    const { block, player, dimension } = e;
    if (!player) return;
    const def = DEFS[block.typeId];
    if (!def) return;
    registerBlock(dimension.id, block.location); // self-heal registry
    const hand = handItem(player);
    const ctx = { block, player, dim: dimension, dimId: dimension.id, pos: block.location, perm: block.permutation, hand };
    if (isWrench(hand) && def.wrench) {
      def.wrench(ctx);
      return;
    }
    if (def.interact && !isWrench(hand)) {
      if (def.interact(ctx)) return;
    }
    showInfo(player, dimension.id, block.location, def.status ? def.status(ctx) : undefined);
  },
};

// ---------------------------------------------------------------- base definitions
const LIT_FURNACES = new Set(["minecraft:lit_furnace", "minecraft:lit_blast_furnace", "minecraft:lit_smoker"]);
const WATER = new Set(["minecraft:water", "minecraft:flowing_water"]);

defineKinetic(`${NS}:shaft`, { axis: axisFromBlockFace, faces: bothFacesOfAxis(axisFromBlockFace) });
defineKinetic(`${NS}:cogwheel`, { axis: axisFromBlockFace, faces: bothFacesOfAxis(axisFromBlockFace), cog: 1 });
defineKinetic(`${NS}:large_cogwheel`, { axis: axisFromBlockFace, faces: bothFacesOfAxis(axisFromBlockFace), cog: 2 });

defineKinetic(`${NS}:water_wheel`, {
  axis: (p) => {
    const c = st(p, "minecraft:cardinal_direction");
    return c === "east" || c === "west" ? "x" : "z";
  },
  faces(p) {
    return AXIS_FACES[this.axis(p)];
  },
  source(n) {
    let flowing = 0;
    let still = 0;
    for (const f of PERP[n.axis]) {
      const b = getBlock(n.dim, add(n.pos, DIR[f]));
      if (!b) continue;
      if (b.typeId === "minecraft:flowing_water") flowing++;
      else if (b.typeId === "minecraft:water") still++;
    }
    if (flowing) return { speed: 8, capacity: 256 };
    if (still) return { speed: 4, capacity: 128 };
    return null;
  },
});

defineKinetic(`${NS}:hand_crank`, {
  axis: axisFromBlockFace,
  faces: (p) => [OPP[st(p, "minecraft:block_face") ?? "up"]],
  source(n) {
    const m = mem(n.dimId, n.pos);
    return m.until && m.until > now() ? { speed: 32, capacity: 256 } : null;
  },
  interact(ctx) {
    const m = mem(ctx.dimId, ctx.pos);
    m.until = now() + 100;
    actionbar(ctx.player, tr("mech.msg.cranked"));
    return true;
  },
});

defineKinetic(`${NS}:furnace_engine`, {
  axis: axisFromFacing,
  faces: (p) => [OPP[facingOf(p)]],
  source(n) {
    const front = getBlock(n.dim, add(n.pos, DIR[facingOf(n.perm)]));
    return front && LIT_FURNACES.has(front.typeId) ? { speed: 16, capacity: 1024 } : null;
  },
});

// ---------------------------------------------------------------- millstone
export const MILL = {
  "minecraft:raw_iron": [["mech:crushed_iron", 1, 1], ["mech:crushed_iron", 1, 0.5]],
  "minecraft:raw_gold": [["mech:crushed_gold", 1, 1], ["mech:crushed_gold", 1, 0.5]],
  "minecraft:raw_copper": [["mech:crushed_copper", 1, 1], ["mech:crushed_copper", 1, 0.5]],
  "mech:raw_zinc": [["mech:crushed_zinc", 1, 1], ["mech:crushed_zinc", 1, 0.5]],
  "minecraft:wheat": [["mech:wheat_flour", 1, 1], ["mech:wheat_flour", 1, 0.25]],
  "minecraft:cobblestone": [["minecraft:gravel", 1, 1]],
  "minecraft:gravel": [["minecraft:sand", 1, 1], ["minecraft:flint", 1, 0.25]],
  "minecraft:sandstone": [["minecraft:sand", 2, 1]],
  "minecraft:bone": [["minecraft:bone_meal", 3, 1]],
  "minecraft:sugar_cane": [["minecraft:sugar", 2, 1]],
  "minecraft:blaze_rod": [["minecraft:blaze_powder", 3, 1]],
  "minecraft:coal": [["minecraft:black_dye", 1, 1]],
};
const MILL_WORK = 128;

function millDrop(dim, pos) {
  const s = MachineState.load(dim.id, pos);
  const at = center(pos);
  if (s.input) spawnItems(dim, at, s.input.id, s.input.count);
  for (const id in s.out || {}) spawnItems(dim, at, id, s.out[id]);
}
defineKinetic(`${NS}:millstone`, {
  axis: () => "y",
  faces: () => ["up"],
  cog: 1,
  impact: 4,
  tick(n, speed) {
    if (!speed) return;
    const s = MachineState.load(n.dimId, n.pos);
    if (!s.input || s.input.count <= 0) return;
    const rec = MILL[s.input.id];
    if (!rec) return;
    s.progress = (s.progress || 0) + Math.abs(speed);
    if (s.progress >= MILL_WORK) {
      s.progress = 0;
      s.input.count--;
      if (s.input.count <= 0) delete s.input;
      s.out = s.out || {};
      for (const [id, cnt, chance] of rec) if (Math.random() < chance) s.out[id] = (s.out[id] || 0) + cnt;
    }
    MachineState.save(n.dimId, n.pos, s);
  },
  interact(ctx) {
    const s = MachineState.load(ctx.dimId, ctx.pos);
    const hand = ctx.hand;
    if (hand && MILL[hand.typeId] && (!s.input || s.input.id === hand.typeId) && (s.input?.count || 0) < 64) {
      const can = 64 - (s.input?.count || 0);
      const moved = Math.min(can, hand.amount);
      s.input = { id: hand.typeId, count: (s.input?.count || 0) + moved };
      MachineState.save(ctx.dimId, ctx.pos, s);
      if (hand.amount - moved <= 0) setHand(ctx.player, undefined);
      else {
        const c = hand.clone();
        c.amount = hand.amount - moved;
        setHand(ctx.player, c);
      }
      actionbar(ctx.player, tr("mech.msg.inserted", prettyId(hand.typeId), moved));
      return true;
    }
    if (!hand && s.out && Object.keys(s.out).length) {
      const at = add(center(ctx.pos), DIR.up, 0.6);
      for (const id in s.out) spawnItems(ctx.dim, at, id, s.out[id]);
      s.out = {};
      MachineState.save(ctx.dimId, ctx.pos, s);
      actionbar(ctx.player, tr("mech.msg.taken"));
      return true;
    }
    return false;
  },
  status(ctx) {
    const s = MachineState.load(ctx.dimId, ctx.pos);
    if (!s.input && !(s.out && Object.keys(s.out).length)) return tr("mech.msg.empty");
    const ready = Object.entries(s.out || {}).map(([id, c]) => `${prettyId(id)} ×${c}`).join(", ") || "-";
    return tr("mech.msg.millstone", s.input ? prettyId(s.input.id) : "-", s.input?.count || 0, Math.floor(((s.progress || 0) / MILL_WORK) * 100), ready);
  },
  drop: millDrop,
});

// ---------------------------------------------------------------- press (over depot)
export const PRESS = {
  "minecraft:iron_ingot": "mech:iron_sheet",
  "minecraft:gold_ingot": "mech:gold_sheet",
  "minecraft:copper_ingot": "mech:copper_sheet",
  "mech:brass_ingot": "mech:brass_sheet",
  "mech:zinc_ingot": "mech:zinc_sheet",
};
function itemEntitiesIn(dim, pos) {
  let ents = [];
  try {
    ents = dim.getEntities({ type: "minecraft:item", location: center(pos), maxDistance: 1.2 });
  } catch {
    return [];
  }
  return ents.filter((e) => {
    const l = e.location;
    return Math.floor(l.x) === pos.x && Math.floor(l.z) === pos.z && l.y >= pos.y - 0.2 && l.y < pos.y + 1.3;
  });
}
function stackOf(e) {
  try {
    return e.getComponent("minecraft:item")?.itemStack;
  } catch {
    return undefined;
  }
}
function replaceEntityItem(dim, e, loc, newId, newCount, remainderId, remainderCount) {
  try {
    e.remove();
  } catch {}
  const spawn = (id, c) => {
    const ent = spawnItems(dim, loc, id, c);
    try {
      ent?.clearVelocity();
    } catch {}
  };
  if (remainderCount > 0) spawn(remainderId, remainderCount);
  if (newCount > 0) spawn(newId, newCount);
}
defineKinetic(`${NS}:mechanical_press`, {
  axis: () => "y",
  faces: () => ["up"],
  impact: 8,
  tick(n, speed) {
    if (!speed) return;
    const below = add(n.pos, DIR.down);
    const b = getBlock(n.dim, below);
    if (!b || b.typeId !== `${NS}:depot`) return;
    const m = mem(n.dimId, n.pos);
    m.progress = (m.progress || 0) + Math.abs(speed);
    if (m.progress < 64) return;
    for (const e of itemEntitiesIn(n.dim, below)) {
      const s = stackOf(e);
      if (!s || !PRESS[s.typeId]) continue;
      m.progress = 0;
      replaceEntityItem(n.dim, e, { x: below.x + 0.5, y: below.y + 0.9, z: below.z + 0.5 }, PRESS[s.typeId], 1, s.typeId, s.amount - 1);
      try {
        n.dim.playSound("random.anvil_land", center(n.pos), { volume: 0.4, pitch: 1.4 });
      } catch {}
      return;
    }
    m.progress = 64;
  },
});

// ---------------------------------------------------------------- mixer (over basin)
export const MIX = [
  { in: { "minecraft:copper_ingot": 1, "mech:zinc_ingot": 1 }, out: [["mech:brass_ingot", 2]] },
  { in: { "mech:crushed_copper": 1, "mech:crushed_zinc": 1 }, out: [["mech:brass_ingot", 2]] },
  { in: { "minecraft:andesite": 1, "minecraft:iron_nugget": 1 }, out: [["mech:andesite_alloy", 1]] },
  { in: { "mech:wheat_flour": 1, "minecraft:water_bucket": 1 }, out: [["mech:dough", 2], ["minecraft:bucket", 1]] },
  { in: { "minecraft:sand": 1, "minecraft:gravel": 1, "minecraft:clay_ball": 1 }, out: [["minecraft:cobblestone", 2]] },
  { in: { "minecraft:gunpowder": 1, "minecraft:sand": 1 }, out: [["minecraft:tnt", 1]] },
];
defineKinetic(`${NS}:mechanical_mixer`, {
  axis: () => "y",
  faces: () => ["up"],
  impact: 4,
  tick(n, speed) {
    if (!speed) return;
    const below = add(n.pos, DIR.down);
    const b = getBlock(n.dim, below);
    if (!b || b.typeId !== `${NS}:basin`) return;
    const ents = itemEntitiesIn(n.dim, below);
    if (!ents.length) return;
    const counts = {};
    for (const e of ents) {
      const s = stackOf(e);
      if (s) counts[s.typeId] = (counts[s.typeId] || 0) + s.amount;
    }
    const rec = MIX.find((r) => Object.entries(r.in).every(([id, c]) => (counts[id] || 0) >= c));
    const m = mem(n.dimId, n.pos);
    if (!rec) {
      m.progress = 0;
      return;
    }
    m.progress = (m.progress || 0) + Math.abs(speed);
    if (m.progress < 96) return;
    m.progress = 0;
    for (const [id, c] of Object.entries(rec.in)) {
      let need = c;
      for (const e of ents) {
        if (need <= 0) break;
        const s = stackOf(e);
        if (!s || s.typeId !== id) continue;
        const take = Math.min(need, s.amount);
        need -= take;
        replaceEntityItem(n.dim, e, { x: below.x + 0.5, y: below.y + 0.4, z: below.z + 0.5 }, id, 0, id, s.amount - take);
      }
    }
    for (const [id, c] of rec.out) {
      const ent = spawnItems(n.dim, { x: below.x + 0.5, y: below.y + 0.5, z: below.z + 0.5 }, id, c);
      try {
        ent?.clearVelocity();
      } catch {}
    }
    try {
      n.dim.playSound("random.fizz", center(n.pos), { volume: 0.3, pitch: 1.2 });
    } catch {}
  },
});

// ---------------------------------------------------------------- drill
export const UNBREAKABLE = new Set([
  "minecraft:bedrock", "minecraft:barrier", "minecraft:end_portal_frame", "minecraft:end_portal", "minecraft:portal", "minecraft:command_block",
  "minecraft:chain_command_block", "minecraft:repeating_command_block", "minecraft:structure_block", "minecraft:jigsaw", "minecraft:obsidian",
  "minecraft:crying_obsidian", "minecraft:reinforced_deepslate", "minecraft:end_gateway", "minecraft:light_block", "minecraft:allow", "minecraft:deny",
]);
export function breakBlockWithDrops(dim, pos) {
  const b = getBlock(dim, pos);
  if (!b || b.isAir || UNBREAKABLE.has(b.typeId)) return false;
  if (b.isLiquid) {
    try {
      b.setType("minecraft:air");
    } catch {}
    return true;
  }
  return runCommand(dim, `setblock ${pos.x} ${pos.y} ${pos.z} air destroy`);
}
defineKinetic(`${NS}:mechanical_drill`, {
  axis: axisFromFacing,
  faces: (p) => [OPP[facingOf(p)]],
  impact: 4,
  tick(n, speed) {
    if (!speed) return;
    const front = add(n.pos, DIR[facingOf(n.perm)]);
    try {
      for (const e of n.dim.getEntities({ location: center(front), maxDistance: 0.9 })) {
        if (e.typeId === "minecraft:item" || e.typeId === "minecraft:xp_orb" || e.typeId === `${NS}:marker`) continue;
        e.applyDamage(2);
      }
    } catch {}
    const m = mem(n.dimId, n.pos);
    m.progress = (m.progress || 0) + Math.abs(speed);
    if (m.progress < 80) return;
    const b = getBlock(n.dim, front);
    if (!b || b.isAir) {
      m.progress = 80;
      return;
    }
    m.progress = 0;
    breakBlockWithDrops(n.dim, front);
  },
});

// ---------------------------------------------------------------- scheduler
export function startKinetics() {
  system.runInterval(() => {
    try {
      evaluate();
    } catch (e) {
      console.warn(`[mech] evaluate failed: ${e}`);
    }
  }, EVAL_EVERY);
}

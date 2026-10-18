// Self-developing colonist settlements: roles, gathering, building, farming, growth, diplomacy, war and trade.
import { world, system } from "@minecraft/server";
import {
  NS, DIR, add, key, parseKey, dist, distXZ, floorPos, randInt, pick, getBlock, st, setBlock, tr, tell, broadcast,
  getContainer, containerAdd, safeDimension, DIM_IDS, now,
} from "./common.js";
import { BUILDINGS, ERAS, WALL_COST, WALL_RADIUS, buildSteps, wallSteps, roadSteps, materialsFor, eraMaterials, isGroundBlock } from "./blueprints.js";
import { GEN } from "./generated.js";

const PROP = `${NS}:civ`;
const SLOTS = GEN.slots;
const ROLES = ["builder", "gatherer", "farmer", "warrior", "trader"];
const ROLE_RU = { builder: "Строитель", gatherer: "Добытчик", farmer: "Фермер", warrior: "Воин", trader: "Торговец" };
const BLD_RU = { town_hall: "Ратуша", house: "Дом", farm: "Ферма", tower: "Сторожевая башня", well: "Колодец", storage: "Склад", wall: "Стена", smithy: "Кузница", market: "Рынок", barracks: "Казармы", library: "Библиотека", workshop: "Мастерская", road: "Дорога" };
const ERA_REQ = [null, { pop: 6, buildings: ["town_hall", "farm", "house", "well"], houses: 2, dev: 20 }, { pop: 12, buildings: ["smithy", "tower"], houses: 4, dev: 60 }, { pop: 20, buildings: ["market", "barracks", "library"], houses: 6, dev: 130 }];
const MAX_HOUSES = [3, 6, 10, 14];
const RES_RU = { wood: "дерево", stone: "камень", food: "еда", iron: "железо" };
const MAX_POP = 40;
const JOIN_RADIUS = 48;

let civ = null;
let dirty = false;
let lastSave = 0;
const stepCache = new Map(); // settlement id -> { sig, steps }

// ---------------------------------------------------------------- persistence
function load() {
  if (civ) return true;
  let raw;
  try {
    raw = world.getDynamicProperty(PROP);
  } catch {
    return false;
  }
  civ = { settlements: {}, nextId: 1 };
  if (typeof raw === "string") {
    try {
      const o = JSON.parse(raw);
      if (o && o.settlements) civ = o;
    } catch {}
  }
  return true;
}
function save(force) {
  if (!civ || (!dirty && !force)) return;
  if (!force && now() - lastSave < 100) return;
  try {
    world.setDynamicProperty(PROP, JSON.stringify(civ));
    dirty = false;
    lastSave = now();
  } catch (e) {
    console.warn(`[mech] civ save failed: ${e}`);
  }
}
function settlements() {
  return Object.values(civ.settlements);
}

// ---------------------------------------------------------------- world helpers
function groundAt(dim, x, z, yHint) {
  for (let y = yHint + 14; y >= yHint - 14; y--) {
    const b = getBlock(dim, { x, y, z });
    if (b === undefined) return null;
    if (b.isLiquid) return null;
    if (isGroundBlock(b)) return y;
  }
  return null;
}
function particle(dim, loc, name = "minecraft:villager_happy") {
  try {
    dim.spawnParticle(name, loc);
  } catch {}
}
function sound(dim, loc, name) {
  try {
    dim.playSound(name, loc, { volume: 0.6 });
  } catch {}
}
function entityPos(e) {
  try {
    return e.location;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- settlements
function freeSlot() {
  const used = new Set(settlements().map((s) => s.slot));
  for (let i = 0; i < SLOTS; i++) if (!used.has(i)) return i;
  return -1;
}
function newName() {
  const used = new Set(settlements().map((s) => s.name));
  const free = GEN.settlementNames.filter((n) => !used.has(n));
  return free.length ? pick(free) : `Поселение ${civ.nextId}`;
}
function foundSettlement(dim, pos) {
  const slot = freeSlot();
  if (slot < 0) return null;
  const p = floorPos(pos);
  const g = groundAt(dim, p.x, p.z, p.y);
  const cy = g === null ? p.y : g + 1;
  const gb = getBlock(dim, { x: p.x, y: cy - 1, z: p.z });
  const sandy = !!gb && gb.typeId.includes("sand");
  const S = {
    id: civ.nextId++, slot, name: newName(), dim: dim.id, center: { x: p.x, y: cy, z: p.z }, sandy,
    res: { wood: 0, stone: 0, food: 0, iron: 0 }, buildings: [], build: null, mine: null, queue: [], scan: 0, gather: null,
    temper: randInt(-3, 2), rel: {}, wars: {}, allies: {}, markers: {}, pop: 0, warriors: 0, emptySince: null, lastTrade: 0, lastDiplo: 0, lastBalance: 0, founded: now(), chest: null, warMarker: null, era: 0, dev: 0, lastCaravan: 0, lastDev: 0,
  };
  civ.settlements[S.id] = S;
  dirty = true;
  broadcast(tr("mech.civ.founded", S.name));
  return S;
}
function nearestSettlement(dimId, pos, maxDist) {
  let best = null;
  let bd = Infinity;
  for (const S of settlements()) {
    if (S.dim !== dimId) continue;
    const d = distXZ(S.center, pos);
    if (d < bd) {
      bd = d;
      best = S;
    }
  }
  return bd <= maxDist ? best : null;
}
function removeSettlement(S) {
  for (const role in S.markers) {
    try {
      world.getEntity(S.markers[role])?.remove();
    } catch {}
  }
  for (const O of settlements()) {
    delete O.rel[S.id];
    delete O.wars[S.id];
    delete O.allies[S.id];
  }
  delete civ.settlements[S.id];
  stepCache.delete(S.id);
  dirty = true;
  broadcast(tr("mech.civ.fallen", S.name));
}

// ---------------------------------------------------------------- colonists
function prop(e, name) {
  try {
    return e.getDynamicProperty(name);
  } catch {
    return undefined;
  }
}
function setProp(e, name, v) {
  try {
    e.setDynamicProperty(name, v);
  } catch {}
}
function applyRole(e, S, role) {
  setProp(e, `${NS}:role`, role);
  setProp(e, `${NS}:clan`, S.id);
  try {
    for (const t of e.getTags()) if (t.startsWith("mech_c") || t.startsWith("mech_role_")) e.removeTag(t);
    e.addTag(`mech_c${S.slot}`);
    e.addTag(`mech_role_${role}`);
    e.triggerEvent(`${NS}:become_${role}`);
    e.triggerEvent(`${NS}:gear_${role}_${Math.min(3, S.era || 0)}`);
    e.triggerEvent(`${NS}:set_clan${S.slot}`);
    e.nameTag = `${ROLE_RU[role]} · ${S.name}`;
  } catch {}
}
function desiredRoles(pop, S) {
  const d = { builder: 0, gatherer: 0, farmer: 0, warrior: 0, trader: 0 };
  if (pop <= 0) return d;
  d.warrior = pop >= 3 ? Math.max(1, Math.floor(pop / 4)) : 0;
  d.builder = pop >= 2 ? Math.max(1, Math.floor(pop / 4)) : 0;
  d.farmer = pop >= 4 ? Math.max(1, Math.floor(pop / 6)) : 0;
  d.trader = S && pop >= 8 && S.buildings.some((b) => b.type === "market") ? (pop >= 20 ? 2 : 1) : 0;
  d.gatherer = Math.max(0, pop - d.warrior - d.builder - d.farmer - d.trader);
  if (d.gatherer === 0 && pop >= 1) {
    if (d.builder > 1) d.builder--;
    else if (d.warrior > 1) d.warrior--;
    else if (d.farmer > 0) d.farmer--;
    else d.builder--;
    d.gatherer = 1;
  }
  return d;
}
function assignColonist(e) {
  const pos = entityPos(e);
  if (!pos) return null;
  const dim = e.dimension;
  let S = nearestSettlement(dim.id, pos, JOIN_RADIUS);
  if (!S) S = foundSettlement(dim, pos);
  if (!S) S = nearestSettlement(dim.id, pos, Infinity);
  if (!S) return null;
  const counts = roleCounts(S);
  const want = desiredRoles((S.pop || 0) + 1, S);
  let role = "gatherer";
  for (const r of ["gatherer", "builder", "warrior", "farmer", "trader"]) {
    if ((counts[r] || 0) < want[r]) {
      role = r;
      break;
    }
  }
  applyRole(e, S, role);
  counts[role] = (counts[role] || 0) + 1;
  liveCounts.set(S.id, counts);
  S.pop = (S.pop || 0) + 1;
  dirty = true;
  return S;
}
const liveCounts = new Map(); // settlement id -> role counts (updated every tick)
function roleCounts(S) {
  return liveCounts.get(S.id) || { builder: 0, gatherer: 0, farmer: 0, warrior: 0, trader: 0 };
}
function rebalance(S, members) {
  if (now() - S.lastBalance < 600) return;
  S.lastBalance = now();
  const want = desiredRoles(members.length, S);
  const have = roleCounts(S);
  let swaps = 0;
  for (const r of ROLES) {
    while ((have[r] || 0) < want[r] && swaps < 3) {
      let donor = null;
      let best = 0;
      for (const o of ROLES) {
        const surplus = (have[o] || 0) - want[o];
        if (surplus > best) {
          best = surplus;
          donor = o;
        }
      }
      if (!donor) break;
      const m = members.find((x) => x.role === donor);
      if (!m) break;
      applyRole(m.e, S, r);
      m.role = r;
      have[donor]--;
      have[r] = (have[r] || 0) + 1;
      swaps++;
    }
  }
}
function updateTags(S, members) {
  const enemySlots = new Set();
  for (const id in S.wars) {
    const O = civ.settlements[id];
    if (O) enemySlots.add(O.slot);
  }
  for (const m of members) {
    try {
      const tags = m.e.getTags();
      for (const t of tags) {
        if (t.startsWith("mech_enemy_of_")) {
          const slot = Number(t.slice(14));
          if (!enemySlots.has(slot)) m.e.removeTag(t);
        }
      }
      for (const slot of enemySlots) if (!tags.includes(`mech_enemy_of_${slot}`)) m.e.addTag(`mech_enemy_of_${slot}`);
      if (!tags.includes(`mech_c${S.slot}`)) m.e.addTag(`mech_c${S.slot}`);
    } catch {}
  }
}

// ---------------------------------------------------------------- markers (navigation targets)
function ensureMarkers(S, dim) {
  const out = {};
  for (const role of ROLES) {
    let ent;
    try {
      ent = S.markers[role] ? world.getEntity(S.markers[role]) : undefined;
    } catch {
      ent = undefined;
    }
    if (!ent) {
      try {
        ent = dim.spawnEntity(`${NS}:marker`, { x: S.center.x + 0.5, y: S.center.y + 0.5, z: S.center.z + 0.5 });
        ent.addTag(`mech_site_${S.slot}_${role}`);
        S.markers[role] = ent.id;
        dirty = true;
      } catch {
        ent = undefined;
      }
    }
    out[role] = ent;
  }
  return out;
}
function moveMarker(marker, loc) {
  if (!marker) return;
  try {
    const p = marker.location;
    if (dist(p, loc) > 0.6) marker.teleport(loc);
  } catch {}
}
function near(members, loc, r) {
  return members.filter((m) => {
    const p = entityPos(m.e);
    return p && distXZ(p, loc) <= r && Math.abs(p.y - loc.y) <= 4;
  });
}
function workers(members, loc, reach, startedTick) {
  const age = now() - (startedTick || now());
  return near(members, loc, age > 1200 ? 24 : reach);
}

// ---------------------------------------------------------------- building
function buildOrder(S, pop) {
  const has = (t) => S.buildings.filter((b) => b.type === t).length;
  const era = S.era || 0;
  const want = [];
  if (!has("town_hall")) return ["town_hall"];
  if (pop >= 3 && !has("farm")) want.push("farm");
  const cap = 3 + 2 * has("house");
  if (pop >= cap - 1 && has("house") < MAX_HOUSES[Math.min(3, era)]) want.push("house");
  if (S.buildings.length >= 3 && !has("well")) want.push("well");
  if (era >= 1 && pop >= 6 && !has("smithy")) want.push("smithy");
  if (era >= 1 && pop >= 8 && !has("tower")) want.push("tower");
  if (era >= 1 && pop >= 10 && !has("storage")) want.push("storage");
  if (era >= 1 && pop >= 12 && !has("wall")) want.push("wall");
  if (era >= 2 && pop >= 12 && !has("market")) want.push("market");
  if (era >= 2 && pop >= 14 && !has("barracks")) want.push("barracks");
  if (era >= 2 && pop >= 16 && !has("library")) want.push("library");
  if (era >= 3 && pop >= 20 && !has("workshop")) want.push("workshop");
  if (pop >= 8 && has("farm") < Math.floor(pop / 8)) want.push("farm");
  if (era >= 2 && pop >= 18 && has("tower") < 2) want.push("tower");
  return want;
}
function overlaps(S, origin, size) {
  const m = Math.floor(size / 2);
  for (const b of [...S.buildings, S.build].filter(Boolean)) {
    if (b.type === "wall") continue;
    const bs = b.size || BUILDINGS[b.type]?.size || 5;
    if (Math.abs(origin.x + m - (b.x + Math.floor(bs / 2))) < (size + bs) / 2 + 1.5 && Math.abs(origin.z + m - (b.z + Math.floor(bs / 2))) < (size + bs) / 2 + 1.5) return true;
  }
  if (S.mine && Math.abs(origin.x + m - S.mine.x) < size / 2 + 4 && Math.abs(origin.z + m - S.mine.z) < size / 2 + 4) return true;
  return false;
}
function findSite(S, dim, size) {
  const c = S.center;
  for (const r of [6, 10, 14, 18, 22, 26]) {
    const n = r < 12 ? 12 : r < 20 ? 16 : 22;
    for (let a = 0; a < n; a++) {
      const ang = (a * 2 * Math.PI) / n + (r % 4 ? 0.2 : 0);
      const cx = c.x + Math.round(Math.cos(ang) * r), cz = c.z + Math.round(Math.sin(ang) * r);
      const origin = { x: cx - Math.floor(size / 2), z: cz - Math.floor(size / 2) };
      if (overlaps(S, origin, size)) continue;
      const samples = [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1], [Math.floor(size / 2), Math.floor(size / 2)]];
      let lo = Infinity, hi = -Infinity, ok = true;
      for (const [dx, dz] of samples) {
        const g = groundAt(dim, origin.x + dx, origin.z + dz, c.y);
        if (g === null) {
          ok = false;
          break;
        }
        lo = Math.min(lo, g);
        hi = Math.max(hi, g);
      }
      if (!ok || hi - lo > 2) continue;
      return { x: origin.x, y: hi + 1, z: origin.z };
    }
  }
  return null;
}
function halve(cost) {
  const o = {};
  for (const k in cost) o[k] = Math.ceil(cost[k] / 2);
  return o;
}
function startBuild(S, dim, pop) {
  const era = S.era || 0;
  // roads to every building (from the Village era on)
  if (era >= 1) {
    const t = S.buildings.find((b) => !b.road && b.type !== "wall" && b.type !== "town_hall");
    if (t) {
      const half = Math.floor((t.size || 5) / 2);
      S.build = { type: "road", x: t.x + half, y: t.y, z: t.z + half, step: 0, started: now(), variant: "wood", size: 1, era, tx: t.x, tz: t.z };
      dirty = true;
      return;
    }
  }
  // renovate old buildings to the current era's materials
  const up = S.buildings.find((b) => (b.era || 0) < era && !["wall", "farm", "well", "market"].includes(b.type));
  if (up) {
    const bp = BUILDINGS[up.type];
    const mats = materialsFor(S.res, S.sandy, halve(bp.cost), halve(bp.stoneCost), era);
    if (mats) {
      for (const r in mats.cost) S.res[r] -= mats.cost[r];
      S.build = { type: up.type, x: up.x, y: up.y, z: up.z, step: 0, started: now(), variant: mats.variant, size: bp.size, era, upgrade: true };
      dirty = true;
      return;
    }
  }
  for (const type of buildOrder(S, pop)) {
    if (type === "wall") {
      if (S.res.stone < WALL_COST.stone) continue;
      S.res.stone -= WALL_COST.stone;
      S.build = { type, x: S.center.x, y: S.center.y, z: S.center.z, step: 0, started: now(), variant: "stone", size: WALL_RADIUS * 2, era };
      dirty = true;
      return;
    }
    const bp = BUILDINGS[type];
    const mats = materialsFor(S.res, S.sandy, bp.cost, bp.stoneCost, era);
    if (!mats) continue;
    let origin;
    if (type === "town_hall") origin = { x: S.center.x - 3, y: S.center.y, z: S.center.z - 3 };
    else origin = findSite(S, dim, bp.size);
    if (!origin) continue;
    for (const r in mats.cost) S.res[r] -= mats.cost[r];
    S.build = { type, x: origin.x, y: origin.y, z: origin.z, step: 0, started: now(), variant: mats.variant, size: bp.size, era };
    dirty = true;
    return;
  }
}
function stepsFor(S, dim) {
  const b = S.build;
  const sig = `${b.type}:${b.x},${b.y},${b.z}:${b.variant}:${b.era || 0}`;
  const c = stepCache.get(S.id);
  if (c && c.sig === sig) return c.steps;
  let steps;
  if (b.type === "wall") steps = wallSteps(S.center, (x, z) => groundAt(dim, x, z, S.center.y));
  else if (b.type === "road") steps = roadSteps(S.center, { x: b.x, z: b.z }, (x, z) => groundAt(dim, x, z, S.center.y), eraMaterials(b.era || 0, S.sandy, "wood").road);
  else steps = buildSteps(b.type, { x: b.x, y: b.y, z: b.z }, eraMaterials(b.era || 0, S.sandy, b.variant || "wood"));
  stepCache.set(S.id, { sig, steps });
  return steps;
}
/** Executes one build step; returns true when something actually changed. */
function applyStep(dim, S, step) {
  const b = getBlock(dim, step);
  if (!b) return false;
  if (step.road) {
    if (b.typeId === step.id || !isGroundBlock(b)) return false;
    if (step.id === "minecraft:grass_path" && b.typeId !== "minecraft:grass_block" && b.typeId !== "minecraft:dirt") return false;
    const above = getBlock(dim, add(step, DIR.up));
    if (!above || !above.isAir) return false;
  } else if (step.foundation) {
    if (isGroundBlock(b)) return false;
  } else if (step.clear) {
    if (b.isAir) return false;
    if (b.typeId.startsWith(NS + ":") || b.typeId === "minecraft:chest") return false;
  } else if (b.typeId === step.id && !step.door) return false;
  if (step.chest) S.chest = { x: step.x, y: step.y, z: step.z };
  return setBlock(dim, step, step.id, step.states);
}
function builderJob(S, dim, members, marker, pop) {
  if (!S.build) startBuild(S, dim, pop);
  const b = S.build;
  const half = b ? Math.floor((b.size || 5) / 2) : 0;
  const site = b ? (b.type === "wall" ? { x: b.x + WALL_RADIUS - 2, y: b.y, z: b.z } : { x: b.x + half + 0.5, y: b.y, z: b.z - 1.5 }) : null;
  if (!site) {
    moveMarker(marker, { x: S.center.x + 0.5, y: S.center.y, z: S.center.z + 0.5 });
    return;
  }
  moveMarker(marker, site);
  if (!members.length) return;
  const steps = stepsFor(S, dim);
  const active = workers(members, site, b.type === "wall" || b.type === "road" ? 40 : 9, b.started);
  if (!active.length) return;
  let budget = Math.min(6, active.length * 2);
  let guard = 0;
  while (b.step < steps.length && budget > 0 && guard < 80) {
    guard++;
    const step = steps[b.step];
    const changed = applyStep(dim, S, step);
    b.step++;
    if (changed) {
      budget--;
      if (!step.clear && !step.foundation && Math.random() < 0.3) {
        particle(dim, { x: step.x + 0.5, y: step.y + 0.8, z: step.z + 0.5 });
        sound(dim, step, "dig.stone");
      }
    }
  }
  if ((b.type === "wall" || b.type === "road") && b.step < steps.length) {
    const s = steps[Math.min(b.step, steps.length - 1)];
    moveMarker(marker, { x: s.x + 0.5, y: s.y + 1, z: s.z + 0.5 });
  }
  dirty = true;
  if (b.step >= steps.length) {
    if (b.type === "road") {
      const t = S.buildings.find((x) => x.x === b.tx && x.z === b.tz);
      if (t) t.road = true;
    } else if (b.upgrade) {
      const t = S.buildings.find((x) => x.x === b.x && x.z === b.z && x.type === b.type);
      if (t) t.era = b.era;
      S.dev = (S.dev || 0) + 2;
      broadcast(tr("mech.civ.upgraded", S.name, BLD_RU[b.type] || b.type));
    } else {
      S.buildings.push({ type: b.type, x: b.x, y: b.y, z: b.z, size: b.size, era: b.era || 0 });
      S.dev = (S.dev || 0) + 5;
      broadcast(tr("mech.civ.built", S.name, BLD_RU[b.type] || b.type));
    }
    S.build = null;
    stepCache.delete(S.id);
  }
}

// ---------------------------------------------------------------- gathering & mining
const SCAN_R = 20;
const SCAN_H = 20;
const SCAN_PER_TICK = 160;
function isLog(t) {
  return t.endsWith("_log") || t.endsWith("_stem") || t === "minecraft:bamboo_block";
}
function resourceOf(t, era = 0) {
  if (isLog(t)) return ["wood", 1 + Math.floor(era / 2), "minecraft:oak_log"];
  if (t.includes("iron_ore")) return ["iron", 1, "minecraft:raw_iron"];
  if (t.includes("gold_ore") || t.includes("diamond_ore") || t.includes("emerald_ore")) return ["iron", 2, "minecraft:raw_gold"];
  if (t.includes("copper_ore") || t.includes("zinc_ore") || t.includes("coal_ore")) return ["iron", 1, "minecraft:coal"];
  if (t === "minecraft:stone" || t === "minecraft:deepslate" || t.includes("sandstone") || t === "minecraft:andesite" || t === "minecraft:diorite" || t === "minecraft:granite" || t === "minecraft:tuff" || t === "minecraft:cobblestone")
    return ["stone", 1, "minecraft:cobblestone"];
  if (t.endsWith("_ore")) return ["iron", 1, "minecraft:raw_iron"];
  return null;
}
function scanResources(S, dim) {
  const side = SCAN_R * 2 + 1;
  const total = side * side * SCAN_H;
  for (let n = 0; n < SCAN_PER_TICK; n++) {
    const i = S.scan % total;
    S.scan = (S.scan + 1) % total;
    const dy = i % SCAN_H;
    const rest = Math.floor(i / SCAN_H);
    const dx = (rest % side) - SCAN_R;
    const dz = Math.floor(rest / side) - SCAN_R;
    const p = { x: S.center.x + dx, y: S.center.y - 5 + dy, z: S.center.z + dz };
    const b = getBlock(dim, p);
    if (!b) continue;
    const t = b.typeId;
    if (isLog(t) || t.endsWith("_ore")) {
      if (S.buildings.some((bl) => bl.type !== "wall" && Math.abs(p.x - bl.x - 2) <= 5 && Math.abs(p.z - bl.z - 2) <= 5)) continue;
      const k = key(p);
      if (S.queue.length < 48 && !S.queue.includes(k)) S.queue.push(k);
    }
  }
}
function deposit(S, dim, itemId) {
  if (!S.chest || Math.random() > 0.3) return;
  const c = getContainer(getBlock(dim, S.chest));
  if (c) containerAdd(c, itemId, 1);
}
function gatherJob(S, dim, members, marker) {
  scanResources(S, dim);
  // choose current target
  while (!S.gather && S.queue.length) {
    const k = S.queue.shift();
    const b = getBlock(dim, parseKey(k));
    if (b && resourceOf(b.typeId)) S.gather = { k, started: now() };
  }
  if (S.gather) {
    const p = parseKey(S.gather.k);
    const b = getBlock(dim, p);
    const r = b ? resourceOf(b.typeId, S.era || 0) : null;
    if (!r) {
      S.gather = null;
    } else {
      const g = groundAt(dim, p.x, p.z, p.y);
      const site = { x: p.x + 0.5, y: (g === null ? p.y : g + 1), z: p.z + 0.5 };
      moveMarker(marker, site);
      const active = workers(members, site, 5, S.gather.started);
      if (active.length) {
        try {
          b.setType("minecraft:air");
        } catch {}
        S.res[r[0]] += r[1];
        deposit(S, dim, r[2]);
        particle(dim, { x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 }, "minecraft:basic_crit_particle");
        sound(dim, p, r[0] === "wood" ? "dig.wood" : "dig.stone");
        S.gather = null;
        // trees: queue the logs above as well
        for (let dy = 1; dy <= 2; dy++) {
          const up = { x: p.x, y: p.y + dy, z: p.z };
          const ub = getBlock(dim, up);
          if (ub && isLog(ub.typeId)) S.queue.unshift(key(up));
        }
      }
      dirty = true;
      return;
    }
  }
  // mining pit
  if (!S.mine) {
    const mx = S.center.x + 8, mz = S.center.z + 8;
    const g = groundAt(dim, mx, mz, S.center.y);
    if (g === null) return;
    S.mine = { x: mx, y: g, z: mz, i: 0, depth: 0 };
    dirty = true;
  }
  const M = S.mine;
  const gy = groundAt(dim, M.x - 2, M.z - 2, M.y);
  const site = { x: M.x - 1.5, y: (gy === null ? M.y : gy) + 1, z: M.z - 1.5 };
  moveMarker(marker, site);
  const active = workers(members, site, 5, S.founded);
  if (!active.length) return;
  for (let w = 0; w < Math.min(active.length, 2); w++) {
    if (M.depth <= 10) {
      const dx = (M.i % 3) - 1, dz = Math.floor(M.i / 3) - 1;
      const p = { x: M.x + dx, y: M.y - M.depth, z: M.z + dz };
      M.i++;
      if (M.i >= 9) {
        M.i = 0;
        M.depth++;
      }
      const b = getBlock(dim, p);
      if (!b || b.isAir) continue;
      if (b.typeId === "minecraft:bedrock" || b.isLiquid) {
        M.depth = 11;
        continue;
      }
      const r = resourceOf(b.typeId, S.era || 0);
      try {
        b.setType("minecraft:air");
      } catch {}
      if (r) {
        S.res[r[0]] += r[1];
        deposit(S, dim, r[2]);
      }
      sound(dim, p, "dig.stone");
    } else if (Math.random() < 0.35 + 0.15 * (S.era || 0)) {
      S.res.stone += 1;
      if (Math.random() < 0.12 + 0.05 * (S.era || 0)) S.res.iron += 1;
      if (Math.random() < 0.4) particle(dim, site, "minecraft:basic_crit_particle");
      deposit(S, dim, "minecraft:cobblestone");
    }
  }
  dirty = true;
}

// ---------------------------------------------------------------- farming
function farmJob(S, dim, members, marker) {
  const farms = S.buildings.filter((b) => b.type === "farm");
  if (!farms.length) {
    moveMarker(marker, { x: S.center.x + 0.5, y: S.center.y, z: S.center.z + 0.5 });
    return;
  }
  const f = farms[Math.floor(now() / 1200) % farms.length];
  const site = { x: f.x + 3.5, y: f.y + 1, z: f.z - 0.5 };
  moveMarker(marker, site);
  const active = workers(members, site, 6, S.founded);
  if (!active.length) return;
  for (let w = 0; w < Math.min(active.length, 3); w++) {
    const dx = randInt(1, 5), dz = randInt(1, 5);
    if (dx === 3 && dz === 3) continue;
    const p = { x: f.x + dx, y: f.y + 1, z: f.z + dz };
    const b = getBlock(dim, p);
    if (!b) continue;
    if (b.typeId === "minecraft:wheat") {
      const growth = Number(st(b.permutation, "growth") ?? 0);
      if (growth >= 7) {
        setBlock(dim, p, "minecraft:wheat", { growth: 0 });
        S.res.food += 2;
        deposit(S, dim, "minecraft:wheat");
        particle(dim, { x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 });
        sound(dim, p, "dig.grass");
      } else if (Math.random() < 0.25) {
        setBlock(dim, p, "minecraft:wheat", { growth: growth + 1 });
      }
    } else if (b.isAir) {
      const below = getBlock(dim, add(p, DIR.down));
      if (below && below.typeId === "minecraft:farmland") setBlock(dim, p, "minecraft:wheat", { growth: 0 });
      else if (below && (below.typeId === "minecraft:dirt" || below.typeId === "minecraft:grass_block")) setBlock(dim, add(p, DIR.down), "minecraft:farmland", { moisturized_amount: 7 });
    }
  }
  dirty = true;
}

// ---------------------------------------------------------------- traders: stand at the market stalls
function traderJob(S, dim, members, marker) {
  const market = S.buildings.find((b) => b.type === "market");
  const loc = market ? { x: market.x + 3.5, y: market.y + 1, z: market.z + 3.5 } : { x: S.center.x + 0.5, y: S.center.y, z: S.center.z + 0.5 };
  moveMarker(marker, loc);
}

// ---------------------------------------------------------------- warriors, war and diplomacy
function warriorJob(S, dim, members, marker) {
  const enemyId = Object.keys(S.wars)[0];
  const E = enemyId ? civ.settlements[enemyId] : null;
  if (!E) {
    S.warMarker = null;
    const a = (now() / 200) % (Math.PI * 2);
    moveMarker(marker, { x: S.center.x + 0.5 + Math.cos(a) * 6, y: S.center.y, z: S.center.z + 0.5 + Math.sin(a) * 6 });
    return;
  }
  if (!S.warMarker) S.warMarker = { x: S.center.x, y: S.center.y, z: S.center.z };
  const W = S.warMarker;
  const arrived = members.some((m) => {
    const p = entityPos(m.e);
    return p && distXZ(p, W) < 10;
  });
  if (arrived && distXZ(W, E.center) > 2) {
    const d = distXZ(W, E.center);
    const stepLen = Math.min(16, d);
    W.x = Math.round(W.x + ((E.center.x - W.x) / d) * stepLen);
    W.z = Math.round(W.z + ((E.center.z - W.z) / d) * stepLen);
    const g = groundAt(dim, W.x, W.z, W.y);
    W.y = g === null ? W.y : g + 1;
    dirty = true;
  }
  moveMarker(marker, { x: W.x + 0.5, y: W.y, z: W.z + 0.5 });
}
function relationLabel(rel, war, ally) {
  if (war) return "война";
  if (ally) return "союз";
  if (rel <= -25) return "напряжённость";
  return "нейтралитет";
}
function diplomacy() {
  const all = settlements();
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const A = all[i], B = all[j];
      if (A.dim !== B.dim) continue;
      const tick = now();
      if (tick - (A.lastDiplo || 0) < 600 && tick - (B.lastDiplo || 0) < 600) continue;
      let rel = A.rel[B.id] ?? 0;
      let delta = randInt(-6, 6) + (A.temper || 0) + (B.temper || 0);
      const d = distXZ(A.center, B.center);
      if (d < 50) delta -= 3;
      if (A.allies[B.id]) delta += 2;
      rel = Math.max(-100, Math.min(100, rel + delta));
      A.rel[B.id] = rel;
      B.rel[A.id] = rel;
      const war = A.wars[B.id];
      if (war) {
        const duration = tick - war.start;
        const aW = A.warriors || 0, bW = B.warriors || 0;
        if (duration > 4800 || (aW === 0 && bW > 0) || (bW === 0 && aW > 0) || A.pop === 0 || B.pop === 0) {
          const aS = aW * (1 + 0.5 * (A.era || 0)), bS = bW * (1 + 0.5 * (B.era || 0));
          const winner = aS !== bS ? (aS > bS ? A : B) : A.pop >= B.pop ? A : B;
          winner.dev = (winner.dev || 0) + 3;
          const loser = winner === A ? B : A;
          const taken = [];
          for (const r in loser.res) {
            const amt = Math.floor(loser.res[r] * 0.4);
            if (amt > 0) {
              loser.res[r] -= amt;
              winner.res[r] += amt;
              taken.push(`${RES_RU[r]} ×${amt}`);
            }
          }
          delete A.wars[B.id];
          delete B.wars[A.id];
          A.warMarker = null;
          B.warMarker = null;
          A.rel[B.id] = B.rel[A.id] = -10;
          broadcast(tr("mech.civ.tribute", winner.name, loser.name));
          broadcast(tr("mech.civ.peace", A.name, B.name));
        }
      } else if (rel <= -45 && A.pop >= 3 && B.pop >= 3 && d < 160) {
        A.wars[B.id] = { start: tick, aggressor: A.id };
        B.wars[A.id] = { start: tick, aggressor: A.id };
        delete A.allies[B.id];
        delete B.allies[A.id];
        broadcast(tr("mech.civ.war", A.name, B.name));
      } else if (rel >= 50 && !A.allies[B.id]) {
        A.allies[B.id] = true;
        B.allies[A.id] = true;
        broadcast(tr("mech.civ.alliance", A.name, B.name));
      } else if (rel < 20 && A.allies[B.id]) {
        delete A.allies[B.id];
        delete B.allies[A.id];
      }
      // trade between allies
      if (A.allies[B.id] && tick - Math.max(A.lastTrade || 0, B.lastTrade || 0) > 1200) {
        const traded = [];
        for (const r in A.res) {
          if (A.res[r] >= 30 && B.res[r] < 10) {
            A.res[r] -= 10;
            B.res[r] += 10;
            traded.push(`${RES_RU[r]} ×10`);
          } else if (B.res[r] >= 30 && A.res[r] < 10) {
            B.res[r] -= 10;
            A.res[r] += 10;
            traded.push(`${RES_RU[r]} ×10`);
          }
        }
        if (traded.length) {
          A.lastTrade = B.lastTrade = tick;
          A.dev = (A.dev || 0) + 2;
          B.dev = (B.dev || 0) + 2;
          A.rel[B.id] = B.rel[A.id] = Math.min(100, rel + 5);
          broadcast(tr("mech.civ.trade", A.name, B.name, traded.join(", ")));
        }
      }
      dirty = true;
    }
  }
  for (const S of all) S.lastDiplo = now();
}

// ---------------------------------------------------------------- growth
function capacity(S) {
  return Math.min(ERAS[Math.min(3, S.era || 0)].cap, 3 + 2 * S.buildings.filter((b) => b.type === "house").length);
}

// ---------------------------------------------------------------- eras (civilization progress)
function eraProgress(S, members) {
  const era = S.era || 0;
  // development points: a prosperous settlement develops over time
  if (now() - (S.lastDev || 0) >= 1200) {
    S.lastDev = now();
    if (S.res.food >= 20) S.dev = (S.dev || 0) + 1;
    if (S.buildings.some((b) => b.type === "library")) S.dev = (S.dev || 0) + 2;
    dirty = true;
  }
  // market caravans bring goods
  if (S.buildings.some((b) => b.type === "market") && now() - (S.lastCaravan || 0) >= 2400) {
    S.lastCaravan = now();
    const r = pick(["wood", "stone", "food", "iron"]);
    const amt = r === "iron" ? 3 : 8;
    S.res[r] += amt;
    S.dev = (S.dev || 0) + 1;
    broadcast(tr("mech.civ.caravan", S.name, `${RES_RU[r]} ×${amt}`));
    dirty = true;
  }
  if (era >= ERAS.length - 1) return;
  const req = ERA_REQ[era + 1];
  const has = (t) => S.buildings.filter((b) => b.type === t).length;
  if (members.length < req.pop || (S.dev || 0) < req.dev || has("house") < req.houses) return;
  if (!req.buildings.every((t) => has(t) > 0)) return;
  S.era = era + 1;
  dirty = true;
  broadcast(tr("mech.civ.era", S.name, ERAS[S.era].ru));
  for (const m of members) applyRole(m.e, S, m.role);
}
function growth(S, dim, members) {
  if (S.res.food < 10 || members.length >= capacity(S) || members.length >= MAX_POP) return;
  if (!S.buildings.some((b) => b.type === "town_hall")) return;
  const loc = { x: S.center.x + 0.5 + randInt(-3, 3), y: S.center.y + 1, z: S.center.z + 0.5 + randInt(-3, 3) };
  let e;
  try {
    e = dim.spawnEntity(`${NS}:colonist`, loc);
  } catch {
    return;
  }
  S.res.food -= 10;
  const want = desiredRoles(members.length + 1, S);
  const have = roleCounts(S);
  let role = "gatherer";
  for (const r of ["gatherer", "builder", "warrior", "farmer", "trader"]) {
    if ((have[r] || 0) < want[r]) {
      role = r;
      break;
    }
  }
  applyRole(e, S, role);
  S.pop = members.length + 1;
  particle(dim, loc, "minecraft:heart_particle");
  broadcast(tr("mech.civ.born", S.name, S.pop));
  dirty = true;
}

// ---------------------------------------------------------------- main tick (every 20 ticks)
let tickNo = 0;
export function civTick() {
  if (!load()) return;
  tickNo++;
  const byClan = new Map();
  for (const dimId of DIM_IDS) {
    const dim = safeDimension(dimId);
    if (!dim) continue;
    let ents = [];
    try {
      ents = dim.getEntities({ type: `${NS}:colonist` });
    } catch {
      continue;
    }
    for (const e of ents) {
      let clan = prop(e, `${NS}:clan`);
      let S = clan !== undefined ? civ.settlements[clan] : undefined;
      if (!S) {
        S = assignColonist(e);
        if (!S) continue;
        clan = S.id;
      }
      let role = prop(e, `${NS}:role`);
      if (!ROLES.includes(role)) {
        role = "gatherer";
        applyRole(e, S, role);
      }
      if (!byClan.has(clan)) byClan.set(clan, []);
      byClan.get(clan).push({ e, role });
    }
  }
  liveCounts.clear();
  for (const S of settlements()) {
    const members = byClan.get(S.id) || [];
    const counts = { builder: 0, gatherer: 0, farmer: 0, warrior: 0, trader: 0 };
    for (const m of members) counts[m.role] = (counts[m.role] || 0) + 1;
    liveCounts.set(S.id, counts);
    S.warriors = counts.warrior;
    const dim = safeDimension(S.dim);
    if (!dim) continue;
    const loaded = getBlock(dim, S.center) !== undefined;
    if (!loaded) continue;
    if (!members.length) {
      if (!S.emptySince) S.emptySince = now();
      else if (now() - S.emptySince > 3600) removeSettlement(S);
      continue;
    }
    S.emptySince = null;
    S.pop = members.length;
    try {
      rebalance(S, members);
      updateTags(S, members);
      const markers = ensureMarkers(S, dim);
      const by = (r) => members.filter((m) => m.role === r);
      builderJob(S, dim, by("builder"), markers.builder, members.length);
      gatherJob(S, dim, by("gatherer"), markers.gatherer);
      farmJob(S, dim, by("farmer"), markers.farmer);
      warriorJob(S, dim, by("warrior"), markers.warrior);
      traderJob(S, dim, by("trader"), markers.trader);
      if (tickNo % 5 === 0) growth(S, dim, members);
      if (tickNo % 15 === 7) eraProgress(S, members);
    } catch (e) {
      console.warn(`[mech] settlement ${S.name} tick failed: ${e}`);
    }
  }
  if (tickNo % 30 === 0) diplomacy();
  save(false);
}

export function getCiv() {
  load();
  return civ;
}

export function describeColonist(player, entity) {
  if (!load()) return;
  const S = civ.settlements[prop(entity, `${NS}:clan`)];
  if (!S) return;
  const role = prop(entity, `${NS}:role`) || "gatherer";
  tell(player, tr("mech.civ.info", S.name, S.pop, S.res.wood, S.res.stone, S.res.food, S.res.iron, S.buildings.length));
  const nextReq = ERA_REQ[(S.era || 0) + 1];
  tell(player, tr("mech.civ.info_era", ERAS[Math.min(3, S.era || 0)].ru, S.dev || 0, nextReq ? `${nextReq.dev} (население ${nextReq.pop}+, ${nextReq.buildings.map((t) => BLD_RU[t]).join(", ")})` : "—"));
  const rels = settlements().filter((O) => O.id !== S.id && O.dim === S.dim).map((O) => `${O.name}: ${relationLabel(S.rel[O.id] ?? 0, !!S.wars[O.id], !!S.allies[O.id])}`);
  tell(player, tr("mech.civ.info_role", ROLE_RU[role], rels.length ? rels.join(", ") : "-"));
}

export function startCiv() {
  system.runInterval(() => {
    try {
      civTick();
    } catch (e) {
      console.warn(`[mech] civ tick failed: ${e}`);
    }
  }, 20);
  try {
    world.afterEvents.playerInteractWithEntity.subscribe((ev) => {
      if (ev.target?.typeId !== `${NS}:colonist`) return;
      let sneaking = false;
      try {
        sneaking = !!ev.player.isSneaking;
      } catch {}
      if (sneaking) describeColonist(ev.player, ev.target);
    });
  } catch {}
}

// Automation: mine driller, tunnel borer, logistics node, processing factory.
import {
  NS, DIR, OPP, HORIZONTAL, add, key, parseKey, center, dist, getBlock, tr, actionbar, spawnItems,
  adjacentContainers, containerAdd, containerTake, containerCount, getContainer, MachineState, now, prettyId,
} from "./common.js";
import { defineKinetic, mem, facingOf, UNBREAKABLE } from "./kinetics.js";

// ---------------------------------------------------------------- what a dug block yields (no drop entities: items go straight to the buffer)
const YIELD = {
  "minecraft:stone": ["minecraft:cobblestone", 1],
  "minecraft:deepslate": ["minecraft:cobbled_deepslate", 1],
  "minecraft:grass_block": ["minecraft:dirt", 1],
  "minecraft:dirt_with_roots": ["minecraft:dirt", 1],
  "minecraft:podzol": ["minecraft:dirt", 1],
  "minecraft:mycelium": ["minecraft:dirt", 1],
  "minecraft:iron_ore": ["minecraft:raw_iron", 1],
  "minecraft:deepslate_iron_ore": ["minecraft:raw_iron", 1],
  "minecraft:copper_ore": ["minecraft:raw_copper", 3],
  "minecraft:deepslate_copper_ore": ["minecraft:raw_copper", 3],
  "minecraft:gold_ore": ["minecraft:raw_gold", 1],
  "minecraft:deepslate_gold_ore": ["minecraft:raw_gold", 1],
  "minecraft:coal_ore": ["minecraft:coal", 1],
  "minecraft:deepslate_coal_ore": ["minecraft:coal", 1],
  "minecraft:diamond_ore": ["minecraft:diamond", 1],
  "minecraft:deepslate_diamond_ore": ["minecraft:diamond", 1],
  "minecraft:emerald_ore": ["minecraft:emerald", 1],
  "minecraft:deepslate_emerald_ore": ["minecraft:emerald", 1],
  "minecraft:lapis_ore": ["minecraft:lapis_lazuli", 5],
  "minecraft:deepslate_lapis_ore": ["minecraft:lapis_lazuli", 5],
  "minecraft:redstone_ore": ["minecraft:redstone", 4],
  "minecraft:deepslate_redstone_ore": ["minecraft:redstone", 4],
  "minecraft:lit_redstone_ore": ["minecraft:redstone", 4],
  "minecraft:nether_gold_ore": ["minecraft:gold_nugget", 4],
  "minecraft:quartz_ore": ["minecraft:quartz", 1],
  "minecraft:ancient_debris": ["minecraft:ancient_debris", 1],
  "mech:zinc_ore": ["mech:raw_zinc", 1],
  "mech:deepslate_zinc_ore": ["mech:raw_zinc", 1],
  "minecraft:clay": ["minecraft:clay_ball", 4],
  "minecraft:gravel": ["minecraft:gravel", 1],
  "minecraft:glowstone": ["minecraft:glowstone_dust", 3],
  "minecraft:snow_layer": null,
  "minecraft:snow": ["minecraft:snowball", 4],
  "minecraft:glass": null,
  "minecraft:ice": null,
  "minecraft:web": ["minecraft:string", 1],
  "minecraft:tallgrass": null,
  "minecraft:short_grass": null,
  "minecraft:fern": null,
  "minecraft:seagrass": null,
  "minecraft:kelp": null,
  "minecraft:bedrock": null,
  "minecraft:water": null,
  "minecraft:flowing_water": null,
  "minecraft:lava": null,
  "minecraft:flowing_lava": null,
  "minecraft:air": null,
  "minecraft:fire": null,
  "minecraft:torch": ["minecraft:torch", 1],
  "minecraft:spawner": null,
  "minecraft:mob_spawner": null,
  "minecraft:infested_stone": null,
};
function yieldOf(typeId) {
  if (typeId in YIELD) return YIELD[typeId];
  if (typeId.endsWith("_leaves") || typeId.endsWith("_flower") || typeId.endsWith("_sapling") || typeId.includes("vine") || typeId.includes("_carpet")) return null;
  return [typeId, 1]; // most blocks are their own item
}
const BUFFER_CAP = 640;

function bufferTotal(buf) {
  let n = 0;
  for (const id in buf) n += buf[id];
  return n;
}
/** Digs one block into the machine buffer. Returns true if a block was removed. */
function digInto(dim, pos, buf) {
  const b = getBlock(dim, pos);
  if (!b || b.isAir) return false;
  if (UNBREAKABLE.has(b.typeId)) return false;
  const y = b.isLiquid ? null : yieldOf(b.typeId);
  try {
    b.setType("minecraft:air");
  } catch {
    return false;
  }
  if (y) buf[y[0]] = (buf[y[0]] || 0) + y[1];
  return true;
}
function flushBuffer(dim, pos, buf, excludeFaces = []) {
  const containers = adjacentContainers(dim, pos, excludeFaces);
  if (!containers.length) return false;
  for (const id of Object.keys(buf)) {
    let left = buf[id];
    for (const c of containers) {
      if (left <= 0) break;
      left = containerAdd(c, id, left);
    }
    if (left <= 0) delete buf[id];
    else buf[id] = left;
  }
  return true;
}
function bufferSummary(buf) {
  const parts = Object.entries(buf).slice(0, 4).map(([id, c]) => `${prettyId(id)} ×${c}`);
  return parts.length ? parts.join(", ") : "-";
}

// ---------------------------------------------------------------- mine driller: 3x3 shaft straight down
const DRILLER_MIN_Y = -60;
defineKinetic(`${NS}:mine_driller`, {
  axis: () => "y",
  faces: () => ["up"],
  impact: 16,
  tick(n, speed) {
    const s = MachineState.load(n.dimId, n.pos);
    if (s.y === undefined) {
      s.y = n.pos.y - 1;
      s.i = 0;
      s.buf = {};
    }
    s.buf = s.buf || {};
    let changed = false;
    if (bufferTotal(s.buf) > 0 && flushBuffer(n.dim, n.pos, s.buf, ["down"])) changed = true;
    if (speed && !s.done && bufferTotal(s.buf) < BUFFER_CAP) {
      const m = mem(n.dimId, n.pos);
      m.progress = (m.progress || 0) + Math.abs(speed);
      let steps = 0;
      while (m.progress >= 24 && steps < 6 && !s.done) {
        if (s.y < DRILLER_MIN_Y) {
          s.done = true;
          break;
        }
        const dx = (s.i % 3) - 1;
        const dz = Math.floor(s.i / 3) - 1;
        const target = { x: n.pos.x + dx, y: s.y, z: n.pos.z + dz };
        const b = getBlock(n.dim, target);
        if (!b) break; // not loaded yet
        if (b.typeId === "minecraft:bedrock") {
          s.done = true;
          break;
        }
        const removed = digInto(n.dim, target, s.buf);
        if (removed) {
          m.progress -= 24;
          steps++;
        }
        s.i++;
        if (s.i >= 9) {
          s.i = 0;
          s.y--;
        }
        changed = true;
      }
    }
    if (changed) MachineState.save(n.dimId, n.pos, s);
  },
  status(ctx) {
    const s = MachineState.load(ctx.dimId, ctx.pos);
    const extra = adjacentContainers(ctx.dim, ctx.pos, ["down"]).length ? "" : " §c⚠";
    return { rawtext: [{ translate: "mech.msg.driller", with: [String(s.y ?? ctx.pos.y - 1), bufferSummary(s.buf || {}) + (s.done ? " §7(done)" : "") + extra] }] };
  },
  drop(dim, pos) {
    const s = MachineState.load(dim.id, pos);
    for (const id in s.buf || {}) spawnItems(dim, center(pos), id, s.buf[id]);
  },
});

// ---------------------------------------------------------------- tunnel borer: 3x3 tunnel ahead, levelled floor, torches
const BORER_RANGE = 64;
function rightOf(face) {
  return { north: "east", east: "south", south: "west", west: "north" }[face] || "east";
}
defineKinetic(`${NS}:tunnel_borer`, {
  axis: (p) => (HORIZONTAL.includes(facingOf(p)) ? ({ north: "z", south: "z", east: "x", west: "x" })[facingOf(p)] : "z"),
  faces: (p) => [OPP[HORIZONTAL.includes(facingOf(p)) ? facingOf(p) : "north"]],
  impact: 16,
  tick(n, speed) {
    const facing = HORIZONTAL.includes(facingOf(n.perm)) ? facingOf(n.perm) : "north";
    const fwd = DIR[facing];
    const right = DIR[rightOf(facing)];
    const s = MachineState.load(n.dimId, n.pos);
    if (s.d === undefined) {
      s.d = 1;
      s.i = 0;
      s.buf = {};
    }
    s.buf = s.buf || {};
    let changed = false;
    if (bufferTotal(s.buf) > 0 && flushBuffer(n.dim, n.pos, s.buf, [facing])) changed = true;
    if (speed && !s.done && bufferTotal(s.buf) < BUFFER_CAP) {
      const m = mem(n.dimId, n.pos);
      m.progress = (m.progress || 0) + Math.abs(speed);
      let steps = 0;
      while (m.progress >= 24 && steps < 6 && !s.done) {
        if (s.d > BORER_RANGE) {
          s.done = true;
          break;
        }
        const base = add(n.pos, fwd, s.d);
        if (s.i < 9) {
          const dx = (s.i % 3) - 1;
          const dy = Math.floor(s.i / 3);
          const target = { x: base.x + right.x * dx, y: base.y + dy, z: base.z + right.z * dx };
          const b = getBlock(n.dim, target);
          if (!b) break;
          if (digInto(n.dim, target, s.buf)) {
            m.progress -= 24;
            steps++;
          }
          s.i++;
        } else {
          // floor levelling + lighting for this slice
          for (let dx = -1; dx <= 1; dx++) {
            const fp = { x: base.x + right.x * dx, y: base.y - 1, z: base.z + right.z * dx };
            const fb = getBlock(n.dim, fp);
            if (fb && (fb.isAir || fb.isLiquid)) {
              try {
                fb.setType("minecraft:cobblestone");
              } catch {}
            }
          }
          if (s.d % 6 === 0) {
            const tp = { x: base.x + right.x, y: base.y, z: base.z + right.z };
            const tb = getBlock(n.dim, tp);
            if (tb && tb.isAir) {
              try {
                tb.setType("minecraft:torch");
              } catch {}
            }
          }
          m.progress -= 24;
          steps++;
          s.i = 0;
          s.d++;
        }
        changed = true;
      }
    }
    if (changed) MachineState.save(n.dimId, n.pos, s);
  },
  status(ctx) {
    const s = MachineState.load(ctx.dimId, ctx.pos);
    return tr("mech.msg.borer", Math.min(s.d ?? 0, BORER_RANGE), BORER_RANGE, bufferSummary(s.buf || {}) + (s.done ? " §7(done)" : ""));
  },
  drop(dim, pos) {
    const s = MachineState.load(dim.id, pos);
    for (const id in s.buf || {}) spawnItems(dim, center(pos), id, s.buf[id]);
  },
});

// ---------------------------------------------------------------- processing factory
const SMELT = {
  "minecraft:raw_iron": "minecraft:iron_ingot",
  "minecraft:raw_copper": "minecraft:copper_ingot",
  "minecraft:raw_gold": "minecraft:gold_ingot",
  "mech:raw_zinc": "mech:zinc_ingot",
  "mech:crushed_iron": "minecraft:iron_ingot",
  "mech:crushed_copper": "minecraft:copper_ingot",
  "mech:crushed_gold": "minecraft:gold_ingot",
  "mech:crushed_zinc": "mech:zinc_ingot",
  "minecraft:iron_ore": "minecraft:iron_ingot",
  "minecraft:deepslate_iron_ore": "minecraft:iron_ingot",
  "minecraft:gold_ore": "minecraft:gold_ingot",
  "minecraft:copper_ore": "minecraft:copper_ingot",
  "mech:zinc_ore": "mech:zinc_ingot",
  "mech:deepslate_zinc_ore": "mech:zinc_ingot",
  "minecraft:cobblestone": "minecraft:stone",
  "minecraft:sand": "minecraft:glass",
  "minecraft:clay_ball": "minecraft:brick",
  "minecraft:clay": "minecraft:hardened_clay",
  "minecraft:cobbled_deepslate": "minecraft:deepslate",
  "minecraft:netherrack": "minecraft:netherbrick",
  "minecraft:ancient_debris": "minecraft:netherite_scrap",
  "minecraft:potato": "minecraft:baked_potato",
  "minecraft:beef": "minecraft:cooked_beef",
  "minecraft:porkchop": "minecraft:cooked_porkchop",
  "minecraft:chicken": "minecraft:cooked_chicken",
  "minecraft:mutton": "minecraft:cooked_mutton",
  "minecraft:cod": "minecraft:cooked_cod",
  "minecraft:salmon": "minecraft:cooked_salmon",
  "mech:dough": "minecraft:bread",
};
const TOOLS = [
  { out: "minecraft:iron_pickaxe", need: { "minecraft:iron_ingot": 3, "minecraft:stick": 2 } },
  { out: "minecraft:iron_sword", need: { "minecraft:iron_ingot": 2, "minecraft:stick": 1 } },
  { out: "minecraft:iron_axe", need: { "minecraft:iron_ingot": 3, "minecraft:stick": 2 } },
  { out: "minecraft:iron_shovel", need: { "minecraft:iron_ingot": 1, "minecraft:stick": 2 } },
  { out: "minecraft:iron_hoe", need: { "minecraft:iron_ingot": 2, "minecraft:stick": 2 } },
  { out: "minecraft:stone_pickaxe", need: { "minecraft:cobblestone": 3, "minecraft:stick": 2 } },
  { out: "minecraft:stone_sword", need: { "minecraft:cobblestone": 2, "minecraft:stick": 1 } },
  { out: "minecraft:stone_axe", need: { "minecraft:cobblestone": 3, "minecraft:stick": 2 } },
  { out: "minecraft:torch", count: 4, need: { "minecraft:coal": 1, "minecraft:stick": 1 } },
  { out: "mech:andesite_alloy", count: 2, need: { "minecraft:andesite": 2, "minecraft:iron_nugget": 2 } },
];
const MODES = ["mech.mode.auto", "mech.mode.smelt", "mech.mode.craft"];
const INGREDIENTS = new Set(TOOLS.flatMap((t) => Object.keys(t.need)).filter((id) => id !== "minecraft:cobblestone"));

function countIn(containers, id) {
  let n = 0;
  for (const c of containers) n += containerCount(c, id);
  return n;
}
function takeFrom(containers, id, count) {
  let need = count;
  for (const c of containers) {
    if (need <= 0) break;
    need -= containerTake(c, id, need);
  }
  return count - need;
}
function emit(n, outContainer, id, count) {
  let left = count;
  if (outContainer) left = containerAdd(outContainer, id, count);
  if (left > 0) spawnItems(n.dim, add(center(n.pos), DIR.up, 0.7), id, left);
}
function factoryOnce(n, inputs, out, mode) {
  // 1) smelting
  if (mode !== 2) {
    for (const c of inputs) {
      try {
        for (let i = 0; i < c.size; i++) {
          const it = c.getItem(i);
          if (!it || !SMELT[it.typeId]) continue;
          containerTake(c, it.typeId, 1);
          const product = SMELT[it.typeId];
          // in auto mode, ingredients for tools stay in the input chest so they can be crafted next
          if (mode === 0 && INGREDIENTS.has(product)) {
            const left = containerAdd(c, product, 1);
            if (left > 0) emit(n, out, product, left);
          } else emit(n, out, product, 1);
          return true;
        }
      } catch {}
    }
  }
  if (mode === 1) return false;
  // 2) tools, round robin
  const m = mem(n.dimId, n.pos);
  m.rr = (m.rr || 0) % TOOLS.length;
  for (let t = 0; t < TOOLS.length; t++) {
    const r = TOOLS[(m.rr + t) % TOOLS.length];
    if (Object.entries(r.need).every(([id, c]) => countIn(inputs, id) >= c)) {
      for (const [id, c] of Object.entries(r.need)) takeFrom(inputs, id, c);
      emit(n, out, r.out, r.count || 1);
      m.rr = (m.rr + t + 1) % TOOLS.length;
      return true;
    }
  }
  // 3) intermediate: sticks from planks, planks from logs
  if (countIn(inputs, "minecraft:stick") < 8) {
    for (const c of inputs) {
      try {
        for (let i = 0; i < c.size; i++) {
          const it = c.getItem(i);
          if (it && it.typeId.endsWith("_planks") && it.amount >= 2) {
            containerTake(c, it.typeId, 2);
            const left = containerAdd(c, "minecraft:stick", 4); // sticks stay in the input chest for tool crafting
            if (left > 0) emit(n, out, "minecraft:stick", left);
            return true;
          }
        }
      } catch {}
    }
    for (const c of inputs) {
      try {
        for (let i = 0; i < c.size; i++) {
          const it = c.getItem(i);
          if (it && (it.typeId.endsWith("_log") || it.typeId.endsWith("_stem"))) {
            containerTake(c, it.typeId, 1);
            const planks = it.typeId.endsWith("_stem") ? it.typeId.replace("_stem", "_planks") : it.typeId.replace("_log", "_planks");
            const left = containerAdd(c, planks, 4); // planks stay in the input chest for the next step
            if (left > 0) emit(n, out, planks, left);
            return true;
          }
        }
      } catch {}
    }
  }
  return false;
}
defineKinetic(`${NS}:factory`, {
  axis: () => "y",
  faces: () => ["up"],
  impact: 16,
  tick(n, speed) {
    if (!speed) return;
    const m = mem(n.dimId, n.pos);
    m.progress = (m.progress || 0) + Math.abs(speed);
    if (m.progress < 48) return;
    const facing = facingOf(n.perm);
    const out = getContainer(getBlock(n.dim, add(n.pos, DIR[facing])));
    const inputs = adjacentContainers(n.dim, n.pos, [facing]);
    if (!inputs.length) {
      m.progress = 48;
      return;
    }
    const s = MachineState.load(n.dimId, n.pos);
    let ops = 0;
    while (m.progress >= 48 && ops < 3) {
      if (!factoryOnce(n, inputs, out, s.mode || 0)) {
        m.progress = 48;
        break;
      }
      m.progress -= 48;
      ops++;
      s.count = (s.count || 0) + 1;
    }
    if (ops) {
      MachineState.save(n.dimId, n.pos, s);
      try {
        n.dim.playSound("random.anvil_use", center(n.pos), { volume: 0.25, pitch: 0.8 });
      } catch {}
    }
  },
  wrench(ctx) {
    const s = MachineState.load(ctx.dimId, ctx.pos);
    s.mode = ((s.mode || 0) + 1) % MODES.length;
    MachineState.save(ctx.dimId, ctx.pos, s);
    actionbar(ctx.player, { rawtext: [{ translate: "mech.msg.factory_mode", with: { rawtext: [{ translate: MODES[s.mode] }] } }] });
  },
  status(ctx) {
    const s = MachineState.load(ctx.dimId, ctx.pos);
    return { rawtext: [{ translate: "mech.msg.factory", with: { rawtext: [{ translate: MODES[s.mode || 0] }, { text: String(s.count || 0) }] } }] };
  },
});

// ---------------------------------------------------------------- logistics node: moves items from the container behind it to a linked container
const LINK_RANGE = 48;
const pendingLinks = new Map(); // playerId -> {dimId, pos, at}

defineKinetic(`${NS}:logistics_node`, {
  passive: true,
  tick(n, _speed, counter) {
    if (counter % 2 !== 0) return; // once per second
    const s = MachineState.load(n.dimId, n.pos);
    if (!s.target) return;
    const facing = facingOf(n.perm);
    let src = getContainer(getBlock(n.dim, add(n.pos, DIR[OPP[facing]])));
    if (!src) src = adjacentContainers(n.dim, n.pos, [facing])[0];
    if (!src) return;
    const tb = getBlock(n.dim, parseKey(s.target));
    if (!tb) return;
    const dst = getContainer(tb);
    if (!dst) return;
    let moved = 0;
    try {
      for (let i = 0; i < src.size && moved < 8; i++) {
        const it = src.getItem(i);
        if (!it) continue;
        const take = Math.min(it.amount, 8 - moved);
        const left = containerAdd(dst, it.typeId, take);
        const really = take - left;
        if (really <= 0) continue;
        containerTake(src, it.typeId, really);
        moved += really;
      }
    } catch {}
    if (moved) {
      s.moved = (s.moved || 0) + moved;
      MachineState.save(n.dimId, n.pos, s);
    }
  },
  wrench(ctx) {
    pendingLinks.set(ctx.player.id, { dimId: ctx.dimId, pos: ctx.pos, at: now() });
    actionbar(ctx.player, tr("mech.msg.link_start"));
  },
  interact(ctx) {
    const s = MachineState.load(ctx.dimId, ctx.pos);
    if (!s.target) actionbar(ctx.player, tr("mech.msg.link_none"));
    else {
      const t = parseKey(s.target);
      actionbar(ctx.player, tr("mech.msg.link_info", t.x, t.y, t.z, s.moved || 0));
    }
    return true;
  },
});

export function handleLinkClick(player, block) {
  const p = pendingLinks.get(player.id);
  if (!p) return false;
  if (now() - p.at > 20 * 60) {
    pendingLinks.delete(player.id);
    return false;
  }
  if (!getContainer(block)) return false;
  pendingLinks.delete(player.id);
  if (block.dimension.id !== p.dimId || dist(block.location, p.pos) > LINK_RANGE) {
    actionbar(player, tr("mech.msg.link_far", LINK_RANGE));
    return true;
  }
  const s = MachineState.load(p.dimId, p.pos);
  s.target = key(block.location);
  MachineState.save(p.dimId, p.pos, s);
  actionbar(player, tr("mech.msg.link_done", block.location.x, block.location.y, block.location.z));
  return true;
}

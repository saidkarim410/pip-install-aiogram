// Mechanical belts (move item entities) and funnels (load/unload containers).
import { system } from "@minecraft/server";
import {
  NS, DIR, OPP, HORIZONTAL, AXIS_FACES, add, key, center, getBlock, actionbar, spawnItems, getContainer, containerAdd, MachineState, safeDimension,
} from "./common.js";
import { defineKinetic, beltNodes, facingOf, MILL, mem } from "./kinetics.js";

const BELT = `${NS}:mechanical_belt`;
const FUNNEL = `${NS}:funnel`;
const BELT_TOP = 0.3;

function horizontalFacing(p) {
  const f = facingOf(p);
  return HORIZONTAL.includes(f) ? f : "north";
}
function beltAxis(p) {
  const f = horizontalFacing(p);
  return f === "north" || f === "south" ? "x" : "z";
}

// ---------------------------------------------------------------- belt block definition
defineKinetic(BELT, {
  belt: true,
  impact: 1,
  axis: beltAxis,
  faces: (p) => AXIS_FACES[beltAxis(p)],
  chain: (p) => [horizontalFacing(p), OPP[horizontalFacing(p)]],
});

function stackOf(e) {
  try {
    return e.getComponent("minecraft:item")?.itemStack;
  } catch {
    return undefined;
  }
}
function removeEntity(e) {
  try {
    e.remove();
  } catch {}
}
function placeItem(dim, e, loc) {
  try {
    e.teleport(loc);
    e.clearVelocity();
  } catch {}
}
/** Tries to hand the item entity to the block it is about to enter. Returns true if the entity was consumed. */
function deliver(dim, e, stack, nextPos, nextBlock) {
  const t = nextBlock.typeId;
  const cont = getContainer(nextBlock);
  if (cont) {
    const left = containerAdd(cont, stack.typeId, stack.amount);
    if (left === stack.amount) return false; // full: wait on the belt
    removeEntity(e);
    if (left > 0) {
      const ent = spawnItems(dim, add(center(nextPos), DIR.up, 0.3), stack.typeId, left);
      try {
        ent?.clearVelocity();
      } catch {}
    }
    return true;
  }
  if (t === `${NS}:millstone` && MILL[stack.typeId]) {
    const s = MachineState.load(dim.id, nextPos);
    if (s.input && s.input.id !== stack.typeId) return false;
    const have = s.input?.count || 0;
    const moved = Math.min(64 - have, stack.amount);
    if (moved <= 0) return false;
    s.input = { id: stack.typeId, count: have + moved };
    MachineState.save(dim.id, nextPos, s);
    removeEntity(e);
    if (stack.amount - moved > 0) spawnItems(dim, add(center(nextPos), DIR.up, 0.7), stack.typeId, stack.amount - moved);
    return true;
  }
  if (t === `${NS}:depot`) {
    placeItem(dim, e, { x: nextPos.x + 0.5, y: nextPos.y + 0.8, z: nextPos.z + 0.5 });
    return true;
  }
  if (t === `${NS}:basin`) {
    placeItem(dim, e, { x: nextPos.x + 0.5, y: nextPos.y + 0.3, z: nextPos.z + 0.5 });
    return true;
  }
  return false;
}
function isPassable(b) {
  const t = b.typeId;
  return b.isAir || b.isLiquid || t === BELT || t === FUNNEL || t.endsWith("_slab") || t.includes("torch") || t.includes("carpet") || t.includes("pressure_plate") || t.endsWith("_sign") || t.includes("rail");
}

/** Called every 2 ticks: moves every loaded item entity that rests on a powered belt. */
function moveBeltItems() {
  for (const [dimId, belts] of beltNodes) {
    if (!belts.size) continue;
    const dim = safeDimension(dimId);
    if (!dim) continue;
    let items;
    try {
      items = dim.getEntities({ type: "minecraft:item" });
    } catch {
      continue;
    }
    for (const e of items) {
      let loc;
      try {
        loc = e.location;
      } catch {
        continue;
      }
      const pos = { x: Math.floor(loc.x), y: Math.floor(loc.y - 0.05), z: Math.floor(loc.z) };
      const belt = belts.get(key(pos));
      if (!belt || !belt.speed) continue;
      const stack = stackOf(e);
      if (!stack) continue;
      const sign = belt.speed > 0 ? 1 : -1;
      const d = DIR[belt.facing];
      const bps = 0.6 + Math.min(32, Math.abs(belt.speed)) / 32; // blocks per second
      const step = bps / 10;
      // keep the item on the centre line of the belt
      const alongX = d.x !== 0;
      let nx = alongX ? loc.x + d.x * sign * step : loc.x + (pos.x + 0.5 - loc.x) * 0.3;
      let nz = alongX ? loc.z + (pos.z + 0.5 - loc.z) * 0.3 : loc.z + d.z * sign * step;
      const ny = pos.y + BELT_TOP;
      const nextPos = { x: Math.floor(nx), y: pos.y, z: Math.floor(nz) };
      if (nextPos.x !== pos.x || nextPos.z !== pos.z) {
        const nb = getBlock(dim, nextPos);
        if (!nb) continue;
        if (nb.typeId !== BELT) {
          if (deliver(dim, e, stack, nextPos, nb)) continue;
          if (!isPassable(nb)) {
            // blocked: park the item at the edge of the belt
            const ex = alongX ? pos.x + 0.5 + d.x * sign * 0.45 : pos.x + 0.5;
            const ez = alongX ? pos.z + 0.5 : pos.z + 0.5 + d.z * sign * 0.45;
            placeItem(dim, e, { x: ex, y: ny, z: ez });
            continue;
          }
        }
      }
      placeItem(dim, e, { x: nx, y: ny, z: nz });
    }
  }
}

// ---------------------------------------------------------------- funnel
const FUNNEL_MODES = ["mech.mode.funnel_in", "mech.mode.funnel_out"];
function itemsInBlock(dim, pos) {
  let ents = [];
  try {
    ents = dim.getEntities({ type: "minecraft:item", location: center(pos), maxDistance: 1.3 });
  } catch {
    return [];
  }
  return ents.filter((e) => {
    const l = e.location;
    return Math.floor(l.x) === pos.x && Math.floor(l.z) === pos.z && l.y >= pos.y - 0.3 && l.y < pos.y + 1.2;
  });
}
defineKinetic(FUNNEL, {
  passive: true,
  tick(n, _speed, counter) {
    const facing = facingOf(n.perm);
    const back = add(n.pos, DIR[OPP[facing]]);
    const target = getBlock(n.dim, back);
    if (!target) return;
    const s = MachineState.load(n.dimId, n.pos);
    const cont = getContainer(target);
    const m = mem(n.dimId, n.pos);
    if (!s.mode) {
      // loading: everything that lands inside the funnel goes into the container behind it
      for (const e of itemsInBlock(n.dim, n.pos)) {
        const st = stackOf(e);
        if (!st) continue;
        if (cont) {
          const left = containerAdd(cont, st.typeId, st.amount);
          if (left === st.amount) continue;
          removeEntity(e);
          if (left > 0) spawnItems(n.dim, center(n.pos), st.typeId, left);
          m.moved = (m.moved || 0) + st.amount - left;
        } else if (target.typeId === `${NS}:millstone` && MILL[st.typeId]) {
          if (deliver(n.dim, e, st, back, target)) m.moved = (m.moved || 0) + st.amount;
        }
      }
      return;
    }
    // unloading: one small stack per second into the block in front
    if (counter % 2 !== 0) return;
    const frontPos = add(n.pos, DIR[facing]);
    const front = getBlock(n.dim, frontPos);
    if (!front || !isPassable(front)) return;
    if (itemsInBlock(n.dim, frontPos).length >= 2) return; // do not flood the belt
    let id = null;
    let count = 0;
    if (cont) {
      try {
        for (let i = 0; i < cont.size; i++) {
          const it = cont.getItem(i);
          if (!it) continue;
          id = it.typeId;
          count = Math.min(8, it.amount);
          if (it.amount - count <= 0) cont.setItem(i, undefined);
          else {
            const c = it.clone();
            c.amount = it.amount - count;
            cont.setItem(i, c);
          }
          break;
        }
      } catch {}
    } else if (target.typeId === `${NS}:millstone`) {
      const ms = MachineState.load(n.dimId, back);
      const entry = Object.entries(ms.out || {}).find(([, c]) => c > 0);
      if (entry) {
        id = entry[0];
        count = Math.min(8, entry[1]);
        ms.out[id] -= count;
        if (ms.out[id] <= 0) delete ms.out[id];
        MachineState.save(n.dimId, back, ms);
      }
    }
    if (!id || count <= 0) return;
    const dropAt = front.typeId === BELT ? { x: frontPos.x + 0.5, y: frontPos.y + BELT_TOP + 0.05, z: frontPos.z + 0.5 } : add(center(frontPos), DIR.up, 0.1);
    const ent = spawnItems(n.dim, dropAt, id, count);
    try {
      ent?.clearVelocity();
    } catch {}
    m.moved = (m.moved || 0) + count;
  },
  wrench(ctx) {
    const s = MachineState.load(ctx.dimId, ctx.pos);
    s.mode = s.mode ? 0 : 1;
    MachineState.save(ctx.dimId, ctx.pos, s);
    actionbar(ctx.player, { rawtext: [{ translate: "mech.msg.funnel_mode", with: { rawtext: [{ translate: FUNNEL_MODES[s.mode] }] } }] });
  },
  interact(ctx) {
    const s = MachineState.load(ctx.dimId, ctx.pos);
    const m = mem(ctx.dimId, ctx.pos);
    actionbar(ctx.player, { rawtext: [{ translate: "mech.msg.funnel_info", with: { rawtext: [{ translate: FUNNEL_MODES[s.mode || 0] }, { text: String(m.moved || 0) }] } }] });
    return true;
  },
});

export function startConveyors() {
  system.runInterval(() => {
    try {
      moveBeltItems();
    } catch (e) {
      console.warn(`[mech] belt tick failed: ${e}`);
    }
  }, 2);
}

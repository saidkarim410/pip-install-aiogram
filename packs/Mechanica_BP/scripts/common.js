import { world, system, ItemStack, EquipmentSlot } from "@minecraft/server";

export const NS = "mech";

export const DIR = {
  up: { x: 0, y: 1, z: 0 }, down: { x: 0, y: -1, z: 0 },
  north: { x: 0, y: 0, z: -1 }, south: { x: 0, y: 0, z: 1 },
  east: { x: 1, y: 0, z: 0 }, west: { x: -1, y: 0, z: 0 },
};
export const OPP = { up: "down", down: "up", north: "south", south: "north", east: "west", west: "east" };
export const FACE_AXIS = { up: "y", down: "y", north: "z", south: "z", east: "x", west: "x" };
export const AXIS_FACES = { x: ["east", "west"], y: ["up", "down"], z: ["north", "south"] };
export const PERP = { x: ["up", "down", "north", "south"], y: ["north", "south", "east", "west"], z: ["up", "down", "east", "west"] };
export const HORIZONTAL = ["north", "south", "east", "west"];
export const ALL_FACES = ["up", "down", "north", "south", "east", "west"];

export function add(p, d, n = 1) {
  return { x: p.x + d.x * n, y: p.y + d.y * n, z: p.z + d.z * n };
}
export function key(p) {
  return `${p.x},${p.y},${p.z}`;
}
export function parseKey(k) {
  const [x, y, z] = k.split(",").map(Number);
  return { x, y, z };
}
export function center(p) {
  return { x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 };
}
export function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}
export function distXZ(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
}
export function floorPos(p) {
  return { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) };
}
export function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}
export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getBlock(dim, pos) {
  try {
    return dim.getBlock(pos);
  } catch {
    return undefined;
  }
}
export function st(perm, name) {
  try {
    return perm.getState(name);
  } catch {
    return undefined;
  }
}
export function setBlock(dim, pos, id, states) {
  const b = getBlock(dim, pos);
  if (!b) return false;
  try {
    if (states) {
      const perm = BlockPermutationResolve(id, states);
      if (perm) {
        b.setPermutation(perm);
        return true;
      }
    }
    b.setType(id);
    return true;
  } catch {
    return false;
  }
}
let _BlockPermutation = null;
export function provideBlockPermutation(cls) {
  _BlockPermutation = cls;
}
function BlockPermutationResolve(id, states) {
  try {
    return _BlockPermutation ? _BlockPermutation.resolve(id, states) : undefined;
  } catch {
    return undefined;
  }
}

export function tr(k, ...args) {
  return { rawtext: [{ translate: k, with: args.map((a) => String(a)) }] };
}
export function actionbar(player, msg) {
  try {
    player.onScreenDisplay.setActionBar(msg);
  } catch {}
}
export function tell(player, msg) {
  try {
    player.sendMessage(msg);
  } catch {}
}
export function broadcast(msg) {
  try {
    world.sendMessage(msg);
  } catch {}
}
export function prettyId(id) {
  return String(id).replace(/^[^:]+:/, "").replace(/_/g, " ");
}

export function spawnItems(dim, pos, id, count) {
  let n = count;
  while (n > 0) {
    const c = Math.min(64, n);
    n -= c;
    try {
      const e = dim.spawnItem(new ItemStack(id, c), pos);
      return e;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function getContainer(block) {
  try {
    return block?.getComponent("minecraft:inventory")?.container;
  } catch {
    return undefined;
  }
}
export function adjacentContainers(dim, pos, excludeFaces = []) {
  const out = [];
  for (const f of ALL_FACES) {
    if (excludeFaces.includes(f)) continue;
    const c = getContainer(getBlock(dim, add(pos, DIR[f])));
    if (c) out.push(c);
  }
  return out;
}
/** Adds `count` of item `id` to the container, returns how many did not fit. */
export function containerAdd(container, id, count) {
  let left = count;
  while (left > 0) {
    const c = Math.min(64, left);
    let rest;
    try {
      rest = container.addItem(new ItemStack(id, c));
    } catch {
      return left;
    }
    const r = rest ? rest.amount : 0;
    left -= c - r;
    if (r > 0) return left;
  }
  return 0;
}
/** Removes up to `count` of item `id` from the container, returns how many were removed. */
export function containerTake(container, id, count) {
  let need = count;
  try {
    for (let i = 0; i < container.size && need > 0; i++) {
      const it = container.getItem(i);
      if (!it || it.typeId !== id) continue;
      const take = Math.min(it.amount, need);
      need -= take;
      if (it.amount - take <= 0) container.setItem(i, undefined);
      else {
        const c = it.clone();
        c.amount = it.amount - take;
        container.setItem(i, c);
      }
    }
  } catch {}
  return count - need;
}
export function containerCount(container, id) {
  let n = 0;
  try {
    for (let i = 0; i < container.size; i++) {
      const it = container.getItem(i);
      if (it && it.typeId === id) n += it.amount;
    }
  } catch {}
  return n;
}

export function handItem(player) {
  try {
    return player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
  } catch {
    return undefined;
  }
}
export function setHand(player, stack) {
  try {
    player.getComponent("minecraft:equippable")?.setEquipment(EquipmentSlot.Mainhand, stack);
  } catch {}
}
export function isWrench(stack) {
  return stack?.typeId === `${NS}:wrench`;
}

// ---- persistent per-block machine state (world dynamic properties)
function mkey(dimId, pos) {
  return `${NS}:m:${dimId}:${key(pos)}`;
}
export const MachineState = {
  load(dimId, pos) {
    try {
      const raw = world.getDynamicProperty(mkey(dimId, pos));
      if (typeof raw === "string") return JSON.parse(raw);
    } catch {}
    return {};
  },
  save(dimId, pos, obj) {
    try {
      world.setDynamicProperty(mkey(dimId, pos), JSON.stringify(obj));
    } catch {}
  },
  clear(dimId, pos) {
    try {
      world.setDynamicProperty(mkey(dimId, pos), undefined);
    } catch {}
  },
};

export function safeDimension(id) {
  try {
    return world.getDimension(id);
  } catch {
    return undefined;
  }
}
export const DIM_IDS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];

export function runCommand(dim, cmd) {
  try {
    dim.runCommand(cmd);
    return true;
  } catch {
    try {
      dim.runCommandAsync(cmd);
      return true;
    } catch {
      return false;
    }
  }
}

export function now() {
  return system.currentTick;
}

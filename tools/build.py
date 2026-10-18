#!/usr/bin/env python3
"""Generates the Mechanica Bedrock addon (behavior pack + resource pack) and packs it into dist/Mechanica.mcaddon.

Run:  python3 tools/build.py
"""
import json
import os
import shutil
import sys
import zipfile

sys.path.insert(0, os.path.dirname(__file__))
import textures as T  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "packs", "Mechanica_BP")
RP = os.path.join(ROOT, "packs", "Mechanica_RP")
DIST = os.path.join(ROOT, "dist")
NS = "mech"

VERSION = [1, 0, 0]
MIN_ENGINE = [1, 21, 30]
SERVER_API = "1.14.0"
UUIDS = {
    "bp_header": "2046914e-ce67-4e5a-a005-4bb65dbf8fa5",
    "bp_data": "1e6b1202-ce4d-4013-9704-a6cec1ffed44",
    "bp_script": "a96b5f2f-52ba-4931-b492-d209d205250a",
    "rp_header": "348024b8-0b81-42c9-b4b0-b7cf193b74cc",
    "rp_res": "2ba18bd3-b0fa-4fc6-9361-b6678c4cbf69",
}

# --------------------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------------------

def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def write_text(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def save_png(img, rel, pack=RP):
    path = os.path.join(pack, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)


def reset_dirs():
    for d in (BP, RP):
        if os.path.isdir(d):
            # keep scripts (hand written) in BP
            for name in os.listdir(d):
                if d == BP and name == "scripts":
                    continue
                p = os.path.join(d, name)
                shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    os.makedirs(BP, exist_ok=True)
    os.makedirs(RP, exist_ok=True)
    os.makedirs(DIST, exist_ok=True)


# --------------------------------------------------------------------------------------
# textures
# --------------------------------------------------------------------------------------

COL = {
    "zinc": (205, 210, 215),
    "brass": (214, 170, 70),
    "andesite": (140, 142, 145),
    "iron": (216, 216, 216),
    "gold": (250, 220, 80),
    "copper": (200, 120, 85),
    "wood": (122, 108, 86),
    "planks": (162, 125, 72),
    "gear": (132, 124, 104),
    "dark": (70, 70, 75),
}

BLOCK_TEX = {}   # atlas name -> rel path (without extension)
ITEM_TEX = {}
FLIPBOOKS = []   # (atlas, path, frames)


def btex(name, img):
    BLOCK_TEX[f"{NS}_{name}"] = f"textures/blocks/{NS}_{name}"
    save_png(img, f"textures/blocks/{NS}_{name}.png")


def bspin(name, frames_img, frames=4):
    atlas = f"{NS}_{name}_spin"
    BLOCK_TEX[atlas] = f"textures/blocks/{atlas}"
    save_png(frames_img, f"textures/blocks/{atlas}.png")
    FLIPBOOKS.append((atlas, f"textures/blocks/{atlas}", frames))


def itex(name, img):
    ITEM_TEX[f"{NS}_{name}"] = f"textures/items/{NS}_{name}"
    save_png(img, f"textures/items/{NS}_{name}.png")


def gen_textures():
    stone = T.stone()
    deep = T.stone((84, 84, 92), streaks=True)
    btex("zinc_ore", T.ore(stone, COL["zinc"]))
    btex("deepslate_zinc_ore", T.ore(deep, COL["zinc"]))
    btex("zinc_block", T.metal_block(COL["zinc"]))
    btex("brass_block", T.metal_block(COL["brass"]))
    btex("andesite_casing", T.casing((150, 118, 68), COL["andesite"]))
    btex("brass_casing", T.casing(COL["brass"], (118, 98, 62)))
    # shafts & cogs
    btex("shaft", T.cylinder(COL["wood"]))
    bspin("shaft", T.stack([T.cylinder(COL["wood"], offset=i * 4) for i in range(4)]))
    cog = T.casing((105, 98, 82), COL["gear"])
    btex("cog", cog)
    bspin("cog", T.sheen_frames(cog))
    big = T.casing((92, 86, 72), (108, 100, 84))
    btex("cog_large", big)
    bspin("cog_large", T.sheen_frames(big))
    btex("wheel", T.planks())
    bspin("wheel", T.stack([T.planks(shift=i * 4) for i in range(4)]))
    btex("wheel_hub", T.cylinder((125, 92, 56)))
    iron = T.metal_block(COL["iron"])
    btex("iron", iron)
    bspin("iron", T.sheen_frames(iron))
    # millstone
    btex("millstone_side", T.stone((150, 150, 150)))
    wheel = T.rings((128, 128, 128))
    btex("millstone_wheel", wheel)
    bspin("millstone_wheel", T.stack([T.gear_face((135, 135, 135), teeth=12, r_out=7.9, r_in=7.0, hole=2.0, angle=i * 7.5) for i in range(4)]))
    btex("millstone_top", T.stone((112, 112, 112)))
    # engine
    eng = T.casing(COL["brass"], (95, 85, 72))
    btex("engine_side", eng)
    btex("engine_front", T.fire_window(eng))
    # drill
    btex("drill_side", T.panel((150, 150, 155), vents=False))
    btex("drill_head", T.gear_face((175, 175, 180), teeth=6, r_out=7.9, r_in=6.0, hole=1.0))
    bspin("drill_head", T.stack([T.gear_face((175, 175, 180), teeth=6, r_out=7.9, r_in=6.0, hole=1.0, angle=i * 15) for i in range(4)]))
    # depot / basin
    depot = T.casing((150, 118, 68), (62, 62, 68))
    btex("depot_top", depot)
    btex("basin_inner", T.panel((58, 58, 64), frame=(90, 90, 96), vents=False))
    # automation
    btex("machine", T.panel((140, 142, 146), stripe=COL["brass"]))
    btex("machine_dark", T.panel((104, 106, 110), vents=False))
    logi = T.panel((82, 112, 156), frame=COL["brass"], vents=False)
    btex("logistics", logi)
    btex("logistics_front", T.arrow_panel(logi))
    fac = T.panel((128, 72, 62), frame=COL["brass"])
    btex("factory", fac)
    btex("factory_front", T.fire_window(T.panel((128, 72, 62), frame=COL["brass"], vents=False)))
    # items
    itex("raw_zinc", T.raw_lump(COL["zinc"]))
    itex("zinc_ingot", T.ingot(COL["zinc"]))
    itex("brass_ingot", T.ingot(COL["brass"]))
    itex("andesite_alloy", T.ingot(COL["andesite"]))
    for m in ("iron", "gold", "copper", "zinc"):
        itex(f"crushed_{m}", T.crushed(COL[m]))
        itex(f"{m}_sheet", T.sheet(COL[m]))
    itex("brass_sheet", T.sheet(COL["brass"]))
    itex("wheat_flour", T.pile((238, 232, 216)))
    itex("dough", T.dough())
    itex("whisk", T.whisk())
    itex("wrench", T.wrench())
    itex("goggles", T.goggles())
    save_png(T.pack_icon(), "pack_icon.png", RP)
    save_png(T.pack_icon(bg=(52, 38, 32)), "pack_icon.png", BP)
    # entities
    save_png(T.Image.new("RGBA", (8, 8), (0, 0, 0, 0)), "textures/entity/mech_marker.png")
    for ci, cc in enumerate(CLAN_COLORS):
        for ri, role in enumerate(ROLES):
            save_png(T.humanoid_skin(cc, role), f"textures/entity/colonist/c{ci}_r{ri}.png")


ROLES = ["builder", "gatherer", "farmer", "warrior"]
CLAN_COLORS = [(200, 50, 50), (50, 90, 210), (50, 160, 60), (230, 200, 50), (150, 60, 190), (235, 130, 40), (40, 180, 190), (235, 235, 235)]

# --------------------------------------------------------------------------------------
# geometry
# --------------------------------------------------------------------------------------

GEOS = {}


def cube(origin, size, mat=None, rot=None, pivot=None, faces=None):
    """Cube with per-face UVs mapped proportionally onto a 16x16 texture."""
    sx, sy, sz = size
    dims = {"north": (sx, sy), "south": (sx, sy), "east": (sz, sy), "west": (sz, sy), "up": (sx, sz), "down": (sx, sz)}
    uv = {}
    for face, (w, h) in dims.items():
        w, h = min(w, 16), min(h, 16)
        entry = {"uv": [0, 0], "uv_size": [w, h]}
        m = (faces or {}).get(face, mat)
        if m:
            entry["material_instance"] = m
        uv[face] = entry
    c = {"origin": list(origin), "size": list(size), "uv": uv}
    if rot:
        c["rotation"] = list(rot)
        c["pivot"] = list(pivot or [0, 8, 0])
    return c


def geo(name, cubes, bounds=(2, 2)):
    GEOS[name] = {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": f"geometry.{NS}_{name}",
                "texture_width": 16, "texture_height": 16,
                "visible_bounds_width": bounds[0], "visible_bounds_height": bounds[1], "visible_bounds_offset": [0, 0.5, 0],
            },
            "bones": [{"name": "root", "pivot": [0, 0, 0], "cubes": cubes}],
        }],
    }


def gen_geometry():
    SH = cube([-3, 0, -3], [6, 16, 6], "shaft")
    geo("shaft", [SH])
    cog = [SH, cube([-6, 6, -6], [12, 4, 12], "cog"), cube([-6, 6, -6], [12, 4, 12], "cog", [0, 45, 0])]
    cog += [cube([-8, 6, -2], [16, 4, 4], "cog", [0, a, 0]) for a in (0, 45, 90, 135)]
    geo("cogwheel", cog)
    big = [SH, cube([-7, 5, -7], [14, 6, 14], "cog"), cube([-7, 5, -7], [14, 6, 14], "cog", [0, 45, 0])]
    big += [cube([-8, 5, -3], [16, 6, 6], "cog", [0, a, 0]) for a in (0, 45, 90, 135)]
    geo("large_cogwheel", big)
    wheel = [cube([-2, 6, -8], [4, 4, 16], "shaft"), cube([-4, 4, -5], [8, 8, 10], "hub"), cube([-4, 4, -5], [8, 8, 10], "hub", [0, 0, 45])]
    wheel += [cube([-8, 7, -6], [16, 2, 12], "paddle", [0, 0, a]) for a in (0, 45, 90, 135)]
    geo("water_wheel", wheel)
    crank = [cube([-2, 0, -2], [4, 10, 4], "shaft"), cube([-2, 10, -2], [8, 2, 4], "arm"), cube([4, 10, -1], [2, 5, 2], "arm")]
    geo("hand_crank", crank)
    geo("engine", [cube([-8, 0, -8], [16, 16, 16], "side", faces={"north": "front", "up": "top", "down": "top"})])
    geo("millstone", [cube([-8, 0, -8], [16, 10, 16], "side", faces={"up": "top"}), cube([-7, 10, -7], [14, 6, 14], "side", faces={"up": "wheel"}),
                      cube([-7, 10, -7], [14, 6, 14], "side", [0, 45, 0], faces={"up": "wheel"})])
    geo("press", [cube([-8, 8, -8], [16, 8, 16], "casing"), cube([-6, 0, -6], [12, 8, 12], "head")])
    mixer = [cube([-8, 10, -8], [16, 6, 16], "casing"), cube([-1, 3, -1], [2, 7, 2], "shaft"), cube([-5, 0, -5], [10, 3, 10], "whisk"), cube([-5, 0, -5], [10, 3, 10], "whisk", [0, 45, 0])]
    geo("mixer", mixer)
    drill = [cube([-8, 0, -2], [16, 16, 10], "side"), cube([-6, 2, -8], [12, 12, 6], "side", faces={"north": "head"}),
             cube([-6, 2, -8], [12, 12, 6], "side", [0, 0, 45], [0, 8, -5], faces={"north": "head"})]
    geo("drill", drill)
    geo("depot", [cube([-8, 0, -8], [16, 12, 16], "side", faces={"up": "top"})], (1, 1))
    basin = [cube([-8, 0, -8], [16, 2, 16], "side", faces={"up": "inner"}), cube([-8, 2, -8], [2, 11, 16], "side"), cube([6, 2, -8], [2, 11, 16], "side"),
             cube([-6, 2, -8], [12, 11, 2], "side"), cube([-6, 2, 6], [12, 11, 2], "side")]
    geo("basin", basin)
    geo("machine_box", [cube([-8, 0, -8], [16, 16, 16], "side", faces={"north": "front", "up": "top"})])
    for name, g in GEOS.items():
        write_json(os.path.join(RP, "models", "blocks", f"{NS}_{name}.geo.json"), g)
    # entities
    colonist = {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {"identifier": f"geometry.{NS}_colonist", "texture_width": 64, "texture_height": 64, "visible_bounds_width": 2, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1, 0]},
            "bones": [
                {"name": "body", "pivot": [0, 24, 0], "cubes": [{"origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]}]},
                {"name": "head", "parent": "body", "pivot": [0, 24, 0], "cubes": [{"origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [0, 0]}, {"origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [32, 0], "inflate": 0.5}]},
                {"name": "rightArm", "parent": "body", "pivot": [-5, 22, 0], "cubes": [{"origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 16]}]},
                {"name": "leftArm", "parent": "body", "pivot": [5, 22, 0], "cubes": [{"origin": [4, 12, -2], "size": [4, 12, 4], "uv": [32, 48]}]},
                {"name": "rightLeg", "parent": "body", "pivot": [-1.9, 12, 0], "cubes": [{"origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 16]}]},
                {"name": "leftLeg", "parent": "body", "pivot": [1.9, 12, 0], "cubes": [{"origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [16, 48]}]},
            ],
        }],
    }
    write_json(os.path.join(RP, "models", "entity", "colonist.geo.json"), colonist)
    marker = {"format_version": "1.12.0", "minecraft:geometry": [{"description": {"identifier": f"geometry.{NS}_marker", "texture_width": 8, "texture_height": 8}, "bones": [{"name": "root", "pivot": [0, 0, 0]}]}]}
    write_json(os.path.join(RP, "models", "entity", "marker.geo.json"), marker)


# --------------------------------------------------------------------------------------
# blocks
# --------------------------------------------------------------------------------------

BLOCK_NAMES = {}  # id -> (en, ru)
ITEM_NAMES = {}
BLOCK_SOUNDS = {}


def mats(spec, render="alpha_test"):
    out = {}
    for k, tex in spec.items():
        out[k] = {"texture": f"{NS}_{tex}", "render_method": render, "ambient_occlusion": render == "opaque", "face_dimming": True}
    return out


def bf(face):
    return f"q.block_state('minecraft:block_face') == '{face}'"


def fd(face):
    return f"q.block_state('minecraft:facing_direction') == '{face}'"


def rot(r):
    return {"minecraft:transformation": {"rotation": r}}


AXIS_PERMS = [
    {"condition": f"{bf('north')} || {bf('south')}", "components": rot([90, 0, 0])},
    {"condition": f"{bf('east')} || {bf('west')}", "components": rot([0, 0, 90])},
]
FACING_PERMS = [
    {"condition": fd("south"), "components": rot([0, 180, 0])},
    {"condition": fd("west"), "components": rot([0, 90, 0])},
    {"condition": fd("east"), "components": rot([0, -90, 0])},
    {"condition": fd("up"), "components": rot([90, 0, 0])},
    {"condition": fd("down"), "components": rot([-90, 0, 0])},
]
ATTACH_PERMS = [
    {"condition": bf("down"), "components": rot([180, 0, 0])},
    {"condition": bf("north"), "components": rot([-90, 0, 0])},
    {"condition": bf("south"), "components": rot([90, 0, 0])},
    {"condition": bf("east"), "components": rot([0, 0, -90])},
    {"condition": bf("west"), "components": rot([0, 0, 90])},
]
CARDINAL_PERMS = [
    {"condition": "q.block_state('minecraft:cardinal_direction') == 'east' || q.block_state('minecraft:cardinal_direction') == 'west'", "components": rot([0, 90, 0])},
]
TRAIT_BLOCK_FACE = {"minecraft:placement_position": {"enabled_states": ["minecraft:block_face"]}}
TRAIT_FACING = {"minecraft:placement_direction": {"enabled_states": ["minecraft:facing_direction"]}}
TRAIT_CARDINAL = {"minecraft:placement_direction": {"enabled_states": ["minecraft:cardinal_direction"]}}
FULL = {"origin": [-8, 0, -8], "size": [16, 16, 16]}


def block(name, en, ru, *, geometry=None, materials, render="alpha_test", category="construction", states=None, traits=None, perms=None,
          collision=FULL, selection=None, hardness=1.5, resistance=6.0, light_damp=15, loot=None, custom=None, spin=None, sound="stone", map_color="#777777", kinetic=False):
    ident = f"{NS}:{name}"
    BLOCK_NAMES[ident] = (en, ru)
    BLOCK_SOUNDS[ident] = sound
    desc = {"identifier": ident, "menu_category": {"category": category}}
    st = dict(states or {})
    if kinetic:
        st[f"{NS}:spin"] = [False, True]
    if st:
        desc["states"] = st
    if traits:
        desc["traits"] = traits
    comps = {
        "minecraft:geometry": f"geometry.{NS}_{geometry}" if geometry else "minecraft:geometry.full_block",
        "minecraft:material_instances": mats(materials, render),
        "minecraft:destructible_by_mining": {"seconds_to_destroy": hardness},
        "minecraft:destructible_by_explosion": {"explosion_resistance": resistance},
        "minecraft:light_dampening": light_damp,
        "minecraft:map_color": map_color,
    }
    if collision is not None:
        comps["minecraft:collision_box"] = collision
    comps["minecraft:selection_box"] = selection or collision or FULL
    if loot:
        comps["minecraft:loot"] = loot
    if custom:
        comps["minecraft:custom_components"] = custom
    permutations = list(perms or [])
    if spin:
        permutations.append({"condition": f"q.block_state('{NS}:spin')", "components": {"minecraft:material_instances": mats(spin, render)}})
    data = {"format_version": "1.21.10", "minecraft:block": {"description": desc, "components": comps}}
    if permutations:
        data["minecraft:block"]["permutations"] = permutations
    write_json(os.path.join(BP, "blocks", f"{name}.json"), data)


def gen_blocks():
    K = [f"{NS}:kinetic"]
    ore_loot = lambda n: f"loot_tables/blocks/{n}.json"  # noqa: E731
    block("zinc_ore", "Zinc Ore", "Цинковая руда", materials={"*": "zinc_ore"}, render="opaque", category="nature", hardness=3, loot=ore_loot("zinc_ore"), map_color="#8a8f94")
    block("deepslate_zinc_ore", "Deepslate Zinc Ore", "Глубинносланцевая цинковая руда", materials={"*": "deepslate_zinc_ore"}, render="opaque", category="nature", hardness=4.5, loot=ore_loot("deepslate_zinc_ore"), sound="deepslate", map_color="#5a5a60")
    block("zinc_block", "Block of Zinc", "Цинковый блок", materials={"*": "zinc_block"}, render="opaque", hardness=5, sound="metal", map_color="#c8ccd0")
    block("brass_block", "Block of Brass", "Латунный блок", materials={"*": "brass_block"}, render="opaque", hardness=5, sound="metal", map_color="#d6aa46")
    block("andesite_casing", "Andesite Casing", "Андезитовый корпус", materials={"*": "andesite_casing"}, render="opaque", hardness=2, sound="wood", map_color="#8c8e91")
    block("brass_casing", "Brass Casing", "Латунный корпус", materials={"*": "brass_casing"}, render="opaque", hardness=2, sound="wood", map_color="#d6aa46")
    # kinetics
    block("shaft", "Shaft", "Вал", geometry="shaft", materials={"*": "shaft"}, spin={"*": "shaft_spin"}, category="items", traits=TRAIT_BLOCK_FACE, perms=AXIS_PERMS,
          collision={"origin": [-3, 0, -3], "size": [6, 16, 6]}, hardness=0.8, resistance=2, light_damp=0, custom=K, kinetic=True, sound="wood")
    cogmats = {"*": "cog", "shaft": "shaft"}
    block("cogwheel", "Cogwheel", "Шестерня", geometry="cogwheel", materials=cogmats, spin={"*": "cog_spin", "shaft": "shaft_spin"}, category="items", traits=TRAIT_BLOCK_FACE, perms=AXIS_PERMS,
          collision={"origin": [-8, 6, -8], "size": [16, 4, 16]}, selection=FULL, hardness=0.8, resistance=2, light_damp=0, custom=K, kinetic=True, sound="wood")
    block("large_cogwheel", "Large Cogwheel", "Большая шестерня", geometry="large_cogwheel", materials={"*": "cog_large", "shaft": "shaft"}, spin={"*": "cog_large_spin", "shaft": "shaft_spin"}, category="items",
          traits=TRAIT_BLOCK_FACE, perms=AXIS_PERMS, collision={"origin": [-8, 5, -8], "size": [16, 6, 16]}, selection=FULL, hardness=1, resistance=2, light_damp=0, custom=K, kinetic=True, sound="wood")
    block("water_wheel", "Water Wheel", "Водяное колесо", geometry="water_wheel", materials={"*": "wheel", "paddle": "wheel", "hub": "wheel_hub", "shaft": "shaft"}, spin={"paddle": "wheel_spin", "shaft": "shaft_spin"},
          category="items", traits=TRAIT_CARDINAL, perms=CARDINAL_PERMS, hardness=1.5, resistance=3, light_damp=0, custom=K, kinetic=True, sound="wood")
    block("hand_crank", "Hand Crank", "Рукоятка", geometry="hand_crank", materials={"*": "shaft", "arm": "wheel"}, spin={"*": "shaft_spin"}, category="items", traits=TRAIT_BLOCK_FACE, perms=ATTACH_PERMS,
          collision={"origin": [-4, 0, -4], "size": [8, 12, 8]}, hardness=0.5, resistance=1, light_damp=0, custom=K, kinetic=True, sound="wood")
    block("furnace_engine", "Furnace Engine", "Печной двигатель", geometry="engine", materials={"*": "engine_side", "front": "engine_front", "top": "brass_casing"}, spin={"top": "iron_spin"}, category="items",
          traits=TRAIT_FACING, perms=FACING_PERMS, hardness=3, resistance=6, custom=K, kinetic=True, sound="metal")
    block("millstone", "Millstone", "Мельница", geometry="millstone", materials={"*": "millstone_side", "top": "millstone_top", "wheel": "millstone_wheel"}, spin={"wheel": "iron_spin"}, category="items",
          hardness=2, custom=K, kinetic=True, sound="stone")
    block("mechanical_press", "Mechanical Press", "Механический пресс", geometry="press", materials={"*": "andesite_casing", "casing": "andesite_casing", "head": "iron"}, spin={"head": "iron_spin"}, category="items",
          hardness=2, light_damp=0, custom=K, kinetic=True, sound="metal")
    block("mechanical_mixer", "Mechanical Mixer", "Механический смеситель", geometry="mixer", materials={"*": "andesite_casing", "casing": "andesite_casing", "shaft": "shaft", "whisk": "iron"}, spin={"whisk": "iron_spin", "shaft": "shaft_spin"},
          category="items", hardness=2, light_damp=0, custom=K, kinetic=True, sound="metal")
    block("mechanical_drill", "Mechanical Drill", "Механический бур", geometry="drill", materials={"*": "drill_side", "head": "drill_head"}, spin={"head": "drill_head_spin"}, category="items",
          traits=TRAIT_FACING, perms=FACING_PERMS, hardness=2, custom=K, kinetic=True, sound="metal")
    block("depot", "Depot", "Депо", geometry="depot", materials={"*": "andesite_casing", "top": "depot_top"}, category="items", collision={"origin": [-8, 0, -8], "size": [16, 12, 16]}, hardness=1.5, light_damp=0, sound="wood")
    block("basin", "Basin", "Чаша", geometry="basin", materials={"*": "andesite_casing", "inner": "basin_inner"}, category="items", collision={"origin": [-8, 0, -8], "size": [16, 2, 16]}, selection=FULL, hardness=1.5, light_damp=0, sound="wood")
    # automation
    block("mine_driller", "Mine Driller", "Шахтная буровая", geometry="machine_box", materials={"*": "machine", "front": "drill_head", "top": "machine_dark"}, spin={"front": "drill_head_spin"}, category="items",
          hardness=3, custom=[f"{NS}:kinetic"], kinetic=True, sound="metal")
    block("tunnel_borer", "Tunnel Borer", "Туннельный проходчик", geometry="machine_box", materials={"*": "machine", "front": "drill_head", "top": "machine_dark"}, spin={"front": "drill_head_spin"}, category="items",
          traits=TRAIT_FACING, perms=FACING_PERMS, hardness=3, custom=[f"{NS}:kinetic"], kinetic=True, sound="metal")
    block("factory", "Processing Factory", "Перерабатывающий завод", geometry="machine_box", materials={"*": "factory", "front": "factory_front", "top": "brass_casing"}, spin={"top": "iron_spin"}, category="items",
          traits=TRAIT_FACING, perms=FACING_PERMS, hardness=3, custom=[f"{NS}:kinetic"], kinetic=True, sound="metal")
    block("logistics_node", "Logistics Node", "Логистический узел", geometry="machine_box", materials={"*": "logistics", "front": "logistics_front", "top": "logistics"}, category="items",
          traits=TRAIT_FACING, perms=FACING_PERMS, hardness=2, custom=[f"{NS}:kinetic"], sound="metal")
    # ore loot tables
    for n, ore_id in (("zinc_ore", f"{NS}:zinc_ore"), ("deepslate_zinc_ore", f"{NS}:deepslate_zinc_ore")):
        write_json(os.path.join(BP, "loot_tables", "blocks", f"{n}.json"), {
            "pools": [{"rolls": 1, "entries": [
                {"type": "item", "name": ore_id, "weight": 1, "conditions": [{"condition": "match_tool", "item": "minecraft:*", "count": 1, "enchantments": [{"silk_touch": {"level": 1}}]}]},
                {"type": "item", "name": f"{NS}:raw_zinc", "weight": 1, "functions": [{"function": "apply_bonus", "enchantment": "fortune", "formula": "ore_drops", "parameters": {}}]},
            ]}]
        })
    # world gen
    write_json(os.path.join(BP, "features", "zinc_ore_feature.json"), {
        "format_version": "1.13.0",
        "minecraft:ore_feature": {"description": {"identifier": f"{NS}:zinc_ore_feature"}, "count": 9, "replace_rules": [
            {"places_block": f"{NS}:zinc_ore", "may_replace": ["minecraft:stone"]},
            {"places_block": f"{NS}:deepslate_zinc_ore", "may_replace": ["minecraft:deepslate"]},
        ]},
    })
    write_json(os.path.join(BP, "feature_rules", "overworld_underground_zinc_ore.json"), {
        "format_version": "1.13.0",
        "minecraft:feature_rules": {
            "description": {"identifier": f"{NS}:overworld_underground_zinc_ore", "places_feature": f"{NS}:zinc_ore_feature"},
            "conditions": {"placement_pass": "underground_pass", "minecraft:biome_filter": [{"test": "has_biome_tag", "operator": "==", "value": "overworld"}]},
            "distribution": {"iterations": 10, "x": {"distribution": "uniform", "extent": [0, 16]}, "y": {"distribution": "uniform", "extent": [-30, 70]}, "z": {"distribution": "uniform", "extent": [0, 16]}},
        },
    })


# --------------------------------------------------------------------------------------
# items
# --------------------------------------------------------------------------------------

def item(name, en, ru, *, stack=64, category="items", extra=None):
    ident = f"{NS}:{name}"
    ITEM_NAMES[ident] = (en, ru)
    comps = {"minecraft:icon": f"{NS}_{name}", "minecraft:max_stack_size": stack}
    comps.update(extra or {})
    write_json(os.path.join(BP, "items", f"{name}.json"), {
        "format_version": "1.21.10",
        "minecraft:item": {"description": {"identifier": ident, "menu_category": {"category": category}}, "components": comps},
    })


def gen_items():
    item("raw_zinc", "Raw Zinc", "Цинковая руда (сырая)")
    item("zinc_ingot", "Zinc Ingot", "Цинковый слиток")
    item("brass_ingot", "Brass Ingot", "Латунный слиток")
    item("andesite_alloy", "Andesite Alloy", "Андезитовый сплав")
    for m, en, ru in (("iron", "Iron", "железо"), ("gold", "Gold", "золото"), ("copper", "Copper", "медь"), ("zinc", "Zinc", "цинк")):
        item(f"crushed_{m}", f"Crushed {en}", f"Дроблёная руда ({ru})")
    item("iron_sheet", "Iron Sheet", "Железный лист")
    item("gold_sheet", "Gold Sheet", "Золотой лист")
    item("copper_sheet", "Copper Sheet", "Медный лист")
    item("brass_sheet", "Brass Sheet", "Латунный лист")
    item("zinc_sheet", "Zinc Sheet", "Цинковый лист")
    item("wheat_flour", "Wheat Flour", "Пшеничная мука")
    item("dough", "Dough", "Тесто")
    item("whisk", "Whisk", "Венчик", stack=1)
    item("wrench", "Wrench", "Гаечный ключ", stack=1, category="equipment", extra={"minecraft:hand_equipped": True, "minecraft:durability": {"max_durability": 500}})
    item("goggles", "Engineer's Goggles", "Очки инженера", stack=1, category="equipment",
         extra={"minecraft:wearable": {"slot": "slot.armor.head", "protection": 1}, "minecraft:durability": {"max_durability": 200}})


# --------------------------------------------------------------------------------------
# recipes
# --------------------------------------------------------------------------------------

def shaped(name, pattern, key, result, count=1, unlock=None):
    k = {}
    for ch, v in key.items():
        k[ch] = {"tag": v[1:]} if v.startswith("#") else {"item": v}
    first = next(iter(key.values()))
    write_json(os.path.join(BP, "recipes", f"{name}.json"), {
        "format_version": "1.20.10",
        "minecraft:recipe_shaped": {"description": {"identifier": f"{NS}:{name}"}, "tags": ["crafting_table"], "pattern": pattern, "key": k,
                                    "unlock": [({"tag": first[1:]} if first.startswith("#") else {"item": first})] if unlock is None else unlock,
                                    "result": {"item": result, "count": count}},
    })


def shapeless(name, ingredients, result, count=1):
    ing = [({"tag": i[1:]} if i.startswith("#") else {"item": i}) for i in ingredients]
    write_json(os.path.join(BP, "recipes", f"{name}.json"), {
        "format_version": "1.20.10",
        "minecraft:recipe_shapeless": {"description": {"identifier": f"{NS}:{name}"}, "tags": ["crafting_table"], "ingredients": ing, "unlock": [ing[0]],
                                       "result": {"item": result, "count": count}},
    })


def furnace(name, inp, out):
    write_json(os.path.join(BP, "recipes", f"{name}.json"), {
        "format_version": "1.20.10",
        "minecraft:recipe_furnace": {"description": {"identifier": f"{NS}:{name}"}, "tags": ["furnace", "blast_furnace"], "unlock": [{"item": inp}], "input": inp, "output": out},
    })


def gen_recipes():
    A, S, C = f"{NS}:andesite_alloy", f"{NS}:shaft", f"{NS}:cogwheel"
    furnace("zinc_ingot_from_raw", f"{NS}:raw_zinc", f"{NS}:zinc_ingot")
    furnace("zinc_ingot_from_ore", f"{NS}:zinc_ore", f"{NS}:zinc_ingot")
    furnace("zinc_ingot_from_deepslate_ore", f"{NS}:deepslate_zinc_ore", f"{NS}:zinc_ingot")
    furnace("iron_from_crushed", f"{NS}:crushed_iron", "minecraft:iron_ingot")
    furnace("gold_from_crushed", f"{NS}:crushed_gold", "minecraft:gold_ingot")
    furnace("copper_from_crushed", f"{NS}:crushed_copper", "minecraft:copper_ingot")
    furnace("zinc_from_crushed", f"{NS}:crushed_zinc", f"{NS}:zinc_ingot")
    furnace("bread_from_dough", f"{NS}:dough", "minecraft:bread")
    shaped("zinc_block", ["ZZZ", "ZZZ", "ZZZ"], {"Z": f"{NS}:zinc_ingot"}, f"{NS}:zinc_block")
    shapeless("zinc_ingot_from_block", [f"{NS}:zinc_block"], f"{NS}:zinc_ingot", 9)
    shaped("brass_block", ["BBB", "BBB", "BBB"], {"B": f"{NS}:brass_ingot"}, f"{NS}:brass_block")
    shapeless("brass_ingot_from_block", [f"{NS}:brass_block"], f"{NS}:brass_ingot", 9)
    shaped("andesite_alloy", ["AN", "NA"], {"A": "minecraft:andesite", "N": "minecraft:iron_nugget"}, A, 2)
    shaped("andesite_alloy_mirror", ["NA", "AN"], {"A": "minecraft:andesite", "N": "minecraft:iron_nugget"}, A, 2)
    shaped("shaft", ["A", "A"], {"A": A}, S, 8)
    shapeless("cogwheel", [S, "#minecraft:planks"], C, 1)
    shapeless("large_cogwheel", [S, "#minecraft:planks", "#minecraft:planks"], f"{NS}:large_cogwheel", 1)
    shaped("water_wheel", ["PPP", "PSP", "PPP"], {"P": "#minecraft:planks", "S": S}, f"{NS}:water_wheel")
    shaped("hand_crank", ["PPP", "  S"], {"P": "#minecraft:planks", "S": S}, f"{NS}:hand_crank")
    shapeless("andesite_casing", [A, "#minecraft:logs"], f"{NS}:andesite_casing", 1)
    shapeless("brass_casing", [f"{NS}:brass_ingot", "#minecraft:logs"], f"{NS}:brass_casing", 1)
    shaped("millstone", ["C", "T"], {"C": C, "T": "minecraft:stone"}, f"{NS}:millstone")
    shaped("mechanical_press", ["S", "K", "I"], {"S": S, "K": f"{NS}:andesite_casing", "I": "minecraft:iron_block"}, f"{NS}:mechanical_press")
    shaped("whisk", ["A A", " I "], {"A": A, "I": f"{NS}:iron_sheet"}, f"{NS}:whisk")
    shaped("mechanical_mixer", ["S", "K", "W"], {"S": S, "K": f"{NS}:andesite_casing", "W": f"{NS}:whisk"}, f"{NS}:mechanical_mixer")
    shaped("mechanical_drill", [" I ", "IKI", " S "], {"I": f"{NS}:iron_sheet", "K": f"{NS}:andesite_casing", "S": S}, f"{NS}:mechanical_drill")
    shaped("furnace_engine", ["BBB", "BFB", "BSB"], {"B": f"{NS}:brass_sheet", "F": "minecraft:furnace", "S": S}, f"{NS}:furnace_engine")
    shaped("depot", ["A", "K"], {"A": A, "K": f"{NS}:andesite_casing"}, f"{NS}:depot")
    shaped("basin", ["A A", "AAA"], {"A": A}, f"{NS}:basin")
    shaped("wrench", ["GC", " S"], {"G": f"{NS}:gold_sheet", "C": C, "S": "minecraft:stick"}, f"{NS}:wrench")
    shaped("goggles", ["BBB", "G G"], {"B": f"{NS}:brass_sheet", "G": "minecraft:glass_pane"}, f"{NS}:goggles")
    shapeless("dough", [f"{NS}:wheat_flour", "minecraft:water_bucket"], f"{NS}:dough", 1)
    # automation
    shaped("mine_driller", ["IDI", "KCK", "IKI"], {"I": f"{NS}:iron_sheet", "D": f"{NS}:mechanical_drill", "K": f"{NS}:andesite_casing", "C": "minecraft:chest"}, f"{NS}:mine_driller")
    shaped("tunnel_borer", ["IKI", "DCD", "IKI"], {"I": f"{NS}:iron_sheet", "D": f"{NS}:mechanical_drill", "K": f"{NS}:andesite_casing", "C": "minecraft:chest"}, f"{NS}:tunnel_borer")
    shaped("factory", ["BBB", "KFK", "BCB"], {"B": f"{NS}:brass_casing", "K": f"{NS}:andesite_casing", "F": "minecraft:blast_furnace", "C": "minecraft:crafting_table"}, f"{NS}:factory")
    shaped("logistics_node", ["ZEZ", "ZKZ", "ZHZ"], {"Z": f"{NS}:zinc_ingot", "E": "minecraft:ender_pearl", "K": f"{NS}:brass_casing", "H": "minecraft:hopper"}, f"{NS}:logistics_node")


# --------------------------------------------------------------------------------------
# entities (colonists + markers)
# --------------------------------------------------------------------------------------

SLOTS = 8


def gen_entities():
    # ---- marker (invisible navigation target)
    write_json(os.path.join(BP, "entities", "marker.json"), {
        "format_version": "1.21.0",
        "minecraft:entity": {
            "description": {"identifier": f"{NS}:marker", "is_spawnable": False, "is_summonable": True},
            "components": {
                "minecraft:type_family": {"family": ["mech_marker"]},
                "minecraft:collision_box": {"width": 0.2, "height": 0.2},
                "minecraft:health": {"value": 1, "max": 1},
                "minecraft:physics": {"has_gravity": False, "has_collision": False},
                "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
                "minecraft:knockback_resistance": {"value": 1.0},
                "minecraft:fire_immune": True,
                "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": False}]},
                "minecraft:conditional_bandwidth_optimization": {},
            },
        },
    })
    # ---- colonist
    targets = []
    for i in range(SLOTS):
        for ri, role in enumerate(ROLES):
            targets.append({"filters": {"all_of": [
                {"test": "has_tag", "subject": "self", "value": f"mech_c{i}"},
                {"test": "has_tag", "subject": "self", "value": f"mech_role_{role}"},
                {"test": "has_tag", "subject": "other", "value": f"mech_site_{i}_{role}"},
            ]}, "max_dist": 64, "must_see": False})
        targets.append({"filters": {"all_of": [
            {"test": "has_tag", "subject": "self", "value": f"mech_c{i}"},
            {"test": "has_tag", "subject": "self", "value": "mech_role_warrior"},
            {"test": "has_tag", "subject": "other", "value": f"mech_enemy_of_{i}"},
        ]}, "max_dist": 40, "must_see": False})
    targets.append({"filters": {"all_of": [
        {"test": "has_tag", "subject": "self", "value": "mech_role_warrior"},
        {"test": "is_family", "subject": "other", "value": "monster"},
    ]}, "max_dist": 20})
    groups = {
        f"{NS}:warrior": {
            "minecraft:attack": {"damage": 5},
            "minecraft:behavior.melee_box_attack": {"priority": 2, "speed_multiplier": 1.25, "track_target": True, "reach_multiplier": 1.4},
            "minecraft:behavior.hurt_by_target": {"priority": 1},
            "minecraft:mark_variant": {"value": 3},
        },
        f"{NS}:worker": {
            "minecraft:behavior.panic": {"priority": 1, "speed_multiplier": 1.3},
        },
        f"{NS}:gatherer": {"minecraft:mark_variant": {"value": 1}},
        f"{NS}:builder": {"minecraft:mark_variant": {"value": 0}},
        f"{NS}:farmer": {"minecraft:mark_variant": {"value": 2}},
    }
    # equipment and health per role and era (civilizations evolve)
    GEAR = {
        "builder": [["minecraft:wooden_axe"], ["minecraft:stone_axe"], ["minecraft:iron_axe"], ["minecraft:diamond_axe"]],
        "gatherer": [["minecraft:wooden_pickaxe"], ["minecraft:stone_pickaxe"], ["minecraft:iron_pickaxe"], ["minecraft:diamond_pickaxe"]],
        "farmer": [["minecraft:wooden_hoe"], ["minecraft:stone_hoe"], ["minecraft:iron_hoe"], ["minecraft:diamond_hoe"]],
        "warrior": [["minecraft:stone_sword", "minecraft:leather_helmet"], ["minecraft:iron_sword", "minecraft:iron_helmet"], ["minecraft:iron_sword", "minecraft:iron_helmet", "minecraft:iron_chestplate"],
                    ["minecraft:diamond_sword", "minecraft:iron_helmet", "minecraft:iron_chestplate", "minecraft:iron_leggings"]],
    }
    WARRIOR_HP = [24, 30, 36, 44]
    gear_groups = []
    for role, eras in GEAR.items():
        for era, items in enumerate(eras):
            gname = f"{NS}:gear_{role}_{era}"
            gear_groups.append(gname)
            table = f"loot_tables/entities/mech_gear_{role}_{era}.json"
            write_json(os.path.join(BP, table), {"pools": [{"rolls": 1, "entries": [{"type": "item", "name": it, "weight": 1}]} for it in items]})
            groups[gname] = {"minecraft:equipment": {"table": table}}
            if role == "warrior":
                groups[gname]["minecraft:health"] = {"value": WARRIOR_HP[era], "max": WARRIOR_HP[era]}
    events = {
        f"{NS}:become_warrior": {"remove": {"component_groups": [f"{NS}:worker", f"{NS}:gatherer", f"{NS}:builder", f"{NS}:farmer"]}, "add": {"component_groups": [f"{NS}:warrior"]}},
        f"{NS}:become_builder": {"remove": {"component_groups": [f"{NS}:warrior", f"{NS}:gatherer", f"{NS}:farmer"]}, "add": {"component_groups": [f"{NS}:worker", f"{NS}:builder"]}},
        f"{NS}:become_gatherer": {"remove": {"component_groups": [f"{NS}:warrior", f"{NS}:builder", f"{NS}:farmer"]}, "add": {"component_groups": [f"{NS}:worker", f"{NS}:gatherer"]}},
        f"{NS}:become_farmer": {"remove": {"component_groups": [f"{NS}:warrior", f"{NS}:builder", f"{NS}:gatherer"]}, "add": {"component_groups": [f"{NS}:worker", f"{NS}:farmer"]}},
    }
    for g in gear_groups:
        events[g] = {"remove": {"component_groups": [o for o in gear_groups if o != g]}, "add": {"component_groups": [g]}}
    for i in range(SLOTS):
        groups[f"{NS}:clan{i}"] = {"minecraft:variant": {"value": i}}
        events[f"{NS}:set_clan{i}"] = {"remove": {"component_groups": [f"{NS}:clan{j}" for j in range(SLOTS) if j != i]}, "add": {"component_groups": [f"{NS}:clan{i}"]}}
    write_json(os.path.join(BP, "entities", "colonist.json"), {
        "format_version": "1.21.0",
        "minecraft:entity": {
            "description": {"identifier": f"{NS}:colonist", "is_spawnable": True, "is_summonable": True},
            "component_groups": groups,
            "components": {
                "minecraft:type_family": {"family": ["mech_colonist", "villager", "mob"]},
                "minecraft:collision_box": {"width": 0.6, "height": 1.9},
                "minecraft:health": {"value": 20, "max": 20},
                "minecraft:movement": {"value": 0.28},
                "minecraft:navigation.walk": {"can_path_over_water": False, "avoid_water": True, "avoid_damage_blocks": True, "can_open_doors": True, "can_pass_doors": True},
                "minecraft:movement.basic": {},
                "minecraft:jump.static": {},
                "minecraft:can_climb": {},
                "minecraft:physics": {},
                "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
                "minecraft:nameable": {"always_show": True, "allow_name_tag_renaming": False},
                "minecraft:persistent": {},
                "minecraft:variant": {"value": 0},
                "minecraft:mark_variant": {"value": 1},
                "minecraft:loot": {"table": "loot_tables/entities/mech_colonist.json"},
                "minecraft:behavior.float": {"priority": 0},
                "minecraft:behavior.nearest_attackable_target": {"priority": 3, "must_see": False, "reselect_targets": True, "scan_interval": 10, "within_radius": 64, "entity_types": targets},
                "minecraft:behavior.move_towards_target": {"priority": 4, "speed_multiplier": 1.0, "within_radius": 64},
                "minecraft:behavior.open_door": {"priority": 5},
                "minecraft:behavior.random_stroll": {"priority": 7, "speed_multiplier": 0.8, "interval": 40},
                "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 6},
                "minecraft:behavior.random_look_around": {"priority": 9},
            },
            "events": dict(events, **{"minecraft:entity_spawned": {"add": {"component_groups": [f"{NS}:worker", f"{NS}:gatherer", f"{NS}:clan0"]}}}),
        },
    })
    write_json(os.path.join(BP, "loot_tables", "entities", "mech_colonist.json"), {"pools": [{"rolls": 1, "entries": [{"type": "item", "name": "minecraft:bread", "weight": 1}, {"type": "item", "name": "minecraft:emerald", "weight": 1}, {"type": "empty", "weight": 2}]}]})
    # ---- client side
    skins = {}
    arr = []
    for ci in range(SLOTS):
        for ri in range(len(ROLES)):
            skins[f"c{ci}_r{ri}"] = f"textures/entity/colonist/c{ci}_r{ri}"
            arr.append(f"Texture.c{ci}_r{ri}")
    write_json(os.path.join(RP, "entity", "colonist.entity.json"), {
        "format_version": "1.10.0",
        "minecraft:client_entity": {"description": {
            "identifier": f"{NS}:colonist",
            "materials": {"default": "entity_alphatest"},
            "textures": skins,
            "geometry": {"default": f"geometry.{NS}_colonist"},
            "animations": {"walk": f"animation.{NS}.colonist.walk", "look": f"animation.{NS}.colonist.look"},
            "scripts": {"animate": ["walk", "look"]},
            "render_controllers": [f"controller.render.{NS}_colonist"],
            "spawn_egg": {"base_color": "#c8a46e", "overlay_color": "#d6aa46"},
        }},
    })
    write_json(os.path.join(RP, "render_controllers", "colonist.render_controllers.json"), {
        "format_version": "1.10.0",
        "render_controllers": {f"controller.render.{NS}_colonist": {
            "arrays": {"textures": {"Array.skins": arr}},
            "geometry": "Geometry.default",
            "materials": [{"*": "Material.default"}],
            "textures": [f"Array.skins[math.clamp(query.variant, 0, {SLOTS - 1}) * {len(ROLES)} + math.clamp(query.mark_variant, 0, {len(ROLES) - 1})]"],
        }},
    })
    write_json(os.path.join(RP, "animations", "colonist.animation.json"), {
        "format_version": "1.8.0",
        "animations": {
            f"animation.{NS}.colonist.walk": {"loop": True, "bones": {
                "rightLeg": {"rotation": ["math.sin(query.anim_time * 700) * 40 * query.modified_move_speed", 0, 0]},
                "leftLeg": {"rotation": ["-math.sin(query.anim_time * 700) * 40 * query.modified_move_speed", 0, 0]},
                "rightArm": {"rotation": ["-math.sin(query.anim_time * 700) * 35 * query.modified_move_speed", 0, 0]},
                "leftArm": {"rotation": ["math.sin(query.anim_time * 700) * 35 * query.modified_move_speed", 0, 0]},
            }},
            f"animation.{NS}.colonist.look": {"loop": True, "bones": {"head": {"rotation": ["query.target_x_rotation", "query.target_y_rotation", 0]}}},
        },
    })
    write_json(os.path.join(RP, "entity", "marker.entity.json"), {
        "format_version": "1.10.0",
        "minecraft:client_entity": {"description": {
            "identifier": f"{NS}:marker", "materials": {"default": "entity_alphatest"}, "textures": {"default": "textures/entity/mech_marker"},
            "geometry": {"default": f"geometry.{NS}_marker"}, "render_controllers": ["controller.render.default"],
        }},
    })


# --------------------------------------------------------------------------------------
# lang, manifests, resource json
# --------------------------------------------------------------------------------------

MESSAGES = {
    "mech.msg.info": ("§6Speed: §f%s rpm §8| §6Stress: §f%s §7/ §f%s SU", "§6Скорость: §f%s об/мин §8| §6Нагрузка: §f%s §7/ §f%s SU"),
    "mech.msg.over": ("§cNetwork overstressed! Add more rotation sources", "§cСеть перегружена! Добавьте источники вращения"),
    "mech.msg.nosource": ("§7No rotation source connected", "§7Нет подключённого источника вращения"),
    "mech.msg.inserted": ("§aInserted: %s ×%s", "§aПоложено: %s ×%s"),
    "mech.msg.millstone": ("§eMillstone: %s ×%s §7| progress %s%% §7| ready: %s", "§eМельница: %s ×%s §7| прогресс %s%% §7| готово: %s"),
    "mech.msg.taken": ("§aYou took the products", "§aВы забрали продукты"),
    "mech.msg.empty": ("§7Empty. Put in raw ore, wheat, cobblestone...", "§7Пусто. Положите сырую руду, пшеницу, булыжник..."),
    "mech.msg.cranked": ("§aCranking!", "§aВы крутите рукоятку!"),
    "mech.msg.driller": ("§eMine Driller: layer Y=%s §7| buffer: %s", "§eШахтная буровая: слой Y=%s §7| буфер: %s"),
    "mech.msg.borer": ("§eTunnel Borer: %s/%s blocks §7| buffer: %s", "§eТуннельный проходчик: %s/%s блоков §7| буфер: %s"),
    "mech.msg.factory": ("§eFactory mode: %s §7| processed: %s", "§eРежим завода: %s §7| переработано: %s"),
    "mech.msg.factory_mode": ("§aFactory mode set: %s", "§aРежим завода: %s"),
    "mech.mode.auto": ("Auto (smelt + craft)", "Авто (переплавка + крафт)"),
    "mech.mode.smelt": ("Smelting only", "Только переплавка"),
    "mech.mode.craft": ("Tools only", "Только инструменты"),
    "mech.msg.link_start": ("§bLogistics: now click the target container (chest, barrel) with the wrench", "§bЛогистика: теперь нажмите ключом по целевому контейнеру (сундук, бочка)"),
    "mech.msg.link_done": ("§aLogistics node linked to %s, %s, %s", "§aЛогистический узел связан с %s, %s, %s"),
    "mech.msg.link_none": ("§7Logistics node is not linked. Click it with a wrench, then click a container", "§7Узел не связан. Нажмите ключом по узлу, затем по контейнеру"),
    "mech.msg.link_info": ("§bLogistics node → %s, %s, %s §7| moved: %s", "§bЛогистический узел → %s, %s, %s §7| перемещено: %s"),
    "mech.msg.link_far": ("§cToo far (max %s blocks)", "§cСлишком далеко (макс. %s блоков)"),
    "mech.msg.need_container": ("§cPlace a chest or barrel next to the machine for output", "§cПоставьте рядом с машиной сундук или бочку для выгрузки"),
    "mech.civ.founded": ("§6[Colonists] §eA new settlement was founded: §f%s", "§6[Поселенцы] §eОсновано новое поселение: §f%s"),
    "mech.civ.joined": ("§7[Colonists] A colonist joined %s", "§7[Поселенцы] Поселенец присоединился к поселению %s"),
    "mech.civ.built": ("§6[%s] §abuilt: %s", "§6[%s] §aпостроено: %s"),
    "mech.civ.born": ("§6[%s] §aa new colonist was born (population %s)", "§6[%s] §aродился новый поселенец (население %s)"),
    "mech.civ.war": ("§4[War] §c%s declared war on %s!", "§4[Война] §c%s объявил войну поселению %s!"),
    "mech.civ.peace": ("§2[Peace] §a%s and %s made peace", "§2[Мир] §a%s и %s заключили мир"),
    "mech.civ.tribute": ("§6[War] §e%s won and took tribute from %s", "§6[Война] §e%s победил и взял дань с поселения %s"),
    "mech.civ.trade": ("§3[Trade] §b%s and %s traded: %s", "§3[Торговля] §b%s и %s обменялись: %s"),
    "mech.civ.alliance": ("§2[Diplomacy] §a%s and %s are now allies", "§2[Дипломатия] §a%s и %s теперь союзники"),
    "mech.civ.fallen": ("§8[Colonists] The settlement %s has fallen", "§8[Поселенцы] Поселение %s пало"),
    "mech.civ.info": ("§6%s §7| pop %s §7| wood %s stone %s food %s iron %s §7| buildings %s", "§6%s §7| население %s §7| дерево %s камень %s еда %s железо %s §7| построек %s"),
    "mech.civ.info_role": ("§7Role: %s §7| relations: %s", "§7Роль: %s §7| отношения: %s"),
    "mech.role.builder": ("Builder", "Строитель"),
    "mech.role.gatherer": ("Gatherer", "Добытчик"),
    "mech.role.farmer": ("Farmer", "Фермер"),
    "mech.role.warrior": ("Warrior", "Воин"),
    "mech.bld.town_hall": ("Town Hall", "Ратуша"),
    "mech.bld.house": ("House", "Дом"),
    "mech.bld.farm": ("Farm", "Ферма"),
    "mech.bld.tower": ("Watchtower", "Сторожевая башня"),
    "mech.bld.well": ("Well", "Колодец"),
    "mech.bld.storage": ("Storehouse", "Склад"),
    "mech.bld.wall": ("Wall", "Стена"),
    "mech.bld.smithy": ("Smithy", "Кузница"),
    "mech.bld.market": ("Market", "Рынок"),
    "mech.bld.barracks": ("Barracks", "Казармы"),
    "mech.bld.library": ("Library", "Библиотека"),
    "mech.bld.workshop": ("Workshop", "Мастерская"),
    "mech.civ.era": ("§6[%s] §d§lenters a new era: §f%s", "§6[%s] §d§lвступает в новую эпоху: §f%s"),
    "mech.civ.upgraded": ("§6[%s] §arebuilt in the new style: %s", "§6[%s] §aперестроено по-новому: %s"),
    "mech.civ.caravan": ("§3[Trade] §ba caravan arrived at %s: %s", "§3[Торговля] §bв %s прибыл караван: %s"),
    "mech.civ.info_era": ("§dEra: §f%s §7| development %s §7| next era at %s", "§dЭпоха: §f%s §7| развитие %s §7| следующая эпоха при %s"),
    "mech.rel.war": ("war", "война"),
    "mech.rel.ally": ("alliance", "союз"),
    "mech.rel.neutral": ("neutral", "нейтралитет"),
    "mech.rel.tense": ("tense", "напряжённость"),
    "mech.res.wood": ("wood", "дерево"),
    "mech.res.stone": ("stone", "камень"),
    "mech.res.food": ("food", "еда"),
    "mech.res.iron": ("iron", "железо"),
}

SETTLEMENT_NAMES_RU = ["Каменный Оплот", "Северный Приют", "Солнечный Холм", "Тихий Брод", "Железный Форт", "Золотой Посад", "Песчаный Стан", "Лесной Двор",
                       "Речная Застава", "Медный Острог", "Ветреный Утёс", "Старый Погост"]


def gen_lang():
    for pack, is_rp in ((BP, False), (RP, True)):
        for lang, idx in (("en_US", 0), ("ru_RU", 1)):
            lines = []
            if is_rp:
                lines.append("pack.name=Mechanica: Create-style Industry" if idx == 0 else "pack.name=Mechanica: индустрия в стиле Create")
                lines.append("pack.description=Rotation power, machines, automation and self-developing colonists" if idx == 0 else "pack.description=Вращение, машины, автоматизация и самостоятельные поселенцы")
                for ident, names in BLOCK_NAMES.items():
                    lines.append(f"tile.{ident}.name={names[idx]}")
                for ident, names in ITEM_NAMES.items():
                    lines.append(f"item.{ident}={names[idx]}")
                    lines.append(f"item.{ident}.name={names[idx]}")
                lines.append(f"entity.{NS}:colonist.name=" + ("Colonist" if idx == 0 else "Поселенец"))
                lines.append(f"entity.{NS}:marker.name=" + ("Work marker" if idx == 0 else "Рабочая метка"))
                lines.append(f"item.spawn_egg.entity.{NS}:colonist.name=" + ("Colonist Spawn Egg" if idx == 0 else "Яйцо призыва поселенца"))
                for k, v in MESSAGES.items():
                    lines.append(f"{k}={v[idx]}")
            else:
                lines.append("pack.name=Mechanica BP" if idx == 0 else "pack.name=Mechanica (поведение)")
                lines.append("pack.description=Behavior pack for Mechanica" if idx == 0 else "pack.description=Пакет поведения Mechanica")
            write_text(os.path.join(pack, "texts", f"{lang}.lang"), "\n".join(lines) + "\n")
        write_json(os.path.join(pack, "texts", "languages.json"), ["en_US", "ru_RU"])


def gen_manifests():
    write_json(os.path.join(BP, "manifest.json"), {
        "format_version": 2,
        "header": {"name": "pack.name", "description": "pack.description", "uuid": UUIDS["bp_header"], "version": VERSION, "min_engine_version": MIN_ENGINE},
        "modules": [
            {"type": "data", "uuid": UUIDS["bp_data"], "version": VERSION},
            {"type": "script", "language": "javascript", "uuid": UUIDS["bp_script"], "entry": "scripts/main.js", "version": VERSION},
        ],
        "dependencies": [{"module_name": "@minecraft/server", "version": SERVER_API}, {"uuid": UUIDS["rp_header"], "version": VERSION}],
    })
    write_json(os.path.join(RP, "manifest.json"), {
        "format_version": 2,
        "header": {"name": "pack.name", "description": "pack.description", "uuid": UUIDS["rp_header"], "version": VERSION, "min_engine_version": MIN_ENGINE},
        "modules": [{"type": "resources", "uuid": UUIDS["rp_res"], "version": VERSION}],
        "dependencies": [{"uuid": UUIDS["bp_header"], "version": VERSION}],
    })


def gen_rp_json():
    write_json(os.path.join(RP, "textures", "terrain_texture.json"), {
        "resource_pack_name": "mechanica", "texture_name": "atlas.terrain", "padding": 8, "num_mip_levels": 4,
        "texture_data": {k: {"textures": v} for k, v in BLOCK_TEX.items()},
    })
    write_json(os.path.join(RP, "textures", "item_texture.json"), {
        "resource_pack_name": "mechanica", "texture_name": "atlas.items",
        "texture_data": {k: {"textures": v} for k, v in ITEM_TEX.items()},
    })
    write_json(os.path.join(RP, "textures", "flipbook_textures.json"), [
        {"flipbook_texture": path, "atlas_tile": atlas, "ticks_per_frame": 3, "frames": list(range(frames))} for atlas, path, frames in FLIPBOOKS
    ])
    write_json(os.path.join(RP, "blocks.json"), dict({"format_version": "1.21.10"}, **{ident: {"sound": snd} for ident, snd in BLOCK_SOUNDS.items()}))


def gen_script_data():
    """Data shared with the scripts: settlement names, block names for chat."""
    data = {"settlementNames": SETTLEMENT_NAMES_RU, "slots": SLOTS, "roles": ROLES}
    write_text(os.path.join(BP, "scripts", "generated.js"), "// generated by tools/build.py\nexport const GEN = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n")


def build_mcaddon():
    out = os.path.join(DIST, "Mechanica.mcaddon")
    if os.path.exists(out):
        os.remove(out)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for pack, top in ((BP, "Mechanica_BP"), (RP, "Mechanica_RP")):
            for dirpath, _, files in os.walk(pack):
                for fn in files:
                    full = os.path.join(dirpath, fn)
                    z.write(full, os.path.join(top, os.path.relpath(full, pack)))
    return out


def main():
    reset_dirs()
    gen_textures()
    gen_geometry()
    gen_blocks()
    gen_items()
    gen_recipes()
    gen_entities()
    gen_lang()
    gen_manifests()
    gen_rp_json()
    gen_script_data()
    out = build_mcaddon()
    print("built", out, os.path.getsize(out), "bytes")


if __name__ == "__main__":
    main()

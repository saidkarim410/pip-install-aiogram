"""Pixel-art texture generation for the Mechanica addon (PIL).

Style rules (vanilla-like): 5-tone ramps per material (outline, shadow, base, light, highlight),
light from the top-left, 1px dark outline on items, subtle noise on surfaces, rivets/vents on machines.
"""
import math
import random

from PIL import Image, ImageDraw

RND = random.Random(20261)
T = (0, 0, 0, 0)


def clamp(v):
    return max(0, min(255, int(v)))


def shade(c, d):
    return (clamp(c[0] + d), clamp(c[1] + d), clamp(c[2] + d))


def mix(a, b, t):
    return tuple(clamp(a[i] + (b[i] - a[i]) * t) for i in range(3))


def ramp(base, spread=1.0):
    """[outline, shadow, base, light, highlight]"""
    s = spread
    return [shade(mix(base, (20, 15, 25), 0.55), -20 * s), shade(base, -38 * s), base, shade(base, 28 * s), shade(mix(base, (255, 255, 240), 0.35), 25 * s)]


def rgba(c):
    return (c[0], c[1], c[2], 255)


def new(w=16, h=16):
    return Image.new("RGBA", (w, h), T)


def put(img, x, y, c):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), rgba(c) if len(c) == 3 else c)


def get(img, x, y):
    if 0 <= x < img.width and 0 <= y < img.height:
        return img.getpixel((x, y))
    return T


def outline(img, color):
    """1px outline around every opaque pixel (inside the canvas)."""
    src = img.copy()
    for y in range(img.height):
        for x in range(img.width):
            if get(src, x, y)[3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if get(src, x + dx, y + dy)[3]:
                    put(img, x, y, color)
                    break
    return img


def noise(img, amp=4, rnd=RND, mask=None):
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a and (mask is None or mask(x, y)):
                d = rnd.randint(-amp, amp)
                px[x, y] = (clamp(r + d), clamp(g + d), clamp(b + d), a)
    return img


def fill(img, c):
    img.paste(rgba(c), (0, 0, img.width, img.height))
    return img


def rect(img, x0, y0, x1, y1, c):
    ImageDraw.Draw(img).rectangle([x0, y0, x1, y1], fill=rgba(c))


def hline(img, x0, x1, y, c):
    for x in range(x0, x1 + 1):
        put(img, x, y, c)


def vline(img, x, y0, y1, c):
    for y in range(y0, y1 + 1):
        put(img, x, y, c)


def bevel(img, x0, y0, x1, y1, r, depth=1):
    """Raised bevel: light on top/left, dark on bottom/right."""
    for i in range(depth):
        hline(img, x0 + i, x1 - i, y0 + i, r[3] if i == 0 else r[2])
        vline(img, x0 + i, y0 + i, y1 - i, r[3] if i == 0 else r[2])
        hline(img, x0 + i, x1 - i, y1 - i, r[1])
        vline(img, x1 - i, y0 + i, y1 - i, r[1])
    put(img, x0, y0, r[4])
    put(img, x1, y1, r[0])


def rivet(img, x, y, r):
    put(img, x, y, r[4])
    put(img, x + 1, y, r[2])
    put(img, x, y + 1, r[2])
    put(img, x + 1, y + 1, r[0])


# ----------------------------------------------------------------------------- surfaces

def stone(base=(128, 128, 128), rnd=RND, streaks=False):
    r = ramp(base)
    img = fill(new(), base)
    d = ImageDraw.Draw(img)
    for _ in range(14):
        x, y = rnd.randint(-2, 15), rnd.randint(-2, 15)
        w, h = rnd.randint(2, 5), rnd.randint(1, 3) if streaks else rnd.randint(2, 4)
        tone = rnd.choice([r[1], r[3], shade(base, -16), shade(base, 14)])
        d.ellipse([x, y, x + w, y + h], fill=rgba(tone))
    noise(img, 5, rnd)
    for _ in range(5):
        x, y = rnd.randint(0, 15), rnd.randint(0, 15)
        for _ in range(rnd.randint(2, 4)):
            put(img, x, y, r[1])
            x = (x + rnd.choice([-1, 0, 1])) % 16
            y = (y + 1) % 16
    return img


ORE_SHAPES = [
    ["..2.", ".233", "2334", ".23."],
    [".33", "234", ".2."],
    ["34", "22"],
    ["..3.", ".234", "2234", ".22."],
]


def ore(base_img, color, count=6, rnd=RND):
    img = base_img.copy()
    r = ramp(color, 1.2)
    placed = []
    tries = 0
    while len(placed) < count and tries < 60:
        tries += 1
        shape = rnd.choice(ORE_SHAPES)
        w, h = len(shape[0]), len(shape)
        x0, y0 = rnd.randint(0, 16 - w), rnd.randint(0, 16 - h)
        if any(abs(x0 - px) < 4 and abs(y0 - py) < 4 for px, py in placed):
            continue
        placed.append((x0, y0))
        for yy, row in enumerate(shape):
            for xx, ch in enumerate(row):
                if ch == ".":
                    continue
                put(img, x0 + xx, y0 + yy, r[int(ch)])
        # dark rim bottom-right of the cluster
        for yy, row in enumerate(shape):
            for xx, ch in enumerate(row):
                if ch != "." and (xx + 1 >= w or row[xx + 1] == ".") and get(img, x0 + xx + 1, y0 + yy)[3] and x0 + xx + 1 < 16:
                    c = get(img, x0 + xx + 1, y0 + yy)
                    put(img, x0 + xx + 1, y0 + yy, shade(c[:3], -30))
    return img


def metal_block(color, rnd=RND):
    r = ramp(color)
    img = fill(new(), color)
    noise(img, 3, rnd)
    bevel(img, 0, 0, 15, 15, r, 2)
    rect(img, 4, 4, 11, 11, shade(color, -8))
    bevel(img, 4, 4, 11, 11, [r[0], r[1], r[2], r[1], r[2]], 1)
    for x, y in ((2, 2), (12, 2), (2, 12), (12, 12)):
        rivet(img, x, y, r)
    return img


def planks(color=(168, 130, 76), rnd=RND, shift=0):
    r = ramp(color)
    img = fill(new(), color)
    noise(img, 4, rnd)
    for i in range(4):
        y = (i * 4 + shift) % 16
        hline(img, 0, 15, (y + 3) % 16, r[0])
        hline(img, 0, 15, y, r[3])
        gx = rnd.randint(0, 15)
        for x in range(gx, gx + 6):
            put(img, x % 16, (y + 1 + (x // 3) % 2) % 16, r[1])
        put(img, (gx + 9) % 16, (y + 2) % 16, r[0])
    return img


def casing(frame=(150, 118, 68), inner=(132, 135, 140), rnd=RND):
    fr = ramp(frame)
    ir = ramp(inner)
    img = fill(new(), inner)
    noise(img, 4, rnd)
    for i in range(3):
        c = fr[3] if i == 0 else (fr[2] if i == 1 else fr[1])
        hline(img, i, 15 - i, i, c)
        vline(img, i, i, 15 - i, c)
        hline(img, i, 15 - i, 15 - i, fr[1] if i < 2 else fr[0])
        vline(img, 15 - i, i, 15 - i, fr[1] if i < 2 else fr[0])
    for x in range(3, 13):
        if x % 3 == 0:
            put(img, x, 1, fr[1])
            put(img, x, 14, fr[0])
            put(img, 1, x, fr[1])
            put(img, 14, x, fr[0])
    bevel(img, 3, 3, 12, 12, [ir[0], ir[1], ir[2], ir[3], ir[4]], 1)
    for x, y in ((4, 4), (10, 4), (4, 10), (10, 10)):
        rivet(img, x, y, ir)
    return img


def cylinder(color, offset=0, rnd=RND):
    """Vertical cylinder shading; `offset` rotates the highlight (for spin frames)."""
    r = ramp(color)
    img = new()
    for x in range(16):
        t = ((x + offset) % 16) / 16.0
        v = math.cos((t - 0.3) * 2 * math.pi)  # highlight around x≈5
        tone = r[4] if v > 0.92 else r[3] if v > 0.45 else r[2] if v > -0.3 else r[1] if v > -0.85 else r[0]
        for y in range(16):
            put(img, x, y, tone)
    noise(img, 3, rnd)
    for y in (0, 15):
        hline(img, 0, 15, y, r[1])
    return img


def panel(color, frame=(70, 72, 78), vents=True, rnd=RND, stripe=None):
    fr = ramp(frame)
    pr = ramp(color)
    img = fill(new(), color)
    noise(img, 3, rnd)
    bevel(img, 0, 0, 15, 15, fr, 1)
    bevel(img, 1, 1, 14, 14, pr, 1)
    for x, y in ((2, 2), (12, 2), (2, 12), (12, 12)):
        rivet(img, x, y, pr)
    if vents:
        for y in (9, 11, 13):
            hline(img, 4, 11, y, pr[1])
            hline(img, 4, 11, y - 1, pr[3])
    if stripe:
        sr = ramp(stripe)
        hline(img, 2, 13, 5, sr[2])
        hline(img, 2, 13, 6, sr[1])
    return img


def gear_face(color=(120, 112, 95), teeth=8, r_out=7.5, r_in=5.5, hole=1.5, size=16, angle=0.0, rnd=RND):
    r = ramp(color)
    img = new(size)
    c = (size - 1) / 2
    for y in range(size):
        for x in range(size):
            dx, dy = x - c, y - c
            rad = math.hypot(dx, dy)
            a = math.atan2(dy, dx) + math.radians(angle)
            sector = (a / (2 * math.pi) * teeth) % 1.0
            if rad < hole:
                continue
            if rad <= r_in or (rad <= r_out and sector < 0.5):
                # light from top-left: normalized direction
                lit = (-dx - dy) / (rad + 0.001)
                tone = r[3] if lit > 0.6 else r[2] if lit > -0.5 else r[1]
                if rad > r_out - 1.0 or (rad > r_in - 1.0 and rad <= r_in and sector >= 0.5):
                    tone = r[1] if lit < 0.2 else r[2]
                if rad < hole + 1.2:
                    tone = r[0]
                put(img, x, y, tone)
    noise(img, 3, rnd)
    return img


def rings(base=(118, 118, 118), rnd=RND):
    r = ramp(base)
    img = fill(new(), base)
    noise(img, 4, rnd)
    c = 7.5
    for y in range(16):
        for x in range(16):
            d = math.hypot(x - c, y - c)
            if int(d) % 3 == 0 and d > 1.5:
                put(img, x, y, r[1] if (x + y) % 2 else r[0])
            if d < 1.6:
                put(img, x, y, r[0])
    return img


def fire_window(frame_img, rnd=RND):
    img = frame_img.copy()
    rect(img, 3, 3, 12, 12, (35, 30, 32))
    for y in range(4, 12):
        t = (11 - y) / 7.0
        col = mix((255, 90, 20), (255, 230, 110), t)
        for x in range(4, 12):
            if rnd.random() < 0.25 + t * 0.5:
                put(img, x, y, shade(col, rnd.randint(-25, 25)))
    for x in (5, 8, 11):
        vline(img, x, 3, 12, (60, 55, 58))
    hline(img, 3, 12, 3, (80, 75, 78))
    return img


def arrow_panel(panel_img, color=(240, 240, 240)):
    img = panel_img.copy()
    r = ramp(color)
    pts = [(8, 3), (13, 8), (10, 8), (10, 12), (6, 12), (6, 8), (3, 8)]
    d = ImageDraw.Draw(img)
    d.polygon(pts, fill=rgba(r[2]))
    d.line([(8, 3), (13, 8)], fill=rgba(r[1]))
    d.line([(8, 3), (3, 8)], fill=rgba(r[4]))
    d.line([(6, 12), (10, 12)], fill=rgba(r[1]))
    return img


# ----------------------------------------------------------------------------- spin frames

def stack(frames):
    out = Image.new("RGBA", (16, 16 * len(frames)))
    for i, f in enumerate(frames):
        out.paste(f, (0, i * 16))
    return out


def sheen_frames(base, n=4, lighten=38):
    frames = []
    for f in range(n):
        fr = base.copy()
        px = fr.load()
        for y in range(16):
            for x in range(16):
                if (x + y + f * 4) % 16 < 2:
                    r, g, b, a = px[x, y]
                    if a:
                        px[x, y] = (clamp(r + lighten), clamp(g + lighten), clamp(b + lighten), a)
        frames.append(fr)
    return stack(frames)


# ----------------------------------------------------------------------------- items

def ingot(color):
    r = ramp(color, 1.1)
    img = new()
    d = ImageDraw.Draw(img)
    top = [(2, 8), (9, 3), (14, 6), (7, 11)]
    front = [(2, 8), (7, 11), (7, 14), (2, 11)]
    right = [(7, 11), (14, 6), (14, 9), (7, 14)]
    d.polygon(top, fill=rgba(r[3]))
    d.polygon(front, fill=rgba(r[2]))
    d.polygon(right, fill=rgba(r[1]))
    d.line([(3, 8), (9, 4)], fill=rgba(r[4]))
    d.line([(4, 9), (9, 5)], fill=rgba(r[4]))
    d.line([(7, 11), (14, 6)], fill=rgba(r[2]))
    hline(img, 3, 6, 13, r[1])
    outline(img, r[0])
    return img


def sheet(color):
    r = ramp(color, 1.1)
    img = new()
    d = ImageDraw.Draw(img)
    d.polygon([(1, 9), (10, 3), (15, 6), (6, 12)], fill=rgba(r[2]))
    d.polygon([(1, 9), (6, 12), (6, 13), (1, 10)], fill=rgba(r[1]))
    d.polygon([(6, 12), (15, 6), (15, 7), (6, 13)], fill=rgba(r[1]))
    d.line([(2, 9), (10, 4)], fill=rgba(r[4]))
    d.line([(4, 10), (9, 7)], fill=rgba(r[3]))
    outline(img, r[0])
    return img


def chunk(img, x, y, size, r, rnd):
    """Irregular rock chunk with light top-left."""
    d = ImageDraw.Draw(img)
    pts = []
    for i in range(6):
        a = i * math.pi / 3 + rnd.uniform(-0.3, 0.3)
        rr = size * rnd.uniform(0.7, 1.1)
        pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr))
    d.polygon(pts, fill=rgba(r[2]))
    for px, py in pts:
        if px + py < x + y:
            put(img, int(round(px)), int(round(py)), r[3])
        else:
            put(img, int(round(px)), int(round(py)), r[1])
    put(img, int(x - size * 0.4), int(y - size * 0.4), r[4])


def crushed(color, rnd=RND):
    r = ramp(color, 1.1)
    img = new()
    for cx, cy, s in ((4, 5, 2.4), (10, 4, 2.0), (7, 9, 2.6), (12, 10, 2.2), (4, 11, 1.8), (9, 13, 1.6)):
        chunk(img, cx + rnd.uniform(-0.5, 0.5), cy + rnd.uniform(-0.5, 0.5), s, r, rnd)
    outline(img, r[0])
    return img


def raw_lump(color, rock=(110, 108, 112), rnd=RND):
    r = ramp(color, 1.1)
    rr = ramp(rock)
    img = new()
    d = ImageDraw.Draw(img)
    d.polygon([(3, 6), (7, 2), (12, 3), (14, 8), (12, 13), (6, 14), (2, 11)], fill=rgba(r[2]))
    d.line([(3, 6), (7, 2), (12, 3)], fill=rgba(r[3]))
    d.line([(14, 8), (12, 13), (6, 14), (2, 11)], fill=rgba(r[1]))
    for x, y in ((9, 6), (10, 7), (6, 9), (11, 11), (5, 5)):
        put(img, x, y, rr[2])
        put(img, x + 1, y, rr[1])
    put(img, 6, 4, r[4])
    put(img, 7, 4, r[4])
    put(img, 5, 5, r[3])
    outline(img, r[0])
    return img


def pile(color, rnd=RND):
    r = ramp(color, 0.9)
    img = new()
    d = ImageDraw.Draw(img)
    d.polygon([(1, 13), (6, 6), (9, 4), (12, 8), (15, 13)], fill=rgba(r[2]))
    d.ellipse([1, 11, 15, 14], fill=rgba(r[1]))
    d.polygon([(2, 12), (6, 7), (9, 5), (11, 8)], fill=rgba(r[3]))
    put(img, 8, 5, r[4])
    put(img, 7, 6, r[4])
    for _ in range(8):
        put(img, rnd.randint(3, 12), rnd.randint(8, 12), rnd.choice([r[1], r[3]]))
    outline(img, r[0])
    return img


def dough(color=(226, 204, 158)):
    r = ramp(color, 0.9)
    img = new()
    d = ImageDraw.Draw(img)
    d.ellipse([2, 5, 13, 14], fill=rgba(r[2]))
    d.ellipse([5, 2, 12, 9], fill=rgba(r[2]))
    d.ellipse([3, 6, 9, 10], fill=rgba(r[3]))
    put(img, 6, 4, r[4])
    put(img, 7, 4, r[4])
    d.arc([3, 6, 13, 14], 20, 110, fill=rgba(r[1]))
    outline(img, r[0])
    return img


def wrench(color=(214, 170, 70)):
    r = ramp(color, 1.1)
    img = new()
    d = ImageDraw.Draw(img)
    d.line([(3, 12), (10, 5)], fill=rgba(r[2]), width=3)
    d.ellipse([8, 1, 14, 7], fill=rgba(r[2]))
    d.rectangle([11, 1, 15, 3], fill=T)
    d.rectangle([12, 1, 15, 4], fill=T)
    d.ellipse([1, 10, 5, 14], fill=rgba(r[2]))
    d.rectangle([2, 12, 3, 13], fill=T)
    d.line([(4, 11), (10, 5)], fill=rgba(r[4]))
    d.line([(4, 13), (11, 6)], fill=rgba(r[1]))
    put(img, 9, 2, r[4])
    put(img, 9, 3, r[3])
    outline(img, r[0])
    return img


def goggles(color=(214, 170, 70)):
    r = ramp(color, 1.1)
    img = new()
    d = ImageDraw.Draw(img)
    d.rectangle([1, 7, 14, 9], fill=rgba((70, 55, 40)))
    hline(img, 1, 14, 7, (95, 75, 55))
    for cx in (4, 11):
        d.ellipse([cx - 3, 4, cx + 3, 10], fill=rgba(r[2]))
        d.ellipse([cx - 2, 5, cx + 2, 9], fill=rgba((90, 180, 215)))
        put(img, cx - 1, 6, (210, 245, 255))
        put(img, cx, 6, (160, 220, 240))
        put(img, cx + 1, 8, (50, 120, 160))
        put(img, cx - 3, 5, r[4])
    put(img, 7, 7, r[3])
    put(img, 8, 7, r[3])
    outline(img, r[0])
    return img


def whisk():
    wood = ramp((150, 110, 65))
    wire = ramp((200, 200, 205))
    img = new()
    d = ImageDraw.Draw(img)
    d.rectangle([11, 1, 13, 6], fill=rgba(wood[2]))
    vline(img, 11, 1, 6, wood[3])
    vline(img, 13, 1, 6, wood[1])
    for ox in (-3, 0, 3):
        d.line([(12, 7), (8 + ox, 13)], fill=rgba(wire[2]))
    d.ellipse([4, 9, 13, 15], outline=rgba(wire[2]))
    d.ellipse([6, 8, 12, 14], outline=rgba(wire[3]))
    put(img, 12, 7, wire[1])
    outline(img, wire[0])
    return img


# ----------------------------------------------------------------------------- entities

def humanoid_skin(clan_color, role, skin=(228, 180, 140), rnd=RND):
    """64x64 skin layout: head(0,0) hat(32,0) body(16,16) rarm(40,16) rleg(0,16) larm(32,48) lleg(16,48)."""
    img = Image.new("RGBA", (64, 64), T)
    d = ImageDraw.Draw(img)
    sr = ramp(skin, 0.8)
    cr = ramp(clan_color)
    pants = ramp((62, 62, 92))
    boots = ramp((58, 40, 28))
    hair = ramp(rnd.choice([(70, 45, 28), (35, 28, 24), (125, 85, 42), (205, 175, 95), (120, 50, 35)]))

    def box(u, v, w, h, dpt, top, side, bottom=None, front=None):
        bottom = bottom or shade(side, -30)
        d.rectangle([u + dpt, v, u + dpt + w - 1, v + dpt - 1], fill=rgba(top))
        d.rectangle([u + dpt + w, v, u + dpt + 2 * w - 1, v + dpt - 1], fill=rgba(bottom))
        d.rectangle([u, v + dpt, u + 2 * w + 2 * dpt - 1, v + dpt + h - 1], fill=rgba(side))
        if front:
            d.rectangle([u + dpt, v + dpt, u + dpt + w - 1, v + dpt + h - 1], fill=rgba(front))

    # head: hair on top and back, face in front (u 8..15, v 8..15)
    box(0, 0, 8, 8, 8, hair[2], sr[2], sr[1])
    d.rectangle([0, 8, 31, 10], fill=rgba(hair[2]))  # hair band all around
    d.rectangle([24, 8, 31, 15], fill=rgba(hair[1]))  # back of head
    d.rectangle([8, 8, 15, 9], fill=rgba(hair[2]))
    put(img, 8, 10, hair[2])
    put(img, 15, 10, hair[2])
    hline(img, 9, 14, 8, hair[3])
    # face
    for ex in (9, 13):
        put(img, ex, 12, (255, 255, 255))
        put(img, ex + 1, 12, (45, 70, 140))
        put(img, ex, 11, sr[1])
        put(img, ex + 1, 11, sr[1])
    put(img, 11, 13, sr[1])  # nose
    put(img, 12, 13, sr[1])
    put(img, 11, 14, (150, 85, 80))  # mouth
    put(img, 12, 14, (150, 85, 80))
    put(img, 10, 14, sr[1])
    # cheeks
    put(img, 9, 13, shade(skin, -10))
    put(img, 14, 13, shade(skin, -10))
    # hat layer per role
    hat_colors = {"builder": (238, 196, 40), "gatherer": (125, 88, 50), "farmer": (210, 175, 95), "warrior": (150, 155, 165)}
    hr = ramp(hat_colors[role])
    if role == "builder":  # hard hat: top + upper half of sides, brim in front
        box(32, 0, 8, 8, 8, hr[3], hr[2], hr[1])
        d.rectangle([32, 12, 63, 15], fill=T)
        hline(img, 40, 47, 11, hr[1])  # brim shadow
        hline(img, 41, 46, 8, hr[4])
        vline(img, 44, 0, 7, hr[4])  # ridge on top
    elif role == "gatherer":  # hood: covers sides and back, open face
        box(32, 0, 8, 8, 8, hr[2], hr[2], hr[1])
        d.rectangle([40, 10, 47, 15], fill=T)  # face opening
        d.rectangle([32, 14, 63, 15], fill=T)
        hline(img, 40, 47, 9, hr[1])
    elif role == "farmer":  # straw hat: wide brim band, open face
        box(32, 0, 8, 8, 8, hr[3], hr[2], hr[1])
        d.rectangle([32, 11, 63, 15], fill=T)
        hline(img, 32, 63, 10, hr[1])
        hline(img, 32, 63, 9, (120, 60, 40))  # ribbon
        d.rectangle([40, 11, 47, 15], fill=T)
    else:  # warrior: iron helmet with nose guard
        box(32, 0, 8, 8, 8, hr[3], hr[2], hr[1])
        d.rectangle([32, 12, 63, 15], fill=T)
        d.rectangle([40, 11, 47, 11], fill=T)
        put(img, 43, 11, hr[2])
        put(img, 44, 11, hr[2])
        put(img, 43, 12, hr[1])
        put(img, 44, 12, hr[1])
        hline(img, 40, 47, 8, hr[4])
    # body (shirt in clan color with collar, belt, buttons)
    box(16, 16, 8, 12, 4, cr[2], cr[2], cr[1])
    d.rectangle([20, 20, 27, 21], fill=rgba(cr[3]))  # collar
    put(img, 23, 22, cr[1])
    put(img, 24, 22, cr[1])
    for y in (23, 25, 27):
        put(img, 23, y, cr[4])
    d.rectangle([20, 29, 27, 30], fill=rgba((70, 48, 30)))  # belt
    put(img, 23, 29, (220, 190, 90))
    put(img, 24, 29, (220, 190, 90))
    d.rectangle([28, 20, 31, 30], fill=rgba(cr[1]))  # right side darker
    d.rectangle([32, 20, 39, 30], fill=rgba(cr[1]))  # back
    # arms: sleeve + hand
    for (u, v) in ((40, 16), (32, 48)):
        box(u, v, 4, 12, 4, sr[2], cr[2], sr[1])
        d.rectangle([u, v + 10, u + 15, v + 15], fill=rgba(sr[2]))
        hline(img, u, u + 15, v + 9, cr[1])
        d.rectangle([u + 8, v + 4, u + 11, v + 9], fill=rgba(cr[1]))
    # legs: pants + boots
    for (u, v) in ((0, 16), (16, 48)):
        box(u, v, 4, 12, 4, pants[2], pants[2], pants[1])
        d.rectangle([u, v + 13, u + 15, v + 15], fill=rgba(boots[2]))
        hline(img, u, u + 15, v + 12, boots[1])
        vline(img, u + 5, v + 4, v + 12, pants[3])
        d.rectangle([u + 8, v + 4, u + 11, v + 12], fill=rgba(pants[1]))
    return img


def pack_icon(size=256, bg=(44, 40, 52), gear=(214, 170, 70)):
    img = Image.new("RGBA", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / size
        d.line([(0, y), (size, y)], fill=rgba(mix(shade(bg, 25), shade(bg, -20), t)))
    c = size / 2
    r = ramp(gear)

    def gear_poly(cx, cy, ro, ri, teeth, rot=0.0):
        pts = []
        for i in range(teeth * 2):
            a = i * math.pi / teeth + rot
            rad = ro if i % 2 == 0 else ri
            pts.append((cx + math.cos(a) * rad, cy + math.sin(a) * rad))
            a2 = a + math.pi / teeth * 0.55
            pts.append((cx + math.cos(a2) * rad, cy + math.sin(a2) * rad))
        return pts

    d.polygon(gear_poly(c + 6, c + 6, size * 0.40, size * 0.32, 12), fill=rgba(r[0]))
    d.polygon(gear_poly(c, c, size * 0.40, size * 0.32, 12), fill=rgba(r[2]))
    d.polygon(gear_poly(c - 3, c - 3, size * 0.36, size * 0.29, 12), fill=rgba(r[3]))
    d.ellipse([c - size * 0.2, c - size * 0.2, c + size * 0.2, c + size * 0.2], fill=rgba(r[1]))
    d.ellipse([c - size * 0.16, c - size * 0.16, c + size * 0.16, c + size * 0.16], fill=rgba(r[2]))
    d.ellipse([c - size * 0.07, c - size * 0.07, c + size * 0.07, c + size * 0.07], fill=rgba(bg))
    sm = gear_poly(c + size * 0.3, c - size * 0.3, size * 0.14, size * 0.1, 8, 0.2)
    d.polygon([(x + 3, y + 3) for x, y in sm], fill=rgba(r[0]))
    d.polygon(sm, fill=rgba((205, 210, 215)))
    d.ellipse([c + size * 0.3 - size * 0.04, c - size * 0.3 - size * 0.04, c + size * 0.3 + size * 0.04, c - size * 0.3 + size * 0.04], fill=rgba(bg))
    return img

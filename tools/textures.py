"""Procedural pixel-art texture generation for the Mechanica addon (PIL)."""
import math
import random

from PIL import Image, ImageDraw

RND = random.Random(1337)


def clamp(v):
    return max(0, min(255, int(v)))


def shade(color, delta):
    return tuple(clamp(c + delta) for c in color[:3]) + ((color[3],) if len(color) > 3 else ())


def new(size=16, color=(0, 0, 0, 0)):
    return Image.new("RGBA", (size, size), color)


def noise_fill(img, base, amp=10, rnd=RND):
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            d = rnd.randint(-amp, amp)
            px[x, y] = shade(base, d) + (255,)
    return img


def stone(base=(127, 127, 127), amp=12, cracks=True, rnd=RND):
    img = new()
    noise_fill(img, base, amp, rnd)
    px = img.load()
    if cracks:
        for _ in range(6):
            x, y = rnd.randint(0, 15), rnd.randint(0, 15)
            for _ in range(rnd.randint(2, 5)):
                px[x, y] = shade(base, -30) + (255,)
                x = (x + rnd.choice([-1, 0, 1])) % 16
                y = (y + rnd.choice([0, 1])) % 16
    return img


def ore(base_img, color, count=7, rnd=RND):
    img = base_img.copy()
    px = img.load()
    for _ in range(count):
        x, y = rnd.randint(1, 13), rnd.randint(1, 13)
        shape = rnd.choice([[(0, 0), (1, 0)], [(0, 0), (0, 1)], [(0, 0), (1, 0), (0, 1)], [(0, 0), (1, 0), (1, 1), (0, 1)]])
        for i, (dx, dy) in enumerate(shape):
            c = shade(color, -25 if i == len(shape) - 1 else (20 if i == 0 else 0))
            px[x + dx, y + dy] = c + (255,)
    return img


def metal_block(color, rnd=RND):
    img = new()
    noise_fill(img, color, 5, rnd)
    px = img.load()
    for i in range(16):
        px[i, 0] = shade(color, 35) + (255,)
        px[0, i] = shade(color, 35) + (255,)
        px[i, 15] = shade(color, -45) + (255,)
        px[15, i] = shade(color, -45) + (255,)
    for i in range(2, 14):
        px[i, 2] = shade(color, 18) + (255,)
        px[2, i] = shade(color, 18) + (255,)
        px[i, 13] = shade(color, -25) + (255,)
        px[13, i] = shade(color, -25) + (255,)
    return img


def planks(color=(162, 125, 72), rnd=RND):
    img = new()
    noise_fill(img, color, 7, rnd)
    px = img.load()
    for y in (3, 7, 11, 15):
        for x in range(16):
            px[x, y] = shade(color, -45) + (255,)
    for y0, x0 in ((0, 8), (4, 2), (8, 12), (12, 6)):
        for y in range(y0, min(16, y0 + 3)):
            px[x0, y] = shade(color, -40) + (255,)
    return img


def casing(frame=(150, 120, 70), inner=(135, 137, 140), rnd=RND):
    img = new()
    noise_fill(img, inner, 8, rnd)
    px = img.load()
    for i in range(16):
        for t in range(2):
            for (x, y) in ((i, t), (i, 15 - t), (t, i), (15 - t, i)):
                px[x, y] = shade(frame, 10 if t == 0 else -15) + (255,)
    for x, y in ((2, 2), (13, 2), (2, 13), (13, 13)):
        px[x, y] = shade(frame, -60) + (255,)
    return img


def shaft_tex(color=(110, 100, 85), rnd=RND):
    img = new()
    noise_fill(img, color, 6, rnd)
    px = img.load()
    for y in range(16):
        px[0, y] = shade(color, 30) + (255,)
        px[15, y] = shade(color, -40) + (255,)
        px[7, y] = shade(color, 12) + (255,)
    return img


def spin_frames(base, frames=4, lighten=45):
    """Stack frames vertically: a diagonal highlight band sweeping over the base texture."""
    w, h = base.size
    out = Image.new("RGBA", (w, h * frames))
    for f in range(frames):
        fr = base.copy()
        px = fr.load()
        for y in range(h):
            for x in range(w):
                if (x + y + f * (w // frames)) % w < 3:
                    r, g, b, a = px[x, y]
                    if a:
                        px[x, y] = (clamp(r + lighten), clamp(g + lighten), clamp(b + lighten), a)
        out.paste(fr, (0, f * h))
    return out


def gear_face(color=(120, 112, 95), teeth=8, r_out=7.5, r_in=5.5, hole=1.5, size=16, rnd=RND):
    img = new(size)
    px = img.load()
    c = (size - 1) / 2
    for y in range(size):
        for x in range(size):
            dx, dy = x - c, y - c
            r = math.hypot(dx, dy)
            a = math.atan2(dy, dx)
            sector = (a / (2 * math.pi) * teeth) % 1.0
            if r < hole:
                continue
            if r <= r_in or (r <= r_out and sector < 0.5):
                d = rnd.randint(-8, 8) + (25 if r < r_in - 1.5 else 0) - (30 if r > r_out - 1.2 else 0)
                px[x, y] = shade(color, d) + (255,)
    return img


def ingot(color):
    img = new()
    d = ImageDraw.Draw(img)
    top = [(2, 7), (8, 3), (14, 6), (8, 10)]
    front = [(2, 7), (8, 10), (8, 14), (2, 11)]
    right = [(8, 10), (14, 6), (14, 10), (8, 14)]
    d.polygon(top, fill=shade(color, 35) + (255,))
    d.polygon(front, fill=color + (255,))
    d.polygon(right, fill=shade(color, -45) + (255,))
    d.line([(2, 7), (8, 3), (14, 6)], fill=shade(color, 60) + (255,))
    d.line([(2, 11), (8, 14), (14, 10)], fill=shade(color, -80) + (255,))
    return img


def sheet(color):
    img = new()
    d = ImageDraw.Draw(img)
    d.polygon([(1, 9), (9, 3), (15, 6), (7, 12)], fill=color + (255,))
    d.line([(1, 9), (9, 3), (15, 6)], fill=shade(color, 50) + (255,))
    d.line([(1, 9), (7, 12), (15, 6)], fill=shade(color, -60) + (255,))
    d.line([(1, 10), (7, 13), (15, 7)], fill=shade(color, -90) + (255,))
    return img


def lumps(color, n=5, rmin=1, rmax=2, outline=-70, rnd=RND, dark_patches=None):
    img = new()
    d = ImageDraw.Draw(img)
    for _ in range(n):
        r = rnd.randint(rmin, rmax)
        x, y = rnd.randint(2 + r, 13 - r), rnd.randint(3 + r, 13 - r)
        d.ellipse([x - r, y - r, x + r, y + r], fill=color + (255,), outline=shade(color, outline) + (255,))
        img.putpixel((x - r // 2, y - r // 2), shade(color, 50) + (255,))
    if dark_patches:
        for _ in range(dark_patches):
            x, y = rnd.randint(3, 12), rnd.randint(3, 12)
            if img.getpixel((x, y))[3]:
                img.putpixel((x, y), (95, 95, 95, 255))
    return img


def pile(color, rnd=RND, h=6):
    img = new()
    d = ImageDraw.Draw(img)
    d.polygon([(2, 13), (8, 13 - h), (14, 13)], fill=color + (255,))
    d.ellipse([1, 11, 14, 14], fill=shade(color, -10) + (255,))
    for _ in range(10):
        x, y = rnd.randint(3, 12), rnd.randint(9, 13)
        img.putpixel((x, y), shade(color, rnd.choice([-30, 30])) + (255,))
    return img


def tool_wrench(color=(205, 170, 70)):
    img = new()
    d = ImageDraw.Draw(img)
    d.line([(3, 12), (11, 4)], fill=color + (255,), width=3)
    d.ellipse([9, 1, 15, 7], fill=color + (255,))
    d.rectangle([11, 2, 15, 4], fill=(0, 0, 0, 0))
    d.ellipse([1, 10, 5, 14], fill=shade(color, -40) + (255,))
    d.line([(4, 11), (10, 5)], fill=shade(color, 60) + (255,))
    return img


def goggles(color=(214, 170, 70)):
    img = new()
    d = ImageDraw.Draw(img)
    d.rectangle([1, 7, 14, 9], fill=(60, 50, 40, 255))
    for cx in (4, 11):
        d.ellipse([cx - 3, 4, cx + 3, 10], fill=color + (255,))
        d.ellipse([cx - 2, 5, cx + 2, 9], fill=(120, 200, 230, 255))
        img.putpixel((cx - 1, 6), (220, 245, 255, 255))
    return img


def whisk():
    img = new()
    d = ImageDraw.Draw(img)
    d.line([(12, 2), (12, 7)], fill=(110, 100, 85, 255), width=2)
    for off in (-3, 0, 3):
        d.line([(12, 7), (8 + off, 13)], fill=(190, 190, 195, 255))
        d.line([(12, 7), (10 + off, 14)], fill=(150, 150, 155, 255))
    d.ellipse([5, 11, 14, 15], outline=(190, 190, 195, 255))
    return img


def humanoid_skin(clan_color, role_color, skin=(224, 172, 132), rnd=RND):
    """Standard 64x64 skin layout: head(0,0) hat(32,0) body(16,16) rarm(40,16) rleg(0,16) larm(32,48) lleg(16,48)."""
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pants = (60, 60, 90)
    boots = (50, 35, 25)
    hair = rnd.choice([(60, 40, 25), (30, 25, 20), (120, 80, 40), (200, 170, 90)])

    def box(u, v, w, h, dpt, top, side, bottom=None):
        bottom = bottom or shade(side, -30)
        d.rectangle([u + dpt, v, u + dpt + w - 1, v + dpt - 1], fill=top + (255,))
        d.rectangle([u + dpt + w, v, u + dpt + 2 * w - 1, v + dpt - 1], fill=bottom + (255,))
        d.rectangle([u, v + dpt, u + 2 * w + 2 * dpt - 1, v + dpt + h - 1], fill=side + (255,))

    box(0, 0, 8, 8, 8, hair, skin, skin)  # head
    d.rectangle([8, 8, 23, 10], fill=hair + (255,))  # hair line on front/sides
    d.rectangle([8, 8, 15, 8], fill=hair + (255,))
    # face (front face of head is at u=8..15, v=8..15)
    for ex in (10, 13):
        d.point((ex, 12), fill=(255, 255, 255, 255))
        d.point((ex + 1, 12), fill=(50, 70, 140, 255))
    d.rectangle([11, 14, 12, 14], fill=shade(skin, -60) + (255,))
    # hat layer (role)
    box(32, 0, 8, 8, 8, role_color, role_color, role_color)
    d.rectangle([40, 11, 63, 15], fill=(0, 0, 0, 0))  # keep face visible below the brim
    d.rectangle([32, 11, 39, 15], fill=(0, 0, 0, 0))
    d.rectangle([48, 10, 55, 15], fill=(0, 0, 0, 0))
    # body
    box(16, 16, 8, 12, 4, clan_color, clan_color)
    d.rectangle([20, 20, 27, 22], fill=shade(clan_color, 40) + (255,))  # collar highlight
    d.rectangle([22, 24, 25, 27], fill=shade(clan_color, -50) + (255,))  # belt buckle
    # arms
    box(40, 16, 4, 12, 4, skin, clan_color)
    d.rectangle([40, 25, 55, 31], fill=skin + (255,))
    box(32, 48, 4, 12, 4, skin, clan_color)
    d.rectangle([32, 57, 47, 63], fill=skin + (255,))
    # legs
    box(0, 16, 4, 12, 4, pants, pants)
    d.rectangle([0, 29, 15, 31], fill=boots + (255,))
    box(16, 48, 4, 12, 4, pants, pants)
    d.rectangle([16, 61, 31, 63], fill=boots + (255,))
    return img


def pack_icon(size=256, bg=(40, 40, 48), gear=(214, 170, 70)):
    img = Image.new("RGBA", (size, size), bg + (255,))
    d = ImageDraw.Draw(img)
    c = size / 2
    teeth = 12
    pts = []
    for i in range(teeth * 2):
        a = i * math.pi / teeth
        r = size * (0.42 if i % 2 == 0 else 0.33)
        pts.append((c + math.cos(a) * r, c + math.sin(a) * r))
        a2 = a + math.pi / teeth * 0.55
        pts.append((c + math.cos(a2) * r, c + math.sin(a2) * r))
    d.polygon(pts, fill=gear + (255,))
    d.ellipse([c - size * 0.2, c - size * 0.2, c + size * 0.2, c + size * 0.2], fill=shade(gear, -60) + (255,))
    d.ellipse([c - size * 0.08, c - size * 0.08, c + size * 0.08, c + size * 0.08], fill=bg + (255,))
    return img

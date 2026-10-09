#!/usr/bin/env python3
"""Extract game pieces from artboard 2, build playable board bg from artboard 1,
and measure baked milestone-card slot transforms."""
import json, math, os
from PIL import Image, ImageDraw, ImageFilter

SCRATCH = os.getcwd()
import sys
PIECES_SRC = sys.argv[1] if len(sys.argv) > 1 else "pieces-2.png"
BOARD_SRC = sys.argv[2] if len(sys.argv) > 2 else "board-1.png"
OUT = os.path.join(SCRATCH, "assets")
os.makedirs(OUT, exist_ok=True)

# ---------- 1. pieces from artboard 2 (RGBA) ----------
pieces = Image.open(os.path.join(SCRATCH, PIECES_SRC))
W, H = pieces.size
DS = 8
small = pieces.resize((W // DS, H // DS), Image.NEAREST)
sw, sh = small.size
alpha = small.getdata(3)  # alpha band
mask = [a > 10 for a in alpha]

def cc_boxes():
    seen = [False] * (sw * sh)
    boxes = []
    for start in range(sw * sh):
        if not mask[start] or seen[start]:
            continue
        stack = [start]
        seen[start] = True
        x0 = x1 = start % sw
        y0 = y1 = start // sw
        n = 0
        while stack:
            p = stack.pop()
            n += 1
            px, py = p % sw, p // sw
            x0, x1 = min(x0, px), max(x1, px)
            y0, y1 = min(y0, py), max(y1, py)
            for dx, dy in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)):
                nx, ny = px + dx, py + dy
                if 0 <= nx < sw and 0 <= ny < sh:
                    q = ny * sw + nx
                    if mask[q] and not seen[q]:
                        seen[q] = True
                        stack.append(q)
        if n > 150:  # ignore specks
            boxes.append((x0, y0, x1, y1, n))
    return boxes

boxes = cc_boxes()
# drop the color-strip: much wider than tall and near top
items = []
for (x0, y0, x1, y1, n) in boxes:
    w, h = x1 - x0, y1 - y0
    if w > sw * 0.6:   # palette strip
        continue
    items.append((x0, y0, x1, y1))

# group into rows by y-center
items.sort(key=lambda b: (b[1] + b[3]) / 2)
rows, cur = [], [items[0]]
for b in items[1:]:
    prev_cy = (cur[-1][1] + cur[-1][3]) / 2
    cy = (b[1] + b[3]) / 2
    if cy - prev_cy > 40:
        rows.append(cur); cur = [b]
    else:
        cur.append(b)
rows.append(cur)
for r in rows:
    r.sort(key=lambda b: b[0])

names_by_row = [
    ["year-2018", "year-2021", "year-2022", "year-2026", "card-back"],
    ["face-founding", "face-contract", "face-signing", "face-henry"],
    ["head-jonny", "head-kelly"],
]
report = {"rows": [len(r) for r in rows], "pieces": {}}
PAD = 6
for row, names in zip(rows, names_by_row):
    for b, name in zip(row, names):
        x0 = max(0, b[0] * DS - PAD); y0 = max(0, b[1] * DS - PAD)
        x1 = min(W, (b[2] + 1) * DS + PAD); y1 = min(H, (b[3] + 1) * DS + PAD)
        crop = pieces.crop((x0, y0, x1, y1))
        crop.save(os.path.join(OUT, f"{name}.png"))
        report["pieces"][name] = {"size": crop.size}

# ---------- 2. board background from artboard 1 ----------
board = Image.open(os.path.join(SCRATCH, BOARD_SRC)).convert("RGB")
BW, BH = board.size
S = BW / 1181.0  # display-basis -> render scale

bg = board.getpixel((int(600 * S), int(150 * S)))
# fill tile from clean cream between heads and deck (keeps any grain)
tile = board.crop((int(520 * S), int(60 * S), int(760 * S), int(300 * S)))

def erase(box):
    x0, y0, x1, y1 = [int(v * S) for v in box]
    tw, th = tile.size
    for ty in range(y0, y1, th):
        for tx in range(x0, x1, tw):
            board.paste(tile.crop((0, 0, min(tw, x1 - tx), min(th, y1 - ty))), (tx, ty))

erase((70, 45, 490, 333))    # heads — must stay ABOVE the milestone-1 card stack
erase((815, 55, 1140, 430))  # deck
report["bg_color"] = bg

# ---------- 3. slot transforms from baked milestone cards ----------
# hue-range predicates per card header (gradients + grain make exact match useless)
slots_spec = [
    ("founding", (275, 507), lambda r,g,b: r > 200 and b > 160 and b > g + 20),
    ("contract", (800, 800), lambda r,g,b: g > 140 and r < 120 and b < 170),
    ("signing",  (367, 1245), lambda r,g,b: b > 190 and g > 150 and r < 120),
    ("henry",    (762, 1645), lambda r,g,b: b > 190 and g < 160 and r < 110),
]
orig = Image.open(os.path.join(SCRATCH, BOARD_SRC)).convert("RGB")
D2 = 4
osm = orig.resize((BW // D2, BH // D2), Image.NEAREST)
opx = osm.load()
report["slots"] = {}
for name, (cx, cy), pred in slots_spec:
    ccx, ccy = cx * S / D2, cy * S / D2
    win = int(150 * S / D2)  # half-window
    x0w, y0w = int(ccx - win), int(ccy - win)
    x1w, y1w = int(ccx + win), int(ccy + win)
    m = {}
    for y in range(y0w, y1w):
        for x in range(x0w, x1w):
            if 0 <= x < osm.width and 0 <= y < osm.height:
                r, g, b = opx[x, y]
                if pred(r, g, b):
                    m[(x, y)] = False
    # largest connected blob only (excludes same-hue track segments in window)
    best = []
    for p in list(m.keys()):
        if m[p]:
            continue
        blob, stack = [], [p]
        m[p] = True
        while stack:
            q = stack.pop()
            blob.append(q)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    r2 = (q[0] + dx, q[1] + dy)
                    if r2 in m and not m[r2]:
                        m[r2] = True
                        stack.append(r2)
        if len(blob) > len(best):
            best = blob
    pts = best
    n = len(pts)

    # convex hull (monotone chain) + rotating calipers -> min-area rect
    def hull(points):
        points = sorted(set(points))
        def half(pts_):
            h = []
            for p in pts_:
                while len(h) >= 2 and (h[-1][0]-h[-2][0])*(p[1]-h[-2][1]) - (h[-1][1]-h[-2][1])*(p[0]-h[-2][0]) <= 0:
                    h.pop()
                h.append(p)
            return h
        lower, upper = half(points), half(points[::-1])
        return lower[:-1] + upper[:-1]

    hl = hull(pts)
    best_rect = None
    for i in range(len(hl)):
        ex = hl[(i+1) % len(hl)][0] - hl[i][0]
        ey = hl[(i+1) % len(hl)][1] - hl[i][1]
        el = math.hypot(ex, ey)
        if el == 0:
            continue
        ux, uy = ex/el, ey/el          # edge dir
        vx, vy = -uy, ux               # normal
        us = [p[0]*ux + p[1]*uy for p in hl]
        vs = [p[0]*vx + p[1]*vy for p in hl]
        w_, h_ = max(us)-min(us), max(vs)-min(vs)
        area = w_*h_
        if best_rect is None or area < best_rect[0]:
            cu, cv = (max(us)+min(us))/2, (max(vs)+min(vs))/2
            cx_ = cu*ux + cv*vx
            cy_ = cu*uy + cv*vy
            best_rect = (area, w_, h_, math.atan2(uy, ux), cx_, cy_)
    _, rw, rh, ang, rcx, rcy = best_rect
    deg = math.degrees(ang)
    while deg > 45: deg -= 90
    while deg < -45: deg += 90
    if rw < rh:
        rw, rh = rh, rw
    report["slots"][name] = {
        "n_px": n,
        "header_center_px": [rcx * D2, rcy * D2],
        "angle_deg": round(deg, 2),
        "header_w_px": round(rw * D2, 1),
        "header_h_px": round(rh * D2, 1),
    }

# match header rects against the face PNGs to get full-card transforms
for name in list(report["slots"].keys()):
    face = Image.open(os.path.join(OUT, f"face-{name}.png")).convert("RGBA")
    fpx = face.load()
    pred = dict((n_, p_) for n_, _, p_ in slots_spec)[name]
    xs, ys = [], []
    for y in range(0, face.height, 2):
        for x in range(0, face.width, 2):
            r, g, b, a = fpx[x, y]
            if a > 200 and pred(r, g, b):
                xs.append(x); ys.append(y)
    fx0, fx1, fy0, fy1 = min(xs), max(xs), min(ys), max(ys)
    fhw, fhh = fx1 - fx0, fy1 - fy0
    s = report["slots"][name]
    scale = ((s["header_w_px"] / max(fhw, fhh)) + (s["header_h_px"] / min(fhw, fhh))) / 2
    # face-image center offset from header center, rotated+scaled onto board
    offx = (face.width / 2) - (fx0 + fx1) / 2
    offy = (face.height / 2) - (fy0 + fy1) / 2
    a = math.radians(s["angle_deg"])
    ca, sa = math.cos(a), math.sin(a)
    cx_b = s["header_center_px"][0] + (offx * ca - offy * sa) * scale
    cy_b = s["header_center_px"][1] + (offx * sa + offy * ca) * scale
    s.update({
        "center_frac": [round(cx_b / BW, 4), round(cy_b / BH, 4)],
        "card_w_frac": round(face.width * scale / BW, 4),
        "card_h_frac": round(face.height * scale / BH, 4),
        "scale": round(scale, 4),
    })

with open(os.path.join(OUT, "slots.json"), "w") as f:
    json.dump(report, f, indent=1)

board.save(os.path.join(OUT, "board-play.jpg"), quality=85)
report["board_size"] = [BW, BH]

# ---------- 4. contact sheet for one-shot eyeball ----------
sheet = Image.new("RGB", (1600, 1250), (240, 240, 240))
x = 10
for name in ["year-2018","year-2021","year-2022","year-2026","card-back"]:
    im = Image.open(os.path.join(OUT, f"{name}.png"))
    im.thumbnail((280, 380))
    sheet.paste(im, (x, 10), im)
    x += im.width + 12
x = 10
for name in ["face-founding","face-contract","face-signing","face-henry","head-jonny","head-kelly"]:
    im = Image.open(os.path.join(OUT, f"{name}.png"))
    im.thumbnail((250, 360))
    sheet.paste(im, (x, 420), im)
    x += im.width + 12
bt = board.copy()
bt.thumbnail((430, 730))
sc = bt.width / BW
d = ImageDraw.Draw(bt)
for name, s in report["slots"].items():
    cxp = s["center_frac"][0] * bt.width
    cyp = s["center_frac"][1] * bt.height
    hw = s["card_w_frac"] * BW * sc / 2
    hh = s["card_h_frac"] * BH * sc / 2
    a = math.radians(s["angle_deg"])
    ca, sa = math.cos(a), math.sin(a)
    corners = [(cxp + du*ca - dv*sa, cyp + du*sa + dv*ca)
               for du, dv in ((-hw,-hh),(hw,-hh),(hw,hh),(-hw,hh))]
    d.polygon(corners, outline=(255, 0, 255), width=3)
sheet.paste(bt, (1100, 420))
sheet.save(os.path.join(SCRATCH, "contact-sheet.jpg"), quality=88)
print(json.dumps(report, indent=1))

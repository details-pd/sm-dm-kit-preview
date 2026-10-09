#!/usr/bin/env python3
"""Lift the 3 gift cards (with baked chrome + buttons) off the dark dimmed
backdrop of artboards 4 (backs) and 5 (fronts) as transparent PNGs."""
import os
from PIL import Image

OUT = "/Users/details/apps-script-backups/jonny-fruits-dm-kit/assets/v3"
DARK = 60   # blurred-luminance backdrop ceiling
SHADOW = 0    # shave disabled: remnant shadow reads correctly on the dim backdrop

def lum(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]

def find_cards(path):
    """Bright components at low res, merged where their bboxes overlap,
    -> the 3 largest padded full-res card bboxes.

    The merge matters: since the Aug 18 deck the card fronts frame the art
    in a black border, so the art square and the white card ring read as
    SEPARATE bright components (and the art square is the bigger one) —
    taking the 3 largest raw components returns just the art squares."""
    im = Image.open(path).convert("RGB")
    D = 4
    sm = im.resize((im.width // D, im.height // D), Image.NEAREST)
    px = sm.load()
    sw, sh = sm.size
    seen = [[False] * sw for _ in range(sh)]
    comps = []
    for y0 in range(sh):
        for x0 in range(sw):
            if seen[y0][x0] or lum(px[x0, y0]) < DARK:
                continue
            stack = [(x0, y0)]
            seen[y0][x0] = True
            n = 0
            bx0 = bx1 = x0; by0 = by1 = y0
            while stack:
                x, y = stack.pop()
                n += 1
                bx0 = min(bx0, x); bx1 = max(bx1, x)
                by0 = min(by0, y); by1 = max(by1, y)
                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < sw and 0 <= ny < sh and not seen[ny][nx] and lum(px[nx, ny]) >= DARK:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            if n > 400:  # specks (heading text, stickers) stay out of the merge
                comps.append([bx0, by0, bx1, by1, n])

    def overlaps(a, b):
        return not (a[2] < b[0] or b[2] < a[0] or a[3] < b[1] or b[3] < a[1])

    merged = []
    for c in sorted(comps, key=lambda c: -c[4]):
        for m in merged:
            if overlaps(c, m):
                m[0] = min(m[0], c[0]); m[1] = min(m[1], c[1])
                m[2] = max(m[2], c[2]); m[3] = max(m[3], c[3])
                break
        else:
            merged.append(c[:4])
    merged = sorted(merged, key=lambda m: -((m[2]-m[0]) * (m[3]-m[1])))[:3]
    boxes = [(max(0, m[0]*D-10), max(0, m[1]*D-10),
              min(im.width, (m[2]+1)*D+10), min(im.height, (m[3]+1)*D+10))
             for m in merged]
    boxes.sort(key=lambda b: b[0])  # left -> right
    return im, boxes

def cut(im, box, out_name):
    """Full-res flood fill from crop edges over DARK NEIGHBORHOODS.
    Using box-blurred luminance (radius 3) instead of per-pixel values means
    the flood cannot squeeze through thin dark outlines (their neighborhoods
    are brightened by the surrounding art) — that leak is what previously
    hollowed out card interiors. The faint dim ring left at card edges reads
    as the card's own shadow."""
    crop = im.crop(box).convert("RGB")
    w, h = crop.size
    px = crop.load()

    # integral image of luminance -> blurred lum lookup
    integ = [[0] * (w + 1) for _ in range(h + 1)]
    for y in range(h):
        row = integ[y + 1]
        prev = integ[y]
        acc = 0
        for x in range(w):
            acc += lum(px[x, y])
            row[x + 1] = prev[x + 1] + acc
    R = 3
    def blur(x, y):
        x0, x1 = max(0, x - R), min(w, x + R + 1)
        y0, y1 = max(0, y - R), min(h, y + R + 1)
        return (integ[y1][x1] - integ[y0][x1] - integ[y1][x0] + integ[y0][x0]) / ((x1 - x0) * (y1 - y0))

    bg = bytearray(w * h)  # 1 = background
    stack = []
    for x in range(w):
        for y in (0, h - 1):
            if blur(x, y) < DARK:
                bg[y * w + x] = 1; stack.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if blur(x, y) < DARK and not bg[y * w + x]:
                bg[y * w + x] = 1; stack.append((x, y))
    while stack:
        x, y = stack.pop()
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not bg[ny * w + nx] and blur(nx, ny) < DARK:
                bg[ny * w + nx] = 1
                stack.append((nx, ny))
    # keep only the largest opaque component (drops detached shadow blobs)
    seen = bytearray(w * h)
    best = []
    for start in range(w * h):
        if bg[start] or seen[start]:
            continue
        comp, stack = [], [start]
        seen[start] = 1
        while stack:
            p = stack.pop()
            comp.append(p)
            x, y = p % w, p // w
            for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    q = ny * w + nx
                    if not bg[q] and not seen[q]:
                        seen[q] = 1
                        stack.append(q)
        if len(comp) > len(best):
            best = comp
    keep = bytearray(w * h)
    for p in best:
        keep[p] = 1
    for p in range(w * h):
        if not keep[p]:
            bg[p] = 1

    # shave attached shadow fringe with a BFS from the boundary: dark-ish
    # opaque pixels adjacent to background go transparent and propagate —
    # the bright white chrome stops the shave from reaching the interior
    frontier = []
    for p in range(w * h):
        if bg[p]:
            continue
        x, y = p % w, p // w
        if any(0 <= x+dx < w and 0 <= y+dy < h and bg[(y+dy)*w + x+dx]
               for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))):
            if lum(px[x, y]) < SHADOW:
                bg[p] = 1
                frontier.append(p)
    while frontier:
        p = frontier.pop()
        x, y = p % w, p // w
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                q = ny * w + nx
                if not bg[q] and lum(px[nx, ny]) < SHADOW:
                    bg[q] = 1
                    frontier.append(q)

    rgba = crop.convert("RGBA")
    rgba.putalpha(Image.frombytes("L", (w, h), bytes(255 - 255 * b for b in bg)))
    # trim to opaque bbox
    rgba = rgba.crop(rgba.getchannel("A").getbbox())
    rgba.save(os.path.join(OUT, out_name))
    # sanity: the central card area must be solid (no see-through holes)
    cw, ch = rgba.size
    core = rgba.getchannel("A").crop((int(cw*0.2), int(ch*0.15), int(cw*0.8), int(ch*0.75)))
    holes = sum(1 for a in core.getdata() if a < 128) / (core.size[0] * core.size[1])
    print(out_name, rgba.size, f"core-holes={holes:.4%}")

names = ["rookie", "highlight", "sixthman"]
for page, kind in (("d3backs-4.png", "back"), ("d3fronts-5.png", "front")):
    im, boxes = find_cards(page)
    for box, n in zip(boxes, names):
        cut(im, box, f"gift-{n}-{kind}.png")

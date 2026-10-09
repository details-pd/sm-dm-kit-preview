#!/usr/bin/env python3
"""Cut the pieces artboard into transparent PNGs.

pdftoppm in this toolchain has no -transp, so alpha is derived by flooding the
near-white background inward from the frame. Each sticker keeps its own white
outline because the flood cannot cross the drop shadow around it.

The shadow is the catch: it is rendered as a thin crescent that the flood
separates from the sticker body, so a sticker arrives as one dense component
plus one or more sparse ones overlapping it. Those get merged back, otherwise
every sprite comes out ~44px narrow at 144dpi and every widthFrac is wrong.

    python3 tools/extract-pieces.py pieces.png out-dir board-render-width
"""
import os
import sys
from collections import deque

from PIL import Image

TH = 250        # this bright on every channel, and reachable from the edge = background
MIN_PX = 4000   # ignore specks
DENSE = 0.25    # fill ratio that separates a real sticker from a shadow crescent
MARGIN = 0.0136 # transparent border the original sprites carry, as a fraction of width


def background(im):
    W, H = im.size
    px = im.load()
    bg = bytearray(W * H)
    q = deque()
    def push(x, y):
        if not bg[y * W + x] and min(px[x, y]) >= TH:
            bg[y * W + x] = 1
            q.append((x, y))
    for x in range(W):
        push(x, 0); push(x, H - 1)
    for y in range(H):
        push(0, y); push(W - 1, y)
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H:
                push(nx, ny)
    return bg


def components(im, bg):
    W, H = im.size
    seen = bytearray(W * H)
    out = []
    for sy in range(H):
        for sx in range(W):
            i = sy * W + sx
            if bg[i] or seen[i]:
                continue
            st = [i]; seen[i] = 1; n = 0
            x0 = x1 = sx; y0 = y1 = sy
            while st:
                j = st.pop(); n += 1
                a, b = j % W, j // W
                x0 = min(x0, a); x1 = max(x1, a)
                y0 = min(y0, b); y1 = max(y1, b)
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = a + dx, b + dy
                    if 0 <= nx < W and 0 <= ny < H:
                        k = ny * W + nx
                        if not bg[k] and not seen[k]:
                            seen[k] = 1; st.append(k)
            if n >= MIN_PX:
                out.append([x0, y0, x1, y1, n])
    return out


def merge_shadows(comps):
    """Fold sparse overlapping components (drop shadows) into the dense ones."""
    dense, sparse = [], []
    for c in comps:
        fill = c[4] / ((c[2] - c[0] + 1) * (c[3] - c[1] + 1))
        (dense if fill >= DENSE else sparse).append(c)
    for s in sparse:
        best, over = None, 0
        for d in dense:
            ox = min(d[2], s[2]) - max(d[0], s[0])
            oy = min(d[3], s[3]) - max(d[1], s[1])
            if ox > 0 and oy > 0 and ox * oy > over:
                best, over = d, ox * oy
        if best is not None:
            best[0] = min(best[0], s[0]); best[1] = min(best[1], s[1])
            best[2] = max(best[2], s[2]); best[3] = max(best[3], s[3])
    return dense


def cut(im, bg, box):
    W, H = im.size
    x0, y0, x1, y1, _ = box
    pad = max(1, round((x1 - x0 + 1) * MARGIN))
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(W - 1, x1 + pad), min(H - 1, y1 + pad)
    w, h = x1 - x0 + 1, y1 - y0 + 1
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    src = im.load(); dst = out.load()
    for y in range(h):
        for x in range(w):
            sx, sy = x0 + x, y0 + y
            if not bg[sy * W + sx]:
                c = src[sx, sy]
                dst[x, y] = (c[0], c[1], c[2], 255)
    return out


def rows_of(comps, gap):
    comps.sort(key=lambda c: (c[1] + c[3]) / 2)
    rows, cur = [], [comps[0]]
    for c in comps[1:]:
        if (c[1] + c[3]) / 2 - (cur[-1][1] + cur[-1][3]) / 2 > gap:
            rows.append(cur); cur = [c]
        else:
            cur.append(c)
    rows.append(cur)
    for r in rows:
        r.sort(key=lambda c: c[0])
    return rows


if __name__ == "__main__":
    src, out_dir = sys.argv[1], sys.argv[2]
    board_w = float(sys.argv[3]) if len(sys.argv) > 3 else 3876.0
    os.makedirs(out_dir, exist_ok=True)
    im = Image.open(src).convert("RGB")
    W, H = im.size
    bg = background(im)
    comps = [c for c in components(im, bg) if (c[2] - c[0]) < 0.6 * W]  # drop palette strips
    comps = merge_shadows(comps)
    for ri, row in enumerate(rows_of(comps, H * 0.05)):
        for ci, c in enumerate(row):
            w = c[2] - c[0] + 1
            sprite = cut(im, bg, c)
            name = f"row{ri}-{ci}.png"
            sprite.save(os.path.join(out_dir, name))
            print(f"{name:14s} {sprite.size[0]:4d}x{sprite.size[1]:4d}  "
                  f"widthFrac={sprite.size[0]/board_w:.4f}")

#!/usr/bin/env python3
"""Cut the game-piece heads out of a TRUE-ALPHA render of the pieces artboard.

    pdftocairo -f 1 -l 1 -png -transp -r 144 design.pdf pieces
    python3 tools/extract-heads.py pieces-1.png out-dir name1,name2,name3,name4

Why this exists: extract-pieces.py derives alpha by flooding the near-white
background inward. A sticker's outline is white and so is the artboard, so the
flood eats the outline wherever there is no drop shadow to stop it. Measured on
the Oct 9 Stephanie heads it removed 75 to 90% of the white outline and left
every edge hard (zero anti-aliased pixels). Kharisel flagged it: pieces should
have a white outline and not look transparent.

pdftocairo -transp renders the artboard with real alpha, so the outline, the
anti-aliasing and the drop shadow all come through exactly as designed. Heads
are left to right along the bottom row, below y=3000 at 144dpi. Cards are not
cut here; their outlines are black, so the flood never had this problem.
"""
import os
import sys

from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
NAMES = sys.argv[3].split(",")
ALPHA_MIN = 8      # alpha at or below this is background
MIN_PX = 4000      # ignore specks
HEAD_ROW_Y = 3000  # heads sit below the card rows
STRIP_W = 0.6      # a component wider than this share of the artboard is the colour strip
PAD = 3            # transparent border kept around each sprite

os.makedirs(OUT, exist_ok=True)
im = Image.open(SRC).convert("RGBA")
W, H = im.size
A = im.getchannel("A").load()

seen = bytearray(W * H)
comps = []
for sy in range(HEAD_ROW_Y, H):
    for sx in range(W):
        i = sy * W + sx
        if seen[i] or A[sx, sy] <= ALPHA_MIN:
            continue
        st = [i]; seen[i] = 1; n = 0
        x0 = x1 = sx; y0 = y1 = sy
        while st:
            j = st.pop(); n += 1
            a, b = j % W, j // W
            x0 = min(x0, a); x1 = max(x1, a); y0 = min(y0, b); y1 = max(y1, b)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = a + dx, b + dy
                if 0 <= nx < W and HEAD_ROW_Y <= ny < H and not seen[ny * W + nx] and A[nx, ny] > ALPHA_MIN:
                    seen[ny * W + nx] = 1; st.append(ny * W + nx)
        if n >= MIN_PX and (x1 - x0) < STRIP_W * W:
            comps.append((x0, y0, x1, y1))

comps.sort()
if len(comps) != len(NAMES):
    sys.exit(f"found {len(comps)} heads, expected {len(NAMES)}: {comps}")
for name, (x0, y0, x1, y1) in zip(NAMES, comps):
    x0, y0 = max(0, x0 - PAD), max(0, y0 - PAD)
    x1, y1 = min(W - 1, x1 + PAD), min(H - 1, y1 + PAD)
    sprite = im.crop((x0, y0, x1 + 1, y1 + 1))
    sprite.save(os.path.join(OUT, f"head-{name}.png"))
    print(f"head-{name}.png  {sprite.size[0]}x{sprite.size[1]}  widthFrac={sprite.size[0] / 3876:.4f}")

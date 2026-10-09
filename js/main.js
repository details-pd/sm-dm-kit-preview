/* =========================================================
   Jonny Fruits Baby DM Kit — v4 engine (Aug 19 board)
   All recipient-specific data comes from js/config.js (KIT).

   State machine:
   intro letter (stars drifting) → board OVERVIEW (both pawns together
   on the top red piece, "Start the Journey" beside them)
   → zoom to the start
   → [the next card says "Click me"; clicking turns it over in place,
      then the pawns walk to it and the following card invites] ×4
   → pawns walk to the second-to-last (black) piece, the final blue
      piece pulses under its "Click for a surprise" pill
   → gift selection → address form → thanks → free explore

   The deck of cards was removed on Aug 19: the board cards are the click
   targets now (Sarah — it freed the right rail so the board can be framed
   larger, and it makes the next action obvious).

   Camera: the board lives inside a fixed, clipped stage and is
   moved with translate+scale — no page scrolling. This is what
   makes "screen only moves on deck interaction" enforceable, and
   it behaves identically on phones.
   ========================================================= */

const el = (id) => document.getElementById(id);
const [BW, BH] = KIT.board.size;

/* ================= build the board from config ================= */
const stage = el("stage");
const board = el("board");

function buildBoard() {
  board.style.width = BW + "px";
  board.style.height = BH + "px";
  board.style.backgroundImage = `url("${KIT.board.image}")`;

  KIT.milestones.forEach((m, i) => {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.id = `slot-${i}`;
    slot.dataset.index = i;
    const w = m.slot.w * BW, h = m.slot.h * BH;
    // 4% oversize so the overlay always covers the baked card art
    slot.style.width = w * 1.04 + "px";
    slot.style.height = h * 1.04 + "px";
    slot.style.left = m.slot.cx * BW - w * 0.52 + "px";
    slot.style.top = m.slot.cy * BH - h * 0.52 + "px";
    // GSAP owns the transform so it can add rotationY for the card turn
    gsap.set(slot, { rotation: m.slot.angle, transformPerspective: 900 });
    // The milestone cards are PAINTED INTO the board art; the overlay
    // normally hides its baked twin exactly. Turning the overlay
    // foreshortens it and would uncover that twin — which reads as a
    // duplicate card — so a blank card sits underneath and stays put,
    // exactly like turning the top card of a pile.
    slot.innerHTML =
      `<div class="slot-halo"></div>` +
      `<img class="slot-plate" src="${KIT.blankCard}" alt="">` +
      `<div class="slot-turn">` +
        `<img class="slot-year" src="${m.yearCard}" alt="">` +
        `<img class="slot-click" src="${KIT.clickCard}" alt="">` +
        `<img class="slot-face" src="${m.face}" alt="${m.alt}">` +
      `</div>`;
    slot.addEventListener("click", () => onSlotClick(i));
    slot.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSlotClick(i); }
    });
    board.appendChild(slot);
  });

  // "Start the Journey" and the surprise hotspot live in board coordinates
  const L = KIT.board.startLabel;
  const label = el("startLabel");
  label.src = L.img;
  label.alt = KIT.copy.startLabelAlt;
  label.style.left = L.x * BW + "px";
  label.style.top = L.y * BH + "px";
  label.style.width = L.w * BW + "px";

  const S = KIT.board.surprise;
  const hit = el("surpriseHit");
  hit.style.left = S.hit.x * BW + "px";
  hit.style.top = S.hit.y * BH + "px";
  hit.style.width = S.hit.w * BW + "px";
  hit.style.height = S.hit.h * BH + "px";
  hit.setAttribute("aria-label", KIT.copy.surpriseAlt);

  const glow = el("surpriseGlow");
  glow.style.left = S.ring.x * BW + "px";
  glow.style.top = S.ring.y * BH + "px";
  glow.style.width = S.ring.w * BW + "px";
  glow.style.height = S.ring.h * BH + "px";

  // pawns are anchored individually (feet on the track); no shared layout,
  // so a lone first pawn stands dead-center on the line
  KIT.pawns.forEach((p, i) => {
    const img = document.createElement("img");
    img.id = `pawn-${i}`;
    img.className = "pawn";
    img.src = p.img;
    img.alt = p.alt;
    img.style.width = p.widthFrac * BW + "px";
    img.style.zIndex = 10 - i;
    board.appendChild(img);
    // anchor low on the band so the heads read as standing ON the track
    gsap.set(img, { xPercent: -50, yPercent: -75 });
    // a pawn with joinsAt waits off-stage until that milestone is turned
    if (p.joinsAt != null) gsap.set(img, { opacity: 0, scale: 0.6 });
  });
}

/* How many milestone cards have been turned. Declared here rather than with
   the rest of the game state because the pawn helpers just below read it,
   and they are called from buildBoard before that block is reached. */
let drawn = 0;

/* Who is on the board right now. A pawn with `joinsAt: n` walks on once
   milestone n has been turned (`drawn` counts turned cards), which is how
   Wesley and Bennett arrive with their own milestones rather than standing
   there from the start. */
const pawnIsOn = (p) => p.joinsAt == null || drawn > p.joinsAt;
const activeIdx = () => KIT.pawns.reduce(
  (a, p, i) => (pawnIsOn(p) ? a.concat(i) : a), []);
const pawnEls = () => activeIdx().map((i) => el(`pawn-${i}`));

/* Offsets for the group, in board px, centred on the feet anchor. Each gap
   is scaled by the two heads it sits between, so a toddler tucks in closer
   than two adults do. For the two-pawn case this is identical to the old
   fixed [-s, +s]. */
function pawnOffsets(idx) {
  const s = KIT.pawnSpread;
  const w = idx.map((i) => KIT.pawns[i].widthFrac * BW);
  const xs = [0];
  for (let k = 1; k < idx.length; k++) xs.push(xs[k - 1] + s * (w[k - 1] + w[k]));
  const mid = (xs[0] + xs[xs.length - 1]) / 2;
  return xs.map((x) => x - mid);
}

/* ================= track: Catmull-Rom through config waypoints ================= */
/* Sampled to arc-length so pawns walk at constant speed. */
const TRACK = (() => {
  const pts = KIT.board.track.map(([x, y]) => [x * BW, y * BH]);
  const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  const samples = [];
  const SEGS = 40;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
    for (let s = 0; s < SEGS; s++) {
      const t = s / SEGS, t2 = t * t, t3 = t2 * t;
      samples.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  samples.push(pts[pts.length - 1]);
  const cum = [0];
  for (let i = 1; i < samples.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1]));
  }
  const total = cum[cum.length - 1];
  return {
    total,
    pointAt(t) { // t: 0..1 of arc length → board px
      const target = Math.max(0, Math.min(1, t)) * total;
      let lo = 0, hi = cum.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] < target) lo = mid + 1; else hi = mid;
      }
      if (lo === 0) return { x: samples[0][0], y: samples[0][1] };
      const f = (target - cum[lo - 1]) / (cum[lo] - cum[lo - 1] || 1);
      return {
        x: samples[lo - 1][0] + (samples[lo][0] - samples[lo - 1][0]) * f,
        y: samples[lo - 1][1] + (samples[lo][1] - samples[lo - 1][1]) * f,
      };
    },
    nearestT(x, y) { // board px → t
      let best = 0, bestD = Infinity;
      for (let i = 0; i < samples.length; i++) {
        const d = (samples[i][0] - x) ** 2 + (samples[i][1] - y) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
      return cum[best] / total;
    },
  };
})();

/* ================= camera ================= */
const cam = { x: 0, y: 0, s: 1 }; // translate px + scale, origin 0 0

function applyCam() {
  gsap.set(board, { x: cam.x, y: cam.y, scale: cam.s });
}

function vw() { return stage.clientWidth; }
function vh() { return stage.clientHeight; }

// scale that fits the whole board in the stage (overview shot)
function fitScale() { return Math.min(vw() / BW, vh() / BH) * 0.94; }

// play scale: a milestone card should read clearly on any screen, but
// the board may never render wider than boardMaxWidth × the viewport —
// on portrait phones that cap wins and keeps the view zoomed out
function playScale() {
  const c = KIT.camera;
  const cardH = KIT.milestones[0].slot.h * BH;
  const cardW = KIT.milestones[0].slot.w * BW;
  return Math.min(
    (c.cardHeight * vh()) / cardH,
    (c.cardMaxWidth * vw()) / cardW,
    (c.boardMaxWidth * vw()) / BW
  );
}

function clampCam(x, y, s) {
  // never show a gap on a side the board can cover
  const bw = BW * s, bh = BH * s;
  const nx = bw <= vw() ? (vw() - bw) / 2 : Math.min(0, Math.max(vw() - bw, x));
  const ny = bh <= vh() ? (vh() - bh) / 2 : Math.min(0, Math.max(vh() - bh, y));
  return { x: nx, y: ny };
}

// camera target that frames board point (bx,by) at viewport center
function camTargetFor(bx, by, s) {
  return { s, ...clampCam(vw() / 2 - bx * s, vh() / 2 - by * s, s) };
}

/* Frame a whole board rectangle: play zoom if it fits, otherwise pull back
   just far enough. This is what keeps the couple AND the card they're being
   asked to click on screen together — on a phone the two are far enough
   apart that play zoom alone would push the card off the left edge. */
function frameBox(x0, y0, x1, y1) {
  // more margin on phones: the box fills most of a small screen, and with
  // only 0.92 the card sat right against the edge (Waheed, Aug 20)
  const pad = vw() < 600 ? KIT.camera.framePadMobile : KIT.camera.framePad;
  const fit = Math.min(vw() / (x1 - x0), vh() / (y1 - y0)) * pad;
  return camTargetFor((x0 + x1) / 2, (y0 + y1) / 2, Math.min(playScale(), fit));
}

// the group's on-board footprint around a feet anchor. Measured from whoever
// is actually on the board, so the camera doesn't reserve room for a child
// who hasn't arrived yet.
function pawnBox(p) {
  const idx = activeIdx();
  const offs = pawnOffsets(idx);
  const ws = idx.map((i) => KIT.pawns[i].widthFrac * BW);
  const left = Math.min(...offs.map((o, k) => o - ws[k] / 2));
  const right = Math.max(...offs.map((o, k) => o + ws[k] / 2));
  const h = Math.max(...ws) * 1.25; // heads are ~1.25× as tall as they are wide
  return [p.x + left, p.y - 0.85 * h, p.x + right, p.y + 0.25 * h];
}

function slotBox(slot) {
  const w = slot.w * BW * 1.04, h = slot.h * BH * 1.04;
  return [slot.cx * BW - w / 2, slot.cy * BH - h / 2,
          slot.cx * BW + w / 2, slot.cy * BH + h / 2];
}

/* Once play starts the zoom is PINNED and every camera move is a pan.
   Before that (the establishing shot and the opening framing) the camera is
   still free to pick a scale that fits.

   It used to re-fit at four points per milestone — widen for the route, pan,
   tighten on arrival, widen again for the next card — which on a phone meant
   the view was constantly breathing in and out (Waheed, Aug 20: "the zooming
   in and out is quite clunky"). Every resting framing fits at play zoom, so
   holding it steady costs nothing and reads far calmer. */
let scaleLocked = false;

function frameFor(boxes) {
  const b = unionBox(boxes);
  const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  return scaleLocked ? camTargetFor(cx, cy, playScale()) : frameBox(...b);
}

function lockPlayScale(dur) {
  if (scaleLocked) return;
  scaleLocked = true;
  // Tween position AND scale together, landing centred on the couple: nudging
  // cam.s on its own scales about the board's origin, which slid the couple
  // out of shot at the start of their first walk.
  cameraTo(frameFor([pawnBox(currentPawnPoint())]), dur, "power2.inOut");
}

function frameActorAnd(box) {
  return frameFor([pawnBox(currentPawnPoint()), box]);
}

/* Is all of this already comfortably on screen where the camera is now?
   If so the camera should stay put. Kharisel, Aug 20: "staying in the current
   view before the pawn moves rather than recalibrating back to it — the extra
   up-and-down movement makes the experience feel a bit laggy, and the pawn is
   already visible from the current view with the two cards." */
function alreadyInView(boxes, margin = 10) {
  const b = unionBox(boxes);
  return b[0] * cam.s + cam.x >= margin
      && b[1] * cam.s + cam.y >= margin
      && b[2] * cam.s + cam.x <= vw() - margin
      && b[3] * cam.s + cam.y <= vh() - margin;
}

function ringBox() {
  const R = KIT.board.surprise.ring;
  return [R.x * BW, R.y * BH, (R.x + R.w) * BW, (R.y + R.h) * BH];
}

/* Everything that has to stay in shot from the moment milestone i is offered
   until the couple finishes walking to it: the card, and where they'll end up.
   Framing all of it UP FRONT means the walk itself needs no zoom change — the
   camera used to still be zooming while they set off, which clipped the card
   for the first few frames on a phone. */
function milestoneViewBoxes(i) {
  const boxes = [slotBox(KIT.milestones[i].slot)]
    .concat(routePawnBoxes(currentPawnPoint(), milestoneAnchor(i)));
  // the last one runs straight on into the walk to the surprise
  if (i === KIT.milestones.length - 1) {
    boxes.push(ringBox());
    boxes.push(...routePawnBoxes(milestoneAnchor(i), {
      x: KIT.board.endPos[0] * BW, y: KIT.board.endPos[1] * BH }));
  }
  return boxes;
}

function cameraTo(target, dur, ease, onDone) {
  gsap.to(cam, {
    x: target.x, y: target.y, s: target.s,
    duration: dur, ease: ease || "power2.inOut",
    onUpdate: applyCam, onComplete: onDone,
  });
}

/* ================= pawns ================= */
let pawnPoint = null; // current feet anchor in board px (null = at startPos)

const startPoint = () => ({
  x: KIT.board.startPos[0] * BW,
  y: KIT.board.startPos[1] * BH,
});
const currentPawnPoint = () => pawnPoint || startPoint();

function renderPawnsAt(p) {
  // Stephanie and Jesse from the first frame; Wesley and Bennett slot into
  // the line as their milestones are turned (Kharisel, Oct 9).
  const idx = activeIdx();
  const offs = pawnOffsets(idx);
  idx.forEach((i, k) => {
    // transform, not left/top: those are layout properties and re-laid the
    // board out on every frame of every walk (Sarah: "laggy after clicks")
    gsap.set(el(`pawn-${i}`), { x: p.x + offs[k], y: p.y });
  });
}

/* A child joining after their card is turned. Placed at the new group
   position first, then popped in, so they appear already standing in line
   rather than sliding across the board. */
function revealJoiners(milestoneIdx) {
  const joining = KIT.pawns
    .map((p, i) => (p.joinsAt === milestoneIdx ? i : -1))
    .filter((i) => i >= 0);
  if (!joining.length) return;
  positionPawns();
  joining.forEach((i) => {
    gsap.to(el(`pawn-${i}`), {
      opacity: 1, scale: 1, duration: 0.42, ease: "back.out(2)",
    });
  });
}
function positionPawns() { renderPawnsAt(currentPawnPoint()); }

/* Camera follow during a walk. It tracks the couple AND whatever they're
   walking towards, easing the zoom as well as the position — on a phone the
   two are often further apart than a play-zoom screenful, and centring on
   the couple alone (what this used to do) slid the card off the edge
   mid-walk (Waheed, Aug 20). */
/* Dead-zone follow: while the couple is inside the middle of the frame the
   camera does not move at all, and it only nudges once they approach an edge.
   Re-centring them every frame is what made a walk look like the whole board
   was sliding around under them. */
function softFollow(p, keepBox) {
  const box = scaleLocked ? pawnBox(p)
    : unionBox([pawnBox(p)].concat(keepBox ? [keepBox] : []));
  const x0 = box[0] * cam.s + cam.x, x1 = box[2] * cam.s + cam.x;
  const y0 = box[1] * cam.s + cam.y, y1 = box[3] * cam.s + cam.y;
  const mx = vw() * KIT.camera.followMargin, my = vh() * KIT.camera.followMargin;
  let dx = 0, dy = 0;
  if (x1 - x0 < vw() - 2 * mx) {
    if (x0 < mx) dx = mx - x0; else if (x1 > vw() - mx) dx = vw() - mx - x1;
  } else {                       // wider than the dead zone: keep it centred
    dx = (vw() - (x0 + x1)) / 2;
  }
  if (y1 - y0 < vh() - 2 * my) {
    if (y0 < my) dy = my - y0; else if (y1 > vh() - my) dy = vh() - my - y1;
  } else {
    dy = (vh() - (y0 + y1)) / 2;
  }
  if (!dx && !dy) return;        // already comfortably framed — hold still
  // catch up briskly once it does have to move: a slow lerp let the couple
  // outrun the camera and clip the edge for a few frames on a phone
  const c = clampCam(cam.x + dx, cam.y + dy, cam.s);
  const k = KIT.camera.followEase;
  cam.x += (c.x - cam.x) * k;
  cam.y += (c.y - cam.y) * k;
  applyCam();
}

function unionBox(boxes) {
  return [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])),
          Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))];
}

// Walk to an arbitrary board point at CONSTANT SPEED. The whole journey —
// step onto the track, travel along it, step off to the anchor — is one
// arc-length-parameterized path with a single ease, so the pace never
// jumps between segments.
// the route of a walk: on-ramp + track run + off-ramp
function walkPolyline(from, targetPt) {
  const t0 = TRACK.nearestT(from.x, from.y);
  const t1 = TRACK.nearestT(targetPt.x, targetPt.y);
  const pts = [from];
  const onRamp = TRACK.pointAt(t0);
  if (Math.hypot(onRamp.x - from.x, onRamp.y - from.y) > 8) pts.push(onRamp);
  const STEPS = 120;
  for (let i = 1; i <= STEPS; i++) {
    pts.push(TRACK.pointAt(t0 + (t1 - t0) * (i / STEPS)));
  }
  if (Math.hypot(targetPt.x - pts[pts.length - 1].x,
                 targetPt.y - pts[pts.length - 1].y) > 8) pts.push(targetPt);
  return pts;
}

/* The couple's footprint sampled ALONG a route. Framing from the two
   endpoints isn't enough: the track loops, so a walk between two nearby
   anchors can swing right across the board, and a zoom that only fitted the
   ends left the card clipped in the middle of the trip. */
function routePawnBoxes(from, targetPt) {
  const pts = walkPolyline(from, targetPt);
  const boxes = [];
  for (let i = 0; i < pts.length; i += 8) boxes.push(pawnBox(pts[i]));
  boxes.push(pawnBox(pts[pts.length - 1]));
  return boxes;
}

function walkPawnsTo(targetPt, keepBox, onDone) {
  const follow = !!keepBox;
  const bob = gsap.to(pawnEls(), { rotation: 3.5, duration: 0.2, repeat: -1, yoyo: true });
  const from = currentPawnPoint();
  const pts = walkPolyline(from, targetPt);

  // cumulative arc length, so progress 0..1 maps to distance travelled
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const total = cum[cum.length - 1];
  const at = (d) => {
    if (total === 0) return pts[0];
    let lo = 1, hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < d) lo = mid + 1; else hi = mid; }
    const f = (d - cum[lo - 1]) / (cum[lo] - cum[lo - 1] || 1);
    return { x: pts[lo - 1].x + (pts[lo].x - pts[lo - 1].x) * f,
             y: pts[lo - 1].y + (pts[lo].y - pts[lo - 1].y) * f };
  };

  // No zoom here at all: the scale is pinned for the whole of play, so a walk
  // is pure panning. The couple is the subject while they move — a card they
  // are travelling away from is allowed to leave the frame, and the arrival
  // pan below brings the destination card fully back into shot.

  const state = { d: 0 };
  gsap.to(state, {
    d: total,
    // constant board-px per second → every walk feels the same. The floor
    // is small so a short hop uses that same pace instead of crawling.
    duration: Math.max(0.35, total / (KIT.timing.walkSpeed * BH)),
    ease: "power1.inOut", // one gentle accelerate/decelerate for the trip
    onUpdate: () => {
      const p = at(state.d);
      pawnPoint = p;
      renderPawnsAt(p);
      if (follow) softFollow(p, keepBox);
    },
    onComplete: () => {
      bob.kill();
      gsap.to(pawnEls(), { rotation: 0, duration: 0.15 });
      if (follow) {
        // settle so the card they walked to is fully in shot — unless it
        // already is, in which case moving would just be extra motion
        if (alreadyInView([pawnBox(targetPt), keepBox])) {
          if (onDone) onDone();
        } else {
          cameraTo(frameFor([pawnBox(targetPt), keepBox]), 0.45, "power1.out", onDone);
        }
      } else if (onDone) onDone();
    },
  });
}

// where the heads stand once milestone i is placed
function milestoneAnchor(i) {
  const m = KIT.milestones[i];
  if (m.pawnPos) return { x: m.pawnPos[0] * BW, y: m.pawnPos[1] * BH };
  // fallback: on the track, a card-width shy of the slot
  const t = TRACK.nearestT(m.slot.cx * BW, m.slot.cy * BH);
  return TRACK.pointAt(Math.max(0, t - (m.slot.w * BW * 0.9) / TRACK.total));
}


/* ================= game state ================= */
let busy = false;
let freeExplore = false;
let chosenGift = null;

const intro = el("intro");
const reveal = el("reveal");
const revealCard = el("revealCard");
const revealInner = el("revealInner");
const revealClose = el("revealClose");
const startLabel = el("startLabel");
const surpriseHit = el("surpriseHit");
const surpriseGlow = el("surpriseGlow");
const giftSelect = el("giftSelect");
const formOverlay = el("form");
const claimForm = el("claimForm");
const formError = el("formError");
const thanks = el("thanks");

/* ================= intro: letter over dimmed board → zoom in =================
   The board is visible (dimmed) behind the landing letter from page load;
   Dive in lifts the letter + dim, then the camera zooms to the start. */
let started = false;

function primeStage() {
  stage.style.visibility = "visible";
  const fs = fitScale();
  Object.assign(cam, { s: fs, ...clampCam((vw() - BW * fs) / 2, (vh() - BH * fs) / 2, fs) });
  applyCam();
  positionPawns(); // both of them, waiting together on the red piece
  showClickCard(0); // reads "Click me" from the very first frame
}

function startExperience() {
  if (busy) return;
  busy = true;
  started = true;

  // land on a view that holds both the couple and the first card, so the
  // thing they're asked to click is on screen from the very first frame
  const play = frameFor([pawnBox(startPoint()), slotBox(KIT.milestones[0].slot)]);

  gsap.timeline({
    // the first card starts inviting once we've landed on the start
    onComplete: () => { busy = false; inviteMilestone(0); },
  })
    .to("#introCard", { y: 46, opacity: 0, scale: 0.96, duration: 0.35, ease: "power1.in" }, 0)
    .to(intro, { backgroundColor: "rgba(5,7,22,0)", duration: 0.5 }, 0.15)
    .add(() => { intro.style.display = "none"; }, 0.65)
    // quick glimpse of the full board — overview + zoom ≈ 1s (Kharisel)
    .to({}, { duration: 0.15 })
    .to(cam, {
      x: play.x, y: play.y, s: play.s,
      duration: KIT.timing.introZoomDur, ease: "power2.inOut",
      onUpdate: applyCam,
    })
    .to(pawnEls(), { scale: 1.06, yoyo: true, repeat: 1, duration: 0.15 }, ">-0.05");
}

/* ================= "Click me" invitation =================
   Exactly one card is live at a time: its year swaps for Kharisel's
   "Click me" card, and it shakes to say so. Cards further down the board
   keep their year until their turn (Sarah, Aug 19). */
let activeIndex = -1;

// just the art: swap this card's year for the "Click me" face. Split out
// from inviting so card 1 can already read "Click me" in the establishing
// shot behind the letter, before anything is clickable (Waheed, Aug 19).
function showClickCard(i) {
  el(`slot-${i}`).classList.add("inviting");
}

function inviteMilestone(i) {
  if (i >= KIT.milestones.length) return;
  activeIndex = i;
  const m = KIT.milestones[i];
  const slot = el(`slot-${i}`);
  showClickCard(i);
  slot.tabIndex = 0;
  slot.setAttribute("role", "button");
  slot.setAttribute("aria-label", KIT.copy.clickCardAlt);
  // bring the card into view alongside the couple, then invite the click.
  // The shake alone wasn't reading as "your turn" (Sarah, Aug 20) — the card
  // now also keeps a halo pulsing until it's clicked.
  const offer = () => {
    // The card is clickable from the moment it's offered, so an eager click
    // can land while this pan is still running. Without this guard the pulse
    // started on the card that had just been turned and never stopped —
    // leaving two cards glowing at once (Waheed, Aug 20).
    if (activeIndex !== i) return;
    shake(slot, m.slot.angle);
    pulseHalo(slot);
  };
  const boxes = [pawnBox(currentPawnPoint()), slotBox(m.slot)];
  if (alreadyInView(boxes)) offer();
  else cameraTo(frameFor(boxes), 0.6, "power2.inOut", offer);
}

// exactly one card may pulse at a time
function pulseHalo(slot) {
  document.querySelectorAll(".slot-halo").forEach((h) => {
    gsap.killTweensOf(h);
    if (h !== slot.querySelector(".slot-halo")) gsap.set(h, { opacity: 0 });
  });
  gsap.fromTo(slot.querySelector(".slot-halo"), { opacity: 0.2 },
    { opacity: 1, duration: 0.7, repeat: -1, yoyo: true, ease: "sine.inOut" });
}

function clearHalo(slot) {
  const h = slot.querySelector(".slot-halo");
  gsap.killTweensOf(h);
  gsap.to(h, { opacity: 0, duration: 0.25 });
}

function shake(elm, angle) {
  gsap.fromTo(elm, { rotation: angle - 2.5 }, {
    rotation: angle + 2.5, duration: 0.12, repeat: 7, yoyo: true,
    onComplete: () => gsap.set(elm, { rotation: angle }),
  });
}

/* ================= turning a card over =================
   The deck is gone, so the card that's already on the board is the thing
   you click: it turns over in place to reveal the milestone, then the
   couple walks to it and the next card starts inviting. */
function onSlotClick(i) {
  if (dragMoved) return;
  if (freeExplore) { // revisit popup once the game is over
    if (el(`slot-${i}`).classList.contains("filled")) showReveal(i);
    return;
  }
  if (busy || i !== activeIndex) return;

  busy = true;
  const slot = el(`slot-${i}`);
  const turn = slot.querySelector(".slot-turn");
  const m = KIT.milestones[i];
  const angle = m.slot.angle;
  const d = KIT.timing.turnDur;

  // stop accepting clicks straight away, but LEAVE the "inviting" class on:
  // it's what holds the Click me art up. Dropping it here would uncover the
  // year card underneath for the whole first half of the turn.
  activeIndex = -1;
  slot.removeAttribute("role");
  slot.removeAttribute("aria-label");
  slot.tabIndex = -1;
  clearHalo(slot);
  gsap.killTweensOf(slot); // stop any shake still running so it can't fight the turn
  gsap.set(slot, { rotation: angle });
  gsap.killTweensOf(slot);              // a shake may still be running
  gsap.set(slot, { rotation: angle });

  // the start label has done its job the moment they set off
  if (i === 0) {
    gsap.to(startLabel, { opacity: 0, duration: 0.4 });
    lockPlayScale(0.4); // one settle into play zoom, done before they set off
  }

  gsap.timeline({
    onComplete: () => {
      drawn += 1;
      // a child named by this milestone joins the line before the walk, so
      // they travel to the card with everyone else
      revealJoiners(i);
      // keep the card they just turned fully in shot for the whole walk
      walkPawnsTo(milestoneAnchor(i), slotBox(m.slot), () => {
        busy = false;
        if (i + 1 < KIT.milestones.length) {
          gsap.delayedCall(KIT.timing.nextPrompt, () => inviteMilestone(i + 1));
        } else {
          finishJourney();
        }
      });
    },
  })
    // turn: half a flip, swap the art at the edge (card is invisible
    // side-on, so the swap is never seen), finish the flip. Only the inner
    // wrapper turns — the blank card behind it keeps the baked art covered.
    .to(turn, { rotationY: 90, duration: d / 2, ease: "power1.in" })
    .add(() => {
      slot.classList.remove("inviting");
      slot.classList.add("filled");
    })
    .to(turn, { rotationY: 0, duration: d / 2, ease: "power1.out" })
    .to(slot, { scale: 1.04, yoyo: true, repeat: 1, duration: 0.14 });
}

/* ================= the end of the board =================
   After the last milestone they walk on to the second-to-last (black)
   piece, and the final blue piece pulses under its baked
   "Click for a surprise" pill (Waheed, Aug 19). */
let surpriseShown = false;

function finishJourney() {
  busy = true;
  const end = {
    x: KIT.board.endPos[0] * BW,
    y: KIT.board.endPos[1] * BH,
  };
  walkPawnsTo(end, ringBox(), () => {
    busy = false;
    armSurprise();
  });
}

function armSurprise() {
  // hold the couple and the pill in one frame
  cameraTo(frameActorAnd(ringBox()), 0.6, "power2.inOut");
  surpriseHit.classList.add("on");
  gsap.killTweensOf(surpriseGlow);
  gsap.fromTo(surpriseGlow,
    { opacity: 0.25, scale: 0.99 },
    { opacity: 1, scale: 1.03, duration: 0.75, repeat: -1, yoyo: true,
      ease: "sine.inOut", transformOrigin: "50% 50%" });
}

function disarmSurprise() {
  surpriseHit.classList.remove("on");
  gsap.killTweensOf(surpriseGlow);
  gsap.set(surpriseGlow, { opacity: 0 });
}

function openSurprise() {
  if (busy || surpriseShown || freeExplore) return;
  surpriseShown = true;
  busy = true;
  disarmSurprise();
  showGiftSelect();
}

// revisit popup (free explore only): dimmed backdrop, X / ESC to close
function showReveal(index) {
  const m = KIT.milestones[index];
  el("revealImg").src = m.face;
  el("revealImg").alt = m.alt;
  gsap.set(revealInner, { rotationY: 180 });
  gsap.set(revealClose, { opacity: 0, scale: 0.4, pointerEvents: "none" });
  reveal.style.display = "grid";
  gsap.set(reveal, { opacity: 1 });

  gsap.timeline({
    onComplete: () => {
      gsap.to(revealClose, { opacity: 1, scale: 1, duration: 0.25, ease: "back.out(2)" });
      gsap.set(revealClose, { pointerEvents: "auto" });
    },
  })
    .from(revealCard, { scale: 0.5, opacity: 0, duration: 0.3, ease: "back.out(1.5)" });
}

function closeReveal() {
  gsap.to(reveal, { opacity: 0, duration: 0.25, onComplete: () => {
    reveal.style.display = "none";
  }});
}

// gift-screen exit (Kharisel): back to the board; the final piece re-invites
function closeGiftSelect() {
  if (chosenGift) return;
  gsap.to(giftSelect, { opacity: 0, duration: 0.3, onComplete: () => {
    giftSelect.style.display = "none";
    gsap.set(giftSelect, { opacity: 1 });
    surpriseShown = false;
    busy = false;
    armSurprise(); // the piece keeps pulsing until they take the gift
  }});
}

/* ================= gift selection =================
   Card chrome + buttons are baked into Kharisel's art; the whole card is
   the click target: face-down → flip, face-up → choose. */
function buildGifts() {
  const row = el("giftRow");
  KIT.gifts.forEach((g) => {
    const card = document.createElement("div");
    card.className = "gift-flip";
    card.dataset.gift = g.name;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", g.backAlt);
    card.innerHTML =
      `<div class="gift-flip-inner">
        <img class="gf-face gf-face-down" src="${g.back}" alt="">
        <div class="gf-face gf-face-up">
          <img src="${g.front}" alt="${g.frontAlt}">
          <p class="gf-desc">${g.desc || ""}</p>
        </div>
      </div>`;
    row.appendChild(card);
  });
}

// the descriptions are live text over the artwork, so they have to be sized
// against the card's rendered width (the row is display:none until now)
function sizeGiftDesc() {
  document.querySelectorAll(".gift-flip").forEach((c) => {
    const d = c.querySelector(".gf-desc");
    if (d && c.clientWidth) d.style.fontSize = c.clientWidth * 0.053 + "px";
  });
}

function showGiftSelect() {
  giftSelect.style.display = "grid";
  sizeGiftDesc();
  gsap.from(".gift-flip", {
    y: 60, opacity: 0, stagger: 0.1, duration: 0.45, ease: "back.out(1.4)",
    onComplete: () => { busy = false; },
  });
}

function resetGiftSelection() {
  chosenGift = null;
  document.querySelectorAll(".gift-flip").forEach((c) => {
    c.classList.remove("chosen", "disabled", "flipped");
  });
}

function changeGift() {
  formOverlay.style.display = "none";
  resetGiftSelection();
  giftSelect.style.display = "grid";
  sizeGiftDesc();
  gsap.from(".gift-flip", { y: 40, opacity: 0, stagger: 0.08, duration: 0.4, ease: "back.out(1.3)" });
}

function setupGiftCards() {
  document.querySelectorAll(".gift-flip").forEach((card) => {
    let flippedAt = 0;
    const act = () => {
      if (chosenGift || card.classList.contains("disabled")) return;
      if (!card.classList.contains("flipped")) {
        card.classList.add("flipped");
        flippedAt = Date.now();
        card.setAttribute("aria-label",
          card.querySelector(".gf-face-up").alt || card.dataset.gift);
        return;
      }
      if (Date.now() - flippedAt < 450) return; // let the flip settle
      chosenGift = card.dataset.gift;
      card.classList.add("chosen");
      document.querySelectorAll(".gift-flip").forEach((other) => {
        if (other !== card) other.classList.add("disabled");
      });
      gsap.timeline()
        .to(card, { scale: 1.05, yoyo: true, repeat: 1, duration: 0.2 })
        .to(giftSelect, { opacity: 0, duration: 0.35, delay: 0.2 })
        .add(() => {
          giftSelect.style.display = "none";
          gsap.set(giftSelect, { opacity: 1 });
          el("chosenGiftLabel").textContent = chosenGift;
          formOverlay.style.display = "grid";
          gsap.from(".form-frame", {
            scale: 0.4, rotation: 8, opacity: 0, duration: 0.5, ease: "back.out(1.3)",
          });
        });
    };
    card.addEventListener("click", act);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); }
    });
  });
}

/* ================= form submit → notifier ================= */
function submitClaim(e) {
  e.preventDefault();
  formError.textContent = "";

  const phone = el("fPhone").value.trim();
  const address = el("fAddress").value.trim();
  if (!phone || !address) {
    formError.textContent = KIT.copy.formMissing;
    return;
  }

  const payload = {
    gift: chosenGift,
    name: KIT.recipient.name,
    phone,
    address,
    instructions: el("fInstructions").value.trim(), // optional
    submittedAt: new Date().toISOString(),
  };

  const submitBtn = claimForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const originalLabel = submitBtn.textContent;
  submitBtn.textContent = "Sending…";

  fetch(KIT.notifier.endpoint, {
    method: "POST",
    // text/plain keeps this a "simple" request (no CORS preflight),
    // which is what Apps Script web apps expect
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  })
    .then((r) => r.json())
    .then((j) => {
      if (!j.ok) throw new Error(j.error || "notifier returned not-ok");
      formOverlay.style.display = "none";
      showThanks();
    })
    .catch((err) => {
      console.error("claim submission failed:", err);
      formError.textContent = KIT.copy.formFailed;
    })
    .finally(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    });
}

/* ================= thanks → free explore ================= */
function showThanks() {
  thanks.style.display = "grid";
  gsap.from(".thanks-card", { y: 40, opacity: 0, duration: 0.5, ease: "back.out(1.4)" });
}

function startFreeExplore() {
  thanks.style.display = "none";
  freeExplore = true;
  disarmSurprise(); // the gift is claimed; stop inviting the click

  // the slots already carry a click handler from buildBoard — onSlotClick
  // routes to the revisit popup once freeExplore is on. Just make them
  // reachable by keyboard again.
  document.querySelectorAll(".slot.filled").forEach((slot) => {
    slot.tabIndex = 0;
    slot.setAttribute("role", "button");
    slot.setAttribute("aria-label",
      slot.querySelector(".slot-face").alt || "Revisit this milestone");
  });
  // ease out to a view of the whole journey
  const fs = Math.max(fitScale(), playScale() * 0.55);
  const p = TRACK.pointAt(1);
  cameraTo(camTargetFor(p.x, p.y, fs), 1.2, "power2.inOut");
}

/* --- manual pan: drag / touch-drag / wheel, clamped ---
   Active during play too (between animations), not just free explore —
   the camera still auto-follows on each draw. */
const canPan = () => freeExplore || !busy;
let dragging = false, dragMoved = false, lastX = 0, lastY = 0;
stage.addEventListener("pointerdown", (e) => {
  if (!canPan()) return;
  dragging = true; dragMoved = false;
  lastX = e.clientX; lastY = e.clientY;
});
window.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
  lastX = e.clientX; lastY = e.clientY;
  const c = clampCam(cam.x + dx, cam.y + dy, cam.s);
  cam.x = c.x; cam.y = c.y;
  applyCam();
});
window.addEventListener("pointerup", () => { dragging = false; });
stage.addEventListener("wheel", (e) => {
  if (!canPan()) return;
  e.preventDefault();
  const c = clampCam(cam.x - e.deltaX, cam.y - e.deltaY, cam.s);
  cam.x = c.x; cam.y = c.y;
  applyCam();
}, { passive: false });

/* ================= resize: keep current framing sane ================= */
window.addEventListener("resize", () => {
  sizeGiftDesc();
  if (stage.style.visibility !== "visible") return;
  positionPawns();
  if (!started) { // still on the landing letter: keep the overview fit
    const fs = fitScale();
    Object.assign(cam, { s: fs, ...clampCam((vw() - BW * fs) / 2, (vh() - BH * fs) / 2, fs) });
    applyCam();
    return;
  }
  const p = currentPawnPoint();
  const s = freeExplore ? cam.s : (busy ? cam.s : playScale());
  Object.assign(cam, camTargetFor(p.x, p.y, s));
  applyCam();
});

/* ================= copy from config ================= */
function applyCopy() {
  document.title = KIT.copy.pageTitle;
  el("introHeadline").innerHTML = KIT.copy.introHeadline;
  el("introBody").innerHTML = KIT.copy.introBody.map((p) => `<p>${p}</p>`).join("");
  el("celebrateBtn").textContent = KIT.copy.introCta;
  el("giftTitle").textContent = KIT.copy.giftTitle;
  el("giftSub").textContent = KIT.copy.giftSub;
  el("formTitle").textContent = KIT.copy.formTitle;
  el("formGiftLead").firstChild.textContent = KIT.copy.formGiftLead + " ";
  el("changeGiftBtn").textContent = KIT.copy.formChangeCta;
  el("fPhoneLabel").textContent = KIT.copy.formPhoneLabel;
  el("fAddressLabel").textContent = KIT.copy.formAddressLabel;
  el("fInstructionsLabel").textContent = KIT.copy.formInstructionsLabel;
  el("submitBtn").textContent = KIT.copy.formSubmitCta;
  el("thanksTitle").textContent = KIT.copy.thanksTitle;
  el("thanksBody").innerHTML = KIT.copy.thanksBody; // may carry a <br>
  el("exploreBtn").textContent = KIT.copy.thanksCta;
}

/* ================= wire up ================= */
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);

buildBoard();
buildGifts();
applyCopy();
setupGiftCards();
primeStage(); // board (dimmed) is the landing backdrop
// stars pop in after the letter is on screen (Kharisel)
gsap.from(".sparkle", {
  scale: 0, opacity: 0, duration: 0.45, ease: "back.out(2.5)",
  stagger: 0.12, delay: 0.5,
});
el("celebrateBtn").addEventListener("click", startExperience);
surpriseHit.addEventListener("click", openSurprise);
revealClose.addEventListener("click", closeReveal);
el("giftClose").addEventListener("click", closeGiftSelect);
// ESC works like the X buttons — including out of the form, which had no
// keyboard exit at all before (Sarah, Aug 19)
window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (getComputedStyle(reveal).display !== "none" &&
      revealClose.style.pointerEvents === "auto") {
    closeReveal();
  } else if (getComputedStyle(formOverlay).display !== "none") {
    changeGift(); // back to the gift picker, same as "Change my mind"
  } else if (getComputedStyle(giftSelect).display !== "none") {
    closeGiftSelect();
  }
});
el("changeGiftBtn").addEventListener("click", changeGift);
claimForm.addEventListener("submit", submitClaim);
el("exploreBtn").addEventListener("click", startFreeExplore);

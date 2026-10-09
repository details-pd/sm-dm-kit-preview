# Stephanie Miller Baby DM Kit — handoff

Reskin of the Jonny Fruits kit for **Stephanie Miller** (Atlassian), baby #3.
Must ship before her maternity leave starts **Oct 19 2026**.
Delivery is by **Slack**, not email, so there is no email asset in scope.

Source art: `PD-Stephanie-Miller-Baby-DM-Kit-Design-Assets.ai`
(Drive `1RGYEZ5fKrHokBzJRT7aJWXZjnZeTNasB`). Serve with
`python3 -m http.server 8791` from this directory.

## Done (Phase 2, Oct 9)

Geometry was verified by measurement, not by eye. Do not re-derive it.

- **Track unchanged.** All 34 waypoints were re-sampled against the new board
  and every one still lands on the painted band. Carried over verbatim.
- **Slots re-measured** by min-area rect on the white card body. The method was
  calibrated against the Jonny config first and reproduced its cx, cy and angle
  to within 0.01deg. M2 and M3 genuinely moved; M1 and M4 only gained a small
  rotation.
- **Board rebuilt** with `tools/build-board-v4.py`, constants unchanged. The
  extracted start label came out byte-identical to Jonny's, which proves that
  corner of the board is untouched.
- **Pieces extracted** with the new `tools/extract-pieces.py`. pdftoppm here has
  no `-transp`, so alpha is derived by flooding the background inward; the
  sticker drop shadows detach and are merged back, without which every sprite is
  44px narrow and every widthFrac wrong.
- **Start position lowered** to y 0.1100. Stephanie's head is taller than
  Kelly's (rise 0.0899 vs 0.0819 board-heights) and cleared the frame by only
  0.0011 at the old anchor. The red piece runs well past there, so this costs
  nothing and avoids reopening the top gap Sarah asked to close.
- **Progressive pawns built** in `main.js`: `joinsAt` on a pawn brings it on when
  that milestone is turned. Verified in-browser: 2 on the board at load, Wesley
  at milestone 1, Bennett at milestone 2.

## Open

1. **Pawn rest positions.** BLOCKING and it is a design call, not a bug.
   A four-head group is 0.50 of board width at `pawnSpread: 0.41`, against a
   card 0.20 wide, so `pawnPos` for milestones 1, 2 and 3 now overlaps the card
   text. Measured at milestone 2: group box [517,1733,1491,2223] vs card
   [434,1821,833,2341]. Tightening the spread does not fix it (at 0.15 the group
   is still 0.28 wide and the best placement improves by only ~60px), because
   the binding constraint is the group's HEIGHT, not its width. Jonny's shipped
   positions sat ~520px from their card centres, so that distance is normal.
   Needs Kharisel's placement call for a family of four.
2. **Gift card art** still points at the Jonny files. Artboards 4 and 5 need
   running through `tools/extract-gift-cards.py`. Kharisel says The Next Lap's
   front may be re-exported once the gift is locked.
3. ~~Gift descriptions.~~ **RESOLVED Oct 9.** Kharisel: slide 11's copy is in
   the deck's speaker notes, slide 12's is in the Illustrator file. So the .ai
   is authoritative for gift copy and the deck's section 01 lines were gift
   IDEATION, not website copy. The landing copy in the speaker notes was diffed
   against `config.js` and matches exactly. Nothing to change.
4. **Notifier** still points at the Jonny deployment, which emails details@ and
   Sarah on every real POST. Repoint before anything is submitted.
5. **No remote yet.** Needs a GitHub repo and Pages.

## Conventions worth keeping

- Bump `?v=` on any asset change; stale-cache bugs bit this codebase twice.
- Verify by DOM/JS assertion with a manually driven GSAP clock, not by watching
  animations. Hidden tabs never tick rAF.
- "favorite", not "favourite". US recipient, deliberate.

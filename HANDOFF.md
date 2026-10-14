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

## Kharisel's Oct 14 feedback

1. ~~All pieces need a white outline and must not look transparent.~~ **DONE.**
   My Oct 9 flood-fill cut had removed 75 to 90% of each head's white outline
   (the outline is white and so is the artboard) and left every edge hard.
   Measured against a true-alpha render, white-outline px went 8,402 -> 40,989
   (Steph), 6,961 -> 28,884 (Jesse), 4,495 -> 18,880 (Wesley), 1,805 -> 13,689
   (Bennett), now exactly equal to the design. New `tools/extract-heads.py` cuts
   heads from `pdftocairo -png -transp -r 144` output. Sizes barely moved, so
   nothing shifts on the board. Cards were not touched: their outlines are black
   so the flood never had this problem.
2. ~~Wesley and Bennett under their parents.~~ **DONE Oct 14.** Pawns take a
   `row`; rows are centred independently and row 1 drops by `pawnRowDrop` (0.42)
   of the tallest row-0 head, with row 1 given a higher z-index so the boys
   overlap their parents. Group width fell from 0.502 to 0.302 of the board.
   `joinedThrough` replaced `drawn` for pawn visibility so a child appears only
   after the parents finish walking, and the reveal re-frames only if the taller
   group fell out of shot. Rest positions for milestones 1 and 2 were re-solved
   (M1 and M4 were already clear).
   Two things worth knowing for next time: `TRACK.nearestT` returns a NORMALISED
   0-1 value, not arc length, so an earlier constraint written as a fraction of
   `TRACK.total` silently did nothing; and a solver that only protects the
   caption will happily park the family on the title, which is what it did.
   Verified by screenshot at each stop, not just by the numbers.

2a. **Oct 14 PM, Kharisel's round 2: boys lower, DONE.** `pawnRowDrop` 0.42 -> 0.70
   so the boys' heads sit near their parents' chins instead of over their faces.
   The group is taller (0.208 of the board high at three or four heads, was 0.132
   at two), so rest positions were re-checked at all four stops: stops 1, 3 and 4
   unchanged and clear; the rookie stop nudged 0.449 -> 0.445 (it was touching the
   card above); `endPos` y 0.900 -> 0.892 because the taller group ran off the
   bottom of the board. Verified by screenshot at three stops and by clipping
   numbers on desktop and a 375px phone. Covering the dog at the second stop is
   fine per Kharisel. **Cost to know about:** at the very end the boys cover the
   right half of the baked "From The Pixel Dreams Team" sign-off at the bottom
   left. HTTPS: certificate approved and enforced, so no more "unsecured" popup.

2b. ~~End of the board on a phone.~~ **DECIDED Oct 14 (Kharisel): clip the family,
   keep the button.** The last card and the pill's hit box overlap, so a family of
   four cannot share a phone screen with the button at the locked zoom. New
   `frameEndBeat()` in main.js frames both when they fit (desktop) and otherwise
   lines the camera up with the BUTTON's right edge plus a little air, letting the
   family clip on the left. On a 375px phone the button now shows fully (0px
   clipped) and ~67px of the family is cut (was ~26px of the family and ~33px of
   the button). Gotcha that cost an attempt: `armSurprise()` used to re-frame "the
   couple and the pill" itself, silently overriding any other end framing, so the
   fix lives there. It is also called when she backs out of the gift screen.
2c. **End position vs the footer, DONE Oct 14 (Kharisel).** The boys were covering
   the baked "From The Pixel Dreams Team" sign-off (bar at x 0.040-0.407, y
   0.969-0.976). `endPos` y 0.892 -> 0.852, solved against the footer, pill, last
   card, every other card and the board edge: 133px higher and clean on all of
   them. Verified by screenshot on desktop (sign-off fully readable, nothing
   clipped) and by clipping numbers on desktop and a 375px phone.

3. **Unique URL: set up Oct 14, WAITING ON DNS.** `stephanieandjesse.pixeldreams.com`,
   same pattern as Jonny's. Done: `CNAME` file (b3c6b83) and the custom domain set on
   the repo's Pages site. NOT done: the DNS record, `CNAME stephanieandjesse ->
   details-pd.github.io`, which Waheed adds. Until it exists the old
   `details-pd.github.io/sm-dm-kit-preview` link redirects to a domain that does not
   resolve (remove the domain with `gh api -X DELETE repos/details-pd/sm-dm-kit-preview/pages`
   style change if that has to wait). After DNS propagates: enforce HTTPS with
   `gh api -X PUT repos/details-pd/sm-dm-kit-preview/pages -F https_enforced=true`
   (GitHub refuses until the cert is issued) and confirm the page loads.
4. **Headline wrap, DONE (Waheed):** "Endless adventures." stays on one line,
   including on phones (width-capped font, checked at 320, 375, 414, 1280).

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
2. ~~Gift card art.~~ **DONE Oct 9.** Extracted from artboards 4 and 5 with
   `tools/extract-gift-cards.py`, which is now parameterized: it used to have its
   output path hardcoded to the JONNY repo and would have overwritten his art.
   Usage: `python3 tools/extract-gift-cards.py backs.png fronts.png out-dir`
   with both artboards rendered at `pdftoppm -r 144`. Fronts get the description
   text painted out of the white band (assets/v5), because the copy is live text.
   Verified: 0 pixels changed outside the erase box, 0 text left inside, 0 holes.
   Kharisel says The Next Lap's front may be re-exported once the gift is locked;
   re-run the extractor and bump `?v=` on that one file.
3. ~~Gift descriptions.~~ **RESOLVED Oct 9.** Kharisel: slide 11's copy is in
   the deck's speaker notes, slide 12's is in the Illustrator file. So the .ai
   is authoritative for gift copy and the deck's section 01 lines were gift
   IDEATION, not website copy. The landing copy in the speaker notes was diffed
   against `config.js` and matches exactly. Nothing to change.
4. **Notifier: deployed, awaiting ONE click from Waheed.** New project
   `apps-script-backups/stephanie-miller-claim-notifier`, deployment
   `AKfycbxGjdsl...VdIDTpeSdwQ` @1. The site now points at it, and no trace of
   the Jonny endpoint remains. It returns 403 until the owner opens the project
   in the Apps Script editor, runs any function, and approves Review permissions.
   Recipients are `details@` only. Add Kharisel for testing and Calvin at go-live
   (Calvin Sribniak-Jones, navigate@pixeldreams.com per the kickoff notes; NOT
   added without being asked). Test with GET only, since a real POST emails a fake
   claim to every recipient. Redeploy with `clasp deploy -i <id>` to keep the URL.
   Gotchas: `clasp create` overwrites appsscript.json with a default that drops
   the `webapp` block (restore from git and re-push before deploying), and
   `clasp pull` writes a duplicate Code.js beside Code.gs that breaks the next
   push (delete it).
5. ~~No remote yet.~~ **DONE Oct 9.** `github.com/details-pd/sm-dm-kit-preview`
   (public; GitHub refused Pages on a private repo on this plan). Staging:
   https://details-pd.github.io/sm-dm-kit-preview/ . Deploys on every push to
   main via `.github/workflows/pages.yml`. No CNAME on purpose. The repo holds
   the children's faces and birth years; move it behind a custom host if that
   matters before sharing wider. Live config.js confirmed free of Jonny's endpoint.

## Conventions worth keeping

- Bump `?v=` on any asset change; stale-cache bugs bit this codebase twice.
- Verify by DOM/JS assertion with a manually driven GSAP clock, not by watching
  animations. Hidden tabs never tick rAF.
- "favorite", not "favourite". US recipient, deliberate.

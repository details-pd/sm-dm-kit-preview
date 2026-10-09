/* =========================================================
   KIT CONFIG — everything recipient-specific lives HERE.
   Re-skinning this experience for a new person / life event
   should mean: swap the assets referenced below and edit
   these values. No changes to main.js.

   Coordinate conventions:
   - board fractions: 0..1 of board width/height (x right, y down)
   - slot angle: degrees, CSS clockwise
   - track: waypoints in board fractions; main.js smooths them
     into a path (Catmull-Rom), pawns travel along it

   NOTE ON Y VALUES: the board art is Kharisel's artboard with 110
   render-px of cream inserted under the top frame (tools/build-board-v4.py).
   Every y below is therefore the artboard value mapped through
   y' = (y * 6516 + 110) / 6626.

   PROVENANCE (Oct 9 2026): reskinned from the Jonny Fruits kit. Kharisel
   built this artboard on that template, so the artboards are the same sizes
   and the TRACK IS UNCHANGED — all 34 waypoints were re-sampled against the
   new board and every one still lands on the painted band, so they are
   carried over verbatim. The slot transforms were re-measured; M2 and M3
   genuinely moved, M1 and M4 only picked up a small rotation.
   ========================================================= */

const KIT = {
  recipient: {
    name: "Stephanie Miller",   // goes into the claim email payload
  },

  copy: {
    pageTitle: "Congratulations, Stephanie and Jesse!",
    introHeadline: "Growing crew. Endless adventures.",
    // Kharisel's Oct 9 landing letter — one entry per paragraph
    introBody: [
      "Stephanie and Jesse,",
      "From “I do” to a family of five, you’ve been building a life with plenty to celebrate.",
      "Now, with Wesley and Bennett welcoming a new little teammate, there’s even more love along for the ride.",
      "To celebrate baby number three, we invite you to take a moment to revisit the moments that made you <em>you</em>, with a little surprise waiting at the end.",
      "Cheering you on always,<br>The Pixel Dreams Team",
    ],
    introCta: "Dive in",
    giftTitle: "Time to Celebrate",
    // "favorite", not the design's "favourite": the recipient is in Indiana,
    // same deliberate US spelling as the Jonny kit (eeac7dc). Confirmed by
    // Waheed, Oct 9.
    giftSub: "We’d love to send you a gift to commemorate this incredible moment in your lives. Browse the options below and choose your favorite.",
    formTitle: "Great choice. Tell us where to send the gift!",
    formGiftLead: "Your gift:",
    formChangeCta: "Change my mind",
    formPhoneLabel: "Phone number",
    formAddressLabel: "Delivery address",
    formInstructionsLabel: "Delivery instructions",
    formSubmitCta: "Submit",
    formMissing: "Please fill in your phone number and address.",
    formFailed: "Hmm, that didn’t send — mind trying once more?",
    thanksTitle: "Your gift is on the way!",
    thanksBody: "Expect it to arrive within two weeks.<br>Congratulations again, Stephanie and Jesse.",
    thanksCta: "Back to the board",
    // labels for assistive tech — the visible words are baked into the art
    startLabelAlt: "Start the Journey",
    clickCardAlt: "Click me — reveal this milestone",
    surpriseAlt: "Click for a surprise",
  },

  board: {
    image: "assets/v4/board-play.jpg?v=1",
    // native design space; all fractions map onto this (w, h)
    size: [1938, 3313],
    // The family waits together on the TOP RED piece. Lowered from the Jonny
    // kit's 0.1002: Stephanie's head is taller than Kelly's (rise 0.0899 vs
    // 0.0819 board-heights) and would have cleared the frame by only 0.0011.
    // The red piece runs well past here, so dropping the anchor buys the
    // clearance without reopening the top gap Sarah asked to close (Aug 20).
    startPos: [0.740, 0.1100],
    // where they end up after the last milestone: the second-to-last
    // (black) piece, high enough that heads stay clear of the baked
    // "Click for a surprise" pill below them.
    endPos: [0.778, 0.8983],

    // "Start the Journey" is baked into the artboard where the family has to
    // stand, so build-board-v4.py lifts it out as a sprite and erases it from
    // the raster. Placed here shifted left of its artboard position to clear
    // the heads; main.js fades it out once the first card is turned.
    // (The sprite came out byte-identical to the Jonny one — that whole
    // corner of the board is untouched.)
    startLabel: {
      img: "assets/v4/label-start.png?v=1",
      x: 0.2860,
      y: 0.0433,
      w: 0.3186,
    },

    // the final blue piece + its baked pill: what flashes and what you
    // click to open the gifts. Unchanged from the Jonny board.
    surprise: {
      hit: { x: 0.706, y: 0.9087, w: 0.246, h: 0.0851 },
      // the pulse is a ring drawn just OUTSIDE the baked pill: the pill is
      // painted into the board, so anything laid over it washes the red out
      ring: { x: 0.7115, y: 0.9363, w: 0.2290, h: 0.0301 },
    },

    // pawn track — verified waypoint-by-waypoint against this board on
    // Oct 9: all 34 still sample the painted band, so they are unchanged
    // from the Jonny kit. Only the segment COLOURS differ.
    track: [
      [0.945, 0.0382], [0.845, 0.0579], [0.762, 0.0904], [0.66, 0.1228],
      [0.55, 0.1425], [0.44, 0.1641], [0.35, 0.1887], [0.295, 0.2182],
      [0.253, 0.2526], [0.222, 0.29], [0.205, 0.3431], [0.293, 0.3746],
      [0.383, 0.407], [0.473, 0.4286], [0.56, 0.4414], [0.66, 0.4591],
      [0.755, 0.4886], [0.833, 0.5378], [0.805, 0.5919], [0.72, 0.6135],
      [0.6, 0.6283], [0.483, 0.644], [0.37, 0.6519], [0.26, 0.6578],
      [0.148, 0.6745], [0.107, 0.7197], [0.126, 0.766], [0.215, 0.8132],
      [0.335, 0.8338], [0.445, 0.8486], [0.55, 0.8554], [0.65, 0.8604],
      [0.735, 0.884], [0.775, 0.9361],
    ],
  },

  // Game pieces (sticker heads). Stephanie and Jesse are on the board from
  // the first frame; the boys join as their own milestones are turned
  // (Kharisel, Oct 9: "Wesley and Bennett should appear on the board once
  // their milestone cards are flipped"). joinsAt is the milestone INDEX that
  // brings that pawn on; null means present from the start.
  // widthFrac = the sprite's native width / the 3876px board render, so the
  // sticker lands at its designed size.
  pawns: [
    { img: "assets/v3/head-steph.png?v=1",   alt: "", widthFrac: 0.1837, joinsAt: null },
    { img: "assets/v3/head-jesse.png?v=1",   alt: "", widthFrac: 0.1486, joinsAt: null },
    { img: "assets/v3/head-wesley.png?v=1",  alt: "", widthFrac: 0.1326, joinsAt: 1 },
    { img: "assets/v3/head-bennett.png?v=1", alt: "", widthFrac: 0.1148, joinsAt: 2 },
  ],
  // gap between neighbours as a fraction of the two heads either side of it
  pawnSpread: 0.41,

  // the card art that replaces a year card when that milestone is next up
  clickCard: "assets/v4/card-clickme.png?v=1",
  // blank card that sits under the turning one, so the milestone card baked
  // into the board is never uncovered mid-turn
  blankCard: "assets/v4/card-blank.png?v=1",

  // milestones IN ORDER. slot = measured transform of the baked card art on
  // the board, re-measured Oct 9 by min-area rect on the white card body
  // (method calibrated against the Jonny config: cx, cy and angle all
  // reproduced to within 0.01deg before being trusted here).
  milestones: [
    {
      id: "races",
      face: "assets/v3/face-races.png?v=1",
      yearCard: "assets/v3/year-2017.png?v=1",
      alt: "Memory card: Off to the Races, 2017 — a tiered wedding cake with a heart. Two hearts, one road ahead.",
      slot: { cx: 0.2330, cy: 0.2688, w: 0.1977, h: 0.1508, angle: -3.93 },
      pawnPos: [0.435, 0.1641], // stops clear of the card text
    },
    {
      id: "rookie",
      face: "assets/v3/face-rookie.png?v=1",
      yearCard: "assets/v3/year-2021.png?v=1",
      alt: "Memory card: Rookie of the Year, 2021 — a wooden crib. Wesley joins the team. Hello, Mom and Dad!",
      slot: { cx: 0.6692, cy: 0.4110, w: 0.1977, h: 0.1508, angle: -0.80 },
      pawnPos: [0.414, 0.4159],
    },
    {
      id: "horsepower",
      face: "assets/v3/face-horsepower.png?v=1",
      yearCard: "assets/v3/year-2023.png?v=1",
      alt: "Memory card: Double the Horsepower, 2023 — two car seats side by side. Bennett arrives, and Wesley gets a teammate for life.",
      slot: { cx: 0.3268, cy: 0.6281, w: 0.1977, h: 0.1508, angle: -1.85 },
      pawnPos: [0.536, 0.6371],
    },
    {
      id: "backseat",
      face: "assets/v3/face-backseat.png?v=1",
      yearCard: "assets/v3/year-2026.png?v=1",
      alt: "Memory card: Three Across the Back Seat, 2026 — a baby bottle. The newest Miller takes the starting line.",
      slot: { cx: 0.6296, cy: 0.8431, w: 0.1977, h: 0.1508, angle: 3.75 },
      pawnPos: [0.365, 0.8387],
    },
  ],

  // Gift options. Names are final (Kharisel's Oct 9 artboards 4 and 5).
  // Card art was extracted with tools/extract-gift-cards.py: chrome and buttons
  // are baked into the art and the whole card is the click target. The
  // descriptions are live text, so the fronts have them painted out of the
  // white band (assets/v5), which is what lets the copy change without a
  // re-export. Copy is as designed in the .ai; per Kharisel, the .ai is
  // authoritative for gift copy and the deck's section 01 was ideation only.
  // Kharisel flagged that The Next Lap's front may be re-exported once the
  // actual gift is locked: re-run the extractor and bump ?v= on that file.
  gifts: [
    {
      name: "The Next Lap",
      back: "assets/v3/gift-nextlap-back.png?v=1",
      front: "assets/v5/gift-nextlap-front.png?v=1",
      backAlt: "Face-down gift card with a race car sticker — flip to reveal",
      desc: "A collection of race\u2011day<br>baby essentials to welcome<br>the newest little racer.",
      frontAlt:
        "The Next Lap — a collection of race-day baby essentials to welcome the newest little racer. Click to choose this gift.",
    },
    {
      name: "Memory Lane",
      back: "assets/v3/gift-memorylane-back.png?v=1",
      front: "assets/v5/gift-memorylane-front.png?v=1",
      backAlt: "Face-down gift card with a memory-book sticker — flip to reveal",
      desc: "Items to help preserve<br>the little moments as<br>they unfold.",
      frontAlt:
        "Memory Lane — items to help preserve the little moments as they unfold. Click to choose this gift.",
    },
    {
      name: "The Pit Stop",
      back: "assets/v3/gift-pitstop-back.png?v=1",
      front: "assets/v5/gift-pitstop-front.png?v=1",
      backAlt: "Face-down gift card with a serving-dish sticker — flip to reveal",
      desc: "Chef-made meals, delivered<br>to the door. Pick the meals,<br>choose a date, and you’re set.",
      frontAlt:
        "The Pit Stop — chef-made CookUnity meals delivered to the door. Click to choose this gift.",
    },
  ],

  notifier: {
    // Stephanie's own deployment (apps-script-backups/stephanie-miller-claim-
    // notifier), recipients details@ only until go-live. It replaced the Jonny
    // endpoint, which emails Sarah on every real POST.
    //
    // It returns 403 until the owner approves the one-time permission prompt in
    // the Apps Script editor (Run any function, Review permissions, Allow).
    // Until then a submit fails safely with copy.formFailed.
    endpoint:
      "https://script.google.com/macros/s/AKfycbxGjdslx36wRe0vxyddtk_6udgaJVauqAib4VbpZtgwqVBZn_-YyDlaVuJVcIDTpeSdwQ/exec",
  },

  // play-zoom framing: a milestone card aims for ~cardHeight of the
  // viewport, but the board never renders wider than boardMaxWidth ×
  // viewport width — that cap is what keeps phones zoomed OUT.
  camera: {
    cardHeight: 0.34,
    cardMaxWidth: 0.78,
    boardMaxWidth: 1.6,
    framePad: 0.92,
    framePadMobile: 0.84,
    followMargin: 0.05,
    followEase: 0.24,
  },

  // animation pacing
  timing: {
    flipDur: 0.45,        // card flip in the revisit popup
    turnDur: 0.44,        // a board card turning over in place
    introZoomDur: 0.85,   // overview → play zoom
    overviewHold: 0.8,    // beat on the establishing shot
    walkSpeed: 0.20,      // board HEIGHTS per second — constant pace
    nextPrompt: 0.5,      // beat before the next card invites a click
  },
};

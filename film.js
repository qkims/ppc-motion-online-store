/* film.js — each product performs once per visit, then sits still ─────────────
   ROUND 36: "lets update all add to cart renders with these here" -- and every
   one of the three new renders is a "rotate / twist and SIT IN POSITION" clip.
   Asked how they should play, the user chose "once per panel visit, then hold".
   That retires two earlier fences at once: round 16's "lets not have it stop and
   loop in a loop" and round 31's "it must never be parked", both of which existed
   because the old clips were endless floats with no settle to protect.

   ROUND 20 built this driver for the jacket alone, for a reason that still holds:
   a `loop autoplay` video runs on the wall clock, so whatever phase it happened to
   be at when its layer slid in was whatever time of day it was.  No CSS can fix
   that, because the film's clock and the video's clock were never the same clock.
   Its own closing note said Option 1's tube "is one entry in TRACKS away from
   being fixed the same way".  This is that entry, and Option 3's as well.

   THE WINDOW IS THE PANEL'S VISIT, WHICH IS THE KIT TABLE, NOT THE SLIDE TABLE.
   builds.css hands the brand panels over at KIT = 3.150 / 7.150 / 11.950, and the
   transport lands each layer 0.55s later (test_builds.py asserts that 0.55 is one
   number for all three).  So there are two candidate windows per layer, and they
   differ by whether the object is allowed to start turning while its card is still
   travelling in:

       layer      kit open -> kit close        landed -> kit close
         1        11.950 -> 3.150   4.00s      12.500 -> 3.150   3.45s
         2         3.150 -> 7.150   4.00s       3.700 -> 7.150   3.45s
         3         7.150 -> 11.950  4.80s       7.700 -> 11.950  4.25s

   ROUND 37 -- "can we have the items just rotate once and hold in position?  Feel
   free to shave off a few seconds in the beginning."  The clips now run 1.875s /
   1.708s / 1.917s (45 / 41 / 46 frames at 24fps, measured off the delivered files
   in Chrome), heads trimmed by 1.417 / 1.750 / 1.750s; build.py carries the frame
   arithmetic and the label-signature measurement that counted the revolutions.
   Against the kit window the holds go 0.708/0.542/1.133s -> 2.125/2.292/2.883s, so
   every product is now parked for more than half its visit.

   THE WINDOW CHOICE IS NO LONGER FORCED, AND THAT IS THE HONEST STATE OF IT.  Up to
   round 36 this note said "against the LANDED window layer 2 does not fit AT ALL --
   3.458s of clip in a 3.45s window is 0.008s over", and that 8ms was the whole
   argument.  At 1.708s the jacket fits the landed window with 1.742s to spare, and
   so do the other two (1.575s and 2.333s).  So the kit window is now a PREFERENCE,
   kept for two stated reasons rather than by arithmetic: it is what shipped and was
   approved ("I love the videos for all three"), and it carries motion continuously
   through the slide-in instead of sliding a frozen frame in and then starting it.
   Moving to the landed window is a one-line change to WIN and costs nothing that
   can be measured -- if the turn should wait until the card has landed, that is the
   edit, and this paragraph is here so the next round does not have to rediscover
   that the old reason has expired.

   WHAT THE HEAD TRIM COSTS, STATED PLAINLY: the object no longer slides in facing
   front.  Frame 0 used to be roughly the presented pose (the tube ~40 deg off
   front, the jacket front-on at source f8, the bottles labels-front), so round 20's
   "start with the jacket turned front and then have it rotate once its in place"
   was still approximately honoured.  Frame 0 is now the tube's plain BACK, the
   jacket's hood, and the bottles three-quarters round -- because the front-facing
   pose IS the beginning, and the beginning is what round 37 asked to shave.  What
   arrives is one unbroken turn into position, which is the newer and more explicit
   instruction; it is a real departure from round 20 and not a side effect nobody
   noticed.  The settle is still the TAIL of each clip (see build.py), so it cannot
   be trimmed to fit anything, and re-timing the footage is what rounds 33-34
   rejected outright ("original speed from the video").

   THE HOLD IS THE VIDEO ENDING, not a pause we schedule.  A non-looping video that
   reaches its end keeps its last frame on screen, which is exactly the required
   picture, so the driver's job at that point is to do NOTHING.  That is worth
   spelling out because the obvious reconciliation -- "if it should be playing and
   it is paused, play it" -- is wrong here: an ended video reports paused === true,
   and play() on an ended video rewinds it to 0.  Round 20's apply() would have
   re-performed each clip every animation frame for the rest of its visit.

   ROUND 41 REVERSES ROUND 40: ALL THREE LAYERS LOOP AGAIN.  "on loop, the bottle
   should play the turning animation again.  It looks like the bottle stays static
   and the looping doesn't happen?"  Round 40 gave layer 1 a `once` flag so it
   performed once PER PAGE and then held forever; that flag and its whole bypass are
   gone, and all three tracks are back on round 20's single path -- rewind off stage,
   perform on entry, hold the last frame until the window closes.

   WHAT ROUND 40 GOT WRONG IS THE DURATION OF "STATIC", NOT THE IDEA OF IT.  The
   earlier ask -- "after the tube rotates, it should stop in static" -- is satisfied
   by the HOLD at the end of a visit, which the shared path has always done.  Held
   for the life of the PAGE instead, the same behaviour reads as broken, because the
   film comes back around and one of the three panels no longer moves.  The hold is
   still here and, with round 41's shorter clip, it is now 2.833s long; it just ends
   when layer 1 goes off stage, like the other two.

   THE REVERT IS A DELETION AND NOT A FLAG FLIP.  `once: false` would leave a dead
   branch sitting under a header describing behaviour the file no longer has, and
   this project has no version control -- a comment that lies is worse than no
   comment.  The two bypasses ARE worth keeping as prose, because anything
   re-attempting once-per-page has to solve both of them again:

     - THE CATCH-UP SEEK.  Layer 1's window WRAPS the loop seam (11.950 -> 3.150),
       so a page load at t=0 lands 0.850s INSIDE the window.  The shared path seeks
       there, which is right for a looping track and wrong for a once-per-page one:
       it would perform only the tail of the turn and then hold that partial pass
       forever, so the full rotation would never be seen.
     - THE `s.time >= d` END TEST.  It compares FILM phase against clip duration,
       which is only meaningful while the two clocks are locked.  A load at u=2.0
       gives s.time 2.85 against d 1.167 and the clip parks at its end having never
       turned.  Only `v.ended` -- the element's own report that it really did play
       through -- can end a once performance.

   NEITHER HURTS THE RESTORED BEHAVIOUR.  A track that rewinds on every exit is
   locked to film time by construction, and the window is 4.00s against a 1.167s
   clip, so a visit entered at the front can never be cut off.

   THE HOLD DEPENDS ON THE SERVER SUPPORTING BYTE RANGES, WHICH IS NOT A DETAIL.
   `v.currentTime = d` in the hold below is a SEEK, and a seek needs a non-empty
   v.seekable.  Python's http.server sends no Accept-Ranges, so Chrome reports
   v.seekable.length 0 / end(0) 0 even with the whole 34 KB file buffered, and EVERY
   currentTime write silently clamps to 0.  The write meant to ESTABLISH the hold
   then destroys it: the tube snaps back to its un-turned pose and sits there for
   the remaining 2.833s, which looks exactly like this file being broken.  Measured
   both ways on the same bytes and the same Chrome -- no ranges: seekable end 0, a
   write of d lands at 0; with ranges: seekable end 1.167, a write of d lands at
   1.167 with ended true.  ppc-motion-online-store.quick.shopify.io answers
   accept-ranges: bytes, so production is the WORKING case; a plain local server is
   the broken one.  Check this page on something that serves ranges, or the hold
   cannot be judged at all. */
(() => {
  'use strict';

  const LOOP = 12.8;                     // the film's period, as builds.css writes it
  const KIT  = [3.150, 7.150, 11.950];   // the three brand-panel hand-overs
  /* [open, close) per layer -- layer 1's WRAPS the seam, which is why `on` below
     cannot be a simple pair of comparisons. */
  const WIN = {1: [KIT[2], KIT[0]], 2: [KIT[0], KIT[1]], 3: [KIT[1], KIT[2]]};
  const CLOCK = 'bd-slide-2';            // a tap on the film clock, see below
  const CATCH = 0.20;                    // only seek if we arrive this far in

  /* Every bd-* animation on this page is the same 12.8s timeline, so any one of
     them reads film time and the choice of which is a question of what is certain
     to exist and to be running.  bd-slide-2 is that, and has been since round 20.
     It is a CLOCK here and no longer layer 2's own transport: the windows come
     from KIT, and nothing below reads the slide table at all. */

  const on = (u, w) => (w[0] < w[1] ? (u >= w[0] && u < w[1])
                                    : (u >= w[0] || u < w[1]));

  /* The schedule, as a pure function of film time.  tick() does nothing except
     apply this, and test_builds.py checks THIS -- so what the suite asserts and
     what the page does cannot drift apart. */
  const at = (t, w) => {
    /* The phase is snapped to a tenth of a millisecond before it is compared.
       ((t % LOOP) + LOOP) % LOOP is the idiom that survives a negative time, but
       it is not exact: the +LOOP and the second % do not round-trip, so 3.150 comes
       back as 3.1499999999999995 -- BELOW its own boundary -- and the same landing
       one cycle on comes back the same way.  The turn would have begun a frame
       late, and a close boundary would have counted as still-on-stage.  Nothing
       visible turns on 1e-15s; a boundary that means what it says does.  0.1ms is
       four orders finer than a frame and the film's beats are all on a 10ms grid. */
    const u = +((((t % LOOP) + LOOP) % LOOP).toFixed(4));
    return on(u, w) ? {play: true, time: +(((u - w[0] + LOOP) % LOOP).toFixed(6))}
                    : {play: false, time: 0};
  };

  const TRACKS = [1, 2, 3].map(n => ({layer: n, sel: `video[data-film="${n}"]`,
                                      win: WIN[n], v: null, parked: false}));
  let raf = 0;

  const clock = () => document.getAnimations().find(
    a => (a.animationName || '') === CLOCK);

  const apply = (tr, s) => {
    const v = tr.v;
    if (!v) return;

    if (!s.play) {
      // Off stage, so rewind: the next visit has to perform from the front, and
      // this is the one place a rewind is invisible.  Clearing `parked` here is
      // what makes the next visit a new performance rather than a resumed one.
      if (!v.paused) v.pause();
      if (v.currentTime > 0.001) v.currentTime = 0;
      tr.parked = false;
      return;
    }
    // duration is NaN until metadata arrives; 0 then reads as "do not know yet"
    // and the normal play path is taken, which is correct -- there is nothing to
    // be past the end of.
    const d = v.duration || 0;
    if (v.ended || (d && s.time >= d)) {
      // The performance is over for this visit.  HOLD: no play(), no seek, no
      // pause of a video that is already stopped at its own end.  The single
      // currentTime write is for the other way in -- a first load that lands in
      // the tail of a window, where the clip should already be finished but the
      // element has never decoded a frame.  `parked` makes that write happen once
      // instead of on every animation frame, because a seek does not necessarily
      // land where it was asked to and comparing against d would re-fire forever.
      if (!v.paused) v.pause();
      if (!tr.parked && d) { v.currentTime = d; tr.parked = true; }
      return;
    }
    if (v.paused) {
      // A first load can arrive anywhere in the window.  Only then is a seek
      // worth its decode; the cycle's own entry is at time 0 and needs none.
      if (s.time > CATCH && Math.abs(v.currentTime - s.time) > CATCH)
        v.currentTime = s.time;
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    }
  };

  const tick = () => {
    const a = clock();
    // While the film is PAUSED the driver does nothing at all: test_builds.py pins
    // the film and freezes every video on frame 0, and a driver that went on
    // setting currentTime would fight it for the whole run.
    if (a && a.playState === 'running' && a.currentTime !== null)
      for (const tr of TRACKS) apply(tr, at(a.currentTime / 1000, tr.win));
    raf = requestAnimationFrame(tick);
  };

  const start = () => {
    for (const tr of TRACKS) tr.v = document.querySelector(tr.sel);
    if (!raf) raf = requestAnimationFrame(tick);
  };
  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  window.__film = {
    LOOP, KIT, WIN, CLOCK, at, on, start, stop,
    running: () => raf !== 0,
    tracks: () => TRACKS.map(tr => ({layer: tr.layer, sel: tr.sel, win: tr.win,
                                     found: !!document.querySelector(tr.sel)})),
  };

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();

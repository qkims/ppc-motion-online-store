/* ============================================================================
   Logo Group Marquee — Figma 50:15637
   Motion ported from https://www.shopify.com/zh/ppc/online-store

   The reference marquee is pure CSS: identical tracks each running
   `animation: marquee-ltr var(--marquee-duration) linear infinite`, where
   @keyframes marquee-ltr goes translateX(-100%) -> translateX(0).

   The reference instance hardcodes --marquee-duration:29.4s for a 1404px
   track, i.e. 47.755 px/s. This page's track is wider (10 logos, not 6), so a
   copied duration would scroll visibly slower. This script instead holds the
   reference *speed* by deriving the duration from the measured track width —
   which also keeps the speed constant across breakpoints, where the logo cell
   height (and therefore the track width) changes.

   If the animation should be tuned by hand instead, delete this file and set
   --marquee-duration in styles.css; the CSS default (44.1s) already matches
   the reference speed at the 1440px desktop width.
   ========================================================================= */
(function () {
  'use strict';

  var REFERENCE_PX_PER_SECOND = 1404 / 29.4; // 47.7551…, from the live page

  var marquee = document.getElementById('logoMarquee');
  if (!marquee) return;

  var tracks = marquee.querySelectorAll('[data-marquee-track]');
  if (!tracks.length) return;

  function sync() {
    // one full cycle translates a track by exactly its own width
    var width = tracks[0].getBoundingClientRect().width;
    if (!width) return;
    var seconds = width / REFERENCE_PX_PER_SECOND;
    marquee.style.setProperty('--marquee-duration', seconds.toFixed(3) + 's');
  }

  sync();

  // logo SVGs are laid out by CSS box, not intrinsic size, so width is stable
  // once styles apply — but re-sync on resize and after webfont/layout settles
  if ('ResizeObserver' in window) {
    new ResizeObserver(sync).observe(marquee);
  } else {
    window.addEventListener('resize', sync);
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sync);
})();

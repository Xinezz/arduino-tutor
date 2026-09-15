// Counts a number up from 0 instead of just appearing - a small thing, but
// it's the difference between a stat that feels alive and one that's just
// text. Originally built for the Dashboard's stat tiles, extracted here once
// the main menu needed the exact same effect for its own progress summary.
// Skipped for anyone who's told their OS they get motion-sick from this kind
// of thing (prefers-reduced-motion) - they see the final value immediately.
//
// Deliberately setTimeout and not requestAnimationFrame: rAF only fires tied
// to an actual paint, which browsers are free to throttle heavily (or stop
// firing almost entirely) the moment a tab isn't the focused one - a stat
// counter opened in a background tab would otherwise just sit stuck on "0"
// forever instead of counting up once you switch to it.
export function animateCount(el, toValue, suffix = "") {
  if (toValue <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = toValue + suffix;
    return;
  }
  const duration = 700;
  const frameMs = 16;
  const start = Date.now();
  function tick() {
    const t = Math.min((Date.now() - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic - fast start, gentle landing
    el.textContent = Math.round(eased * toValue) + suffix;
    if (t < 1) setTimeout(tick, frameMs);
  }
  tick();
}

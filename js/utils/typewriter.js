// Reveals a code block's text one character at a time instead of it just
// appearing - the "movie hacker" look, paired with a blinking cursor
// (styled in css/style.css via the .typewriter class this adds). Meant for
// STATIC code that's shown once and read, never edited - the live practice
// editor is a real CodeMirror instance and never goes through this.
//
// Deliberately setTimeout-based, not requestAnimationFrame: rAF is tied to
// an actual paint and gets throttled hard (sometimes almost entirely
// stopped) whenever a tab isn't the focused one, which was already found
// and fixed the same way for both the board's render loop and the
// dashboard's stat counters - a typing effect that silently stalls in a
// background tab would be a worse experience than no effect at all.
export function typewriterText(el, text, opts = {}) {
  el.classList.add("typewriter");

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = text;
    return;
  }

  // Longer solutions type faster per character, not slower overall - the
  // effect should read as "this appeared with some flair," not become
  // something you have to sit through to reach a 15-line answer.
  const maxDurationMs = opts.maxDurationMs ?? 900;
  const minCharMs = opts.minCharMs ?? 6;
  const charMs = Math.max(minCharMs, maxDurationMs / Math.max(text.length, 1));

  el.textContent = "";
  let i = 0;
  function tick() {
    i++;
    el.textContent = text.slice(0, i);
    if (i < text.length) setTimeout(tick, charMs);
  }
  tick();
}

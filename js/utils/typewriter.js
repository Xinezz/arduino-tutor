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
//
// Options: maxDurationMs / minCharMs tune the speed, onChar(count, char) fires
// after each character appears (Sam's voice blips hook in here), and onDone()
// fires once the full text is showing. Returns { cancel, finish }: cancel()
// stops the effect where it is (so a stale line can't keep talking after the
// next one starts), finish() jumps straight to the full text.
export function typewriterText(el, text, opts = {}) {
  el.classList.add("typewriter");

  const finishNow = () => {
    el.textContent = text;
    opts.onDone?.();
  };

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    finishNow();
    return { cancel() {}, finish() {} };
  }

  // Longer solutions type faster per character, not slower overall - the
  // effect should read as "this appeared with some flair," not become
  // something you have to sit through to reach a 15-line answer.
  const maxDurationMs = opts.maxDurationMs ?? 900;
  const minCharMs = opts.minCharMs ?? 6;
  const charMs = Math.max(minCharMs, maxDurationMs / Math.max(text.length, 1));

  el.textContent = "";
  let i = 0;
  let timer = null;
  let stopped = false;

  function tick() {
    if (stopped) return;
    i++;
    el.textContent = text.slice(0, i);
    opts.onChar?.(i, text[i - 1]);
    if (i < text.length) {
      timer = setTimeout(tick, charMs);
    } else {
      opts.onDone?.();
    }
  }
  tick();

  return {
    cancel() {
      stopped = true;
      clearTimeout(timer);
    },
    finish() {
      if (stopped || i >= text.length) return;
      stopped = true;
      clearTimeout(timer);
      finishNow();
    },
  };
}

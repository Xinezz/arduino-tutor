// Renders a challenge card with the 4-tier hint system:
// Hint 1 (concept) -> Hint 2 (which function/concept to use) -> Hint 3 (small example) -> Solution.
// Each tier only appears after the learner explicitly asks for it, and they're revealed
// one at a time (you can't skip straight to hint 3 without seeing 1 and 2 first) -
// the point is to make you think before you see the answer. Now with a real cost
// attached to that too: each tier is priced (escalating, so thinking it through
// stays cheaper than skipping ahead), reported to app.js via onSpend rather than
// touching progress/credits directly here - this module only renders and reports.
//
// Challenges marked difficulty "boss" get the full boss-fight treatment: a
// menacing chip with an HP bar, and a short defeat sequence when you mark it
// solved. It's presentation only - the reward is the same as any other
// challenge, and onComplete fires after the fight so the payout lands on the
// victory banner.

import { typewriterText } from "../utils/typewriter.js";
import { HINT_COSTS, SOLUTION_COST, CREDIT_REWARDS } from "../progress/progress.js";
import { icon } from "../game/sprites.js";
import { playSfx, duckMusic } from "../game/audio.js";
import { getSettings } from "../game/settings.js";
import { burst, banner, shake, screenFlash, confetti, centerOf } from "../game/fx.js";

const DIFFICULTY = {
  easy: { label: "Easy", stars: 1, cls: "difficulty-easy" },
  medium: { label: "Medium", stars: 2, cls: "difficulty-medium" },
  hard: { label: "Hard", stars: 3, cls: "difficulty-hard" },
  boss: { label: "Boss Challenge", stars: 0, cls: "difficulty-boss" },
};

const BOSS_HP_SEGMENTS = 10;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function renderChallenge(container, challenge, { onComplete, onSpend, alreadySolved = false }) {
  container.innerHTML = "";
  if (!challenge) return;

  let hintsRevealed = 0;
  let solutionRevealed = false;
  const isBoss = challenge.difficulty === "boss";

  const card = document.createElement("div");
  card.className = "challenge-card hud-frame" + (isBoss ? " is-boss" : "");

  // ---- boss banner: sprite + HP bar ----
  let hpFill = null;
  let bossArt = null;
  if (isBoss) {
    const arena = document.createElement("div");
    arena.className = "boss-arena";
    bossArt = document.createElement("div");
    bossArt.className = "boss-art";
    bossArt.innerHTML = icon("bossChip", 6);
    arena.appendChild(bossArt);

    const hud = document.createElement("div");
    hud.className = "boss-hud";
    const nameRow = document.createElement("div");
    nameRow.className = "boss-name";
    nameRow.innerHTML = `${icon("skull", 2)}<span>BOSS</span>`;
    hud.appendChild(nameRow);
    const hp = document.createElement("div");
    hp.className = "boss-hp";
    for (let i = 0; i < BOSS_HP_SEGMENTS; i++) {
      const seg = document.createElement("i");
      if (alreadySolved) seg.classList.add("is-empty");
      hp.appendChild(seg);
    }
    hpFill = hp;
    hud.appendChild(hp);
    const status = document.createElement("div");
    status.className = "boss-status";
    status.textContent = alreadySolved ? "DEFEATED" : "A boss blocks the way. Wire it. Code it. Beat it.";
    hud.appendChild(status);
    arena.appendChild(hud);
    if (alreadySolved) arena.classList.add("is-defeated");
    card.appendChild(arena);
  }

  const titleRow = document.createElement("div");
  titleRow.className = "challenge-title-row";

  const badge = document.createElement("span");
  const diff = DIFFICULTY[challenge.difficulty] || DIFFICULTY.easy;
  badge.className = `difficulty-badge ${diff.cls}`;
  badge.innerHTML = diff.stars ? icon("star", 2).repeat(diff.stars) : icon("skull", 2);
  const badgeLabel = document.createElement("span");
  badgeLabel.textContent = diff.label;
  badge.appendChild(badgeLabel);

  const title = document.createElement("strong");
  title.textContent = challenge.title;

  titleRow.appendChild(badge);
  titleRow.appendChild(title);
  if (!alreadySolved) {
    const reward = document.createElement("span");
    reward.className = "reward-chip";
    reward.innerHTML = `${icon("star", 1)}+${CREDIT_REWARDS.challenge} ${icon("coin", 1)}+${CREDIT_REWARDS.challenge}`;
    reward.title = "Reward for solving this challenge";
    titleRow.appendChild(reward);
  }
  card.appendChild(titleRow);

  const prompt = document.createElement("p");
  prompt.className = "challenge-prompt";
  prompt.style.whiteSpace = "pre-wrap";
  prompt.textContent = challenge.prompt;
  card.appendChild(prompt);

  const controls = document.createElement("div");
  controls.className = "hint-controls";

  const hintBtn = document.createElement("button");
  hintBtn.className = "btn btn-hint";
  hintBtn.dataset.sfx = "none";
  const solutionBtn = document.createElement("button");
  solutionBtn.className = "btn btn-hint";
  solutionBtn.dataset.sfx = "none";
  const doneBtn = document.createElement("button");
  doneBtn.className = "btn btn-primary";
  doneBtn.dataset.sfx = "none";
  doneBtn.textContent = isBoss ? "Defeat the Boss" : "Mark as Solved";

  controls.appendChild(hintBtn);
  controls.appendChild(solutionBtn);
  controls.appendChild(doneBtn);
  card.appendChild(controls);

  const revealArea = document.createElement("div");
  card.appendChild(revealArea);

  const coin = icon("coin", 2);

  function updateHintButton() {
    if (hintsRevealed >= challenge.hints.length) {
      hintBtn.textContent = "No More Hints";
      hintBtn.disabled = true;
    } else {
      const cost = HINT_COSTS[hintsRevealed] ?? HINT_COSTS[HINT_COSTS.length - 1];
      hintBtn.innerHTML = `Show Hint ${hintsRevealed + 1} of ${challenge.hints.length} · ${coin}${cost}`;
    }
  }

  hintBtn.addEventListener("click", () => {
    const cost = HINT_COSTS[hintsRevealed] ?? HINT_COSTS[HINT_COSTS.length - 1];
    const hintText = challenge.hints[hintsRevealed];
    hintsRevealed += 1;
    playSfx("hint");
    onSpend(cost, `Hint ${hintsRevealed}`, { challengeId: challenge.id, isSolution: false, at: centerOf(hintBtn) });

    const box = document.createElement("div");
    box.className = "hint-box";
    box.textContent = `Hint ${hintsRevealed}: ${hintText}`;
    revealArea.appendChild(box);

    updateHintButton();
  });

  solutionBtn.innerHTML = `Show Solution · ${coin}${SOLUTION_COST}`;
  solutionBtn.addEventListener("click", () => {
    if (solutionRevealed) return;
    solutionRevealed = true;
    playSfx("spend");
    onSpend(SOLUTION_COST, "Solution", { challengeId: challenge.id, isSolution: true, at: centerOf(solutionBtn) });

    const box = document.createElement("div");
    box.className = "solution-box";

    const codeEl = document.createElement("pre");
    codeEl.className = "code-block";
    typewriterText(codeEl, challenge.solution);
    box.appendChild(codeEl);

    const explainHeading = document.createElement("strong");
    explainHeading.textContent = "Line-by-line explanation:";
    box.appendChild(explainHeading);

    const list = document.createElement("ul");
    for (const line of challenge.explain) {
      const li = document.createElement("li");
      li.textContent = line;
      list.appendChild(li);
    }
    box.appendChild(list);

    revealArea.appendChild(box);
    solutionBtn.disabled = true;
  });

  // The boss goes down in a short sequence: ten hits draining the HP bar, a
  // blast, then the victory banner - and only then does the reward land.
  async function defeatBoss() {
    const fx = getSettings().fx;
    const arena = card.querySelector(".boss-arena");
    const status = card.querySelector(".boss-status");
    if (!fx) {
      hpFill.querySelectorAll("i").forEach((s) => s.classList.add("is-empty"));
      arena.classList.add("is-defeated");
      status.textContent = "DEFEATED";
      return;
    }
    duckMusic(4200);
    const segs = [...hpFill.querySelectorAll("i")];
    for (let i = segs.length - 1; i >= 0; i--) {
      segs[i].classList.add("is-empty");
      bossArt.classList.add("is-hit");
      playSfx("bossHit");
      shake(card, 260);
      setTimeout(() => bossArt.classList.remove("is-hit"), 110);
      await wait(150);
    }
    playSfx("boom");
    screenFlash("rgba(255,255,255,0.55)", 360);
    burst(centerOf(bossArt), { count: 34, colors: ["#ff3b3b", "#ffd23f", "#ffffff", "#ff7a59"], size: 8, spread: 150, gravity: 110, duration: 1000 });
    arena.classList.add("is-defeated");
    status.textContent = "DEFEATED";
    await wait(450);
    playSfx("bossDefeat");
    banner("BOSS DEFEATED!", { kind: "boss", sub: "Challenge cleared", duration: 2200 });
    confetti({ count: 90 });
    await wait(900);
  }

  doneBtn.addEventListener("click", async () => {
    if (doneBtn.disabled) return;
    doneBtn.disabled = true;
    const at = centerOf(doneBtn);
    if (isBoss) {
      await defeatBoss();
    }
    onComplete(challenge.id, { at, isBoss });
    doneBtn.innerHTML = `${icon("check", 2)} ${isBoss ? "Defeated" : "Solved"}`;
  });

  if (alreadySolved) {
    // Re-visiting a challenge you've already cleared: show it as done (no
    // second payout is possible anyway - progress.js guards that).
    doneBtn.innerHTML = `${icon("check", 2)} ${isBoss ? "Defeated" : "Solved"}`;
    doneBtn.disabled = true;
  }

  updateHintButton();
  container.appendChild(card);
}

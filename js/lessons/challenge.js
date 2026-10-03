// Renders a challenge card with the 4-tier hint system:
// Hint 1 (concept) -> Hint 2 (which function/concept to use) -> Hint 3 (small example) -> Solution.
// Each tier only appears after the learner explicitly asks for it, and they're revealed
// one at a time (you can't skip straight to hint 3 without seeing 1 and 2 first) -
// the point is to make you think before you see the answer. Now with a real cost
// attached to that too: each tier is priced (escalating, so thinking it through
// stays cheaper than skipping ahead), reported to app.js via onSpend rather than
// touching progress/credits directly here - this module only renders and reports.
//
// Challenges with a `check` (see checks.js) are graded automatically: "Check
// My Code" runs whatever is in the editor (via getCode) and only reports
// completion on a pass. Challenges without one keep the self-marked button.

import { typewriterText } from "../utils/typewriter.js";
import { HINT_COSTS, SOLUTION_COST } from "../progress/progress.js";
import { runCheck } from "./checks.js";

const DIFFICULTY_LABELS = {
  easy: { text: "🟢 Easy", cls: "difficulty-easy" },
  medium: { text: "🟡 Medium", cls: "difficulty-medium" },
  hard: { text: "🔴 Hard", cls: "difficulty-hard" },
  boss: { text: "💀 Boss Challenge", cls: "difficulty-boss" },
};

export function renderChallenge(container, challenge, { onComplete, onSpend, getCode }) {
  container.innerHTML = "";
  if (!challenge) return;

  let hintsRevealed = 0;
  let solutionRevealed = false;

  const card = document.createElement("div");
  card.className = "challenge-card hud-frame";

  const titleRow = document.createElement("div");
  titleRow.className = "challenge-title-row";

  const badge = document.createElement("span");
  const diff = DIFFICULTY_LABELS[challenge.difficulty] || DIFFICULTY_LABELS.easy;
  badge.className = `difficulty-badge ${diff.cls}`;
  badge.textContent = diff.text;

  const title = document.createElement("strong");
  title.textContent = challenge.title;

  titleRow.appendChild(badge);
  titleRow.appendChild(title);
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
  const solutionBtn = document.createElement("button");
  solutionBtn.className = "btn btn-hint";
  const doneBtn = document.createElement("button");
  doneBtn.className = "btn btn-primary";
  const autoCheck = Boolean(challenge.check && getCode);
  doneBtn.textContent = autoCheck ? "Check My Code" : "Mark as Solved";

  controls.appendChild(hintBtn);
  controls.appendChild(solutionBtn);
  controls.appendChild(doneBtn);
  card.appendChild(controls);

  const checkResult = document.createElement("div");
  checkResult.className = "check-result";
  checkResult.hidden = true;
  card.appendChild(checkResult);

  const revealArea = document.createElement("div");
  card.appendChild(revealArea);

  function updateHintButton() {
    if (hintsRevealed >= challenge.hints.length) {
      hintBtn.textContent = "No More Hints";
      hintBtn.disabled = true;
    } else {
      const cost = HINT_COSTS[hintsRevealed] ?? HINT_COSTS[HINT_COSTS.length - 1];
      hintBtn.textContent = `Show Hint ${hintsRevealed + 1} of ${challenge.hints.length} · ⚡${cost}`;
    }
  }

  hintBtn.addEventListener("click", () => {
    const cost = HINT_COSTS[hintsRevealed] ?? HINT_COSTS[HINT_COSTS.length - 1];
    const hintText = challenge.hints[hintsRevealed];
    hintsRevealed += 1;
    onSpend(cost, `Hint ${hintsRevealed}`);

    const box = document.createElement("div");
    box.className = "hint-box";
    box.textContent = `Hint ${hintsRevealed}: ${hintText}`;
    revealArea.appendChild(box);

    updateHintButton();
  });

  solutionBtn.textContent = `Show Solution · ⚡${SOLUTION_COST}`;
  solutionBtn.addEventListener("click", () => {
    if (solutionRevealed) return;
    solutionRevealed = true;
    onSpend(SOLUTION_COST, "Solution");

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

  let solved = false;

  function showCheckResult({ pass, message }) {
    checkResult.hidden = false;
    checkResult.classList.toggle("pass", pass);
    checkResult.classList.toggle("fail", !pass);
    checkResult.textContent = pass ? `✓ Passed! ${message}` : `✗ Not yet: ${message}`;
  }

  doneBtn.addEventListener("click", () => {
    if (!autoCheck) {
      onComplete(challenge.id);
      doneBtn.textContent = "✓ Solved";
      doneBtn.disabled = true;
      return;
    }

    doneBtn.disabled = true;
    doneBtn.textContent = "Checking...";
    // Let the button repaint before the (synchronous) headless run starts.
    setTimeout(() => {
      let result;
      try {
        result = runCheck(challenge.check, getCode());
      } catch (err) {
        console.error(err);
        result = { pass: false, message: "Something went wrong while checking - try running your code first." };
      }
      showCheckResult(result);
      if (result.pass && !solved) {
        solved = true;
        onComplete(challenge.id);
      }
      doneBtn.disabled = false;
      doneBtn.textContent = solved ? "✓ Solved · Check Again" : "Check My Code";
    }, 30);
  });

  updateHintButton();
  container.appendChild(card);
}

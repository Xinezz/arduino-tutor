// Renders a challenge card with the 4-tier hint system:
// Hint 1 (concept) -> Hint 2 (which function/concept to use) -> Hint 3 (small example) -> Solution.
// Each tier only appears after the learner explicitly asks for it, and they're revealed
// one at a time (you can't skip straight to hint 3 without seeing 1 and 2 first) -
// the point is to make you think before you see the answer.

const DIFFICULTY_LABELS = {
  easy: { text: "🟢 Easy", cls: "difficulty-easy" },
  medium: { text: "🟡 Medium", cls: "difficulty-medium" },
  hard: { text: "🔴 Hard", cls: "difficulty-hard" },
  boss: { text: "💀 Boss Challenge", cls: "difficulty-boss" },
};

export function renderChallenge(container, challenge, onComplete) {
  container.innerHTML = "";
  if (!challenge) return;

  let hintsRevealed = 0;
  let solutionRevealed = false;

  const card = document.createElement("div");
  card.className = "challenge-card";

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
  doneBtn.textContent = "Mark as Solved";

  controls.appendChild(hintBtn);
  controls.appendChild(solutionBtn);
  controls.appendChild(doneBtn);
  card.appendChild(controls);

  const revealArea = document.createElement("div");
  card.appendChild(revealArea);

  function updateHintButton() {
    if (hintsRevealed >= challenge.hints.length) {
      hintBtn.textContent = "No More Hints";
      hintBtn.disabled = true;
    } else {
      hintBtn.textContent = `Show Hint ${hintsRevealed + 1} of ${challenge.hints.length}`;
    }
  }

  hintBtn.addEventListener("click", () => {
    const hintText = challenge.hints[hintsRevealed];
    hintsRevealed += 1;

    const box = document.createElement("div");
    box.className = "hint-box";
    box.textContent = `Hint ${hintsRevealed}: ${hintText}`;
    revealArea.appendChild(box);

    updateHintButton();
  });

  solutionBtn.textContent = "Show Solution";
  solutionBtn.addEventListener("click", () => {
    if (solutionRevealed) return;
    solutionRevealed = true;

    const box = document.createElement("div");
    box.className = "solution-box";

    const codeEl = document.createElement("pre");
    codeEl.className = "code-block";
    codeEl.textContent = challenge.solution;
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

  doneBtn.addEventListener("click", () => {
    onComplete(challenge.id);
    doneBtn.textContent = "✓ Solved";
    doneBtn.disabled = true;
  });

  updateHintButton();
  container.appendChild(card);
}

// Renders the five quiz game types and handles their interaction.
// onResult(quizId, success, topic) is called once per attempt so app.js can
// record it in progress (for the dashboard's weak-topics list).

function shuffledDistinctFrom(original) {
  const arr = [...original];
  // Fisher-Yates shuffle - the standard unbiased way to shuffle an array.
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const isSameOrder = arr.every((v, i) => v === original[i]);
  return isSameOrder ? shuffledDistinctFrom(original) : arr;
}

// Every quiz card starts with the same badge + title + prompt - shared here
// so the five render functions below only need to build the part that's
// actually different about their game.
function renderQuizHeader(card, quiz, emoji) {
  const titleRow = document.createElement("div");
  titleRow.className = "quiz-title-row";
  const badge = document.createElement("span");
  badge.className = "quiz-badge";
  badge.textContent = `${emoji} ${quiz.topic}`;
  const title = document.createElement("strong");
  title.textContent = quiz.title;
  titleRow.appendChild(badge);
  titleRow.appendChild(title);
  card.appendChild(titleRow);

  const prompt = document.createElement("p");
  prompt.className = "quiz-prompt";
  prompt.textContent = quiz.prompt;
  card.appendChild(prompt);
}

export function renderQuiz(container, quiz, onResult) {
  container.innerHTML = "";
  if (!quiz) return;
  if (quiz.type === "order") renderOrderQuiz(container, quiz, onResult);
  else if (quiz.type === "predict") renderPredictQuiz(container, quiz, onResult);
  else if (quiz.type === "debug") renderDebugQuiz(container, quiz, onResult);
  else if (quiz.type === "fill") renderFillBlankQuiz(container, quiz, onResult);
  else if (quiz.type === "match") renderMatchQuiz(container, quiz, onResult);
}

// ---------- "order" type: drag scrambled code lines into the right sequence ----------

function renderOrderQuiz(container, quiz, onResult) {
  let currentOrder = shuffledDistinctFrom(quiz.lines);
  let hasChecked = false;
  let showedAnswer = false;

  function checkOrder() {
    const isCorrect = currentOrder.every((line, i) => line === quiz.lines[i]);
    hasChecked = true;
    render();
    onResult(quiz.id, isCorrect, quiz.topic);
  }

  function shuffleAgain() {
    currentOrder = shuffledDistinctFrom(quiz.lines);
    hasChecked = false;
    render();
  }

  function moveItem(fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= currentOrder.length) return;
    const [item] = currentOrder.splice(fromIndex, 1);
    currentOrder.splice(toIndex, 0, item);
    hasChecked = false;
    render();
  }

  function startDrag(index, startEvent) {
    startEvent.preventDefault();
    let dragIndex = index;

    function onMove(e) {
      const items = Array.from(container.querySelectorAll(".quiz-line-item"));
      const overIndex = items.findIndex((el) => {
        const r = el.getBoundingClientRect();
        return e.clientY >= r.top && e.clientY <= r.bottom;
      });
      if (overIndex !== -1 && overIndex !== dragIndex) {
        const [item] = currentOrder.splice(dragIndex, 1);
        currentOrder.splice(overIndex, 0, item);
        dragIndex = overIndex;
        hasChecked = false;
        render(dragIndex);
      }
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function render(draggingIndex) {
    container.innerHTML = "";
    const card = document.createElement("div");
    card.className = "quiz-card";
    renderQuizHeader(card, quiz, "🧩");

    const list = document.createElement("ul");
    list.className = "quiz-order-list";
    currentOrder.forEach((line, i) => {
      const li = document.createElement("li");
      li.className = "quiz-line-item";
      if (i === draggingIndex) li.classList.add("dragging");
      if (hasChecked) li.classList.add(line === quiz.lines[i] ? "correct" : "incorrect");

      const handle = document.createElement("span");
      handle.className = "quiz-drag-handle";
      handle.textContent = "⠿";
      handle.title = "Drag to reorder";
      handle.addEventListener("mousedown", (e) => startDrag(i, e));
      li.appendChild(handle);

      const text = document.createElement("span");
      text.className = "quiz-line-text";
      text.textContent = line;
      li.appendChild(text);

      const moveBtns = document.createElement("div");
      moveBtns.className = "quiz-move-buttons";
      const up = document.createElement("button");
      up.className = "quiz-move-btn";
      up.textContent = "▲";
      up.title = "Move up";
      up.disabled = i === 0;
      up.addEventListener("click", () => moveItem(i, i - 1));
      const down = document.createElement("button");
      down.className = "quiz-move-btn";
      down.textContent = "▼";
      down.title = "Move down";
      down.disabled = i === currentOrder.length - 1;
      down.addEventListener("click", () => moveItem(i, i + 1));
      moveBtns.appendChild(up);
      moveBtns.appendChild(down);
      li.appendChild(moveBtns);

      list.appendChild(li);
    });
    card.appendChild(list);

    const controls = document.createElement("div");
    controls.className = "quiz-controls";
    const checkBtn = document.createElement("button");
    checkBtn.className = "btn btn-complete";
    checkBtn.textContent = "Check Order";
    checkBtn.addEventListener("click", checkOrder);
    const shuffleBtn = document.createElement("button");
    shuffleBtn.className = "btn btn-secondary";
    shuffleBtn.textContent = "Shuffle Again";
    shuffleBtn.addEventListener("click", shuffleAgain);
    const answerBtn = document.createElement("button");
    answerBtn.className = "btn btn-hint";
    answerBtn.textContent = showedAnswer ? "Answer Shown Below" : "Show Answer";
    answerBtn.disabled = showedAnswer;
    answerBtn.addEventListener("click", () => { showedAnswer = true; render(); });
    controls.appendChild(checkBtn);
    controls.appendChild(shuffleBtn);
    controls.appendChild(answerBtn);
    card.appendChild(controls);

    if (hasChecked) {
      const allCorrect = currentOrder.every((line, i) => line === quiz.lines[i]);
      const result = document.createElement("div");
      result.className = "quiz-result " + (allCorrect ? "success" : "failure");
      result.textContent = allCorrect
        ? "Correct! That's a working program, in the right order."
        : "Not quite - lines marked red are out of place. Keep adjusting and check again.";
      card.appendChild(result);
    }

    if (showedAnswer) {
      const box = document.createElement("div");
      box.className = "solution-box";
      const codeEl = document.createElement("pre");
      codeEl.className = "code-block";
      codeEl.textContent = quiz.lines.join("\n");
      box.appendChild(codeEl);
      card.appendChild(box);
    }

    container.appendChild(card);
  }

  render();
}

// ---------- "predict" type: multiple-choice code comprehension ----------

function renderPredictQuiz(container, quiz, onResult) {
  let answered = false;
  let selectedIndex = null;

  function selectOption(index) {
    if (answered) return;
    answered = true;
    selectedIndex = index;
    const success = index === quiz.correctIndex;
    render();
    onResult(quiz.id, success, quiz.topic);
  }

  function render() {
    container.innerHTML = "";
    const card = document.createElement("div");
    card.className = "quiz-card";
    renderQuizHeader(card, quiz, "❓");

    const codeBlock = document.createElement("pre");
    codeBlock.className = "code-block";
    codeBlock.textContent = quiz.code;
    card.appendChild(codeBlock);

    const optionsWrap = document.createElement("div");
    optionsWrap.className = "quiz-options";
    quiz.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "quiz-option";
      btn.textContent = opt;
      btn.disabled = answered;
      if (answered) {
        if (i === quiz.correctIndex) btn.classList.add("correct");
        else if (i === selectedIndex) btn.classList.add("incorrect");
      }
      btn.addEventListener("click", () => selectOption(i));
      optionsWrap.appendChild(btn);
    });
    card.appendChild(optionsWrap);

    if (answered) {
      const isCorrect = selectedIndex === quiz.correctIndex;
      const result = document.createElement("div");
      result.className = "quiz-result " + (isCorrect ? "success" : "failure");
      result.textContent = (isCorrect ? "Correct! " : "Not quite. ") + quiz.explanation;
      card.appendChild(result);
    }

    container.appendChild(card);
  }

  render();
}

// ---------- "debug" type: click the one buggy line in a code listing ----------
// The point isn't writing correct code from scratch - it's recognizing what
// a specific kind of mistake LOOKS like, since that's the skill that actually
// speeds up real debugging.

function renderDebugQuiz(container, quiz, onResult) {
  let answered = false;
  let selectedIndex = null;

  function selectLine(index) {
    if (answered) return;
    answered = true;
    selectedIndex = index;
    const success = index === quiz.buggyLineIndex;
    render();
    onResult(quiz.id, success, quiz.topic);
  }

  function render() {
    container.innerHTML = "";
    const card = document.createElement("div");
    card.className = "quiz-card";
    renderQuizHeader(card, quiz, "🐛");

    const list = document.createElement("ul");
    list.className = "quiz-order-list";
    quiz.lines.forEach((line, i) => {
      const li = document.createElement("li");
      li.className = "quiz-line-item debug-line";
      if (!answered) li.classList.add("clickable");
      if (answered) {
        if (i === quiz.buggyLineIndex) li.classList.add("correct");
        else if (i === selectedIndex) li.classList.add("incorrect");
      }

      const number = document.createElement("span");
      number.className = "quiz-line-number";
      number.textContent = String(i + 1);
      li.appendChild(number);

      const text = document.createElement("span");
      text.className = "quiz-line-text";
      text.textContent = line;
      li.appendChild(text);

      if (!answered) li.addEventListener("click", () => selectLine(i));
      list.appendChild(li);
    });
    card.appendChild(list);

    if (answered) {
      const isCorrect = selectedIndex === quiz.buggyLineIndex;
      const result = document.createElement("div");
      result.className = "quiz-result " + (isCorrect ? "success" : "failure");
      result.textContent = (isCorrect ? "Correct! " : "Not quite - the green line is the culprit. ") + quiz.explanation;
      card.appendChild(result);

      const box = document.createElement("div");
      box.className = "solution-box";
      const label = document.createElement("div");
      label.className = "editor-label";
      label.textContent = "Fixed line";
      const codeEl = document.createElement("pre");
      codeEl.className = "code-block";
      codeEl.textContent = quiz.fixedLine;
      box.appendChild(label);
      box.appendChild(codeEl);
      card.appendChild(box);
    }

    container.appendChild(card);
  }

  render();
}

// ---------- "fill" type: complete a known-correct snippet from a word bank ----------
// Multiple-choice rather than free typing on purpose - the point is
// recognizing the right piece, not getting tripped up by a typo the
// interpreter would reject anyway.

function renderFillBlankQuiz(container, quiz, onResult) {
  let answered = false;
  let selectedChoice = null;

  function selectChoice(choice) {
    if (answered) return;
    answered = true;
    selectedChoice = choice;
    const success = choice === quiz.correctChoice;
    render();
    onResult(quiz.id, success, quiz.topic);
  }

  function render() {
    container.innerHTML = "";
    const card = document.createElement("div");
    card.className = "quiz-card";
    renderQuizHeader(card, quiz, "✏️");

    const codeBlock = document.createElement("pre");
    codeBlock.className = "code-block";
    codeBlock.appendChild(document.createTextNode(quiz.codeBefore));
    const blank = document.createElement("span");
    blank.className = "quiz-blank";
    blank.textContent = answered ? selectedChoice : "?????";
    if (answered) blank.classList.add(selectedChoice === quiz.correctChoice ? "correct" : "incorrect");
    codeBlock.appendChild(blank);
    codeBlock.appendChild(document.createTextNode(quiz.codeAfter));
    card.appendChild(codeBlock);

    const optionsWrap = document.createElement("div");
    optionsWrap.className = "quiz-options quiz-options-inline";
    quiz.choices.forEach((choice) => {
      const btn = document.createElement("button");
      btn.className = "quiz-option";
      btn.textContent = choice;
      btn.disabled = answered;
      if (answered) {
        if (choice === quiz.correctChoice) btn.classList.add("correct");
        else if (choice === selectedChoice) btn.classList.add("incorrect");
      }
      btn.addEventListener("click", () => selectChoice(choice));
      optionsWrap.appendChild(btn);
    });
    card.appendChild(optionsWrap);

    if (answered) {
      const isCorrect = selectedChoice === quiz.correctChoice;
      const result = document.createElement("div");
      result.className = "quiz-result " + (isCorrect ? "success" : "failure");
      result.textContent = (isCorrect ? "Correct! " : "Not quite. ") + quiz.explanation;
      card.appendChild(result);
    }

    container.appendChild(card);
  }

  render();
}

// ---------- "match" type: pair terms with their meanings ----------
// A wrong pair just flashes and un-selects instead of ending the attempt -
// mismatched guesses are how you learn which ones you're actually mixing up,
// so punishing them by ending the game early would defeat the point.

function renderMatchQuiz(container, quiz, onResult) {
  const rightOrder = shuffledDistinctFrom(quiz.pairs.map((p) => p.right));
  const matchedLefts = new Set();
  const matchedRights = new Set();
  let selectedLeft = null;
  let hadMistake = false;
  let flashPair = null; // { left, right } briefly shown red after a wrong guess

  function pickLeft(left) {
    if (matchedLefts.has(left) || flashPair) return;
    selectedLeft = selectedLeft === left ? null : left;
    render();
  }

  function pickRight(right) {
    if (matchedRights.has(right) || flashPair || selectedLeft === null) return;
    const correctRight = quiz.pairs.find((p) => p.left === selectedLeft).right;
    if (right === correctRight) {
      matchedLefts.add(selectedLeft);
      matchedRights.add(right);
      selectedLeft = null;
      render();
      if (matchedLefts.size === quiz.pairs.length) {
        onResult(quiz.id, !hadMistake, quiz.topic);
      }
    } else {
      hadMistake = true;
      flashPair = { left: selectedLeft, right };
      render();
      setTimeout(() => {
        flashPair = null;
        selectedLeft = null;
        render();
      }, 700);
    }
  }

  function render() {
    container.innerHTML = "";
    const card = document.createElement("div");
    card.className = "quiz-card";
    renderQuizHeader(card, quiz, "🔗");

    const board = document.createElement("div");
    board.className = "quiz-match-board";

    const leftCol = document.createElement("div");
    leftCol.className = "quiz-match-col";
    quiz.pairs.forEach((pair) => {
      const btn = document.createElement("button");
      btn.className = "quiz-match-item";
      btn.textContent = pair.left;
      if (matchedLefts.has(pair.left)) btn.classList.add("matched");
      if (selectedLeft === pair.left) btn.classList.add("selected");
      if (flashPair && flashPair.left === pair.left) btn.classList.add("incorrect");
      btn.disabled = matchedLefts.has(pair.left);
      btn.addEventListener("click", () => pickLeft(pair.left));
      leftCol.appendChild(btn);
    });

    const rightCol = document.createElement("div");
    rightCol.className = "quiz-match-col";
    rightOrder.forEach((right) => {
      const btn = document.createElement("button");
      btn.className = "quiz-match-item";
      btn.textContent = right;
      if (matchedRights.has(right)) btn.classList.add("matched");
      if (flashPair && flashPair.right === right) btn.classList.add("incorrect");
      btn.disabled = matchedRights.has(right);
      btn.addEventListener("click", () => pickRight(right));
      rightCol.appendChild(btn);
    });

    board.appendChild(leftCol);
    board.appendChild(rightCol);
    card.appendChild(board);

    if (matchedLefts.size === quiz.pairs.length) {
      const result = document.createElement("div");
      result.className = "quiz-result " + (hadMistake ? "failure" : "success");
      result.textContent = hadMistake
        ? "All matched, with a few wrong guesses along the way - review the ones that tripped you up."
        : "Perfect - every pair matched with no wrong guesses.";
      card.appendChild(result);
    }

    container.appendChild(card);
  }

  render();
}

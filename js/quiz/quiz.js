// Renders the two quiz game types and handles their interaction.
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

export function renderQuiz(container, quiz, onResult) {
  container.innerHTML = "";
  if (!quiz) return;
  if (quiz.type === "order") renderOrderQuiz(container, quiz, onResult);
  else if (quiz.type === "predict") renderPredictQuiz(container, quiz, onResult);
}

// ---------- "order" type: drag scrambled code lines into the right sequence ----------

function renderOrderQuiz(container, quiz, onResult) {
  let currentOrder = shuffledDistinctFrom(quiz.lines);
  let hasChecked = false;

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

    const titleRow = document.createElement("div");
    titleRow.className = "quiz-title-row";
    const badge = document.createElement("span");
    badge.className = "quiz-badge";
    badge.textContent = "🧩 " + quiz.topic;
    const title = document.createElement("strong");
    title.textContent = quiz.title;
    titleRow.appendChild(badge);
    titleRow.appendChild(title);
    card.appendChild(titleRow);

    const prompt = document.createElement("p");
    prompt.className = "quiz-prompt";
    prompt.textContent = quiz.prompt;
    card.appendChild(prompt);

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
    controls.appendChild(checkBtn);
    controls.appendChild(shuffleBtn);
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

    const titleRow = document.createElement("div");
    titleRow.className = "quiz-title-row";
    const badge = document.createElement("span");
    badge.className = "quiz-badge";
    badge.textContent = "❓ " + quiz.topic;
    const title = document.createElement("strong");
    title.textContent = quiz.title;
    titleRow.appendChild(badge);
    titleRow.appendChild(title);
    card.appendChild(titleRow);

    const prompt = document.createElement("p");
    prompt.className = "quiz-prompt";
    prompt.textContent = quiz.prompt;
    card.appendChild(prompt);

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

// One modal at a time, with a queue behind it. Level-up screens, the chest,
// settings and confirmations all go through here so they can never pile on
// top of each other - if a lesson completion triggers a promotion AND a
// milestone chest, they simply play one after the other.
//
// openModal({ title, content, actions, dismissable, className }) returns a
// handle { close(result), closed } where `closed` resolves with whatever the
// closing button/Esc/backdrop produced.

let root = null;
let current = null;
const queue = [];

function getRoot() {
  if (!root || !root.isConnected) {
    root = document.getElementById("modal-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "modal-root";
      document.body.appendChild(root);
    }
  }
  return root;
}

export function openModal(opts) {
  let resolveClosed;
  const closed = new Promise((r) => { resolveClosed = r; });
  const handle = { opts, closed, el: null, resolve: resolveClosed, close: (v) => closeHandle(handle, v) };
  if (current) queue.push(handle);
  else show(handle);
  return handle;
}

export function modalOpen() {
  return current !== null;
}

function show(handle) {
  const { title, content, actions = [], dismissable = true, className = "" } = handle.opts;
  current = handle;
  handle.prevFocus = document.activeElement;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  const box = document.createElement("div");
  box.className = `modal hud-frame ${className}`;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  if (title) box.setAttribute("aria-label", title);

  if (title) {
    const h = document.createElement("div");
    h.className = "modal-title";
    h.textContent = title;
    box.appendChild(h);
  }
  const body = document.createElement("div");
  body.className = "modal-body";
  if (typeof content === "string") body.innerHTML = content;
  else if (content) body.appendChild(content);
  box.appendChild(body);

  if (actions.length) {
    const foot = document.createElement("div");
    foot.className = "modal-actions";
    for (const a of actions) {
      const b = document.createElement("button");
      b.className = `btn ${a.kind ? `btn-${a.kind}` : "btn-primary"}`;
      b.textContent = a.label;
      b.addEventListener("click", () => {
        const result = a.onClick?.();
        if (a.closes !== false && result !== false) handle.close(a.value ?? a.label);
      });
      foot.appendChild(b);
    }
    box.appendChild(foot);
  }

  backdrop.appendChild(box);
  if (dismissable) {
    backdrop.addEventListener("mousedown", (e) => {
      if (e.target === backdrop) handle.close(null);
    });
  }
  handle.el = backdrop;
  handle.onKey = (e) => {
    if (e.key === "Escape" && dismissable) {
      e.preventDefault();
      handle.close(null);
    }
  };
  document.addEventListener("keydown", handle.onKey);
  getRoot().appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add("open"));
  setTimeout(() => backdrop.classList.add("open"), 40);
  box.querySelector("button")?.focus?.({ preventScroll: true });
  handle.opts.onOpen?.(box, handle);
}

function closeHandle(handle, result) {
  const idx = queue.indexOf(handle);
  if (idx !== -1) {
    queue.splice(idx, 1);
    handle.resolve(result);
    return;
  }
  if (current !== handle || !handle.el) return;
  const el = handle.el;
  document.removeEventListener("keydown", handle.onKey);
  el.classList.remove("open");
  el.classList.add("closing");
  current = null;
  setTimeout(() => el.remove(), 220);
  try { handle.prevFocus?.focus?.({ preventScroll: true }); } catch { /* element gone */ }
  handle.opts.onClose?.(result);
  handle.resolve(result);
  const next = queue.shift();
  if (next) setTimeout(() => show(next), 160);
}

// A yes/no question. Resolves true only if the confirm button was pressed;
// Esc, a click outside, or Cancel all resolve false.
export function confirmDialog({ title, body, confirmLabel = "Yes", cancelLabel = "Cancel", danger = false }) {
  return new Promise((resolve) => {
    const p = document.createElement("p");
    p.textContent = body;
    openModal({
      title,
      content: p,
      actions: [
        { label: cancelLabel, kind: "secondary", value: false },
        { label: confirmLabel, kind: danger ? "danger" : "complete", value: true },
      ],
      onClose: (result) => resolve(result === true),
    });
  });
}

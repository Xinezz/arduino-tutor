// Small stacked notifications - "ACHIEVEMENT UNLOCKED", mission complete,
// purchase confirmations. Non-blocking: they slide in, sit for a few seconds,
// and slide out, and clicking one dismisses it early. Titles/text are always
// set via textContent (the icon markup comes only from our own sprite
// renderer), so nothing user-supplied can inject markup.

const MAX_VISIBLE = 4;

let root = null;
function getRoot() {
  if (!root || !root.isConnected) {
    root = document.getElementById("toast-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "toast-root";
      document.body.appendChild(root);
    }
  }
  return root;
}

export function showToast({ iconHtml = "", title = "", text = "", kind = "info", duration = 4500 } = {}) {
  const host = getRoot();
  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  el.setAttribute("role", "status");

  const ico = document.createElement("div");
  ico.className = "toast-icon";
  ico.innerHTML = iconHtml;
  const body = document.createElement("div");
  body.className = "toast-body";
  const t = document.createElement("div");
  t.className = "toast-title";
  t.textContent = title;
  const d = document.createElement("div");
  d.className = "toast-text";
  d.textContent = text;
  body.append(t, d);
  el.append(ico, body);
  host.appendChild(el);

  // Keep the stack from growing without bound if a lot unlock at once.
  while (host.children.length > MAX_VISIBLE) host.firstElementChild.remove();

  let gone = false;
  const dismiss = () => {
    if (gone) return;
    gone = true;
    el.classList.remove("show");
    el.classList.add("hide");
    setTimeout(() => el.remove(), 380);
  };
  el.addEventListener("click", dismiss);
  setTimeout(() => el.classList.add("show"), 20);
  setTimeout(dismiss, duration);
  return { dismiss };
}

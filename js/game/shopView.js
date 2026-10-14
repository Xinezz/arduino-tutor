// The Parts Shop screen: Volt behind the counter, a row of avatars, a row of
// themes. Pure rendering - buying/equipping/previewing are reported through
// callbacks and app.js re-renders this screen with the new state, so the shop
// never has to track what you own.

import { icon } from "./sprites.js";
import { THEMES, AVATARS, itemKey, getTheme } from "./shop.js";
import { renderShopkeeperBox, getShopGreeting } from "../npc/mentor.js";

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function priceTag(price) {
  const t = el("span", "shop-price");
  t.innerHTML = price > 0 ? `${icon("coin", 2)}<span>${price}</span>` : "<span>FREE</span>";
  return t;
}

function themeMock(theme) {
  const [bg, panel, accent, green, yellow] = theme.swatch;
  const mock = el("div", "theme-mock");
  mock.style.setProperty("--m-bg", bg);
  mock.style.setProperty("--m-panel", panel);
  mock.style.setProperty("--m-accent", accent);
  mock.style.setProperty("--m-green", green);
  mock.style.setProperty("--m-yellow", yellow);
  mock.innerHTML = `
    <div class="mock-bar"><i></i><i></i><i></i></div>
    <div class="mock-body">
      <div class="mock-side"><b></b><b></b><b></b></div>
      <div class="mock-main"><u></u><u class="short"></u><span class="mock-btn"></span></div>
    </div>`;
  return mock;
}

// handlers: { onBuy(slot, id, price), onEquip(slot, id), onTry(themeId), onStopTry() }
// state:    { line, previewing }
export function renderShop(container, progress, handlers, { line = null, previewing = null } = {}) {
  container.innerHTML = "";
  const owned = new Set(progress.inventory);
  const equipped = progress.equipped || {};

  const clerk = el("div", "mentor-box hud-frame shop-clerk");
  container.appendChild(clerk);
  renderShopkeeperBox(clerk, { text: line ?? getShopGreeting(), tag: "Parts Shop", mood: "happy" });

  const head = el("div", "shop-head");
  head.appendChild(el("h1", null, "Parts Shop"));
  const wallet = el("div", `shop-wallet${progress.credits < 0 ? " is-debt" : ""}`);
  wallet.innerHTML = `${icon("coin", 3)}<span class="shop-wallet-num"></span><span class="shop-wallet-label">YOUR CREDITS</span>`;
  wallet.querySelector(".shop-wallet-num").textContent = String(progress.credits);
  head.appendChild(wallet);
  container.appendChild(head);

  if (previewing) {
    const theme = getTheme(previewing);
    const isOwned = owned.has(itemKey("theme", theme.id));
    const bar = el("div", "shop-preview-bar");
    bar.appendChild(el("span", "shop-preview-text", `Previewing: ${theme.name}`));
    const actions = el("div", "shop-preview-actions");
    const main = el("button", `btn ${isOwned ? "btn-primary" : "btn-complete"}`, isOwned ? "Equip It" : `Buy for ${theme.price}`);
    main.type = "button";
    main.dataset.sfx = "none";
    main.addEventListener("click", () => {
      if (isOwned) handlers.onEquip("theme", theme.id);
      else handlers.onBuy("theme", theme.id, theme.price);
    });
    const stop = el("button", "btn btn-secondary", "Stop Preview");
    stop.type = "button";
    stop.addEventListener("click", () => handlers.onStopTry());
    actions.append(main, stop);
    bar.appendChild(actions);
    container.appendChild(bar);
  }

  // ---------------------------------------------------------------- avatars
  container.appendChild(el("div", "dashboard-section-title", "Avatars"));
  const avatarGrid = el("div", "shop-grid");
  for (const a of AVATARS) {
    const key = itemKey("avatar", a.id);
    const isOwned = owned.has(key);
    const isEquipped = equipped.avatar === a.id;
    const card = el("article", `shop-card${isOwned ? " is-owned" : ""}${isEquipped ? " is-equipped" : ""}`);

    const art = el("div", "shop-art");
    art.innerHTML = icon(`avatar_${a.id}`, 7);
    card.appendChild(art);
    card.appendChild(el("h3", "shop-name", a.name));
    card.appendChild(el("p", "shop-blurb", a.blurb));

    const foot = el("div", "shop-foot");
    if (!isOwned) foot.appendChild(priceTag(a.price));
    foot.appendChild(actionButton({ isOwned, isEquipped, price: a.price, credits: progress.credits, handlers, slot: "avatar", id: a.id }));
    card.appendChild(foot);
    avatarGrid.appendChild(card);
  }
  container.appendChild(avatarGrid);

  // ----------------------------------------------------------------- themes
  container.appendChild(el("div", "dashboard-section-title", "Themes"));
  const themeGrid = el("div", "shop-grid");
  for (const t of THEMES) {
    const key = itemKey("theme", t.id);
    const isOwned = owned.has(key);
    const isEquipped = (equipped.theme ?? "default") === t.id;
    const card = el("article", `shop-card shop-card-theme${isOwned ? " is-owned" : ""}${isEquipped ? " is-equipped" : ""}${previewing === t.id ? " is-previewing" : ""}`);

    const art = el("div", "shop-art");
    art.appendChild(themeMock(t));
    card.appendChild(art);
    card.appendChild(el("h3", "shop-name", t.name));
    card.appendChild(el("p", "shop-blurb", t.blurb));

    const foot = el("div", "shop-foot");
    if (!isOwned) foot.appendChild(priceTag(t.price));
    if (!isOwned && previewing !== t.id) {
      const tryBtn = el("button", "btn btn-secondary shop-try", "Try");
      tryBtn.type = "button";
      tryBtn.addEventListener("click", () => handlers.onTry(t.id));
      foot.appendChild(tryBtn);
    }
    foot.appendChild(actionButton({ isOwned, isEquipped, price: t.price, credits: progress.credits, handlers, slot: "theme", id: t.id }));
    card.appendChild(foot);
    themeGrid.appendChild(card);
  }
  container.appendChild(themeGrid);
}

function actionButton({ isOwned, isEquipped, price, credits, handlers, slot, id }) {
  const btn = el("button", "btn shop-action");
  btn.type = "button";
  if (isEquipped) {
    btn.textContent = "Equipped";
    btn.classList.add("btn-secondary");
    btn.disabled = true;
  } else if (isOwned) {
    btn.textContent = "Equip";
    btn.classList.add("btn-primary");
    btn.addEventListener("click", () => handlers.onEquip(slot, id));
  } else {
    btn.textContent = "Buy";
    btn.classList.add(credits >= price ? "btn-complete" : "btn-hint");
    btn.dataset.sfx = "none";
    btn.addEventListener("click", () => handlers.onBuy(slot, id, price));
  }
  return btn;
}

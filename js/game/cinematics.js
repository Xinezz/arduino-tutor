// The big moments: leveling up, opening a treasure chest, getting promoted,
// unlocking a trophy. Each one is a short, self-contained little scene built
// from the lower-level pieces (sound, effects, modal, toast) - the reward flow
// decides WHEN to play them, this file decides what they look like.

import { icon, composedSvg } from "./sprites.js";
import { SAM_MOODS } from "./bigSprites.js";
import { playSfx, duckMusic } from "./audio.js";
import { openModal } from "./modal.js";
import { showToast } from "./toast.js";
import { banner, confetti, screenFlash, coinShower, tweenNumber } from "./fx.js";
import { getSettings } from "./settings.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- level up
export function levelUpFanfare({ level, isMilestone }) {
  duckMusic(2600);
  playSfx("levelUp");
  banner("LEVEL UP!", { kind: "level", sub: `YOU ARE NOW LEVEL ${level}`, duration: 2100 });
  screenFlash("rgba(255,255,255,0.32)", 340);
  confetti({ count: isMilestone ? 130 : 70 });
}

// ------------------------------------------------------------ treasure chest
// Resolves once the player has collected the chest. The credits themselves are
// already in the save by the time this opens (progress.js pays them the moment
// they're earned); this is the ceremony for revealing them.
export function openChest({ title = "TREASURE CHEST", subtitle = "", reward = 0, buttonLabel = "OPEN IT!" } = {}) {
  return new Promise((resolve) => {
    const scene = document.createElement("div");
    scene.className = "chest-scene";
    scene.innerHTML = `
      <div class="chest-stage">
        <div class="chest-rays" aria-hidden="true"></div>
        <div class="chest-art">${icon("chest", 9)}</div>
      </div>
      <div class="chest-reward" aria-live="polite"></div>
      <p class="chest-sub"></p>
      <div class="chest-actions"></div>`;
    scene.querySelector(".chest-sub").textContent = subtitle;

    const art = scene.querySelector(".chest-art");
    const rewardEl = scene.querySelector(".chest-reward");
    const actions = scene.querySelector(".chest-actions");

    const openBtn = document.createElement("button");
    openBtn.className = "btn btn-complete chest-btn";
    openBtn.textContent = buttonLabel;
    openBtn.dataset.sfx = "none";
    actions.appendChild(openBtn);

    let handle = null;
    let opened = false;

    openBtn.addEventListener("click", async () => {
      if (opened) return;
      opened = true;
      openBtn.disabled = true;
      const fx = getSettings().fx;
      playSfx("whoosh");
      if (fx) {
        art.classList.add("is-shaking");
        await wait(650);
        art.classList.remove("is-shaking");
      }
      art.innerHTML = icon("chestOpen", 9);
      scene.classList.add("is-open");
      playSfx("chestOpen");
      coinShower(art, 16);
      rewardEl.innerHTML = `<span class="chest-reward-num">+0</span> ${icon("coin", 3)}`;
      tweenNumber(rewardEl.querySelector(".chest-reward-num"), 0, reward, { format: (n) => `+${n}`, duration: 900 });
      await wait(fx ? 950 : 0);
      actions.innerHTML = "";
      const collect = document.createElement("button");
      collect.className = "btn btn-primary chest-btn";
      collect.textContent = "COLLECT";
      collect.addEventListener("click", () => handle.close("collected"));
      actions.appendChild(collect);
      collect.focus({ preventScroll: true });
    });

    handle = openModal({
      title,
      content: scene,
      className: "modal-center modal-chest",
      dismissable: false,
      onClose: () => resolve(),
    });
  });
}

// ----------------------------------------------------------------- promotion
export function openPromotion({ rank, previousRank }) {
  return new Promise((resolve) => {
    playSfx("levelUp");
    duckMusic(3200);
    confetti({ count: 90 });
    const scene = document.createElement("div");
    scene.className = "promo-scene";
    scene.innerHTML = `
      <div class="promo-sprites">
        <span class="promo-spark promo-spark-a">${icon("sparkle", 3)}</span>
        <span class="promo-sam">${composedSvg("sam", SAM_MOODS.happy, { scale: 6 })}</span>
        <span class="promo-spark promo-spark-b">${icon("sparkle", 3)}</span>
      </div>
      <div class="promo-from"></div>
      <div class="promo-arrow">${icon("medal", 3)}</div>
      <div class="promo-rank"></div>
      <p class="promo-desc"></p>
      <p class="promo-quote"></p>`;
    scene.querySelector(".promo-from").textContent = previousRank.name;
    scene.querySelector(".promo-rank").textContent = rank.name;
    scene.querySelector(".promo-desc").textContent = rank.desc;
    scene.querySelector(".promo-quote").textContent = "“I put in the paperwork myself. You earned this.” — Sam";
    openModal({
      title: "PROMOTION!",
      content: scene,
      className: "modal-center modal-promo",
      actions: [{ label: "Onward!", kind: "complete" }],
      dismissable: false,
      onClose: () => resolve(),
    });
  });
}

// ------------------------------------------------------------- achievements
export function achievementToast(def) {
  playSfx("achievement");
  showToast({
    iconHtml: icon(def.icon, 3),
    title: "ACHIEVEMENT UNLOCKED",
    text: `${def.name}${def.reward ? ` · +${def.reward} credits` : ""}`,
    kind: "achievement",
    duration: 5200,
  });
}

export function missionToast(mission) {
  playSfx("mission");
  showToast({
    iconHtml: icon(mission.icon, 3),
    title: "MISSION COMPLETE",
    text: `${mission.name} — claim your ${mission.reward} credits in your Profile`,
    kind: "mission",
    duration: 5200,
  });
}

// The heads-up display in the top bar: your avatar, level + XP bar, coins,
// day streak, and the mute / settings buttons. This module only paints that
// strip - it never changes progress. app.js (through the reward flow) calls
// update() after anything that moves a number, and the numbers animate.

import { getLevelInfo } from "../progress/progress.js";
import { icon } from "./sprites.js";
import { avatarSpriteName } from "./shop.js";
import { tweenNumber, bump } from "./fx.js";
import { getSettings, setSetting, onSettingsChange } from "./settings.js";
import { playSfx } from "./audio.js";

export function createHud({ onOpenProfile, onOpenSettings } = {}) {
  const $ = (id) => document.getElementById(id);
  const els = {
    root: $("hud"),
    avatar: $("hud-avatar"),
    level: $("hud-level"),
    lvNum: $("hud-lv-num"),
    xpFill: $("hud-xp-fill"),
    coins: $("hud-coins"),
    coinsNum: $("hud-coins-num"),
    streak: $("hud-streak"),
    streakNum: $("hud-streak-num"),
    mute: $("hud-mute"),
    settings: $("hud-settings"),
    badge: $("profile-badge"),
  };

  // Static sprites.
  els.coins.querySelector(".hud-ico").innerHTML = icon("coin", 2);
  els.streak.querySelector(".hud-ico").innerHTML = icon("flame", 2);
  els.settings.innerHTML = icon("gear", 2);

  let shownCoins = null;
  let shownLevel = null;
  let shownAvatar = null;
  let coinHold = 0; // credits to keep hidden from the display for now (a chest about to be opened)

  function paintMute() {
    const muted = getSettings().muted;
    els.mute.innerHTML = icon(muted ? "mute" : "speaker", 2);
    els.mute.setAttribute("aria-pressed", String(muted));
    els.mute.title = muted ? "Sound is off (M)" : "Sound is on (M)";
  }
  paintMute();
  onSettingsChange((_s, key) => { if (key === "muted") paintMute(); });

  els.mute.addEventListener("click", () => {
    setSetting("muted", !getSettings().muted);
    playSfx("toggleOn"); // silent when we just muted, a little blip when we unmuted
  });
  els.settings.addEventListener("click", () => onOpenSettings?.());
  els.avatar.addEventListener("click", () => onOpenProfile?.());

  let lastProgress = null;

  function update(progress, { animate = true } = {}) {
    lastProgress = progress;
    const info = getLevelInfo(progress.xp);

    // level + xp bar
    els.lvNum.textContent = String(info.level);
    els.xpFill.style.width = `${info.pct}%`;
    els.level.title = `Level ${info.level} - ${info.xpIntoLevel} / ${info.xpForLevel} XP to level ${info.level + 1}`;
    if (animate && shownLevel !== null && info.level > shownLevel) bump(els.level);
    shownLevel = info.level;

    // coins
    const display = progress.credits - coinHold;
    if (shownCoins === null || !animate) els.coinsNum.textContent = String(display);
    else if (display !== shownCoins) {
      tweenNumber(els.coinsNum, shownCoins, display);
      bump(els.coins);
    }
    shownCoins = display;
    els.coins.classList.toggle("is-debt", display < 0);
    els.coins.title = display < 0
      ? "You're in the red - finish a lesson or challenge to earn it back."
      : "Your credits. Earn them by finishing work; spend them on hints and in the shop.";

    // streak
    const streak = progress.streak || 0;
    els.streakNum.textContent = String(streak);
    els.streak.title = `${streak} day streak`;
    els.streak.classList.toggle("is-hot", streak >= 3);

    // avatar
    const avatarId = progress.equipped?.avatar ?? "rookie";
    if (avatarId !== shownAvatar) {
      els.avatar.innerHTML = icon(avatarSpriteName(avatarId), 3);
      els.avatar.title = "Your profile";
      shownAvatar = avatarId;
    }
  }

  // Hold back part of the balance from the readout (the milestone bonus that
  // a chest is about to "reveal"), then release it to count up on its own.
  function holdCoins(amount) {
    coinHold = amount;
    if (lastProgress) update(lastProgress, { animate: false });
  }
  function releaseCoins() {
    coinHold = 0;
    if (lastProgress) update(lastProgress);
  }

  function setProfileBadge(count) {
    els.badge.hidden = count <= 0;
    els.badge.textContent = count > 9 ? "9+" : String(count);
  }

  return { els, update, holdCoins, releaseCoins, setProfileBadge };
}

// The three "game" panels on the Profile screen: the player card (avatar,
// name, rank, level), the daily-missions board with its bonus chest, and the
// trophy room. They build DOM and report clicks through callbacks - claiming
// a reward is app.js's job (it owns progress), not this file's.

import { getLevelInfo } from "../progress/progress.js";
import { getCurrentRank } from "../progress/ranks.js";
import { icon } from "./sprites.js";
import { avatarSpriteName } from "./shop.js";
import { getDailyBoard } from "./missions.js";
import { ACHIEVEMENTS, buildContext, achievementProgress } from "./achievements.js";
import { animateCount } from "../utils/animateCount.js";

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// ----------------------------------------------------------- player card

export function buildPlayerCard(progress, { onChangeAvatar, animate = true } = {}) {
  const card = el("div", "player-card hud-frame");

  const avatarWrap = el("div", "player-avatar");
  avatarWrap.innerHTML = icon(avatarSpriteName(progress.equipped?.avatar), 8);
  card.appendChild(avatarWrap);

  const info = el("div", "player-info");
  info.appendChild(el("div", "player-name", progress.playerName || "Player 1"));
  info.appendChild(el("div", "player-rank", getCurrentRank(progress).name));

  const { level, xpIntoLevel, xpForLevel, pct } = getLevelInfo(progress.xp);
  const lvRow = el("div", "player-level-row");
  lvRow.appendChild(el("span", "player-lv", `LV ${level}`));
  const track = el("div", "player-xp-track");
  const fill = el("div", "player-xp-fill");
  track.appendChild(fill);
  lvRow.appendChild(track);
  lvRow.appendChild(el("span", "player-xp-num", `${xpIntoLevel} / ${xpForLevel} XP`));
  info.appendChild(lvRow);
  // Starts empty and fills on the next tick so the bar visibly charges up
  // (unless this is just a refresh of what's already on screen).
  if (animate) setTimeout(() => { fill.style.width = `${pct}%`; }, 40);
  else { fill.style.transition = "none"; fill.style.width = `${pct}%`; }

  const chips = el("div", "player-chips");
  const trophyCount = Object.keys(progress.achievements || {}).length;
  const chipData = [
    ["coin", `${progress.credits}`, "credits", progress.credits < 0 ? "is-debt" : ""],
    ["flame", `${progress.streak || 0}`, "day streak", ""],
    ["trophy", `${trophyCount} / ${ACHIEVEMENTS.length}`, "trophies", ""],
  ];
  for (const [sprite, value, label, cls] of chipData) {
    const chip = el("div", `player-chip ${cls}`);
    chip.innerHTML = `${icon(sprite, 2)}<span class="player-chip-val"></span><span class="player-chip-label"></span>`;
    chip.querySelector(".player-chip-val").textContent = value;
    chip.querySelector(".player-chip-label").textContent = label;
    chips.appendChild(chip);
  }
  info.appendChild(chips);

  if (onChangeAvatar) {
    const btn = el("button", "btn btn-secondary player-change", "Change Look");
    btn.addEventListener("click", onChangeAvatar);
    info.appendChild(btn);
  }
  card.appendChild(info);
  return card;
}

// -------------------------------------------------------- daily missions

function timeUntilReset() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const mins = Math.max(1, Math.round((next - now) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function buildMissionsPanel(progress, { onClaim, onClaimChest } = {}) {
  const board = getDailyBoard(progress);
  const panel = el("section", "missions-panel hud-frame");

  const head = el("div", "missions-head");
  head.appendChild(el("h2", "missions-title", "DAILY MISSIONS"));
  head.appendChild(el("span", "missions-reset", `Resets in ${timeUntilReset()}`));
  panel.appendChild(head);

  const list = el("div", "mission-list");
  for (const m of board.missions) {
    const row = el("div", `mission${m.claimed ? " is-claimed" : m.done ? " is-ready" : ""}`);
    const ico = el("div", "mission-icon");
    ico.innerHTML = icon(m.claimed ? "check" : m.icon, 3);
    row.appendChild(ico);

    const body = el("div", "mission-body");
    body.appendChild(el("div", "mission-name", m.name));
    body.appendChild(el("div", "mission-desc", m.desc));
    const bar = el("div", "mission-bar");
    const barFill = el("div", "mission-bar-fill");
    barFill.style.width = `${(m.have / m.target) * 100}%`;
    bar.appendChild(barFill);
    body.appendChild(bar);
    body.appendChild(el("div", "mission-count", `${m.have} / ${m.target}`));
    row.appendChild(body);

    const reward = el("div", "mission-reward");
    reward.innerHTML = `${icon("coin", 2)}<span>+${m.reward}</span>`;
    row.appendChild(reward);

    const btn = el("button", "btn mission-btn");
    btn.type = "button";
    if (m.claimed) {
      btn.textContent = "Claimed";
      btn.disabled = true;
      btn.classList.add("btn-secondary");
    } else if (m.done) {
      btn.textContent = "Claim!";
      btn.classList.add("btn-complete");
      btn.dataset.sfx = "none";
      btn.addEventListener("click", () => onClaim?.(m, btn));
    } else {
      btn.textContent = "In progress";
      btn.disabled = true;
      btn.classList.add("btn-secondary");
    }
    row.appendChild(btn);
    list.appendChild(row);
  }
  panel.appendChild(list);

  // the bonus chest for clearing the whole board
  const chest = el("div", `mission-chest${board.chestReady ? " is-ready" : board.chestClaimed ? " is-claimed" : ""}`);
  const chestArt = el("div", "mission-chest-art");
  chestArt.innerHTML = icon(board.chestClaimed ? "chestOpen" : "chest", 5);
  chest.appendChild(chestArt);
  const chestText = el("div", "mission-chest-text");
  chestText.appendChild(el("div", "mission-chest-title", "BONUS CHEST"));
  chestText.appendChild(el(
    "div",
    "mission-chest-desc",
    board.chestClaimed
      ? "Collected for today. Come back tomorrow for a new board!"
      : board.chestReady
        ? `All missions done! +${board.chestReward} credits inside.`
        : `Claim all three missions to unlock it — +${board.chestReward} credits inside.`
  ));
  chest.appendChild(chestText);
  const chestBtn = el("button", "btn mission-btn");
  chestBtn.type = "button";
  if (board.chestClaimed) {
    chestBtn.textContent = "Collected";
    chestBtn.disabled = true;
    chestBtn.classList.add("btn-secondary");
  } else if (board.chestReady) {
    chestBtn.textContent = "Open!";
    chestBtn.classList.add("btn-complete");
    chestBtn.dataset.sfx = "none";
    chestBtn.addEventListener("click", () => onClaimChest?.(chestArt));
  } else {
    chestBtn.textContent = "Locked";
    chestBtn.disabled = true;
    chestBtn.classList.add("btn-secondary");
  }
  chest.appendChild(chestBtn);
  panel.appendChild(chest);
  return panel;
}

// ------------------------------------------------------------ trophy room

export function buildTrophyRoom(progress, { animate = true } = {}) {
  const ctx = buildContext(progress);
  const unlocked = progress.achievements || {};
  const total = ACHIEVEMENTS.length;
  const have = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;

  const room = el("section", "trophy-room");
  const head = el("div", "trophy-head");
  head.appendChild(el("h2", "trophy-title", "TROPHY ROOM"));
  const count = el("span", "trophy-count");
  head.appendChild(count);
  if (animate) animateCount(count, have, ` / ${total}`);
  else count.textContent = `${have} / ${total}`;
  room.appendChild(head);

  const grid = el("div", "trophy-grid");
  // Earned trophies first (most recent first), then the ones still to chase.
  const sorted = [...ACHIEVEMENTS].sort((a, b) => {
    const ua = unlocked[a.id];
    const ub = unlocked[b.id];
    if (ua && ub) return ub.localeCompare(ua);
    if (ua) return -1;
    if (ub) return 1;
    return (a.secret ? 1 : 0) - (b.secret ? 1 : 0);
  });

  for (const a of sorted) {
    const got = unlocked[a.id];
    const secretHidden = a.secret && !got;
    const card = el("div", `trophy${got ? " is-unlocked" : " is-locked"}${a.secret ? " is-secret" : ""}`);

    const art = el("div", "trophy-art");
    art.innerHTML = secretHidden ? icon("lock", 3) : icon(a.icon, 3);
    card.appendChild(art);

    const body = el("div", "trophy-body");
    body.appendChild(el("div", "trophy-name", secretHidden ? "???" : a.name));
    body.appendChild(el("div", "trophy-desc", secretHidden ? (a.hint || "A secret trophy.") : a.desc));

    if (got) {
      const when = new Date(got);
      const footer = el("div", "trophy-meta");
      footer.innerHTML = `${a.reward ? `${icon("coin", 1)} +${a.reward}` : ""}`;
      footer.appendChild(el("span", "trophy-date", Number.isNaN(when.getTime()) ? "" : when.toLocaleDateString()));
      body.appendChild(footer);
    } else if (!secretHidden) {
      const prog = achievementProgress(a, ctx);
      if (prog) {
        const [cur, target] = prog;
        const bar = el("div", "trophy-bar");
        const fill = el("div", "trophy-bar-fill");
        fill.style.width = `${(cur / target) * 100}%`;
        bar.appendChild(fill);
        body.appendChild(bar);
        body.appendChild(el("div", "trophy-prog", `${cur} / ${target}`));
      }
    }
    card.appendChild(body);
    grid.appendChild(card);
  }
  room.appendChild(grid);
  return room;
}

// The World Map: the whole course drawn as an overworld. Each level is a
// "world" with its own winding path of lesson nodes - cleared nodes turn into
// green check tiles, boss lessons are skulls, a little version of YOUR avatar
// stands on the lesson you were last in. Clicking a node opens that lesson.
//
// The path is a snake: it runs left-to-right along one row, turns, runs
// right-to-left along the next, and so on. How many nodes fit on a row depends
// on the available width, so the map re-lays itself out if the window resizes.

import { lessons } from "../lessons/data.js";
import { levelTitle, levelIcon } from "../lessons/levels.js";
import { icon } from "./sprites.js";
import { avatarSpriteName } from "./shop.js";
import { renderMentorBox, getMapLine } from "../npc/mentor.js";

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

const ZONE_COLORS = ["var(--accent)", "var(--green)", "var(--yellow)", "var(--purple)", "var(--red)"];
const NODE_WIDTH = 96; // px each node (+ its gap) needs along a row

function perRowFor(width) {
  return Math.max(3, Math.min(9, Math.floor(width / NODE_WIDTH)));
}

// The width the map content can actually use: the panel minus its own padding.
function contentWidth(node) {
  const cs = getComputedStyle(node);
  return node.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
}

function chunk(list, size) {
  const rows = [];
  for (let i = 0; i < list.length; i += size) rows.push(list.slice(i, i + size));
  return rows;
}

export function renderWorldMap(container, progress, { onOpenLesson, onPoke } = {}) {
  container._mapArgs = { progress, onOpenLesson, onPoke };
  const width = contentWidth(container) || 900;
  const perRow = perRowFor(width);
  container._mapPerRow = perRow;
  container.innerHTML = "";

  const done = new Set(progress.viewedLessons);
  const solved = new Set(progress.completedChallenges);

  const mentor = el("div", "mentor-box hud-frame");
  container.appendChild(mentor);
  renderMentorBox(mentor, { text: getMapLine(progress), tag: "World Map", onPoke });

  // ---- header + overall progress ----
  const head = el("div", "map-head");
  head.appendChild(el("h1", null, "World Map"));
  const overall = el("div", "map-overall");
  const pct = lessons.length ? Math.round((done.size / lessons.length) * 100) : 0;
  overall.innerHTML = `
    <div class="map-overall-row"><span>COURSE PROGRESS</span><span>${done.size} / ${lessons.length}</span></div>
    <div class="map-overall-track"><div class="map-overall-fill" style="width:${pct}%"></div></div>`;
  head.appendChild(overall);
  const legend = el("div", "map-legend");
  legend.innerHTML = `
    <span><i class="lg lg-todo"></i>To do</span>
    <span><i class="lg lg-done"></i>Cleared</span>
    <span><i class="lg lg-boss"></i>Boss</span>
    <span>${icon("bolt", 1)}Challenge</span>`;
  head.appendChild(legend);
  container.appendChild(head);

  // ---- one zone per level ----
  const levels = [...new Set(lessons.map((l) => l.level))];
  levels.forEach((levelNum, zi) => {
    const inLevel = lessons.filter((l) => l.level === levelNum);
    const doneCount = inLevel.filter((l) => done.has(l.id)).length;
    const cleared = doneCount === inLevel.length;

    const zone = el("section", `zone${cleared ? " is-cleared" : ""}`);
    zone.style.setProperty("--zone", ZONE_COLORS[zi % ZONE_COLORS.length]);

    const zhead = el("header", "zone-head");
    const zico = el("div", "zone-icon");
    zico.innerHTML = icon(levelIcon(levelNum), 3);
    zhead.appendChild(zico);
    const ztext = el("div", "zone-text");
    ztext.appendChild(el("div", "zone-world", `WORLD ${levelNum}`));
    ztext.appendChild(el("div", "zone-name", levelTitle(levelNum)));
    zhead.appendChild(ztext);
    const zprog = el("div", "zone-progress");
    zprog.innerHTML = cleared
      ? `${icon("flag", 2)}<span>CLEARED</span>`
      : `<span>${doneCount} / ${inLevel.length}</span>`;
    zhead.appendChild(zprog);
    zone.appendChild(zhead);

    const path = el("div", "zone-path");
    path.style.setProperty("--per-row", String(perRow));
    chunk(inLevel, perRow).forEach((rowLessons, ri, allRows) => {
      const row = el("div", `path-row${ri % 2 ? " is-reversed" : ""}${ri < allRows.length - 1 ? " has-turn" : ""}`);
      rowLessons.forEach((lesson) => {
        const idx = lessons.indexOf(lesson);
        const isDone = done.has(lesson.id);
        const isBoss = lesson.challenge?.difficulty === "boss";
        const isCurrent = lesson.id === progress.lastLessonId;

        const wrap = el("div", "map-node-wrap");
        const btn = el(
          "button",
          `map-node${isDone ? " is-done" : ""}${isBoss ? " is-boss" : ""}${isCurrent ? " is-current" : ""}`
        );
        btn.type = "button";
        btn.dataset.lessonId = lesson.id;
        btn.dataset.sfx = "select";
        btn.title = `${lesson.title}${isDone ? " (cleared)" : ""}`;
        btn.setAttribute("aria-label", `${lesson.title}${isDone ? ", cleared" : ""}${isBoss ? ", boss challenge" : ""}`);

        const face = el("span", "map-node-face");
        if (isBoss) face.innerHTML = icon("skull", 3);
        else if (isDone) face.innerHTML = icon("check", 3);
        else face.textContent = String(idx + 1);
        btn.appendChild(face);

        if (lesson.challenge) {
          const pip = el("span", `map-node-pip${solved.has(lesson.challenge.id) ? " is-solved" : ""}`);
          pip.innerHTML = icon("bolt", 1);
          pip.title = solved.has(lesson.challenge.id) ? "Challenge solved" : "Has a challenge";
          btn.appendChild(pip);
        }
        btn.addEventListener("click", () => onOpenLesson?.(lesson.id));
        wrap.appendChild(btn);

        if (isCurrent) {
          const marker = el("span", "map-marker");
          marker.innerHTML = icon(avatarSpriteName(progress.equipped?.avatar), 3);
          marker.title = "You are here";
          wrap.appendChild(marker);
        }
        wrap.appendChild(el("div", "map-node-title", lesson.title));
        row.appendChild(wrap);
      });
      path.appendChild(row);
    });
    zone.appendChild(path);
    container.appendChild(zone);
  });

  attachResizeWatcher(container);
}

// Re-lay out when the width changes enough to change how many nodes fit on a
// row. One observer per container, installed once.
function attachResizeWatcher(container) {
  if (container._mapObserver) return;
  const ro = new ResizeObserver(() => {
    if (!container.isConnected || container.closest("[hidden]")) return;
    const width = contentWidth(container);
    if (!width || perRowFor(width) === container._mapPerRow) return;
    const { progress, onOpenLesson, onPoke } = container._mapArgs;
    const scrollTop = container.scrollTop;
    renderWorldMap(container, progress, { onOpenLesson, onPoke });
    container.scrollTop = scrollTop;
  });
  ro.observe(container);
  container._mapObserver = ro;
}

// Brings the "you are here" node into view - only scrolling if it's actually
// off-screen, so a node near the top leaves Sam's box visible above it.
export function focusCurrentNode(container) {
  const node = container.querySelector(".map-node.is-current");
  node?.scrollIntoView({ block: "nearest", behavior: "auto" });
}

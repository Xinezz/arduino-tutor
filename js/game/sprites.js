// Turns the text-grid sprites in spriteData.js / bigSprites.js into crisp
// inline SVG. Each color in a sprite becomes ONE <path> built from merged
// horizontal runs of pixels, so even a 16x16 character is only a handful of
// path commands, scales to any size without blurring (shape-rendering:
// crispEdges), and a "currentColor" palette entry follows the surrounding
// text color - which is how UI icons pick up the active theme.

import { SPRITES as BASE } from "./spriteData.js";
import { BIG_SPRITES, composeSprite } from "./bigSprites.js";

const ALL = { ...BASE, ...BIG_SPRITES };
const cache = new Map();

export function hasSprite(name) {
  return name in ALL;
}

function buildPaths(def, palOverride) {
  const pal = palOverride ? { ...def.pal, ...palOverride } : def.pal;
  const byColor = new Map();
  def.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === "." || ch === " ") {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < row.length && row[x + run] === ch) run++;
      const color = pal[ch];
      if (color) {
        const d = byColor.get(color) ?? [];
        d.push(`M${x} ${y}h${run}v1h-${run}z`);
        byColor.set(color, d);
      }
      x += run;
    }
  });
  return [...byColor.entries()]
    .map(([color, d]) => `<path fill="${color}" d="${d.join("")}"/>`)
    .join("");
}

export function renderDef(def, { scale = 2, cls = "", title = "", pal = null } = {}) {
  const w = def.rows[0].length;
  const h = def.rows.length;
  const aria = title ? `role="img" aria-label="${title}"` : 'aria-hidden="true"';
  return (
    `<svg class="px ${cls}" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" ` +
    `shape-rendering="crispEdges" ${aria}>${buildPaths(def, pal)}</svg>`
  );
}

export function spriteSvg(name, opts = {}) {
  const def = ALL[name];
  if (!def) {
    console.warn(`Unknown sprite: ${name}`);
    return "";
  }
  if (opts.pal) return renderDef(def, opts);
  const key = `${name}|${opts.scale ?? 2}|${opts.cls ?? ""}|${opts.title ?? ""}`;
  let svg = cache.get(key);
  if (!svg) {
    svg = renderDef(def, opts);
    cache.set(key, svg);
  }
  return svg;
}

// Markup string for use inside innerHTML templates.
export function icon(name, scale = 2, cls = "") {
  return spriteSvg(name, { scale, cls });
}

// A live element, for appendChild-style code.
export function iconEl(name, scale = 2, cls = "") {
  const tpl = document.createElement("template");
  tpl.innerHTML = spriteSvg(name, { scale, cls }).trim();
  return tpl.content.firstElementChild;
}

// A sprite built on the fly (e.g. an NPC with a mood overlay applied).
export function composedSvg(baseName, overlays, opts = {}) {
  const base = ALL[baseName];
  if (!base) return "";
  return renderDef(composeSprite(base, overlays), opts);
}

// For CSS cursors/backgrounds, which need a url(), not inline markup.
export function spriteDataUri(name, scale = 2) {
  const def = ALL[name];
  if (!def) return "";
  const svg = renderDef(def, { scale }).replace(' aria-hidden="true"', "");
  const withNs = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
  return `url("data:image/svg+xml,${encodeURIComponent(withNs)}")`;
}

export function spriteNames() {
  return Object.keys(ALL);
}

export function spriteSize(name) {
  const def = ALL[name];
  return def ? { w: def.rows[0].length, h: def.rows.length } : null;
}

// Dev check: every row of every sprite must be the same width.
export function validateSprites() {
  const problems = [];
  for (const [name, def] of Object.entries(ALL)) {
    const w = def.rows[0].length;
    def.rows.forEach((row, i) => {
      if (row.length !== w) problems.push(`${name} row ${i}: width ${row.length}, expected ${w}`);
      for (const ch of row) {
        if (ch !== "." && ch !== " " && !(ch in def.pal)) {
          problems.push(`${name} row ${i}: "${ch}" has no palette entry`);
          break;
        }
      }
    });
  }
  return problems;
}

// Fills the static HTML's sprite placeholders:
//   <span data-sprite="coin" data-scale="3"></span>   -> that sprite, inline
//   <button data-sprite-icon="book">Label</button>    -> sprite inserted before the label
// so index.html can use pixel icons without pasting SVG into it.
export function hydrateSprites(root = document) {
  root.querySelectorAll("[data-sprite]").forEach((node) => {
    if (node.dataset.hydrated) return;
    node.innerHTML = spriteSvg(node.dataset.sprite, { scale: Number(node.dataset.scale) || 2 });
    node.dataset.hydrated = "1";
  });
  root.querySelectorAll("[data-sprite-icon]").forEach((node) => {
    if (node.dataset.hydrated) return;
    const holder = document.createElement("span");
    holder.className = "tab-ico";
    holder.innerHTML = spriteSvg(node.dataset.spriteIcon, { scale: 2 });
    node.prepend(holder);
    node.dataset.hydrated = "1";
  });
}

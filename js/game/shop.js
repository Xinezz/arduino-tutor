// The Parts Shop catalog: cosmetic themes and avatars, bought with credits.
// Nothing here affects lessons, XP or hints - it's purely a reason to earn and
// a way to make the place feel like yours.
//
// A theme is just a set of CSS-variable overrides on <html>. The default
// theme's values live in style.css's :root, so applying "default" simply
// removes every override. Keeping the palettes in JS (instead of a stylesheet)
// means the shop's swatch previews and the real theme can never drift apart.

export const itemKey = (slot, id) => `${slot}:${id}`;

// Variables every non-default theme sets. Derived values (the dim accent, the
// glows) are computed from these in style.css, so a theme only has to supply
// its base colors.
const t = (appBg, bg, panel, panelAlt, border, text, textDim, accent, green, yellow, red, purple, shadow, onAccent, onGreen, onYellow, codeBg, codeText) => ({
  "--app-bg": appBg, "--bg": bg, "--panel": panel, "--panel-alt": panelAlt, "--border": border,
  "--text": text, "--text-dim": textDim,
  "--accent": accent, "--green": green, "--yellow": yellow, "--red": red, "--purple": purple,
  "--pixel-shadow-color": shadow,
  "--on-accent": onAccent, "--on-green": onGreen, "--on-yellow": onYellow,
  "--code-bg": codeBg, "--code-text": codeText,
});

export const THEMES = [
  {
    id: "default",
    name: "Workshop",
    price: 0,
    blurb: "The classic CircuitWorks bench. Cool blues, warm bulbs.",
    vars: {},
    swatch: ["#0f1117", "#171a23", "#4fc3f7", "#57d38c", "#e8c547"],
  },
  {
    id: "gameboy",
    name: "Pocket Mono",
    price: 60,
    blurb: "Four shades of pea-soup green. Very 1989.",
    vars: t("#051505", "#0b2a0b", "#0f380f", "#174417", "#306230", "#d3e68a", "#8bac0f",
      "#9bbc0f", "#8bac0f", "#d8e65a", "#d9683f", "#6fa06f", "#041404",
      "#0f380f", "#0f380f", "#0f380f", "#0a2a0a", "#9bbc0f"),
    swatch: ["#0b2a0b", "#0f380f", "#9bbc0f", "#8bac0f", "#d8e65a"],
  },
  {
    id: "sunset",
    name: "Neon Sunset",
    price: 80,
    blurb: "Hot pink over deep purple. Synthwave, but for soldering.",
    vars: t("#0b0415", "#140a24", "#1d1033", "#2a1647", "#4a2a7a", "#f5e9ff", "#b49bd6",
      "#ff5fa2", "#5ef0c0", "#ffb347", "#ff5470", "#a78bfa", "#07030f",
      "#2a0518", "#04281d", "#2e1700", "#0e0618", "#ffb3de"),
    swatch: ["#140a24", "#1d1033", "#ff5fa2", "#5ef0c0", "#ffb347"],
  },
  {
    id: "matrix",
    name: "Terminal",
    price: 80,
    blurb: "Phosphor green on black. Wake up, tech.",
    vars: t("#000000", "#020a04", "#06140a", "#0b2012", "#12432a", "#b6ffc8", "#5fae7a",
      "#39ff88", "#a6ff4d", "#e6ff5a", "#ff5f56", "#4dffd2", "#000000",
      "#02210d", "#142400", "#262b00", "#010603", "#39ff88"),
    swatch: ["#020a04", "#06140a", "#39ff88", "#a6ff4d", "#e6ff5a"],
  },
  {
    id: "amber",
    name: "Amber CRT",
    price: 90,
    blurb: "A warm orange glow, like a terminal from the eighties.",
    vars: t("#080400", "#120a02", "#1c1005", "#2a1809", "#5a3a14", "#ffd9a0", "#b88a4a",
      "#ffb000", "#d8c850", "#ffcc33", "#ff6a3d", "#d9985a", "#050200",
      "#2a1700", "#241e00", "#2a1d00", "#0b0601", "#ffb000"),
    swatch: ["#120a02", "#1c1005", "#ffb000", "#d8c850", "#ff6a3d"],
  },
  {
    id: "ocean",
    name: "Deep Sea",
    price: 100,
    blurb: "Cold, quiet and bioluminescent. Great for long study sessions.",
    vars: t("#020b12", "#04141f", "#082235", "#0d3048", "#1a5272", "#dff6ff", "#7fb6cf",
      "#35e0d0", "#6ff2a0", "#ffd86b", "#ff7a7a", "#8fa8ff", "#010a10",
      "#032421", "#04281a", "#2e2200", "#031019", "#7ff5e8"),
    swatch: ["#04141f", "#082235", "#35e0d0", "#6ff2a0", "#ffd86b"],
  },
  {
    id: "gold",
    name: "Gold Rush",
    price: 150,
    blurb: "Black and gold. For people who like their pixels premium.",
    vars: t("#050402", "#0c0a06", "#16120a", "#221b0e", "#5a4a1c", "#fff4d2", "#c4b27a",
      "#ffd23f", "#8fe388", "#ffe27a", "#ff6b5a", "#c9a3ff", "#050402",
      "#2a1f00", "#0c2a0a", "#2a2000", "#080603", "#ffd23f"),
    swatch: ["#0c0a06", "#16120a", "#ffd23f", "#8fe388", "#c9a3ff"],
  },
];

export const AVATARS = [
  { id: "rookie", name: "Rookie", price: 0, blurb: "Fresh hire. Cap included." },
  { id: "bot", name: "Bolt Bot", price: 0, blurb: "Beep boop. Mostly beep." },
  { id: "cat", name: "Circuit Cat", price: 0, blurb: "Sits on the warm parts." },
  { id: "wizard", name: "Code Wizard", price: 40, blurb: "Compiles on the first try. Allegedly." },
  { id: "astro", name: "Astro Tech", price: 60, blurb: "Debugging at zero gravity." },
  { id: "ninja", name: "Byte Ninja", price: 80, blurb: "Silent, deadly, well-commented." },
  { id: "knight", name: "Silicon Knight", price: 100, blurb: "Sworn to protect the pull-up resistors." },
];

export function getTheme(id) {
  return THEMES.find((x) => x.id === id) ?? THEMES[0];
}

export function getAvatar(id) {
  return AVATARS.find((x) => x.id === id) ?? AVATARS[0];
}

export const avatarSpriteName = (id) => `avatar_${getAvatar(id).id}`;

// Looks an item up by its inventory key ("theme:ocean").
export function getShopItem(key) {
  const [slot, id] = key.split(":");
  const item = slot === "theme" ? THEMES.find((x) => x.id === id) : AVATARS.find((x) => x.id === id);
  return item ? { ...item, slot, key } : null;
}

// ---- applying a theme ----
let applied = [];

export function applyTheme(id) {
  const theme = getTheme(id);
  const root = document.documentElement;
  for (const name of applied) root.style.removeProperty(name);
  applied = [];
  for (const [name, value] of Object.entries(theme.vars)) {
    root.style.setProperty(name, value);
    applied.push(name);
  }
  root.dataset.theme = theme.id;
  // Mobile browsers tint their own chrome from this.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme.vars["--panel"] ?? "#171a23");
}

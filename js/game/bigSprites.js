// The bigger pixel-art pieces: the NPCs, the playable avatars, the treasure
// chest, the boss. Same text-grid format as spriteData.js.

const S = (pal, ...rows) => ({ pal, rows });

// Lays overlay rows on top of a base sprite. An overlay row is a string the
// same width as the base where "_" means "leave this pixel alone" - used for
// facial expressions, so a mood only has to describe the few pixels it changes.
export function composeSprite(base, overlays) {
  const rows = base.rows.map((row, y) => {
    const ov = overlays?.[y];
    if (!ov) return row;
    let out = "";
    for (let x = 0; x < row.length; x++) out += ov[x] && ov[x] !== "_" ? ov[x] : row[x];
    return out;
  });
  return { pal: base.pal, rows };
}

// ------------------------------------------------------------------- Sam
// A friendly circuit-technician robot: antenna LEDs, a visor with two cyan
// eyes, a little smile. Eyes live in rows 7-8 (columns 4-5 and 10-11), the
// mouth in rows 11-12, so every mood below is just a patch over those.

export const SAM_PALETTE = {
  k: "#0e1424", b: "#8ea4c4", h: "#cfe0f5", d: "#5a6f92",
  a: "#4fc3f7", A: "#bdeaff", y: "#ffd23f", m: "#1b2a4a",
};

// Volt, the shop clerk, is the same bot with a different paint job.
export const VOLT_PALETTE = {
  k: "#1e1208", b: "#e0a458", h: "#ffd9a0", d: "#9a6a30",
  a: "#7dff9a", A: "#d4ffe0", y: "#ff6b6b", m: "#3a2410",
};

export const SAM_MOODS = {
  idle: {},
  blink: { 7: "____kk____kk____", 8: "____aa____aa____" },
  happy: {
    7: "____aa____aa____", 8: "____kk____kk____",
    11: "____mmmmmmmm____", 12: "_____mmmmmm_____",
  },
  surprised: {
    6: "____AA____AA____", 7: "____AA____AA____", 8: "____AA____AA____",
    11: "____bbmmmmbb____", 12: "____bbmmmmbb____",
  },
  think: { 7: "__________kk____", 8: "__________aa____", 11: "____bbbbbbbb____" },
  sad: { 11: "____bmmmmmmb____", 12: "____mbbbbbbm____" },
  // Open mouth, swapped in and out while Sam is talking.
  talk: { 11: "____bmmmmmmb____", 12: "____bbmmmmbb____" },
};

const SAM_ROWS = [
  "....y......y....",
  "....k......k....",
  "....k......k....",
  "..kkkkkkkkkkkk..",
  ".kbhhhbbbbbbbbk.",
  ".kbhbbbbbbbbbdk.",
  ".kbkkkkkkkkkkbk.",
  "dkbkaAkkkkaAkbkd",
  "dkbkaakkkkaakbkd",
  ".kbkkkkkkkkkkbk.",
  ".kbbbbbbbbbbbdk.",
  ".kbbmbbbbbbmbdk.",
  ".kbbbmmmmmmbbdk.",
  ".kddddddddddddk.",
  "..kkkkkkkkkkkk..",
  "......kkkk......",
];

// ---------------------------------------------------------------- chest

const CHEST_PAL = { o: "#3b240a", w: "#8b5a24", W: "#b27a34", g: "#ffd23f", G: "#fff0a0", k: "#1b1f2b" };

// ----------------------------------------------------------------- boss
// A menacing IC with red eyes and fangs - the "boss" of each Challenge Lab.

const BOSS_PAL = { k: "#12141c", g: "#3a4256", G: "#5a6275", w: "#cfd6e4", r: "#ff3b3b", R: "#a01818", f: "#f4f6fa" };

// ------------------------------------------------------------- the sprites

export const BIG_SPRITES = {
  sam: S(SAM_PALETTE, ...SAM_ROWS),

  chest: S(CHEST_PAL,
    "................",
    "...oooooooooo...",
    "..owWWWWWWWWwo..",
    ".owWWWWWWWWWWwo.",
    ".owwwwwwwwwwwwo.",
    ".oggggggggggggo.",
    ".owwwwggggwwwwo.",
    ".owwwwgkkgwwwwo.",
    ".owwwwggggwwwwo.",
    ".owwwwwwwwwwwwo.",
    ".owwwwwwwwwwwwo.",
    ".oggwwwwwwwwggo.",
    ".oooooooooooooo.",
    "................"),

  chestOpen: S(CHEST_PAL,
    "..oooooooooooo..",
    ".owWWWWWWWWWWwo.",
    ".owwwwwwwwwwwwo.",
    ".oggggggggggggo.",
    ".okkkkkkkkkkkko.",
    ".okkgGgGgGgGkko.",
    ".oggggggggggggo.",
    ".owwwwggggwwwwo.",
    ".owwwwgkkgwwwwo.",
    ".owwwwggggwwwwo.",
    ".owwwwwwwwwwwwo.",
    ".oggwwwwwwwwggo.",
    ".oooooooooooooo.",
    "................"),

  bossChip: S(BOSS_PAL,
    "................",
    "....kkkkkkkk....",
    "..kkggggggggkk..",
    ".wkgGGGGGGGGgkw.",
    "wwkgGrrGGrrGgkww",
    ".wkgGRrGGrRGgkw.",
    "wwkgGGGGGGGGgkww",
    ".wkgGGGGGGGGgkw.",
    "wwkgkkkkkkkkgkww",
    ".wkgkfkfkfkfgkw.",
    "wwkgGGGGGGGGgkww",
    ".wkgGGGGGGGGgkw.",
    "..kkggggggggkk..",
    "....kkkkkkkk....",
    "................",
    "................"),

  // ------------------------------------------------------------ avatars
  avatar_rookie: S({ k: "#1a1423", r: "#e24b4b", R: "#a82828", s: "#f1c49b", e: "#1a1423", m: "#a0524a", b: "#4a86d6" },
    "...kkkkkk...",
    "..krrrrrrk..",
    ".krrrrrrrrk.",
    "kRRRRRRRRRRk",
    ".kssssssssk.",
    ".ksessssesk.",
    ".kssssssssk.",
    ".ksssmmsssk.",
    "..kssssssk..",
    "..kbbbbbbk..",
    ".kbbbbbbbbk.",
    "kbbbbbbbbbbk"),

  avatar_bot: S({ y: "#ffd23f", k: "#0e1424", b: "#8ea4c4", a: "#4fc3f7", m: "#1b2a4a", d: "#5a6f92" },
    ".....yy.....",
    ".....kk.....",
    "..kkkkkkkk..",
    ".kbbbbbbbbk.",
    ".kbaabbaabk.",
    ".kbaabbaabk.",
    ".kbbbbbbbbk.",
    ".kbmmmmmmbk.",
    ".kbbbbbbbbk.",
    "..kkkkkkkk..",
    ".kddddddddk.",
    "kddddddddddk"),

  avatar_cat: S({ k: "#2a1a10", o: "#f0a050", g: "#7dff9a", n: "#ff8fa8", w: "#fff7ea", p: "#6a4ac0" },
    "..k......k..",
    ".kok....kok.",
    ".kooooooook.",
    ".kogoooogok.",
    ".kooooooook.",
    ".kooonnoook.",
    ".kooowwoook.",
    "..kooooook..",
    "...kkkkkk...",
    "..kppppppk..",
    ".kppppppppk.",
    "kppppppppppk"),

  avatar_wizard: S({ k: "#1a1030", p: "#8a5ae0", P: "#5a3aa8", y: "#ffd23f", s: "#f1c49b", e: "#1a1030", w: "#f4f6fa" },
    ".....kk.....",
    "....kppk....",
    "...kppppk...",
    "..kppypppk..",
    ".kPPPPPPPPk.",
    "..kssssssk..",
    "..ksessesk..",
    "..kwwwwwwk..",
    ".kwwwwwwwwk.",
    "..kwwwwwwk..",
    ".kPPPPPPPPk.",
    "kPPPPPPPPPPk"),

  avatar_astro: S({ k: "#14263e", w: "#e8ecf4", a: "#4fc3f7", o: "#ff8a2b" },
    "...kkkkkk...",
    "..kwwwwwwk..",
    ".kwwwwwwwwk.",
    ".kwkkkkkkwk.",
    ".kwkaaaakwk.",
    ".kwkkkkkkwk.",
    ".kwwwwwwwwk.",
    "..kwwwwwwk..",
    "...kkkkkk...",
    "..kooooook..",
    ".kooooooook.",
    "kooooooooook"),

  avatar_ninja: S({ k: "#14141c", R: "#d63030", s: "#f1c49b", e: "#14141c", g: "#3a3f52" },
    "...kkkkkk...",
    "..kkkkkkkk..",
    ".kRRRRRRRRk.",
    ".kkkkkkkkkk.",
    [".", "k", "k", "s", "e", "s", "s", "e", "s", "k", "k", "."].join(""),
    ".kkkkkkkkkk.",
    "..kkkkkkkk..",
    "...kkkkkk...",
    "..kkkkkkkk..",
    "..kggggggk..",
    ".kggggggggk.",
    "kggggggggggk"),

  avatar_knight: S({ r: "#e24b4b", k: "#12141c", g: "#aab2c4", b: "#3a5fa8" },
    ".....rr.....",
    "....rrrr....",
    "..kkkkkkkk..",
    ".kggggggggk.",
    ".kgkkkkkkgk.",
    ".kgkkkkkkgk.",
    ".kggggggggk.",
    "..kggggggk..",
    "...kkkkkk...",
    "..kbbbbbbk..",
    ".kbbbbbbbbk.",
    "kbbbbbbbbbbk"),
};

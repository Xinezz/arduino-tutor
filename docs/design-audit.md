# Visual design audit and design system

## 1. Audit

Taken from the running site at 1280 × 800 and 375 × 812, with a learner part-way through the course. Every feature listed exists and was opened; there's no separate "Profile" or "Assessment" page – the avatar opens Progress, and assessment lives inside projects and pathways.

**What works:**
- A real identity: navy surfaces, cyan accent, green success, amber highlights, pixel-sprite icons, and Sam the mentor.
- Text contrast already meets WCAG AA in every theme (tested in Phase 8).
- Content structure is sound – lessons follow one template, and projects one 10-part layout.

**Problems, most important first:**

| # | Problem | Where | Effect |
|---|---|---|---|
| 1 | **The top bar overflows at 1280 px.** Six tabs + HUD + Ask Sam measure 1,437 px wide: Ask Sam, mute and settings fall off-screen, and the page scrolls sideways | Every screen | A common laptop width loses controls |
| 2 | **Pixel font everywhere.** Every h1/h2/h3, every button (0.62 rem), tabs (0.55 rem), labels and badges use Press Start 2P. At these sizes it's hard to read – even "28" read as "25" in a screenshot | Sitewide | Slower reading, a "game" not "platform" feel |
| 3 | **Busy rainbow pixel-grid image behind the whole app.** Panels need heavy borders and shadows to stay readable over it | Every screen | Visual noise, competing with content |
| 4 | **Heavy chrome on everything:** 3 px borders, hard 4 px offset shadows, and corner "rivets" (`.hud-frame`) on most cards | Cards, panels | Nothing stands out because everything is decorated |
| 5 | **Six different card styles** (lesson card, learn-next, project card, dash-q, rec-card, pathway card, portfolio card) with different padding, borders and shadows | Learn, Projects, Progress, Pathways, Portfolio | Feels like separate products |
| 6 | **Buttons:** 7 variants with competing effects (bevel + hard shadow + glow on hover + pulsing Stop); long labels wrap in pixel font | Sitewide | Primary actions don't stand out |
| 7 | **Practice is a stack, not a workbench:** the intro, then a full-width editor, then a board taller than the screen, then the Serial Monitor at the very bottom – the code and its output are never visible together | Practice, hands-on lessons | Constant scrolling while coding |
| 8 | **The home screen repeats "Up next" three times** (hero text, illustration label, "Keep going" card); a decorative bar-chart panel carries no information; Continue is a small icon tile | Menu (landing) | The next action is not the most prominent thing |
| 9 | **Status shown in red** on project cards ("✔ Completed: guided" in the same red as errors) | Projects | Success reads as a problem |
| 10 | **Content width:** wide panels capped at 1100 px leave a dark band on the right at 1280+ | Learn, Projects, Progress | Looks unfinished |
| 11 | **Sam's box at the top of every lesson** pushes the title down | Lessons | The lesson starts below the fold on laptops |

## 2. Design direction

*Professional educational technology with retro arcade and robotics accents.* The palette already matches this direction, so it's refined rather than replaced. Shop themes keep working, because they override the same variables.

**Colour tokens (default theme)**

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0b0f19` deep navy | Page background (with a faint engineering grid) |
| `--panel` / `--surface-1` | `#141a26` | Cards, panels |
| `--panel-alt` / `--surface-2` | `#1b2232` | Raised areas, inputs, hover |
| `--border` | `#283147` | 1 px borders |
| `--text` | `#e6e9f0` | Body text (15.8:1 on the background) |
| `--text-dim` | `#a1a9bd` | Secondary text (8.1:1 on the background) |
| `--accent` | `#4fc3f7` cyan | Primary actions, links, focus |
| `--green` | `#57d38c` | Success, progress, Run |
| `--yellow` | `#e8c547` amber | Highlights, rewards, warnings |
| `--red` | `#ef6461` | Errors, destructive actions |
| `--purple` | `#b48ce8` | Advanced level, rare accents |

**Typography**
- **Inter** for all reading and UI text: 16 px body, line-height 1.65, lesson prose limited to about 72 characters per line.
- **Space Grotesk** (600/700) for headings – distinctive, technical, still very readable.
- **Press Start 2P** only for the logo, small eyebrow labels, badges and HUD numbers – never paragraphs, buttons or headings.
- **JetBrains Mono** for code.
- **Scale:** 0.75, 0.875, 1, 1.125, 1.375, 1.75, 2.25 rem.

**Spacing, shape and depth**
- **Spacing scale:** 4, 8, 12, 16, 24, 32, 48 px.
- **Radius:** 4 px for controls, 8 px for cards. Crisp, not bubbly; pixel badges stay square.
- **Borders:** 1 px everywhere.
- **Shadows:** one soft elevation for cards, plus a small hard "pixel" 2 px offset kept only on primary buttons as the retro accent.
- **Corner rivets** only on featured cards: continue-learning, certificate.

**Components** (`css/system.css`, loaded last, built on the tokens):
- **Buttons:** `.btn` sizes (default and `.btn-small`) and variants: primary, success (Run), secondary, ghost/hint, danger, destructive.
- **Containers:** cards, page headers, section titles.
- **Content blocks:** badges and pills, inputs and selects, callouts (note, warning, key idea, example, exercise, check).
- **Feedback:** progress bars, tooltips.
- **Navigation:** the top bar and tabs.

## 3. What was implemented

**Design system** (`css/system.css`, loaded last):
- Tokens: colour (with semantic aliases), type scale, spacing scale, radii, elevation, motion.
- Components: buttons (6 variants, 3 sizes), cards, inputs, callouts, badges, progress bars, navigation, modal and toast surfaces.
- Every page's existing classes are mapped onto these components, so they share one visual language.
- A global `[hidden]` guard, so component display rules can never reveal a hidden element.

**Navigation:**
- Before: pixel-font tabs and a top bar 1,437 px wide at a 1280 px viewport.
- Now: Inter labels with sprite icons and a clear active state (accent text + tint + border). The bar fits on one row from 1200 px, with the sections on their own row below that.
- On phones, the six sections show as an icon above a short label.
- The streak chip hides between 1200 and 1439 px (it's also on Home and Progress).

**Home:**
- **First visit:** what Arduino Tutor is, who it's for, what you'll achieve (lesson and module counts taken from the course data) and how to begin – beside the sign-up card.
- **Returning:** a welcome, then one large **Continue learning** card (module position, why it matters, module progress, Continue). Supporting cards: progress, recommended activity (with its reason), recently completed, projects, achievements. Quick links to every section.
- The decorative equaliser panel and the triple "Up next" are gone.

**Practice:**
- A workbench at 1180 px and wider: **Code + Serial Monitor** on the left (sticky), **Circuit** on the right. Run is the primary green action.
- The wiring instructions moved into a "How to build a circuit" disclosure.
- Code and Serial Monitor are in JetBrains Mono instead of VT323, for readability.
- No simulator logic changed; every control keeps its ID.

**Lessons:**
- Numbered section headings that anchor the page.
- Callouts colour-coded by type: note, mistakes, predict, exercise, guided, hint, solution, demo.
- Prose limited to a 72-character line.
- A compact mentor strip.

**Projects, Pathways, Progress, Portfolio:**
- One card style and consistent page headers.
- Project status in green only when complete (it used the error red).
- Planned pathways recede (dashed, dimmed); the available one has an accent border.
- Progress question headings and suggestion buttons resized.

**Game screens:** sprites and colours kept; frames slimmed to 1 px and titles set in the heading font.

**Background:** a calm engineering grid inside the app. The arcade image stays, toned down, on the home screen.

## 4. Verified
- **Automated:** 351 of 351 tests pass, including WCAG AA contrast for every theme against the new default palette.
- **Browser** (scripted, built-in Chromium), with no console errors:
  - home (first visit and returning), the tour and Skip, a lesson and its checkpoint, Mark done;
  - in Practice: run, add a part, Check Circuit;
  - Projects, Pathways, Progress (including the rewards area), Portfolio and Ask Sam.
- **Layout:** no page-level sideways scroll at 1280, 1024, 768 and 375 px. The only off-screen element is CodeMirror's intentionally hidden input field. No buttons under 24 px.
- **Accessibility scan:** home (both states) and every tab have no unnamed controls, no unlabelled fields, no duplicate IDs and no skipped heading levels.

## 5. Known limitations
- The older stylesheets (`style.css`, `hud.css`, `game.css`, `screens.css`) still contain the superseded rules; `system.css` overrides them. Removing the dead rules is a safe follow-up, but needs page-by-page checking.
- The circuit board drawing itself (Uno, breadboard, parts) is unchanged – it's simulator rendering.
- The lesson view keeps the stacked editor → board → Serial Monitor layout, because the lesson column beside the course list is too narrow for a side-by-side workbench.
- Not checked in Firefox or Safari. `color-mix()` and `:has()` need recent versions; older browsers fall back to simpler colours.

// What a portfolio record IS: its categories, difficulty levels, the nine
// documentation sections (A-I) with the questions each one answers, the
// templates, which sections a record of each difficulty needs, how a record
// is pre-filled from a library project, and how two versions are compared.
// Pure - no storage, no DOM (portfolio.js stores; portfolioView.js draws).

import { SKILLS } from "../lessons/curriculum.js";

export const CATEGORIES = [
  { id: "electronics", name: "Electronics" },
  { id: "programming", name: "Arduino Programming" },
  { id: "robotics", name: "Robotics and Automation" },
  { id: "sensors", name: "Sensors and Instrumentation" },
  { id: "iot", name: "IoT and Smart Systems" },
  { id: "design", name: "Engineering Design Challenges" },
];
export const categoryName = (id) => CATEGORIES.find((c) => c.id === id)?.name ?? "Other";

export const DIFFICULTIES = [
  { id: "beginner", name: "Beginner" },
  { id: "intermediate", name: "Intermediate" },
  { id: "advanced", name: "Advanced" },
];
export const difficultyName = (id) => DIFFICULTIES.find((d) => d.id === id)?.name ?? id;

// The nine sections. Each field is one question with a prompt.
export const SECTIONS = [
  { id: "overview", letter: "A", title: "Project overview", fields: [
    ["what", "What is the project?", "In a sentence or two: what does it do?"],
    ["problem", "What problem does it solve?", "Who or what is it for - what would be harder without it?"],
    ["purpose", "What is its intended purpose?", "Where would it be used?"],
  ] },
  { id: "requirements", letter: "B", title: "Design requirements", fields: [
    ["must", "What should the system accomplish?", "Measurable where you can: \"sounds within 0.5 s\", not \"is quick\"."],
    ["io", "What are the inputs and outputs?", "Inputs: what it senses. Outputs: what it controls."],
    ["limits", "What limitations or constraints exist?", "Pins, parts, power, what the simulator can't do..."],
  ] },
  { id: "components", letter: "C", title: "Components and materials", fields: [
    ["choices", "Why was each component chosen?", "For each part: its job, and why this part rather than another."],
    ["hardware", "Simulated, or real hardware?", "Which parts ran in the simulator, and which would need (or used) real hardware?"],
  ] },
  { id: "circuit", letter: "D", title: "Circuit design", fields: [
    ["connections", "How are the components connected?", "Describe the important connections (the circuit itself is saved below)."],
    ["wiring", "Which wiring decisions mattered?", "Resistor values, pull-ups, polarity, which pins and why."],
  ] },
  { id: "programming", letter: "E", title: "Programming", fields: [
    ["decisions", "Which programming decisions mattered?", "How the program is structured, and why - variables, conditions, timing."],
    ["concepts", "Which programming concepts did you use?", "For example: if/else, loops, functions, millis(), analogRead()."],
  ] },
  { id: "testing", letter: "F", title: "Testing and results", fields: [
    ["tests", "What tests did you perform?", "What did you try, and how?"],
    ["expected", "What did you expect to happen?", ""],
    ["actual", "What actually happened?", ""],
    ["met", "Did it meet its requirements?", "Requirement by requirement, if you can."],
  ] },
  { id: "problems", letter: "G", title: "Problems and troubleshooting", fields: [
    ["what", "What problems occurred?", ""],
    ["how", "How did you investigate them?", "What did you check, print or measure?"],
    ["fix", "What solutions did you implement?", ""],
  ] },
  { id: "improvements", letter: "H", title: "Improvements", fields: [
    ["better", "What could be improved?", ""],
    ["features", "What features could be added?", ""],
    ["next", "What would you change in a future version?", ""],
  ] },
  { id: "reflection", letter: "I", title: "Personal reflection", fields: [
    ["learned", "What did you learn?", ""],
    ["skills", "Which skills improved?", ""],
    ["hardest", "What was the most challenging part?", "And how did you get past it?"],
    ["differently", "What would you do differently next time?", ""],
  ] },
];
export const sectionById = (id) => SECTIONS.find((s) => s.id === id);

// Beginners document the essentials; more advanced projects document more.
export const REQUIRED = {
  beginner: ["overview", "components", "testing", "reflection"],
  intermediate: ["overview", "requirements", "components", "circuit", "programming", "testing", "problems", "reflection"],
  advanced: SECTIONS.map((s) => s.id),
};

export const TEMPLATES = [
  { id: "basic", name: "Basic Arduino Project", category: "programming", hint: "A first build: what it does, the parts, how you tested it, and what you learned." },
  { id: "circuit", name: "Electronics Circuit Design", category: "electronics", hint: "Lead with the circuit: values you calculated (Ohm's law, current budget) and why." },
  { id: "robotics", name: "Robotics Project", category: "robotics", hint: "Focus on movement: what moves, how it's controlled, and how it's tested safely." },
  { id: "sensors", name: "Sensor Monitoring System", category: "sensors", hint: "Focus on measurement: what's measured, readings you observed, thresholds and accuracy." },
  { id: "automation", name: "Automation Project", category: "robotics", hint: "Focus on decisions: what triggers each action, and what happens in every situation." },
  { id: "iot", name: "IoT Prototype", category: "iot", hint: "Be clear about what ran in the simulator and what would need real networked hardware." },
  { id: "design", name: "Engineering Design Challenge", category: "design", hint: "Requirements first, then options considered, the choice made, and testing against each requirement." },
];
export const templateById = (id) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];

// A section counts as written when every one of its fields has some real text.
const filled = (v) => typeof v === "string" && v.trim().length >= 3;
export function sectionComplete(doc, sectionId) {
  const s = sectionById(sectionId);
  return s.fields.every(([f]) => filled(doc?.[sectionId]?.[f]));
}
export function docStatus(entry) {
  const required = REQUIRED[entry.difficulty] ?? REQUIRED.beginner;
  const done = required.filter((id) => sectionComplete(entry.doc, id));
  const started = SECTIONS.filter((s) => s.fields.some(([f]) => filled(entry.doc?.[s.id]?.[f]))).map((s) => s.id);
  return { required, done, started, complete: done.length === required.length, label: done.length === required.length ? "Documented" : started.length ? "Draft" : "Not started" };
}

// ---- a record for a library project ----
export function categoryFor(project) {
  if (project.pathwayLevel === 3) return "design";
  if (project.pathway === "electronics") return "electronics";
  const c = project.concepts ?? [];
  if (c.some((x) => ["servo", "motors"].includes(x))) return "robotics";
  if (c.some((x) => ["light", "temperature", "ultrasonic", "ir", "analogread"].includes(x))) return "sensors";
  return "programming";
}
export function difficultyFor(project) {
  if (project.pathwayLevel === 3) return "advanced";
  if (project.pathwayLevel === 2) return "intermediate";
  return "beginner";
}
export function templateFor(project) {
  if (project.pathwayLevel === 3) return "design";
  return { electronics: "circuit", sensors: "sensors", robotics: "automation" }[categoryFor(project)] ?? "basic";
}

// What the library and the learner's own project log already say - so
// nothing is typed twice. Every pre-filled answer stays editable.
export function prefillDoc(project, log = {}) {
  const lines = (xs) => xs.join("\n");
  const req = project.independent?.requirements ?? [];
  return {
    overview: { what: project.summary ?? "", problem: project.problem ?? "", purpose: project.why ?? "" },
    requirements: {
      must: lines(req),
      io: [project.plan?.inputs && `Inputs: ${project.plan.inputs}`, project.plan?.outputs && `Outputs: ${project.plan.outputs}`].filter(Boolean).join("\n"),
      limits: lines(project.independent?.limits ?? []),
    },
    components: {
      choices: lines((project.components ?? []).map((c) => `${c.count} × ${c.kind}: ${c.purpose} ${c.why}`)),
      hardware: "",
    },
    circuit: { connections: lines(project.plan?.circuit ?? []), wiring: "" },
    programming: { decisions: log.decisions ?? "", concepts: (project.concepts ?? []).map((c) => SKILLS[c]).filter(Boolean).join(", ") },
    testing: { tests: "", expected: "", actual: "", met: "" },
    problems: { what: log.problems ?? "", how: "", fix: "" },
    improvements: { better: "", features: log.improvements ?? "", next: "" },
    reflection: { learned: "", skills: "", hardest: "", differently: "" },
  };
}

// ---- comparing versions ----
// A line diff (longest common subsequence): [{ type: "same"|"add"|"del", text }].
export function lineDiff(before = "", after = "") {
  const a = String(before ?? "").split("\n");
  const b = String(after ?? "").split("\n");
  const n = a.length, m = b.length;
  if (n * m > 4_000_000) return [{ type: "del", text: "(too long to compare line by line)" }];
  const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ type: "same", text: a[i] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) out.push({ type: "del", text: a[i++] });
    else out.push({ type: "add", text: b[j++] });
  }
  while (i < n) out.push({ type: "del", text: a[i++] });
  while (j < m) out.push({ type: "add", text: b[j++] });
  return out;
}

// Which documentation answers differ between two snapshots: [{ section, field, question }]
export function docChanges(before = {}, after = {}) {
  const out = [];
  for (const s of SECTIONS) {
    for (const [f, question] of s.fields) {
      if ((before?.[s.id]?.[f] ?? "").trim() !== (after?.[s.id]?.[f] ?? "").trim()) out.push({ section: s, field: f, question });
    }
  }
  return out;
}

export function circuitSummary(circuit) {
  if (!circuit?.parts?.length) return { parts: 0, wires: 0, text: "No circuit saved" };
  const counts = {};
  for (const p of circuit.parts) counts[p.kind] = (counts[p.kind] ?? 0) + 1;
  return { parts: circuit.parts.length, wires: circuit.wires.length, text: Object.entries(counts).map(([k, n]) => `${n} ${k}${n > 1 ? "s" : ""}`).join(", ") };
}

// Deployment safety for GitHub Pages (a static, case-sensitive host serving
// the site from a sub-path): every import resolves to a real file with the
// exact same letter case, asset paths are relative, the module preload list
// matches the real import graph, only the known external hosts are used, and
// nothing that looks like a secret ships in the front-end code.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, moduleGraph, preloadBlock } from "../tools/module-graph.mjs";

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const allJs = (dir = "js") => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
  .flatMap((d) => (d.isDirectory() ? allJs(`${dir}/${d.name}`) : d.name.endsWith(".js") ? [`${dir}/${d.name}`] : []));

// true only if every segment of the path exists with exactly this case
function existsExactCase(rel) {
  let dir = ROOT;
  for (const part of rel.split("/")) {
    if (!fs.readdirSync(dir).includes(part)) return false;
    dir = path.join(dir, part);
  }
  return true;
}

test("every relative import resolves to a file with exactly the same letter case", () => {
  const re = /(?:import|export)\s[^;]*?from\s*["'](\.[^"']+)["']|import\s*["'](\.[^"']+)["']/g;
  for (const file of allJs()) {
    for (const m of read(file).matchAll(re)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1] ?? m[2]));
      assert.ok(existsExactCase(target), `${file} imports ${m[1] ?? m[2]} - not found with that exact case (GitHub Pages is case-sensitive)`);
    }
  }
});

test("index.html uses relative paths that exist, so the site works from its /arduino-tutor/ sub-path", () => {
  const html = read("index.html");
  for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    const url = m[1];
    if (/^https?:\/\//.test(url) || url.startsWith("data:")) continue;
    assert.ok(!url.startsWith("/"), `${url} is absolute - it would break under the GitHub Pages sub-path`);
    assert.ok(existsExactCase(url), `${url} doesn't exist (with that exact case)`);
  }
});

test("the modulepreload list matches the real import graph", () => {
  const html = read("index.html").replace(/\r\n/g, "\n");
  assert.ok(html.includes(preloadBlock(moduleGraph())), "out of date - run: node tools/module-graph.mjs --write");
});

test("only the known external hosts are used", () => {
  const html = read("index.html");
  const hosts = new Set([...html.matchAll(/(?:src|href)="https?:\/\/([^/"]+)/g)].map((m) => m[1]));
  assert.deepEqual([...hosts].sort(), ["cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"].filter((h) => hosts.has(h)).sort());
  for (const file of allJs()) assert.doesNotMatch(read(file), /fetch\(\s*["']https?:/, `${file} calls an external service`);
});

test("no API keys, tokens or private keys in the front-end code", () => {
  const secret = /(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|api[_-]?key\s*[:=]\s*["'][^"']{12,})/i;
  for (const file of [...allJs(), "index.html"]) assert.doesNotMatch(read(file), secret, file);
});

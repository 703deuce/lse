#!/usr/bin/env node
/**
 * Lightweight static security greps for CI (dangerous patterns).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

const RULES = [
  {
    name: "dangerouslySetInnerHTML",
    pattern: /dangerouslySetInnerHTML/,
    allowlist: [],
  },
  {
    name: "rejectUnauthorized:false",
    pattern: /rejectUnauthorized\s*:\s*false/,
    allowlist: [],
  },
  {
    name: "child_process",
    pattern: /\brequire\s*\(\s*["']child_process["']\s*\)|from\s+["']child_process["']/,
    allowlist: [],
  },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules") continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(SRC);
const violations = [];

for (const file of files) {
  const rel = relative(ROOT, file);
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  for (const rule of RULES) {
    if (rule.allowlist.some((allowed) => rel.includes(allowed))) continue;
    lines.forEach((line, idx) => {
      if (rule.pattern.test(line)) {
        violations.push(`${rel}:${idx + 1} [${rule.name}] ${line.trim()}`);
      }
    });
  }
}

if (violations.length) {
  console.error("Security static checks failed:\n" + violations.join("\n"));
  process.exit(1);
}

console.log(`Security static checks passed (${files.length} source files).`);

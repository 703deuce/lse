#!/usr/bin/env node
/**
 * Fail CI when client bundles may embed server-only secrets.
 * Scans src/components and use client files under src/app for dangerous assignments.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SECRET_PATTERNS = [
  /\bSUPABASE_SERVICE_ROLE\s*=/,
  /\bCRON_SECRET\s*=/,
  /\bBREVO_API_KEY\s*=/,
];

const SCAN_DIRS = [join(ROOT, "src/components")];

function isUseClientSource(path, content) {
  if (path.includes(`${join("src", "app")}${join("", "")}`)) {
    return /^\s*["']use client["']/m.test(content);
  }
  return path.includes(`${join("src", "components")}`);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules") continue;
      walk(full, out);
    } else if (/\.(tsx|jsx|ts|js)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function scanAppClientFiles() {
  const appDir = join(ROOT, "src/app");
  const files = walk(appDir);
  return files.filter((file) => {
    const content = readFileSync(file, "utf8");
    return /^\s*["']use client["']/m.test(content);
  });
}

const files = [
  ...SCAN_DIRS.flatMap((dir) => (statSync(dir, { throwIfNo: false }) ? walk(dir) : [])),
  ...scanAppClientFiles(),
];

const violations = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  if (!isUseClientSource(file, content) && !file.includes(`${join("src", "components")}`)) {
    continue;
  }
  const lines = content.split("\n");
  lines.forEach((line, idx) => {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        violations.push(`${relative(ROOT, file)}:${idx + 1}: ${line.trim()}`);
      }
    }
  });
}

if (violations.length) {
  console.error("Client bundle secret scan failed:\n" + violations.join("\n"));
  process.exit(1);
}

console.log(`Client bundle secret scan passed (${files.length} files checked).`);

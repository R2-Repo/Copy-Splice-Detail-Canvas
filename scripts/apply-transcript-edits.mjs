/**
 * Apply StrReplace edits from agent transcripts in chronological order.
 * Usage: node scripts/apply-transcript-edits.mjs <transcript.jsonl> [...]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function extractReplacements(jsonlPath) {
  const lines = readFileSync(jsonlPath, "utf8").split("\n");
  const replacements = [];

  for (const line of lines) {
    if (!line.includes('"StrReplace"')) continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    const content = parsed?.message?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block?.name !== "StrReplace") continue;
      const input = block.input;
      if (!input?.path || input.old_string == null || input.new_string == null) continue;
      if (input.old_string === input.new_string) continue;

      const rel = input.path
        .replace(/\\/g, "/")
        .split("Copy-Splice-Detail-Canvas/")[1];
      if (!rel?.startsWith("src/")) continue;

      replacements.push({
        file: resolve(repoRoot, rel),
        old_string: input.old_string,
        new_string: input.new_string,
        replace_all: input.replace_all === true,
      });
    }
  }

  return replacements;
}

function applyReplacement(filePath, old_string, new_string, replace_all) {
  if (!existsSync(filePath)) {
    return { ok: false, reason: "file missing" };
  }

  let content = readFileSync(filePath, "utf8");

  if (replace_all) {
    if (!content.includes(old_string)) {
      return { ok: false, reason: "old_string not found (replace_all)" };
    }
    content = content.split(old_string).join(new_string);
    writeFileSync(filePath, content, "utf8");
    return { ok: true };
  }

  const index = content.indexOf(old_string);
  if (index === -1) {
    return { ok: false, reason: "old_string not found" };
  }
  if (content.indexOf(old_string, index + 1) !== -1) {
    return { ok: false, reason: "old_string not unique" };
  }

  content =
    content.slice(0, index) +
    new_string +
    content.slice(index + old_string.length);
  writeFileSync(filePath, content, "utf8");
  return { ok: true };
}

const transcriptPaths = process.argv.slice(2);
if (transcriptPaths.length === 0) {
  console.error("Provide one or more transcript .jsonl paths");
  process.exit(1);
}

let all = [];
for (const p of transcriptPaths) {
  all.push(...extractReplacements(resolve(p)));
}

let ok = 0;
let fail = 0;
const failures = [];

for (const rep of all) {
  try {
    const result = applyReplacement(
      rep.file,
      rep.old_string,
      rep.new_string,
      rep.replace_all,
    );
    if (result.ok) {
      ok += 1;
    } else {
      fail += 1;
      failures.push({ file: rep.file, reason: result.reason });
    }
  } catch (err) {
    fail += 1;
    failures.push({ file: rep.file, reason: err.message });
  }
}

console.log(`Apply complete: ${ok} succeeded, ${fail} failed (${all.length} total)`);
if (failures.length > 0) {
  console.log("\nFirst 25 failures:");
  for (const f of failures.slice(0, 25)) {
    console.log(`  ${f.file}: ${f.reason}`);
  }
}

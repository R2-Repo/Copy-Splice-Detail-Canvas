/**
 * Reverse StrReplace edits from agent transcripts to restore an earlier code state.
 * Usage: node scripts/undo-transcript-edits.mjs <transcript.jsonl> [...]
 */
import { readFileSync, writeFileSync } from "node:fs";
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

function undoReplacement(filePath, old_string, new_string, replace_all) {
  let content = readFileSync(filePath, "utf8");

  if (replace_all) {
    if (!content.includes(new_string)) {
      return { ok: false, reason: "new_string not found (replace_all)" };
    }
    content = content.split(new_string).join(old_string);
    writeFileSync(filePath, content, "utf8");
    return { ok: true };
  }

  const index = content.indexOf(new_string);
  if (index === -1) {
    return { ok: false, reason: "new_string not found" };
  }
  if (content.indexOf(new_string, index + 1) !== -1) {
    return { ok: false, reason: "new_string not unique" };
  }

  content =
    content.slice(0, index) +
    old_string +
    content.slice(index + new_string.length);
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

// Reverse chronological order to undo edits.
all.reverse();

let totalOk = 0;
let pass = 0;
const maxPasses = 20;

const applied = new Set();

while (pass < maxPasses) {
  pass += 1;
  let passOk = 0;

  for (let i = 0; i < all.length; i++) {
    if (applied.has(i)) continue;
    const rep = all[i];
    try {
      const result = undoReplacement(
        rep.file,
        rep.old_string,
        rep.new_string,
        rep.replace_all,
      );
      if (result.ok) {
        applied.add(i);
        passOk += 1;
        totalOk += 1;
      }
    } catch {
      // skip
    }
  }

  console.log(`Pass ${pass}: ${passOk} undos applied`);
  if (passOk === 0) break;
}

console.log(
  `Undo complete: ${totalOk} undos applied, ${all.length - totalOk} remaining (${all.length} edits in transcript)`,
);

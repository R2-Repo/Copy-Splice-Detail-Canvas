#!/usr/bin/env node
/**
 * Headless import/search/routing/rules CLI for dev sidecar use.
 */
import "./register-env.ts";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  dispatchCommand,
  type DaemonCommand,
  type SessionStore,
} from "./handlers";

const COMMANDS: DaemonCommand[] = [
  "parse",
  "search",
  "evaluate",
  "evaluate-tier",
  "evaluate-batch",
  "analyze-topology",
  "rules",
  "export-top",
];

function usage(): never {
  console.error(
    `Usage: sdc-eval <command> [--file path]\nCommands: ${COMMANDS.join(", ")}\n` +
      "Reads JSON from --file or stdin; writes JSON to stdout.",
  );
  process.exit(1);
}

function readInput(): unknown {
  const fileIdx = process.argv.indexOf("--file");
  if (fileIdx !== -1) {
    const path = process.argv[fileIdx + 1];
    if (!path) usage();
    return JSON.parse(readFileSync(resolve(path), "utf8"));
  }
  const text = readFileSync(0, "utf8").trim();
  if (!text) usage();
  return JSON.parse(text);
}

function writeOk(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function writeErr(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function main(): void {
  const command = process.argv[2] as DaemonCommand | undefined;
  if (!command || !COMMANDS.includes(command)) {
    usage();
  }

  const store: SessionStore = new Map();

  try {
    const input = readInput() as Record<string, unknown>;
    const result = dispatchCommand(command, input, store);
    writeOk(result);
  } catch (err) {
    writeErr(err instanceof Error ? err.message : String(err));
  }
}

main();

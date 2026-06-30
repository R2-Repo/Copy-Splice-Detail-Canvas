#!/usr/bin/env node
/**
 * Long-lived SDC eval daemon — NDJSON on stdin/stdout + optional HTTP.
 *   npm run sdc:daemon
 *   echo '{"id":"1","command":"ping","payload":{}}' | npm run sdc:daemon
 */
import "./register-env.ts";

import { createInterface } from "node:readline";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import {
  dispatchCommand,
  type DaemonCommand,
  type SessionStore,
} from "./handlers";

const DEFAULT_PORT = 18765;

export type DaemonRequest = {
  id: string;
  command: DaemonCommand;
  payload?: Record<string, unknown>;
};

export type DaemonResponse = {
  id: string;
  ok: boolean;
  error?: string;
} & Record<string, unknown>;

function daemonPort(): number {
  const raw = process.env.SDC_DAEMON_PORT;
  if (!raw) return DEFAULT_PORT;
  const port = Number.parseInt(raw, 10);
  return Number.isFinite(port) ? port : DEFAULT_PORT;
}

function httpEnabled(): boolean {
  return process.env.SDC_DAEMON_HTTP !== "0";
}

function processRequest(
  store: SessionStore,
  req: DaemonRequest,
): DaemonResponse {
  const { id, command, payload = {} } = req;
  if (!id) {
    return { id: id ?? "", ok: false, error: "Missing request id" };
  }
  if (!command) {
    return { id, ok: false, error: "Missing command" };
  }

  try {
    const result = dispatchCommand(command, payload, store);
    if (command === "shutdown") {
      setTimeout(() => process.exit(0), 10);
    }
    return { id, ...result };
  } catch (err) {
    return {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function writeNdjson(obj: unknown): void {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function startHttpServer(
  store: SessionStore,
  port: number,
): ReturnType<typeof createServer> {
  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      const ping = processRequest(store, { id: "health", command: "ping" });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ...ping, http: true, port }));
      return;
    }

    if (req.method === "POST") {
      try {
        const body = await readBody(req);
        const parsed = JSON.parse(body) as DaemonRequest;
        const response = processRequest(store, parsed);
        res.writeHead(response.ok ? 200 : 400, {
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify(response));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            id: "",
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Not found" }));
  });

  server.listen(port, "127.0.0.1");
  return server;
}

function startNdjsonLoop(store: SessionStore): void {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const req = JSON.parse(trimmed) as DaemonRequest;
      const response = processRequest(store, req);
      writeNdjson(response);
    } catch (err) {
      writeNdjson({
        id: "",
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  rl.on("close", () => {
    if (httpEnabled()) {
      return;
    }
    process.exit(0);
  });
}

export function main(): void {
  const store: SessionStore = new Map();
  const port = daemonPort();
  const http = httpEnabled();

  if (http) {
    startHttpServer(store, port);
    process.stderr.write(`sdc-eval daemon HTTP listening on 127.0.0.1:${port}\n`);
  }

  if (!http || process.stdin.isTTY) {
    process.stderr.write("sdc-eval daemon NDJSON ready on stdin/stdout\n");
    startNdjsonLoop(store);
  } else {
    process.stderr.write("sdc-eval daemon HTTP-only mode\n");
    process.stdin.resume();
  }

  process.on("SIGTERM", () => process.exit(0));
  process.on("SIGINT", () => process.exit(0));
}

main();

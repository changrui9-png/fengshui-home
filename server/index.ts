import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { handleAnalyze, publicHealth } from "../src/server/analyze";

loadEnvFile();

const port = Number(process.env.PORT ?? 8787);
const root = join(process.cwd(), "dist");
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, publicHealth(process.env));
    }
    if (req.method === "POST" && url.pathname === "/api/analyze") {
      const raw = await readBody(req, 7_000_000);
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return sendJson(res, 400, { analyzed: false, error: "bad-json", message: "请求不是 JSON。" });
      }
      const ip = req.socket.remoteAddress ?? "local";
      const result = await handleAnalyze(parsed as { consent?: unknown }, process.env, fetch, ip);
      return sendJson(res, result.status, result.body);
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      return sendJson(res, 405, { error: "method" });
    }
    serveStatic(url.pathname, req, res);
  } catch {
    sendJson(res, 500, { error: "server", message: "服务器暂时不能完成这个请求。" });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`fengshui-home listening on ${port}`);
});

function serveStatic(pathname: string, req: IncomingMessage, res: ServerResponse): void {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const file = normalize(join(root, requested));
  if (!file.startsWith(root) || !existsSync(file) || !existsSync(root)) {
    if (existsSync(join(root, "index.html"))) {
      res.writeHead(200, { "content-type": types[".html"], "cache-control": "no-store" });
      res.end(req.method === "HEAD" ? undefined : readFileSync(join(root, "index.html")));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("还没有构建前端。请先运行 npm run build。");
    return;
  }
  const ext = extname(file);
  res.writeHead(200, { "content-type": types[ext] ?? "application/octet-stream", "cache-control": "no-store" });
  res.end(req.method === "HEAD" ? undefined : readFileSync(file));
}

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function loadEnvFile(): void {
  const path = join(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

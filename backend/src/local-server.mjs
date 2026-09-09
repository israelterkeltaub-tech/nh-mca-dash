import http from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { handler as ingestHandler } from "./ingest-gmail.mjs";
import { handler as parseHandler } from "./parse-statement.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type"
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, { ...cors, "Content-Type": "application/json" });
  res.end(body);
}

function extractEvent(req, body) {
  return {
    body,
    path: req.url,
    httpMethod: req.method
  };
}

async function handleRoute(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      ...cors,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    });
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && req.url === "/api/gmail/normalize") {
    const raw = await readBody(req);
    const result = await ingestHandler(extractEvent(req, raw));
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    const status = parsed.statusCode || 500;
    const body = JSON.parse(parsed.body || "{}");
    sendJson(res, status, body);
    return;
  }

  if (req.method === "POST" && req.url === "/api/statements/parse") {
    const raw = await readBody(req);
    const result = await parseHandler(extractEvent(req, raw));
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    const status = parsed.statusCode || 500;
    const body = JSON.parse(parsed.body || "{}");
    sendJson(res, status, body);
    return;
  }

  // Optional static fallback for debugging.
  const filePath = path.join(__dirname, "..", "..", req.url.startsWith("/") ? req.url.slice(1) : req.url);
  if (req.method === "GET" && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === ".html" ? "text/html" : ext === ".css" ? "text/css" : "application/octet-stream";
    res.writeHead(200, { ...cors, "Content-Type": contentType });
    res.end(content);
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

const server = http.createServer((req, res) => {
  Promise.resolve(handleRoute(req, res)).catch(() => {
    sendJson(res, 500, { error: "Internal server error" });
  });
});

const PORT = Number(process.env.PORT || 3001);
server.listen(PORT, () => {
  console.log(`NH MCA Dash API running at http://localhost:${PORT}`);
});

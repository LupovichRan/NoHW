// Local dev server: static files + the same /api handlers Vercel runs. No dependencies.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
process.env.NOHW_STORE_FILE ??= path.join(root, ".family-store.json");
const api = { "/api/extract": await import("./api/extract.js"), "/api/family": await import("./api/family.js") };
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
const PORT = +process.env.PORT || 8787;

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const mod = api[url.pathname];
  if (mod) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const fn = mod[req.method];
    const r = fn ? await Promise.resolve().then(() => fn(request)).catch(() => new Response("error", { status: 500 })) : new Response("method", { status: 405 });
    res.writeHead(r.status, Object.fromEntries(r.headers));
    return res.end(Buffer.from(await r.arrayBuffer()));
  }
  let p = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
  const rel = p.slice(root.length).split(path.sep).filter(Boolean);
  if (!p.startsWith(root) || rel.some((x) => x.startsWith(".")) || ["api", "tests", "node_modules"].includes(rel[0]) || ["server.mjs", "package.json"].includes(rel[0])) { res.writeHead(404); return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream", "cache-control": "no-cache" });
  fs.createReadStream(p).pipe(res);
}).listen(PORT, () => console.log(`nohw v1 on http://localhost:${PORT}`));

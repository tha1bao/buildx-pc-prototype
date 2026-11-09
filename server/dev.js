// Máy chủ chạy tại máy để phát triển: phục vụ file tĩnh + /api/*, giống Vercel.
// Dùng: DATABASE_URL=postgres://... npm run dev   (mặc định cổng 3000)
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { handle } = require("./api");

// STATIC=dist: phục vụ bản đã đóng gói (npm run build) giống trên Vercel; mặc định dùng mã nguồn public/
const ROOT = path.join(__dirname, "..", process.env.STATIC === "dist" ? "dist" : "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json" };
const PUBLIC = new Set(["index.html", "app.css", "data.js", "engine.js", "app.js", "store.js", "admin.js", "api-client.js"]);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const m = url.pathname.match(/^\/api\/(auth|state|version|action)$/);
  if (m) return handle(m[1], req, res);
  const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const ok = process.env.STATIC === "dist" ? file === "index.html" || /^assets\/app\.[0-9a-f]{10}\.(js|css)$/.test(file) : PUBLIC.has(file);
  if (!ok) { res.statusCode = 404; return res.end("Not found"); }
  res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(path.join(ROOT, file)).pipe(res);
});

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  server.listen(port, () => console.log(`BuildX chạy tại http://localhost:${port}`));
}
module.exports = server;

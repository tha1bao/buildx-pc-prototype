// Đóng gói giao diện cho Vercel: gộp 6 file JS thành một, nén JS/CSS, đặt tên theo mã băm để trình duyệt
// lưu đệm lâu dài (đổi nội dung → đổi tên file). Kết quả ở dist/; chạy tại máy vẫn dùng public/ nguyên bản.
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const esbuild = require("esbuild");
const SRC = path.join(__dirname, "..", "public"), OUT = path.join(__dirname, "..", "dist");
const JS = ["data.js", "engine.js", "api-client.js", "app.js", "store.js", "admin.js"];
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 10);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "assets"), { recursive: true });
// nối theo đúng thứ tự nạp trong index.html (mỗi file đã tự bọc trong hàm riêng, không lộ biến chung)
const joined = JS.map((f) => `;/* ${f} */\n${fs.readFileSync(path.join(SRC, f), "utf8")}\n`).join("");
const js = esbuild.transformSync(joined, { minify: true, target: "es2019", charset: "utf8", legalComments: "none" }).code;
const css = esbuild.transformSync(fs.readFileSync(path.join(SRC, "app.css"), "utf8"), { loader: "css", minify: true, charset: "utf8" }).code;
const jsName = `assets/app.${hash(js)}.js`, cssName = `assets/app.${hash(css)}.css`;
fs.writeFileSync(path.join(OUT, jsName), js);
fs.writeFileSync(path.join(OUT, cssName), css);

let html = fs.readFileSync(path.join(SRC, "index.html"), "utf8");
html = html.replace('<link rel="stylesheet" href="app.css">', `<link rel="stylesheet" href="${cssName}">`);
html = html.replace(/(<script src="[^"]+"><\/script>\s*)+/, `<script src="${jsName}"></script>\n`);
if (!html.includes(jsName) || !html.includes(cssName)) throw new Error("Không thay được thẻ script/css trong index.html");
fs.writeFileSync(path.join(OUT, "index.html"), html);
// chép các file tĩnh khác (nếu có) giữ nguyên đường dẫn
for (const f of fs.readdirSync(SRC)) if (![...JS, "app.css", "index.html"].includes(f)) fs.cpSync(path.join(SRC, f), path.join(OUT, f), { recursive: true });
const kb = (n) => (n / 1024).toFixed(0) + " KB";
const raw = JS.reduce((t, f) => t + fs.statSync(path.join(SRC, f)).size, 0) + fs.statSync(path.join(SRC, "app.css")).size;
console.log(`dist/: ${jsName} ${kb(js.length)}, ${cssName} ${kb(css.length)} (gốc ${kb(raw)}; gzip JS ~${kb(require("zlib").gzipSync(js).length)})`);

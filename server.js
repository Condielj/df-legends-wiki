// Local launcher. Only the selected snapshot and the viewer assets are served.
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat, readdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { basename, dirname, extname, join, resolve } from "node:path";
import { groupExports } from "./importer.js";

const root = dirname(fileURLToPath(import.meta.url));
const assets = new Set([
  "index.html",
  "app.js",
  "icons.js",
  "demo.js",
  "style.css",
  "worker.js",
  "importer.js",
  "assets/fortress.svg",
  "assets/book.svg",
  "vendor/sax.mjs",
]);
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".xml": "application/xml",
};
const input = process.argv[2];
let selected = [];
if (input) {
  const target = resolve(input),
    name = basename(target),
    directory = dirname(target);
  if (!/\.xml$/i.test(name) || !(await stat(target)).isFile())
    throw new Error("Expected a Legends XML file path.");
  const siblings = (await readdir(directory, { withFileTypes: true })).filter(
    (entry) => entry.isFile(),
  );
  const group = groupExports(siblings).find((g) =>
    g.files.some((f) => f.name === name),
  );
  selected = (group?.files || [{ name }]).map((f) => join(directory, f.name));
}
const token = randomBytes(18).toString("hex");
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const route = url.pathname;
  if (
    !["GET", "HEAD"].includes(req.method) ||
    req.headers.host !== "127.0.0.1:" + server.address().port
  ) {
    res.writeHead(403).end();
    return;
  }
  let file;
  if (route === "/_export" || route.startsWith("/_export/")) {
    if (!selected.length || url.searchParams.get("key") !== token) {
      res.writeHead(404).end();
      return;
    }
    if (route === "/_export") {
      res
        .writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        })
        .end(JSON.stringify(selected.map((p) => basename(p))));
      return;
    }
    if (/^\/_export\/\d+$/.test(route)) file = selected[Number(route.slice(9))];
  } else {
    const relative = route === "/" ? "index.html" : route.slice(1);
    if (assets.has(relative)) file = join(root, relative);
  }
  if (!file) {
    res.writeHead(404).end();
    return;
  }
  try {
    const info = await stat(file);
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
      "Content-Length": info.size,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") res.end();
    else
      createReadStream(file)
        .on("error", () => res.destroy())
        .pipe(res);
  } catch {
    res.writeHead(404).end();
  }
});
server.on("error", (err) => {
  console.error(err.message);
  process.exitCode = 1;
});
server.listen(Number(process.env.PORT || 4173), "127.0.0.1", () => {
  const url =
    "http://127.0.0.1:" +
    server.address().port +
    "/" +
    (selected.length ? "?open=" + token : "");
  console.log("Open " + url);
  if (selected.length)
    console.log("Matched " + selected.map((p) => basename(p)).join(", "));
});

import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
const base = path.resolve("dist");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const filename = path.resolve(
      base,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!filename.startsWith(base + path.sep)) throw Error();
    const content = await readFile(filename);
    res.writeHead(200, {
      "Content-Type":
        mime[path.extname(filename)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(5173, "127.0.0.1", () =>
  console.log("Local: http://127.0.0.1:5173"),
);

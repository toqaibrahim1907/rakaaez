import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { handleCvExtraction } from "./api/worker-extraction.mjs";
try { process.loadEnvFile(".env.local"); } catch (error) { if (error.code !== "ENOENT") throw error; }
const base = path.resolve("dist");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
};
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (pathname === "/api/worker-extraction") return await handleCvExtraction(req, res);
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


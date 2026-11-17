import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "vendor") out.push(...(await walk(name)));
    } else out.push(name);
  }
  return out;
}
for (const file of await walk("web"))
  if (file.endsWith(".js")) {
    const r = spawnSync(process.execPath, ["--check", file], {
      encoding: "utf8",
    });
    if (r.status) throw new Error(r.stderr);
    const text = await readFile(file, "utf8");
    if (/sb_secret_|SUPABASE_SERVICE_ROLE_KEY|eyJhbGci/.test(text))
      throw Error("Unexpected privileged or JWT key in " + file);
  }
console.log("JavaScript syntax and frontend key checks passed.");

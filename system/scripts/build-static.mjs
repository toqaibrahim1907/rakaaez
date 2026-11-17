import {
  cp,
  mkdir,
  readFile,
  writeFile,
  lstat,
  rm,
  realpath,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(path.join(root, ".env.local"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const url = process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_PUBLISHABLE_KEY || "";
if (key && !key.startsWith("sb_publishable_"))
  throw new Error(
    "Use a Supabase publishable key. Privileged and legacy keys are rejected.",
  );
if (
  url &&
  !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) &&
  !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)
)
  throw new Error("Invalid Supabase project URL");
if (!url || !key)
  console.warn(
    "Supabase public configuration is missing: the build will display a setup screen.",
  );
await mkdir(path.join(root, "web/assets/vendor"), { recursive: true });
await cp(
  path.join(root, "node_modules/bootstrap/dist/css/bootstrap.rtl.min.css"),
  path.join(root, "web/assets/vendor/bootstrap.rtl.min.css"),
);
await cp(
  path.join(root, "node_modules/bootstrap/dist/js/bootstrap.bundle.min.js"),
  path.join(root, "web/assets/vendor/bootstrap.bundle.min.js"),
);
await cp(
  path.join(root, "node_modules/@supabase/supabase-js/dist/umd/supabase.js"),
  path.join(root, "web/assets/vendor/supabase.js"),
);
await writeFile(
  path.join(root, "web/public-config.js"),
  "globalThis.RENTAL_CONFIG=Object.freeze(" +
    JSON.stringify({
      supabaseUrl: url,
      supabasePublishableKey: key,
      appUrl: process.env.APP_URL || "",
    }).replaceAll("<", "\\u003c") +
    ");\n",
);
// Resolve and validate the exact disposable build target before removing it.
const output = path.join(await realpath(root), "dist");
if (
  path.dirname(output) !== (await realpath(root)) ||
  path.basename(output) !== "dist"
)
  throw new Error("Unsafe build directory");
try {
  if ((await lstat(output)).isSymbolicLink())
    throw new Error("Build directory must not be a link");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, "web"), path.join(root, "dist"), {
  recursive: true,
  filter: (source) => path.basename(source) !== "package.json",
});
const index = await readFile(path.join(root, "dist/index.html"), "utf8");
if (index.includes("service_role") || key.startsWith("sb_secret_"))
  throw new Error("Unsafe build");
console.log("Static application built in dist/");

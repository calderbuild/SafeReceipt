// Copies the client modules from wrapper/ into lib/. wrapper/ stays the source of
// truth: the repo's own scripts and the browser parity test keep importing it
// directly, and this package ships the same files.
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRAPPER = join(PKG, "..", "..", "wrapper");
const FILES = ["accountability.mjs", "canonicalize.mjs", "policy.mjs", "abi.mjs", "ledger.mjs", "deployments.json"];

const LIB = join(PKG, "lib");
rmSync(LIB, { recursive: true, force: true });
mkdirSync(LIB);
for (const f of FILES) copyFileSync(join(WRAPPER, f), join(LIB, f));
console.log(`copied ${FILES.length} files from wrapper/ to lib/`);

// Stranger acceptance test: do what /start tells a new developer to do, from outside the repo,
// and check the receipt in a real browser. Not part of CI: it spends testnet MON and writes a
// real receipt and a hosted trace.
//
//   node scripts/stranger-acceptance.mjs
//
// SITE   where the client sends traces and whose receipt page is printed (default production)
// PAGE   origin to open the receipt page on, if different (e.g. a local `npm run dev`)
// The wallet key is read from ~/.secrets/safereceipt-e2e.env (E2E_PRIVATE_KEY) and never printed.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = (process.env.SITE || "https://safereceipt.vercel.app").replace(/\/$/, "");
const PAGE = process.env.PAGE?.replace(/\/$/, "");
const PYTHON = process.env.PLAYWRIGHT_PYTHON || "/opt/homebrew/Caskroom/miniforge/base/bin/python";

const timings = [];
const started = Date.now();
async function phase(name, fn) {
  const t = Date.now();
  const out = await fn();
  timings.push([name, (Date.now() - t) / 1000]);
  console.log(`ok  ${name} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
  return out;
}
const run = (cmd, args, opts) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "inherit"], encoding: "utf8", ...opts });

// Fail before spending gas if SITE doesn't serve the hosted trace store.
await phase(`preflight: ${SITE} serves /api/traces`, async () => {
  const res = await fetch(`${SITE}/api/traces/monad/1.json`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    throw new Error(`${SITE}/api/traces answered HTTP ${res.status} ${type || "(no content type)"}; it doesn't run the hosted trace store yet`);
  }
});

const dir = mkdtempSync(join(tmpdir(), "safereceipt-stranger-"));
const agentDir = join(dir, "my-agent");
console.log(`scratch dir ${dir}`);

const tarball = await phase("npm pack the client", async () => {
  run("npm", ["pack", "--pack-destination", dir], { cwd: join(REPO, "packages/client") });
  return join(dir, readdirSync(dir).find((f) => f.endsWith(".tgz")));
});

await phase("install into an empty folder", async () => {
  run("mkdir", [agentDir]);
  run("npm", ["init", "-y"], { cwd: agentDir });
  run("npm", ["install", "--silent", "ethers", tarball], { cwd: agentDir });
  copyFileSync(join(agentDir, "node_modules/@safereceipt/client/examples/minimal-agent.mjs"), join(agentDir, "minimal-agent.mjs"));
});

await phase("write the wallet key to .env", async () => {
  const line = readFileSync(join(homedir(), ".secrets/safereceipt-e2e.env"), "utf8").match(/^E2E_PRIVATE_KEY=(.+)$/m);
  if (!line) throw new Error("E2E_PRIVATE_KEY missing from ~/.secrets/safereceipt-e2e.env");
  writeFileSync(join(agentDir, ".env"), `PRIVATE_KEY=${line[1].trim()}\n`, { mode: 0o600 });
});

const receiptPage = await phase("run the example agent for real", async () => {
  const res = spawnSync("node", ["minimal-agent.mjs"], {
    cwd: agentDir,
    encoding: "utf8",
    env: { ...process.env, SAFERECEIPT_SEND: "1", SAFERECEIPT_SITE_URL: SITE },
  });
  process.stdout.write(res.stdout.replace(/^/gm, "    "));
  if (res.status !== 0) throw new Error(`example agent failed:\n${res.stderr}`);
  const url = res.stdout.match(/open (\S+\/fleet\/receipt\/\d+)/)?.[1];
  if (!url) throw new Error("the example did not print a receipt page");
  return PAGE ? url.replace(SITE, PAGE) : url;
});

await phase(`verify in headless Chrome: ${receiptPage}`, async () => {
  const res = spawnSync(PYTHON, [join(REPO, "scripts/stranger_verify.py"), receiptPage], { encoding: "utf8" });
  process.stdout.write(res.stdout.replace(/^/gm, "    "));
  if (res.status !== 0) throw new Error(`browser verification did not read INTACT:\n${res.stderr}`);
});

console.log(`\nINTACT. Total ${((Date.now() - started) / 1000).toFixed(1)}s`);
for (const [name, s] of timings) console.log(`  ${s.toFixed(1).padStart(6)}s  ${name}`);

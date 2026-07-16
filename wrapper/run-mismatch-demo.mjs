import { ethers } from "ethers";
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import "dotenv/config";
import { DEPLOYMENTS } from "./abi.mjs";
import { AccountabilityClient } from "./accountability.mjs";
import { evaluatePolicy } from "./policy.mjs";
import { hashTrace } from "./canonicalize.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEDGER_DIR = process.env.LEDGER_DIR || "/tmp/accountability-ledger-init";
const LEDGER_RAW_TRACES = "https://raw.githubusercontent.com/calderbuild/accountability-ledger/master/traces";

/**
 * Demonstration of the MISMATCH path: an agent that oversteps its declared
 * scope. The detection is real -- the SCOPE_CREEP rule genuinely fires because
 * the recorded trace touches a resource outside declaredScope. This proves the
 * negative path lands as MISMATCH on-chain, which is the "rogue agent" beat in
 * the demo.
 */
async function main() {
  const network = process.env.NETWORK || "monad";
  const cfg = DEPLOYMENTS[network];
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env");

  const agents = JSON.parse(readFileSync(join(__dirname, `agents.${network}.json`), "utf8"));
  const agentId = agents["security-scanner"];

  const provider = new ethers.JsonRpcProvider(cfg.rpc);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const client = new AccountabilityClient({ network, signer, evidenceBaseURL: LEDGER_RAW_TRACES });

  const declaredIntent = {
    agent: "security-scanner",
    goal: "Scan only the docs/ directory for leaked secrets",
    declaredScope: ["docs/"],
    budgetMs: 60000,
  };
  console.log("== COMMIT ==");
  const { receiptId, txHash: commitTx } = await client.beginAction({ agentId, declaredIntent, riskScore: 20 });
  console.log(`  receipt #${receiptId}  ${cfg.explorer}/tx/${commitTx}`);

  // Agent oversteps: it also reads test/ (outside declaredScope). Real, recorded.
  console.log("\n== EXECUTE (agent oversteps scope) ==");
  client.emit("scan", "Scanning docs/", 40, { touched: ["docs/"] });
  client.emit("scan", "Also reading test/ (NOT in declared scope)", 80, { touched: ["test/"] });

  const policy = evaluatePolicy(client.buildTrace(null));
  console.log(`\n== POLICY ==\n  score ${policy.score}  verified ${policy.verified}  rules [${policy.rulesTriggered.join(", ")}]`);

  console.log("\n== REVEAL ==");
  const result = await client.endAction({ policyResult: policy });
  console.log(`  status ${result.status}  ${cfg.explorer}/tx/${result.txHash}`);

  const tracePath = join(LEDGER_DIR, "traces", `${receiptId}.json`);
  writeFileSync(tracePath, JSON.stringify(result.trace, null, 2) + "\n");
  execSync(
    `git -C "${LEDGER_DIR}" add traces/${receiptId}.json && ` +
    `git -C "${LEDGER_DIR}" -c user.name="calderbuild" -c user.email="johnrobertdestiny@gmail.com" ` +
    `commit -q -m "evidence: receipt #${receiptId} (security-scanner, ${result.status} -- scope creep)" && ` +
    `git -C "${LEDGER_DIR}" push -q origin master`,
    { encoding: "utf8" },
  );
  console.log(`  published trace -> ${result.evidenceURI}`);

  console.log("\n== INDEPENDENT VERIFY ==");
  let fetched = null;
  for (let attempt = 1; attempt <= 10 && !fetched; attempt++) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(`${result.evidenceURI}?t=${Date.now()}`);
    if (res.ok) fetched = await res.json();
    else console.log(`  waiting for raw CDN (attempt ${attempt}, HTTP ${res.status})`);
  }
  if (!fetched) throw new Error("evidence not reachable after retries");
  const recomputed = hashTrace(fetched);
  const onChain = (await client.contract.getReceipt(receiptId)).outcomeHash;
  const match = recomputed.toLowerCase() === onChain.toLowerCase();
  console.log(`  recomputed ${recomputed}`);
  console.log(`  on-chain   ${onChain}`);
  console.log(`  MATCH: ${match ? "YES" : "NO"}   |   on-chain status: ${result.status}`);
  if (!match) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });

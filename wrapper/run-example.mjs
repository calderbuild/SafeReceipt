import { ethers } from "ethers";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import "dotenv/config";
import { DEPLOYMENTS } from "./abi.mjs";
import { AccountabilityClient } from "./accountability.mjs";
import { evaluatePolicy } from "./policy.mjs";
import { hashTrace } from "./canonicalize.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Local clone of https://github.com/calderbuild/accountability-ledger
const LEDGER_DIR = process.env.LEDGER_DIR || "/tmp/accountability-ledger-init";
const LEDGER_RAW_TRACES = "https://raw.githubusercontent.com/calderbuild/accountability-ledger/master/traces";

async function main() {
  const network = process.env.NETWORK || "monad";
  const cfg = DEPLOYMENTS[network];
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env");

  const agents = JSON.parse(readFileSync(join(__dirname, `agents.${network}.json`), "utf8"));
  const agentId = agents["code-reviewer"];

  const provider = new ethers.JsonRpcProvider(cfg.rpc);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const client = new AccountabilityClient({ network, signer, evidenceBaseURL: LEDGER_RAW_TRACES });

  // --- 1. COMMIT: declare the intent on-chain BEFORE the agent acts ---
  const declaredIntent = {
    agent: "code-reviewer",
    goal: "Run the SafeReceipt V2 contract test suite and confirm all tests pass",
    declaredScope: ["test/", "contracts/"],
    budgetMs: 180000,
  };
  console.log("== COMMIT ==");
  const { receiptId, intentHash, txHash: commitTx } = await client.beginAction({
    agentId,
    declaredIntent,
    riskScore: 10,
  });
  console.log(`  receipt #${receiptId}  intentHash ${intentHash}`);
  console.log(`  ${cfg.explorer}/tx/${commitTx}`);

  // --- 2. EXECUTE: run the real action, capture the trace ---
  console.log("\n== EXECUTE ==");
  client.emit("start", "Invoking npm run test", 0, { touched: ["test/", "contracts/"] });
  let testOutput = "";
  let passed = false;
  try {
    testOutput = execSync("npm run test", {
      cwd: join(__dirname, ".."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    passed = /\d+ passing/.test(testOutput) && !/\d+ failing/.test(testOutput);
    const m = testOutput.match(/(\d+) passing/);
    client.emit("test-run", `Test suite completed: ${m ? m[1] : "?"} passing`, 80, {
      passing: m ? Number(m[1]) : null,
      touched: ["test/", "contracts/"],
    });
  } catch (err) {
    testOutput = (err.stdout || "") + (err.stderr || "");
    client.emit("error", "Test suite failed", 80, { error: true, touched: ["test/"] });
  }
  console.log(`  captured ${testOutput.length} bytes of output, passed=${passed}`);

  // --- 3. POLICY: score the trace against the declared intent ---
  const traceForPolicy = client.buildTrace(null);
  const policy = evaluatePolicy(traceForPolicy);
  // The action's own success (tests passed) AND policy compliance both required.
  policy.verified = policy.verified && passed;
  client.emit("policy", `Policy score ${policy.score} (${policy.riskLevel})`, 100, {
    rulesTriggered: policy.rulesTriggered,
  });
  console.log(`\n== POLICY ==\n  score ${policy.score}  verified ${policy.verified}  rules [${policy.rulesTriggered.join(", ")}]`);

  // --- 4. REVEAL: hash trace, link outcome on-chain ---
  console.log("\n== REVEAL ==");
  const result = await client.endAction({ policyResult: policy });
  console.log(`  outcomeHash ${result.outcomeHash}`);
  console.log(`  status ${result.status}  ${cfg.explorer}/tx/${result.txHash}`);
  console.log(`  evidenceURI ${result.evidenceURI}`);

  // --- 5. PUBLISH the trace pre-image to the public ledger ---
  const tracePath = join(LEDGER_DIR, "traces", `${receiptId}.json`);
  writeFileSync(tracePath, JSON.stringify(result.trace, null, 2) + "\n");
  execSync(
    `git -C "${LEDGER_DIR}" add traces/${receiptId}.json && ` +
    `git -C "${LEDGER_DIR}" -c user.name="calderbuild" -c user.email="johnrobertdestiny@gmail.com" ` +
    `commit -q -m "evidence: receipt #${receiptId} (code-reviewer, ${result.status})" && ` +
    `git -C "${LEDGER_DIR}" push -q origin master`,
    { encoding: "utf8" },
  );
  console.log(`  published trace -> ${result.evidenceURI}`);

  // --- 6. INDEPENDENT VERIFICATION (what a judge / third party does) ---
  console.log("\n== INDEPENDENT VERIFY ==");
  // Re-fetch the published JSON from GitHub (not from local state) and recompute.
  let fetched = null;
  for (let attempt = 1; attempt <= 10 && !fetched; attempt++) {
    await new Promise((r) => setTimeout(r, 3000)); // allow GitHub raw CDN to update
    const res = await fetch(`${result.evidenceURI}?t=${Date.now()}`);
    if (res.ok) {
      fetched = await res.json();
    } else {
      console.log(`  waiting for raw CDN (attempt ${attempt}, HTTP ${res.status})`);
    }
  }
  if (!fetched) throw new Error("evidence not reachable after retries");
  const recomputed = hashTrace(fetched);
  const onChain = (await client.contract.getReceipt(receiptId)).outcomeHash;
  const match = recomputed.toLowerCase() === onChain.toLowerCase();
  console.log(`  re-fetched ${result.evidenceURI}`);
  console.log(`  recomputed  ${recomputed}`);
  console.log(`  on-chain    ${onChain}`);
  console.log(`  MATCH: ${match ? "YES -- trace is provably the one committed on-chain" : "NO -- tampered"}`);

  if (!match) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });

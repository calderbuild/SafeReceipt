import { ethers } from "ethers";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { DEPLOYMENTS } from "./abi.mjs";
import { AccountabilityClient } from "./accountability.mjs";
import { evaluatePolicy } from "./policy.mjs";
import { LEDGER_RAW_TRACES, ledgerPublisher, verifyAgainstChain } from "./ledger.mjs";
const HERE = dirname(fileURLToPath(import.meta.url)); // Node 18 has no import.meta.dirname

/**
 * Happy path: the wrapper itself runs the contract test suite (a plain
 * `npm run test`, not an LLM) under the code-reviewer agent identity.
 */
async function main() {
  const network = process.env.NETWORK || "monad";
  const cfg = DEPLOYMENTS[network];
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env");

  const agents = JSON.parse(readFileSync(join(HERE, `agents.${network}.json`), "utf8"));
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, new ethers.JsonRpcProvider(cfg.rpc));
  const client = new AccountabilityClient({ network, signer, evidenceBaseURL: LEDGER_RAW_TRACES });
  const publish = ledgerPublisher("code-reviewer"); // fails fast if the ledger clone is missing

  // 1. COMMIT: declare the intent on-chain before acting
  const declaredIntent = {
    agent: "code-reviewer",
    goal: "Run the SafeReceipt contract test suite and confirm all tests pass",
    declaredScope: ["test/", "contracts/"],
    budgetMs: 180000,
  };
  console.log("== COMMIT ==");
  const { receiptId, intentHash, txHash: commitTx } = await client.beginAction({
    agentId: agents["code-reviewer"],
    declaredIntent,
    riskScore: 10,
  });
  console.log(`  receipt #${receiptId}  intentHash ${intentHash}`);
  console.log(`  ${cfg.explorer}/tx/${commitTx}`);

  // 2. EXECUTE: run the real test suite, record what happened
  console.log("\n== EXECUTE ==");
  client.emit("start", "Invoking npm run test", 0, { touched: ["test/", "contracts/"] });
  let output = "";
  try {
    output = execSync("npm run test", { cwd: join(HERE, ".."), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    output = (err.stdout || "") + (err.stderr || "");
  }
  const passing = Number(output.match(/(\d+) passing/)?.[1] ?? 0);
  const failing = Number(output.match(/(\d+) failing/)?.[1] ?? 0);
  if (passing > 0 && failing === 0) {
    client.emit("test-run", `Test suite completed: ${passing} passing`, 80, { passing, touched: ["test/", "contracts/"] });
  } else {
    client.emit("error", `Test suite failed: ${passing} passing, ${failing} failing`, 80, { error: true, passing, failing });
  }
  console.log(`  ${passing} passing, ${failing} failing`);

  // 3. POLICY: a failed run fires ERROR_STAGE, so policy.verified covers both
  const policy = evaluatePolicy(client.buildTrace(null));
  client.emit("policy", `Policy score ${policy.score} (${policy.riskLevel})`, 100, { rulesTriggered: policy.rulesTriggered });
  console.log(`\n== POLICY ==\n  score ${policy.score}  verified ${policy.verified}  rules [${policy.rulesTriggered.join(", ")}]`);

  // 4. PUBLISH + REVEAL
  console.log("\n== PUBLISH + REVEAL ==");
  const result = await client.endAction({ policyResult: policy, publish });
  console.log(`  outcomeHash ${result.outcomeHash}`);
  console.log(`  status ${result.status}  ${cfg.explorer}/tx/${result.txHash}`);

  // 5. INDEPENDENT VERIFY (what a third party does)
  console.log("\n== INDEPENDENT VERIFY ==");
  if (!(await verifyAgainstChain(client, receiptId, result.evidenceURI))) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });

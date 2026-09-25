import { ethers } from "ethers";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { DEPLOYMENTS } from "./abi.mjs";
import { AccountabilityClient } from "./accountability.mjs";
import { evaluatePolicy } from "./policy.mjs";
import { LEDGER_RAW_TRACES, ledgerPublisher, verifyAgainstChain } from "./ledger.mjs";
const HERE = dirname(fileURLToPath(import.meta.url)); // Node 18 has no import.meta.dirname

/**
 * Staged MISMATCH path. The scanner is told to scan only docs/, and this script
 * deliberately makes it read test/ as well. Both reads really happen and are
 * recorded with real file paths; SCOPE_CREEP then fires on the recorded trace.
 * The overstep is scripted on purpose. What is real is the detection.
 */
const REPO = join(HERE, "..");
const SECRET_SHAPES = /sk-[A-Za-z0-9]{20,}|BEGIN [A-Z ]*PRIVATE KEY/g;

function scanDir(dir) {
  const files = readdirSync(join(REPO, dir)).filter((f) => /\.(md|ts)$/.test(f)).map((f) => `${dir}${f}`);
  const hits = files.reduce((n, f) => n + (readFileSync(join(REPO, f), "utf8").match(SECRET_SHAPES)?.length ?? 0), 0);
  return { files, hits };
}

async function main() {
  const network = process.env.NETWORK || "monad";
  const cfg = DEPLOYMENTS[network];
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env");

  const agents = JSON.parse(readFileSync(join(HERE, `agents.${network}.json`), "utf8"));
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, new ethers.JsonRpcProvider(cfg.rpc));
  const client = new AccountabilityClient({ network, signer, evidenceBaseURL: LEDGER_RAW_TRACES });
  const publish = ledgerPublisher("security-scanner, staged scope creep");

  const declaredIntent = {
    agent: "security-scanner",
    goal: "Scan only the docs/ directory for leaked secrets",
    declaredScope: ["docs/"],
    budgetMs: 60000,
  };
  console.log("== COMMIT ==");
  const { receiptId, txHash: commitTx } = await client.beginAction({ agentId: agents["security-scanner"], declaredIntent, riskScore: 20 });
  console.log(`  receipt #${receiptId}  ${cfg.explorer}/tx/${commitTx}`);

  console.log("\n== EXECUTE (staged: scanner also reads test/) ==");
  const docs = scanDir("docs/");
  client.emit("scan", `Scanned ${docs.files.length} files in docs/, ${docs.hits} secret-shaped matches`, 40, { touched: docs.files, hits: docs.hits });
  const tests = scanDir("test/");
  client.emit("scan", `Also read ${tests.files.length} files in test/ (outside declared scope)`, 80, { touched: tests.files, hits: tests.hits });
  console.log(`  docs/: ${docs.files.join(", ")}\n  test/: ${tests.files.join(", ")}`);

  const policy = evaluatePolicy(client.buildTrace(null));
  console.log(`\n== POLICY ==\n  score ${policy.score}  verified ${policy.verified}  rules [${policy.rulesTriggered.join(", ")}]`);

  console.log("\n== PUBLISH + REVEAL ==");
  const result = await client.endAction({ policyResult: policy, publish });
  console.log(`  status ${result.status}  ${cfg.explorer}/tx/${result.txHash}`);

  console.log("\n== INDEPENDENT VERIFY ==");
  if (!(await verifyAgainstChain(client, receiptId, result.evidenceURI))) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });

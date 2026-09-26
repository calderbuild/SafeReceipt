import { ethers } from "ethers";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { DEPLOYMENTS } from "./abi.mjs";
import { AccountabilityClient } from "./accountability.mjs";
import { evaluatePolicy } from "./policy.mjs";
import { LEDGER_RAW_TRACES, ledgerPublisher, verifyAgainstChain } from "./ledger.mjs";
const HERE = dirname(fileURLToPath(import.meta.url)); // Node 18 has no import.meta.dirname

const MODEL = "deepseek-flash";
const FILE = "contracts/DemoUSD.sol";
const sha256 = (s) => "0x" + createHash("sha256").update(s).digest("hex");

/**
 * A real LLM run: the code-reviewer agent asks DeepSeek to review one
 * contract file. The model's full answer goes into the published trace.
 * DEEPSEEK_API_KEY comes from the environment and is never logged.
 */
async function main() {
  const network = process.env.NETWORK || "monad";
  const cfg = DEPLOYMENTS[network];
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env");
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY not set");

  const agents = JSON.parse(readFileSync(join(HERE, `agents.${network}.json`), "utf8"));
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, new ethers.JsonRpcProvider(cfg.rpc));
  const client = new AccountabilityClient({ network, signer, evidenceBaseURL: LEDGER_RAW_TRACES });
  const publish = ledgerPublisher("code-reviewer");

  const declaredIntent = {
    agent: "code-reviewer",
    goal: `Review ${FILE} for security issues with a language model and report findings`,
    declaredScope: [FILE],
    model: MODEL,
    budgetMs: 120000,
  };
  console.log("== COMMIT ==");
  const { receiptId, txHash: commitTx } = await client.beginAction({
    agentId: agents["code-reviewer"],
    declaredIntent,
    riskScore: 10,
  });
  console.log(`  receipt #${receiptId}  ${cfg.explorer}/tx/${commitTx}`);

  console.log("\n== EXECUTE ==");
  const source = readFileSync(join(HERE, "..", FILE), "utf8");
  client.emit("read", `Read ${FILE}`, 10, { touched: [FILE], sha256: sha256(source) });

  const system = "You are a smart-contract security reviewer. List concrete findings for the Solidity file you are given, most severe first, each with severity and one sentence of reasoning. If it is intentionally a test token, say which properties would be unsafe in production. Be brief.";
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `File: ${FILE}\n\n${source}` },
      ],
      reasoning_effort: "low",
      max_tokens: 3000,
      temperature: 0.2,
    }),
  });
  const data = await res.json();
  const review = data.choices?.[0]?.message?.content;
  if (!res.ok || !review) {
    client.emit("error", `Model call failed with status ${res.status}`, 60, { error: true, status: res.status });
  } else {
    client.emit("model", `${MODEL} returned a review (${review.length} chars)`, 80, {
      model: MODEL,
      promptSha256: sha256(system + source),
      usage: data.usage ?? null,
      review,
    });
    console.log(review.split("\n").slice(0, 6).join("\n"), "\n  ...");
  }

  const policy = evaluatePolicy(client.buildTrace(null));
  client.emit("policy", `Policy score ${policy.score} (${policy.riskLevel})`, 100, { rulesTriggered: policy.rulesTriggered });
  console.log(`\n== POLICY ==\n  score ${policy.score}  verified ${policy.verified}`);

  console.log("\n== PUBLISH + REVEAL ==");
  const result = await client.endAction({ policyResult: policy, publish });
  console.log(`  status ${result.status}  ${cfg.explorer}/tx/${result.txHash}`);

  console.log("\n== INDEPENDENT VERIFY ==");
  if (!(await verifyAgainstChain(client, receiptId, result.evidenceURI))) process.exit(1);
}

main().catch((e) => { console.error(e.message); process.exit(1); });

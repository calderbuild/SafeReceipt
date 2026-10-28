import { ethers } from "ethers";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEPLOYMENTS } from "./abi.mjs";
import { AccountabilityClient } from "./accountability.mjs";
import { registerAgent, receiptURL } from "./hosted.mjs";
import { evaluatePolicy } from "./policy.mjs";
import { verifyAgainstChain } from "./ledger.mjs";
const HERE = dirname(fileURLToPath(import.meta.url)); // Node 18 has no import.meta.dirname

const MODEL = "deepseek-flash";
const FILE = process.env.REVIEW_FILE || "contracts/AgentIdentityRegistry.sol";
const AGENT = process.env.AGENT_NAME || "identity-reviewer";
const sha256 = (s) => "0x" + createHash("sha256").update(s).digest("hex");

/**
 * One real review run from a participant wallet: registers an agent (unless AGENT_ID is set),
 * files a receipt, asks DeepSeek to review FILE, uploads the trace to the hosted store and links it.
 * PRIVATE_KEY and DEEPSEEK_API_KEY come from the environment and are never logged.
 * max_tokens is 8000: at 3000 the reasoning used the whole budget and the answer came back empty.
 */
async function main() {
  const network = process.env.NETWORK || "bot";
  const cfg = DEPLOYMENTS[network];
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY not set");
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY not set");

  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, new ethers.JsonRpcProvider(cfg.rpc));
  console.log(`wallet ${signer.address} on ${network}`);

  let agentId = Number(process.env.AGENT_ID);
  if (!agentId) {
    const reg = await registerAgent(signer, { name: AGENT, role: `Reviews ${FILE} with a language model`, model: MODEL }, { network });
    agentId = reg.agentId;
    console.log(`registered agent #${agentId}  ${cfg.explorer}/tx/${reg.txHash}`);
  }

  const client = new AccountabilityClient({ network, signer });
  const declaredIntent = {
    agent: AGENT,
    goal: `Review ${FILE} for security issues with a language model and report findings`,
    declaredScope: [FILE],
    model: MODEL,
    budgetMs: 240000,
  };
  console.log("== COMMIT ==");
  const { receiptId, txHash: commitTx } = await client.beginAction({ agentId, declaredIntent, riskScore: 10 });
  console.log(`  receipt #${receiptId}  ${cfg.explorer}/tx/${commitTx}`);

  console.log("\n== EXECUTE ==");
  const source = readFileSync(join(HERE, "..", FILE), "utf8");
  client.emit("read", `Read ${FILE}`, 10, { touched: [FILE], sha256: sha256(source) });

  const system = "You are a smart-contract security reviewer. List concrete findings for the Solidity file you are given, most severe first, each with severity and one sentence of reasoning. Be brief.";
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
      max_tokens: 8000,
      temperature: 0.2,
    }),
  });
  const data = await res.json();
  const review = data.choices?.[0]?.message?.content;
  if (!res.ok || !review) {
    client.emit("error", `Model call failed with status ${res.status}`, 60, { error: true, status: res.status, finishReason: data.choices?.[0]?.finish_reason ?? null });
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
  const result = await client.endAction({ policyResult: policy });
  console.log(`  status ${result.status}  ${cfg.explorer}/tx/${result.txHash}`);
  console.log(`  trace ${result.evidenceURI}`);

  console.log("\n== INDEPENDENT VERIFY ==");
  if (!(await verifyAgainstChain(client, receiptId, result.evidenceURI))) process.exit(1);
  console.log(`  ${receiptURL(receiptId, network)}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });

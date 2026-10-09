// Minimal agent wrapped in a SafeReceipt. Dry by default: it builds the intent
// and the trace and prints what it would commit. Set SAFERECEIPT_SEND=1 (plus
// PRIVATE_KEY, AGENT_ID and EVIDENCE_BASE_URL) to send real transactions; then
// publish() below must actually upload the trace to EVIDENCE_BASE_URL.
import { ethers } from "ethers";
import { AccountabilityClient, DEPLOYMENTS, evaluatePolicy, hashIntent, hashTrace } from "@safereceipt/client";

const declaredIntent = {
  agent: "minimal-agent",
  goal: "Summarize docs/ for a new reader",
  declaredScope: ["docs/"],
  budgetMs: 60000,
};

// The agent's actual work. Each step reports what it touched.
function work(client) {
  client.emit("read", "Read docs/guide.md", 40, { touched: ["docs/guide.md"] });
  client.emit("summarize", "Wrote a three-line summary", 90, { summary: "..." });
}

if (process.env.SAFERECEIPT_SEND !== "1") {
  console.log(`dry run: monad ActionRegistry ${DEPLOYMENTS.monad.actionRegistry}`);
  console.log("would commit intentHash", hashIntent(declaredIntent));

  // A client without a signer records events; nothing is sent.
  const client = new AccountabilityClient({ network: "monad", signer: null, evidenceBaseURL: "https://example.invalid/traces" });
  work(client);
  const policy = evaluatePolicy({ declaredIntent, events: client.events, durationMs: 0 });
  console.log("policy", JSON.stringify(policy));
  console.log("trace events hash", hashTrace({ declaredIntent, events: client.events }));
  console.log("set SAFERECEIPT_SEND=1 to send it");
} else {
  for (const k of ["PRIVATE_KEY", "AGENT_ID", "EVIDENCE_BASE_URL"]) if (!process.env[k]) throw new Error(`${k} not set`);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, new ethers.JsonRpcProvider(DEPLOYMENTS.monad.rpc));
  const client = new AccountabilityClient({ network: "monad", signer, evidenceBaseURL: process.env.EVIDENCE_BASE_URL });

  const { receiptId } = await client.beginAction({ agentId: Number(process.env.AGENT_ID), declaredIntent, riskScore: 10 });
  work(client);
  const policy = evaluatePolicy(client.buildTrace(null));
  const result = await client.endAction({
    policyResult: policy,
    publish: async (trace, id) => {
      // Upload `trace` so it is readable at `${EVIDENCE_BASE_URL}/${id}.json` before returning.
      throw new Error(`implement publish() for receipt #${id} (${JSON.stringify(trace).length} bytes)`);
    },
  });
  console.log(`receipt #${receiptId}: ${result.status}`);
}

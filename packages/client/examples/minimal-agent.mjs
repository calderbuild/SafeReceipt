// Minimal agent wrapped in a SafeReceipt, start to finish.
//
//   node minimal-agent.mjs                                   dry run: prints what it would commit
//   SAFERECEIPT_SEND=1 PRIVATE_KEY=0x... node minimal-agent.mjs
//                                                            registers an agent (unless AGENT_ID is set),
//                                                            files a receipt on Monad testnet, uploads the
//                                                            trace to SafeReceipt's hosted store, links it
//
// The wallet needs a little testnet MON for gas (https://faucet.monad.xyz).
import { ethers } from "ethers";
import {
  AccountabilityClient,
  DEPLOYMENTS,
  evaluatePolicy,
  hashIntent,
  hashTrace,
  registerAgent,
  verifyAgainstChain,
} from "@safereceipt/client";

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
  const client = new AccountabilityClient({ network: "monad", signer: null });
  work(client);
  const policy = evaluatePolicy({ declaredIntent, events: client.events, durationMs: 0 });
  console.log("policy", JSON.stringify(policy));
  console.log("trace events hash", hashTrace({ declaredIntent, events: client.events }));
  console.log("traces would be hosted at", client.evidenceBaseURL);
  console.log("set SAFERECEIPT_SEND=1 and PRIVATE_KEY to send it");
} else {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY not set");
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, new ethers.JsonRpcProvider(DEPLOYMENTS.monad.rpc));

  let agentId = Number(process.env.AGENT_ID);
  if (!agentId) {
    ({ agentId } = await registerAgent(signer, { name: "minimal-agent", role: "Summarizes docs", model: "none" }));
    console.log(`registered agent #${agentId} (set AGENT_ID=${agentId} to reuse it)`);
  }

  // No evidenceBaseURL: the trace goes to SafeReceipt's hosted store.
  const client = new AccountabilityClient({ network: "monad", signer });
  const { receiptId } = await client.beginAction({ agentId, declaredIntent, riskScore: 10 });
  console.log(`receipt #${receiptId} opened`);
  work(client);
  const policy = evaluatePolicy(client.buildTrace(null));
  const result = await client.endAction({ policyResult: policy });
  console.log(`receipt #${receiptId}: ${result.status}, trace at ${result.evidenceURI}`);

  await verifyAgainstChain(client, receiptId, result.evidenceURI);
  console.log("see it, and verify it yourself, at https://safereceipt.vercel.app/fleet");
}

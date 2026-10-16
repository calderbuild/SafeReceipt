// Minimal agent wrapped in a SafeReceipt, start to finish.
//
//   node minimal-agent.mjs                      dry run: prints what it would commit, sends nothing
//   SAFERECEIPT_SEND=1 node minimal-agent.mjs   registers an agent (unless AGENT_ID is set), files a
//                                               receipt on Monad testnet, uploads the trace to
//                                               SafeReceipt's hosted store, links it, checks it the
//                                               way a stranger would, and prints the receipt's page
//
// EXAMPLE picks one of the two edge cases the contract allows on purpose:
//   EXAMPLE=anonymous   files the receipt under agent id 0: no registered agent stands behind it
//   EXAMPLE=revoked     registers a fresh agent, opens the receipt, revokes the agent, then links the
//                       outcome anyway (linking does not recheck revocation)
// The verifier labels both; neither fails a check.
//
// PRIVATE_KEY comes from the environment or from a .env file in this directory. The wallet
// needs a little testnet MON for gas (https://faucet.monad.xyz).
import { existsSync, readFileSync } from "node:fs";
import { ethers } from "ethers";
import {
  AccountabilityClient,
  AGENT_IDENTITY_ABI,
  DEPLOYMENTS,
  evaluatePolicy,
  hashIntent,
  hashTrace,
  receiptURL,
  registerAgent,
  verifyReceipt,
} from "@safereceipt/client";

// Node 18 has no --env-file; read KEY=value lines ourselves.
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}

const EXAMPLE = process.env.EXAMPLE ?? "";
if (!["", "anonymous", "revoked"].includes(EXAMPLE)) throw new Error(`EXAMPLE must be anonymous or revoked, got ${EXAMPLE}`);

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
  console.log("meanwhile, check a live receipt the way a stranger would: npx safereceipt-verify 3 --network monad");
} else {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY not set (environment or .env)");
  const provider = new ethers.JsonRpcProvider(DEPLOYMENTS.monad.rpc);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const balance = await provider.getBalance(signer.address);
  if (balance === 0n) throw new Error(`${signer.address} has no testnet MON; get some at https://faucet.monad.xyz`);

  // The revoked example always registers its own agent, so it never revokes one you reuse.
  let agentId;
  if (EXAMPLE === "anonymous") {
    agentId = 0;
  } else if (EXAMPLE === "" && process.env.AGENT_ID) {
    agentId = Number(process.env.AGENT_ID);
  } else {
    ({ agentId } = await registerAgent(signer, { name: "minimal-agent", role: "Summarizes docs", model: "none" }));
    console.log(`registered agent #${agentId}${EXAMPLE ? "" : ` (set AGENT_ID=${agentId} to reuse it)`}`);
  }

  // No evidenceBaseURL: the trace goes to SafeReceipt's hosted store.
  const client = new AccountabilityClient({ network: "monad", signer });
  const { receiptId } = await client.beginAction({ agentId, declaredIntent, riskScore: 10 });
  console.log(`receipt #${receiptId} opened`);
  work(client);
  if (EXAMPLE === "revoked") {
    const identity = new ethers.Contract(DEPLOYMENTS.monad.agentIdentityRegistry, AGENT_IDENTITY_ABI, signer);
    await (await identity.revokeAgent(agentId)).wait();
    console.log(`agent #${agentId} revoked before the outcome is linked`);
  }
  const policy = evaluatePolicy(client.buildTrace(null));
  const result = await client.endAction({ policyResult: policy });
  console.log(`receipt #${receiptId}: ${result.status}, trace at ${result.evidenceURI}`);

  // What anyone else can run: npx safereceipt-verify <receiptId> --network monad
  const check = await verifyReceipt({ network: "monad", receiptId });
  for (const c of check.checks) console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.label}`);
  for (const n of check.notes) console.log(`  NOTE  ${n.text}`);
  console.log(`\nopen ${receiptURL(receiptId)} and press Verify independently`);
}

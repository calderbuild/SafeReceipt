import { ethers } from "ethers";
import "dotenv/config";
import { AGENT_IDENTITY_ABI, DEPLOYMENTS } from "./abi.mjs";
import { AccountabilityClient } from "./accountability.mjs";
import { registerAgent } from "./hosted.mjs";
import { evaluatePolicy } from "./policy.mjs";
import { LEDGER_RAW_TRACES, ledgerPublisher } from "./ledger.mjs";

// Validation set for a fresh V2.1 deployment: a normal receipt, an anonymous receipt (agent 0)
// and an outcome linked after the agent was revoked. Evidence goes to the public ledger repo.
//   NETWORK=bot LEDGER_DIR=... DOTENV_CONFIG_PATH=~/.secrets/botchain-mainnet.env node wrapper/run-validation.mjs
const network = process.env.NETWORK;
const cfg = DEPLOYMENTS[network];
if (!cfg?.actionRegistry) throw new Error(`NETWORK must name a deployed network, got ${network}`);
const key = process.env.PRIVATE_KEY?.trim();
if (!key) throw new Error("PRIVATE_KEY not set");
const signer = new ethers.Wallet(key.startsWith("0x") ? key : `0x${key}`, new ethers.JsonRpcProvider(cfg.rpc));
const identity = new ethers.Contract(cfg.agentIdentityRegistry, AGENT_IDENTITY_ABI, signer);
const publish = ledgerPublisher("validation");

async function run(label, agentId, { revokeBeforeLink = false } = {}) {
  const client = new AccountabilityClient({ network, signer, evidenceBaseURL: LEDGER_RAW_TRACES });
  const declaredIntent = { agent: "validation-agent", goal: `Validation set: ${label}`, declaredScope: ["docs/"], budgetMs: 60000 };
  const begin = await client.beginAction({ agentId, declaredIntent, riskScore: 10 });
  console.log(`[${label}] receipt #${begin.receiptId} opened (agent ${agentId}) tx ${begin.txHash}`);
  client.emit("read", "Read docs/guide.md", 40, { touched: ["docs/guide.md"] });
  client.emit("summarize", "Wrote a three-line summary", 90, { summary: "..." });
  if (revokeBeforeLink) {
    const tx = await identity.revokeAgent(agentId);
    await tx.wait();
    console.log(`[${label}] agent ${agentId} revoked tx ${tx.hash}`);
  }
  const result = await client.endAction({ policyResult: evaluatePolicy(client.buildTrace(null)), publish });
  console.log(`[${label}] receipt #${begin.receiptId} ${result.status} link tx ${result.txHash}`);
  return begin.receiptId;
}

const bal = await signer.provider.getBalance(signer.address);
console.log(`${network}: signer ${signer.address} balance ${ethers.formatEther(bal)}`);
const meta = (name) => ({ name, role: "Validation of a fresh deployment", model: "none" });
const a = await registerAgent(signer, meta("validation-agent"), { network });
console.log(`registered agent #${a.agentId} tx ${a.txHash}`);
const normal = await run("normal", a.agentId);
const anonymous = await run("anonymous", 0);
const r = await registerAgent(signer, meta("validation-agent-revoked"), { network });
console.log(`registered agent #${r.agentId} tx ${r.txHash}`);
const revoked = await run("revoked-before-link", r.agentId, { revokeBeforeLink: true });
console.log(`receipts: normal #${normal}, anonymous #${anonymous}, revoked-before-link #${revoked}`);

import { ethers } from "ethers";
import { ACTION_REGISTRY_ABI, ACTION_TYPE, AGENT_IDENTITY_ABI, DEPLOYMENTS, STATUS } from "./abi.mjs";
import { hashIntent, hashTrace } from "./canonicalize.mjs";
import { evaluatePolicy } from "./policy.mjs";

/**
 * The checks a third party runs on an off-chain receipt, without trusting the agent,
 * its operator or the SafeReceipt site. Same comparisons as the Verify button on
 * /fleet (frontend/src/lib/v2.ts checkTrace).
 *
 * `checks` must all pass for the published trace to be the one committed on-chain.
 * `notes` are facts about the receipt that limit what it says (anonymous filer,
 * revoked agent, changed owner, who wrote the status); they never fail a check.
 *
 * receipt: { id, actor, agentId, chainId, status, intentHash, outcomeHash }
 * agent:   null for agentId 0, else { owner, revoked } read now
 */
export function checkReceipt(receipt, trace, agent) {
  const recomputedOutcome = hashTrace(trace);
  const recomputedIntent = hashIntent(trace.declaredIntent ?? {});
  const policy = evaluatePolicy(trace);
  const policyStatus = policy.verified ? "VERIFIED" : "MISMATCH";
  const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

  const checks = [
    {
      id: "OUTCOME_HASH",
      ok: same(recomputedOutcome, receipt.outcomeHash),
      label: "Published trace hashes to the outcome hash stored on-chain",
      detail: { recomputed: recomputedOutcome, onChain: receipt.outcomeHash },
    },
    {
      id: "INTENT_HASH",
      ok: same(recomputedIntent, receipt.intentHash),
      label: "Declared intent in the trace hashes to the intent committed before the run",
      detail: { recomputed: recomputedIntent, onChain: receipt.intentHash },
    },
    {
      id: "IDS",
      ok: Number(trace.receiptId) === receipt.id && Number(trace.agentId) === receipt.agentId && Number(trace.chainId) === receipt.chainId,
      label: "Trace names this receipt, agent and chain (a trace copied from another receipt fails here)",
      detail: { trace: { receiptId: trace.receiptId, agentId: trace.agentId, chainId: trace.chainId } },
    },
    {
      id: "POLICY",
      ok: policyStatus === receipt.status,
      label: `Policy rules re-run here give ${policyStatus}, recorded status is ${receipt.status}`,
      detail: { rulesTriggered: policy.rulesTriggered },
    },
  ];

  const notes = [
    {
      id: "STATUS_IS_A_CLAIM",
      text: `${receipt.status} was written by the filer. The POLICY check re-ran the rules on the published trace; neither proves the trace is a complete account of what the agent did.`,
    },
  ];
  if (agent === null) {
    notes.push({
      id: "ANONYMOUS",
      text: "Agent id 0: no registered agent. Any wallet can open such a receipt, so it says nothing about which agent did the work.",
    });
  } else {
    if (agent.revoked) {
      notes.push({
        id: "AGENT_REVOKED",
        text: `Agent #${receipt.agentId} is revoked now. The contract refuses new receipts for a revoked agent, so this one was opened before the revocation, but linking an outcome does not recheck it: the outcome may have been linked after the agent was revoked.`,
      });
    }
    if (!same(agent.owner, receipt.actor)) {
      notes.push({
        id: "OWNER_CHANGED",
        text: `Agent #${receipt.agentId} now belongs to ${agent.owner}, not to the wallet that filed this receipt (${receipt.actor}).`,
      });
    }
  }

  return { intact: checks.every((c) => c.ok), checks, notes, trace };
}

const isV21 = (cfg) => cfg?.version === "2.1" && Boolean(cfg.actionRegistry) && Boolean(cfg.agentIdentityRegistry);

/** Networks this verifier can read: those with a V2.1 deployment. */
export const v21Networks = () => Object.keys(DEPLOYMENTS).filter((n) => isV21(DEPLOYMENTS[n]));

/** Read a receipt and its agent from the chain, fetch the published trace, run checkReceipt. */
export async function verifyReceipt({ network = "monad", receiptId, provider, fetchTrace = fetchJSON }) {
  const cfg = DEPLOYMENTS[network];
  if (!isV21(cfg)) {
    throw new Error(`${network} is not a V2.1 deployment. Supported: ${v21Networks().join(", ")}. V2.0 let anyone file under any agent, so its receipts cannot be read with these checks.`);
  }
  provider ??= new ethers.JsonRpcProvider(cfg.rpc);

  const registry = new ethers.Contract(cfg.actionRegistry, ACTION_REGISTRY_ABI, provider);
  const r = await registry.getReceipt(receiptId);
  if (r.actor === ethers.ZeroAddress) throw new Error(`Receipt #${receiptId} does not exist on ${network}`);
  if (Number(r.actionType) !== ACTION_TYPE.OFF_CHAIN_ACTION) {
    throw new Error(`Receipt #${receiptId} is an on-chain action; this verifier checks off-chain receipts only`);
  }
  const receipt = {
    id: Number(receiptId),
    actor: r.actor,
    agentId: Number(r.agentId),
    chainId: cfg.chainId,
    status: STATUS[Number(r.status)],
    intentHash: r.intentHash,
    outcomeHash: r.outcomeHash,
    evidenceURI: r.evidenceURI,
    timestamp: Number(r.timestamp),
  };
  if (receipt.status === "CREATED") return { receipt, linked: false };

  let agent = null;
  if (receipt.agentId !== 0) {
    const identity = new ethers.Contract(cfg.agentIdentityRegistry, AGENT_IDENTITY_ABI, provider);
    const [owner, revoked] = await Promise.all([identity.ownerOf(receipt.agentId), identity.revoked(receipt.agentId)]);
    agent = { owner, revoked };
  }
  const trace = await fetchTrace(receipt.evidenceURI);
  return { receipt, linked: true, ...checkReceipt(receipt, trace, agent) };
}

async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not fetch the published trace (HTTP ${res.status}): ${url}`);
  return res.json();
}

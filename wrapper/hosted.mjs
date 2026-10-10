import { ethers } from "ethers";
import { AGENT_IDENTITY_ABI, DEPLOYMENTS } from "./abi.mjs";
import { hashTrace } from "./canonicalize.mjs";

// SafeReceipt's site: the hosted trace store (frontend/api/traces.ts, Monad testnet only) and
// the receipt pages. SAFERECEIPT_SITE_URL points the client at another deployment (a preview, or `npm run dev`).
export const SITE_URL = (process.env.SAFERECEIPT_SITE_URL || "https://safereceipt.vercel.app").replace(/\/$/, "");
const TRACES_ENDPOINT = `${SITE_URL}/api/traces`;
export const HOSTED_TRACES = { monad: `${TRACES_ENDPOINT}/monad` };

/** The shareable page of a Monad receipt, where anyone can press Verify. */
export function receiptURL(receiptId) {
  return `${SITE_URL}/fleet/receipt/${receiptId}`;
}

/** The exact text the filer signs. Must match frontend/api/traces.ts traceUploadMessage. */
export function traceUploadMessage(chainId, receiptId, traceHash) {
  return `SafeReceipt trace upload\nChain: ${chainId}\nReceipt: ${receiptId}\nTrace hash: ${traceHash.toLowerCase()}`;
}

/**
 * publish() hook that stores the trace on SafeReceipt's site. The signer must be
 * the wallet that filed the receipt; the site checks that on-chain, stores the
 * trace once, and serves it at `${HOSTED_TRACES.monad}/${receiptId}.json`.
 */
export function hostedPublisher(signer, { network = "monad" } = {}) {
  const base = HOSTED_TRACES[network];
  if (!base) throw new Error(`No hosted trace store for network: ${network}`);
  const { chainId } = DEPLOYMENTS[network];
  return async (trace, receiptId) => {
    const signature = await signer.signMessage(traceUploadMessage(chainId, receiptId, hashTrace(trace)));
    const res = await fetch(TRACES_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chainId, receiptId, trace, signature }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(`hosted trace upload failed (${res.status}): ${error}`);
    }
    // Read it back the way a verifier will, before the hash goes on-chain
    const fetched = await (await fetch(`${base}/${receiptId}.json`)).json();
    if (hashTrace(fetched) !== hashTrace(trace)) throw new Error(`hosted trace for receipt #${receiptId} does not match what was uploaded`);
  };
}

/** Plain JSON metadata as a data: URI, so registering needs no hosting. /fleet reads it like any tokenURI. */
export function metadataURI({ name, role, model, ...rest }) {
  const json = JSON.stringify({ name, role, model, ...rest });
  return `data:application/json;base64,${Buffer.from(json).toString("base64")}`;
}

/**
 * Register an agent identity owned by `signer`. `metadata` is { name, role, model }
 * (stored inline) or a tokenURI string you host yourself.
 * @returns { agentId, txHash }
 */
export async function registerAgent(signer, metadata, { network = "monad" } = {}) {
  const cfg = DEPLOYMENTS[network];
  if (!cfg) throw new Error(`Unknown network: ${network}`);
  const tokenURI = typeof metadata === "string" ? metadata : metadataURI(metadata);
  const registry = new ethers.Contract(cfg.agentIdentityRegistry, AGENT_IDENTITY_ABI, signer);
  const tx = await registry.registerAgent(tokenURI);
  const rcpt = await tx.wait();
  const ev = rcpt.logs
    .map((l) => { try { return registry.interface.parseLog(l); } catch { return null; } })
    .find((p) => p && p.name === "AgentRegistered");
  if (!ev) throw new Error(`AgentRegistered event not found in tx ${tx.hash}`);
  return { agentId: Number(ev.args.agentId), txHash: tx.hash };
}

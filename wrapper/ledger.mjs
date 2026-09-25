import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hashTrace } from "./canonicalize.mjs";
const HERE = dirname(fileURLToPath(import.meta.url)); // Node 18 has no import.meta.dirname

// Local clone of https://github.com/calderbuild/accountability-ledger.
export const LEDGER_DIR = process.env.LEDGER_DIR ?? join(HERE, "..", "..", "accountability-ledger");
// Receipt ids restart at 1 on every registry deploy, so each version gets its own directory.
const TRACE_DIR = "traces/v2.1";
export const LEDGER_RAW_TRACES = `https://raw.githubusercontent.com/calderbuild/accountability-ledger/master/${TRACE_DIR}`;

/** publish() hook for AccountabilityClient.endAction: commit + push the trace, wait until it is readable. */
export function ledgerPublisher(label) {
  if (!existsSync(join(LEDGER_DIR, ".git"))) throw new Error(`LEDGER_DIR is not a git clone: ${LEDGER_DIR}`);
  return async (trace, receiptId) => {
    mkdirSync(join(LEDGER_DIR, TRACE_DIR), { recursive: true });
    writeFileSync(join(LEDGER_DIR, TRACE_DIR, `${receiptId}.json`), JSON.stringify(trace, null, 2) + "\n");
    // Commit identity comes from the clone's own git config.
    execSync(`git -C "${LEDGER_DIR}" add ${TRACE_DIR}/${receiptId}.json`);
    execSync(`git -C "${LEDGER_DIR}" commit -q -m "evidence: receipt #${receiptId} (${label})"`);
    execSync(`git -C "${LEDGER_DIR}" push -q origin master`);
    const url = `${LEDGER_RAW_TRACES}/${receiptId}.json`;
    const fetched = await fetchWithRetry(url);
    if (hashTrace(fetched) !== hashTrace(trace)) throw new Error(`published trace at ${url} does not match what was pushed`);
    console.log(`  published trace -> ${url}`);
  };
}

async function fetchWithRetry(url) {
  for (let attempt = 1; attempt <= 20; attempt++) {
    await new Promise((r) => setTimeout(r, 3000)); // GitHub raw CDN lags a few seconds
    const res = await fetch(`${url}?t=${Date.now()}`);
    if (res.ok) return res.json();
    console.log(`  waiting for raw CDN (attempt ${attempt}, HTTP ${res.status})`);
  }
  throw new Error(`evidence not reachable after retries: ${url}`);
}

/** What a third party does: re-fetch the published trace, re-hash it, compare with the chain. */
export async function verifyAgainstChain(client, receiptId, evidenceURI) {
  const fetched = await fetchWithRetry(evidenceURI);
  const recomputed = hashTrace(fetched);
  const onChain = (await client.contract.getReceipt(receiptId)).outcomeHash;
  const match = recomputed.toLowerCase() === onChain.toLowerCase();
  console.log(`  recomputed ${recomputed}`);
  console.log(`  on-chain   ${onChain}`);
  console.log(`  MATCH: ${match ? "YES, the published trace is the one committed on-chain" : "NO, tampered"}`);
  return match;
}

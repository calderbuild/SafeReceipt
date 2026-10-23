#!/usr/bin/env node
// Verify one off-chain receipt yourself: reads the chain over a public RPC, fetches
// the published trace, re-hashes it and re-runs the policy rules locally.
//
//   npx --package=@safereceipt/client safereceipt-verify <receiptId> [--network monad|bohr|bot] [--json]
//
// Exit 0: every check passed. 1: a check failed. 2: no outcome linked yet, or an error.
import { v21Networks, verifyReceipt } from "./verify.mjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args.splice(i, 2)[1];
};
const json = args.includes("--json") && args.splice(args.indexOf("--json"), 1);
const network = flag("--network") ?? "monad";
const [receiptId] = args;

if (!/^\d+$/.test(receiptId ?? "")) {
  console.error(`Usage: safereceipt-verify <receiptId> [--network ${v21Networks().join("|")}] [--json]`);
  process.exit(2);
}

try {
  const result = await verifyReceipt({ network, receiptId: Number(receiptId) });
  if (json) {
    const { trace: _trace, ...rest } = result;
    console.log(JSON.stringify(rest, null, 2));
  } else {
    print(result);
  }
  process.exit(!result.linked ? 2 : result.intact ? 0 : 1);
} catch (err) {
  console.error(`error: ${err.message}`);
  process.exit(2);
}

function print({ receipt, linked, intact, checks, notes }) {
  console.log(`Receipt #${receipt.id} on ${network} (chain ${receipt.chainId})`);
  console.log(`  filed by ${receipt.actor}, agent ${receipt.agentId === 0 ? "0 (anonymous)" : `#${receipt.agentId}`}`);
  console.log(`  recorded status ${receipt.status}`);
  if (!linked) {
    console.log("\nNo outcome linked yet: there is no trace to check.");
    return;
  }
  console.log(`  trace ${receipt.evidenceURI}\n`);
  for (const c of checks) console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.label}`);
  console.log("");
  for (const n of notes) console.log(`  NOTE  ${n.text}`);
  const traceMatches = checks.filter((c) => c.id !== "POLICY").every((c) => c.ok);
  if (intact) {
    console.log("\nINTACT: the published trace is the one committed on-chain. This proves what was recorded, not that the agent's actions happened as the trace says.");
  } else if (traceMatches) {
    console.log("\nSTATUS DISPUTED: the trace is the one committed on-chain, but the recorded status disagrees with the policy rules.");
  } else {
    console.log("\nBROKEN: the published trace does not match what was committed on-chain.");
  }
}

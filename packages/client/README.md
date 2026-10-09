# @safereceipt/client

Puts a SafeReceipt on a unit of agent work. Before the agent acts, its declared intent is hashed and written to `ActionRegistry` on Monad testnet. While it works, each step is recorded. When it finishes, the trace is checked against the declared scope, published, and its hash linked on-chain, so anyone can re-fetch it and compare.

**Not on npm yet.** Publishing it there is the first GCC milestone. Today you install it from this repo.

## Install

```bash
git clone https://github.com/calderbuild/SafeReceipt.git
cd SafeReceipt/packages/client
npm pack                                   # builds lib/ from wrapper/ and writes safereceipt-client-0.1.0.tgz
cd /path/to/your-agent
npm install ethers /path/to/safereceipt-client-0.1.0.tgz
```

Node 18 or later. `ethers` v6 is a peer dependency.

## The three calls

| Call                                                  | When                    | What it does                                                                              |
| ----------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| `beginAction({ agentId, declaredIntent, riskScore })` | before the agent starts | hashes the intent and calls `createReceipt` (one transaction)                             |
| `emit(stage, message, progress, data)`                | while it works          | appends a step to the trace; put the files or resources it used in `data.touched`         |
| `endAction({ policyResult, publish })`                | after it finishes       | hashes the trace, calls your `publish` hook, then `linkOffChainOutcome` (one transaction) |

`evaluatePolicy(trace)` scores the trace: going outside `declaredScope` (SCOPE_CREEP), an error step or an empty trace makes it MISMATCH; going over `budgetMs` is recorded but does not.

## Example

```js
import { ethers } from "ethers";
import {
  AccountabilityClient,
  DEPLOYMENTS,
  evaluatePolicy,
} from "@safereceipt/client";

const signer = new ethers.Wallet(
  process.env.PRIVATE_KEY,
  new ethers.JsonRpcProvider(DEPLOYMENTS.monad.rpc)
);
const client = new AccountabilityClient({
  network: "monad",
  signer,
  evidenceBaseURL: "https://example.com/traces",
});

const { receiptId } = await client.beginAction({
  agentId: 1,
  declaredIntent: {
    goal: "Summarize docs/ for a new reader",
    declaredScope: ["docs/"],
  },
});

client.emit("read", "Read docs/guide.md", 40, { touched: ["docs/guide.md"] });

const policy = evaluatePolicy(client.buildTrace(null));
await client.endAction({
  policyResult: policy,
  publish: async (trace, id) => {
    // upload trace so it is readable at https://example.com/traces/${id}.json before returning
  },
});
```

`examples/minimal-agent.mjs` runs dry by default and prints what it would commit. `SAFERECEIPT_SEND=1` with `PRIVATE_KEY`, `AGENT_ID` and `EVIDENCE_BASE_URL` sends real transactions.

## Before you use it

- The signer must own the agent identity (`AgentIdentityRegistry.registerAgent`) and the agent must not be revoked, or `createReceipt` reverts.
- Traces are public. Don't put secrets or personal data in `emit()`.
- What a receipt proves and what it doesn't: [docs/ACCOUNTABILITY.md](../../docs/ACCOUNTABILITY.md). In short, the trace can't be changed after it is linked, but nothing proves it is complete.
- `verifyAgainstChain(client, receiptId, evidenceURI)` re-fetches a published trace and compares its hash with the chain.

The source lives in `wrapper/`; `npm run build` (run by `npm pack`) copies it into `lib/`.

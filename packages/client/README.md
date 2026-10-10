# @safereceipt/client

[中文](./README.zh.md)

Puts a receipt on a unit of agent work. Before the agent acts, what it says it will do is hashed and written on-chain. While it works, each step is recorded. When it finishes, the record is checked against what it said, published, and its hash linked on-chain. Anyone can then re-fetch the record and compare, in their own browser, on [safereceipt.vercel.app/fleet](https://safereceipt.vercel.app/fleet).

Runs on Monad testnet. Version 0.1: an early release, and I'd like to hear where it gets in your way ([issues](https://github.com/calderbuild/SafeReceipt/issues)).

## Quickstart (about 10 minutes)

You need Node 18 or later and a wallet with a little testnet MON for gas ([faucet](https://faucet.monad.xyz)). Use a throwaway key: it signs testnet transactions only.

```bash
npm install @safereceipt/client ethers
```

```js
import { ethers } from "ethers";
import {
  AccountabilityClient,
  DEPLOYMENTS,
  evaluatePolicy,
  registerAgent,
} from "@safereceipt/client";

const signer = new ethers.Wallet(
  process.env.PRIVATE_KEY,
  new ethers.JsonRpcProvider(DEPLOYMENTS.monad.rpc)
);

// Once per agent: an on-chain identity owned by your wallet.
const { agentId } = await registerAgent(signer, {
  name: "my-agent",
  role: "Summarizes docs",
  model: "gpt-x",
});

const client = new AccountabilityClient({ network: "monad", signer });

// 1. Before the agent acts: commit what it will do and where it may look.
const { receiptId } = await client.beginAction({
  agentId,
  declaredIntent: {
    goal: "Summarize docs/ for a new reader",
    declaredScope: ["docs/"],
  },
});

// 2. While it works: record each step and what it touched.
client.emit("read", "Read docs/guide.md", 40, { touched: ["docs/guide.md"] });

// 3. After it finishes: check the record against the intent, publish it, link its hash.
const policy = evaluatePolicy(client.buildTrace(null));
const { status, evidenceURI } = await client.endAction({
  policyResult: policy,
});
console.log(receiptId, status, evidenceURI);
```

Your agent and receipt now show up on [/fleet](https://safereceipt.vercel.app/fleet). Press **Verify independently** there: the browser fetches the record, hashes it, reads the hash from the chain and compares.

The same flow as a runnable script: `examples/minimal-agent.mjs` (dry run by default; `SAFERECEIPT_SEND=1 PRIVATE_KEY=0x...` sends it).

## The three calls

| Call                                                  | When                    | What it does                                                                        |
| ----------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| `beginAction({ agentId, declaredIntent, riskScore })` | before the agent starts | hashes the intent and calls `createReceipt` (one transaction)                       |
| `emit(stage, message, progress, data)`                | while it works          | appends a step to the record; list the files or resources it used in `data.touched` |
| `endAction({ policyResult, publish })`                | after it finishes       | hashes the record, publishes it, then calls `linkOffChainOutcome` (one transaction) |

`evaluatePolicy(trace)` scores the record: going outside `declaredScope` (SCOPE_CREEP), an error step or an empty record makes it MISMATCH; going over `budgetMs` is recorded but does not.

## Where the record is published

By default the record is stored on SafeReceipt's site and served at `https://safereceipt.vercel.app/api/traces/monad/<receiptId>.json`. The site accepts it only when it is signed by the wallet that filed the receipt, within 24 hours of filing and before the outcome is linked, and only once; a stored record is never overwritten (sending the same record again is fine, so a failed link can be retried). The hosted store takes up to 20 records per wallet per day and 900 a month in total; past that, publish with your own hook. Records are public, so don't put secrets or personal data in `emit()`.

To host records yourself, pass `evidenceBaseURL` and a `publish(trace, receiptId)` hook that makes the record readable at `${evidenceBaseURL}/${receiptId}.json` before it returns.

## What a receipt proves, and what it doesn't

- It proves the intent was committed before the work, and that the published record is the one linked on-chain (it can't be changed afterwards).
- It does not prove the record is complete: your code writes it, and a step left out of it can't be detected. That needs the agent to run in trusted hardware (TEE), which is on the roadmap.
- Details: [docs/ACCOUNTABILITY.md](https://github.com/calderbuild/SafeReceipt/blob/main/docs/ACCOUNTABILITY.md).

## Other exports

`hostedPublisher(signer)`, `metadataURI(metadata)`, `verifyAgainstChain(client, receiptId, evidenceURI)`, `hashTrace`, `hashIntent`, `DEPLOYMENTS`, the ABIs. Types are in `index.d.ts`.

The source lives in [`wrapper/`](https://github.com/calderbuild/SafeReceipt/tree/main/wrapper); `npm run build` (run by `npm pack`) copies it into `lib/`. MIT.

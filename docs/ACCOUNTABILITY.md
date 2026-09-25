# What the accountability layer proves (and what it doesn't)

This document is the honest scope boundary for the BUIDL_QUESTS 2026 build.
It exists because the fastest way to lose a sophisticated judge's trust is to
overclaim what an on-chain hash actually guarantees.

## The two paths have different trust properties

### On-chain actions (ERC20 approve) -- re-checkable by anyone

For an action that resolves to a real transaction, the verifier fetches the tx
by hash and checks it against the declared intent: it succeeded, it was sent by
the receipt's actor, it was mined after the receipt, and its calldata names the
declared token, spender and amount (`frontend/src/lib/verifyExecution.ts`).
The inputs are public and the logic is open source, so anyone holding the
receipt's intent (the exported evidence file) can re-run it and get the same
answer, without trusting the agent, its operator, or this frontend.

Two limits:

- The VERIFIED / MISMATCH flag stored on-chain is written by the receipt owner
  (`linkExecution`), who could lie. Treat it as a claim and re-run the check.
- Only ERC20 approve is execution-checked. Batch-pay intents get a receipt and
  risk score, but no execution check yet.

### Off-chain actions (OFF_CHAIN_ACTION) -- commit-reveal, partial trust

For an action with no transaction to check (an agent that researched, reviewed,
wrote, or decided), the mechanism is commit-reveal:

1. **Commit** -- before the agent runs, its declared intent is hashed and
   written on-chain (`createReceipt`). This is a timestamp that cannot be
   backdated.
2. **Reveal** -- after the agent runs, the full execution trace is hashed,
   published to a public URL (`evidenceURI`), and linked on-chain
   (`linkOffChainOutcome`).

**What this proves:**

- The declared intent existed and was committed _before_ the agent acted --
  you cannot rewrite the goal after seeing the outcome.
- The published trace is tamper-evident: changing one byte changes its hash,
  which no longer matches the on-chain record. The independent-verify path
  (re-fetch the trace, recompute the hash, compare to chain) confirms this in
  front of the viewer.

**What this does NOT prove:**

- That the trace is a _complete and truthful_ account of what the agent did.
  The harness records its own trace, so a dishonest or buggy harness could
  publish a trace that omits or misrepresents an action. Closing this gap
  requires attested execution -- a TEE enclave, or independent re-execution of
  the agent -- neither of which is built in this version.
- Anything about the recorded status beyond the policy rules. The Fleet page
  re-runs the rules (`frontend/src/lib/tracePolicy.ts`) on the published trace
  and checks the result agrees with the chain, but the rules only see what the
  trace reports (for example the `touched` paths).

**Privacy and linkability:**

- Traces are published in full and unredacted. Don't route secrets or personal
  data through a traced run.
- The intent hash is unsalted: two receipts with the same declared intent have
  the same intent hash, and a short intent can be guessed by hashing candidates.
  Salted commitments are on the roadmap.

## Who can file a receipt (V2.1)

`createReceipt` with an `agentId` requires `msg.sender` to own that agent NFT
and the agent not to be revoked. In V2.0 this was not checked, so anyone could
file receipts under any agent; V2.0 is kept only for its historical receipts.

## Why ship the honest version

The on-chain approve check is reproducible by anyone today. The off-chain path is a real,
useful integrity primitive (it makes intent non-repudiable and traces
tamper-evident) with a clearly named ceiling. Presenting the off-chain path as
if it were trustless would be the same failure this project is designed to
prevent: an agent claiming it did something it can't prove.

## Roadmap (named, not claimed as done)

- **Salted intent commitments**, so receipts don't leak or link identical intents.
- **TEE attestation** for off-chain traces (Phala / AWS Nitro), upgrading the
  off-chain path toward the trust level of the on-chain path.
- **OpenTimestamps** Bitcoin anchoring on the commit hash, for one genuinely
  third-party timestamp independent of any chain we control.
- **Agent-controlled keys** (ERC-8004 direction): agents sign their own
  receipts instead of the founder wallet custodying every identity.

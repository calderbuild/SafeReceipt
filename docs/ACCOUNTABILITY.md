# What the accountability layer proves (and what it doesn't)

This document is the honest scope boundary for the BUIDL_QUESTS 2026 build.
It exists because the fastest way to lose a sophisticated judge's trust is to
overclaim what an on-chain hash actually guarantees.

## The two paths have different trust properties

### On-chain actions (ON_CHAIN_APPROVE / ON_CHAIN_TRANSFER) -- trustless

For an action that resolves to a real transaction, the verifier fetches the tx
by hash, decodes its calldata, and compares it against the declared intent. The
comparison inputs are public and the logic is open source, so anyone can re-run
it and get the same VERIFIED / MISMATCH result. This path does not require
trusting the agent, its operator, or SafeReceipt's frontend.

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

## Why ship the honest version

The on-chain path is genuinely trustless today. The off-chain path is a real,
useful integrity primitive (it makes intent non-repudiable and traces
tamper-evident) with a clearly named ceiling. Presenting the off-chain path as
if it were trustless would be the same failure this project is designed to
prevent: an agent claiming it did something it can't prove.

## Roadmap (named, not claimed as done)

- **TEE attestation** for off-chain traces (Phala / AWS Nitro), upgrading the
  off-chain path toward the trust level of the on-chain path.
- **OpenTimestamps** Bitcoin anchoring on the commit hash, for one genuinely
  third-party timestamp independent of any chain we control.
- **Agent-controlled keys** (ERC-8004 direction): agents sign their own
  receipts instead of the founder wallet custodying every identity.

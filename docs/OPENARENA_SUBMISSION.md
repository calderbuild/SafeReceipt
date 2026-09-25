# OpenArena submission draft (BUIDL_QUESTS 2026)

Draft only. Submitting is a publish action -- do it yourself when you're happy
with the copy. This is the rough v1 to land early and start climbing; iterate
through the review window (OpenArena is build-in-public, not a fixed deadline).

## Fields

- **Project name:** SafeReceipt -- Agent Fleet Accountability
- **Primary track:** Sovereignty (technical depth lives here: ERC-8004-inspired
  identity + hash-based verifiable execution). Frame OPC as the narrative.
- **Repo:** https://github.com/calderbuild/SafeReceipt (merged to `main`)
- **Evidence ledger:** https://github.com/calderbuild/accountability-ledger
- **Live demo:** https://safereceipt.vercel.app (frontend refresh lands Week 3)

## One-line

On-chain accountability for a solo builder's AI agent fleet: every agent has a
verifiable identity, and every action leaves a tamper-evident receipt you can
check without trusting the operator.

## Description (rough v1)

A solo founder running a fleet of agents has the same problem a company has with
employees, minus the paper trail: when an agent acts on your behalf, what proof
is there of what it actually did? SafeReceipt gives each agent an on-chain
identity (ERC-8004-inspired, ERC-721) and each action a receipt whose declared
intent is hashed on-chain _before_ execution and whose outcome is linked after.

Two verification paths, with honestly different guarantees:

- On-chain actions (token approvals, transfers) are trustless: the outcome tx is
  decoded and compared to the declared intent, open source, re-runnable by anyone.
- Off-chain actions (research, review, decisions) use commit-reveal: intent is
  committed before the agent runs, the full trace is published and hashed, and
  anyone can re-fetch the trace, recompute the hash, and confirm it matches the
  chain. This makes intent non-repudiable and traces tamper-evident. It does not
  attest the trace is a complete account -- that needs TEE/re-execution, named as
  roadmap, not claimed as done. (See docs/ACCOUNTABILITY.md.)

Deployed and live on Monad Testnet and Base Sepolia. The demonstrated fleet is
real: doc-researcher, code-reviewer, and security-scanner are actual subagents I
run, registered on-chain, with real VERIFIED and MISMATCH receipts in the ledger.

## Proof points to show (all live now)

- AgentIdentityRegistry (Monad): 0x89FFce2796909addf5C8E4A924247d2F2715e133
- ActionRegistry (Monad): 0x8aeee534f7C954fC1Fcb942c4DA8E58f779fcFA6
- Receipt #1 VERIFIED (code-reviewer ran the test suite):
  https://raw.githubusercontent.com/calderbuild/accountability-ledger/master/traces/1.json
- Receipt #2 MISMATCH (agent overstepped declared scope):
  https://raw.githubusercontent.com/calderbuild/accountability-ledger/master/traces/2.json

## Honest note to include (differentiator, not a weakness)

This project is a continuation, not a from-scratch build: SafeReceipt started at
an earlier Monad hackathon as a single-tx approve verifier. For BUIDL_QUESTS 2026
it grew the agent identity registry and the off-chain verifiable-execution layer.
The commit history is the proof of real, incremental work.

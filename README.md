# SafeReceipt

**Agent Accountability Protocol** -- verifiable on-chain identity and receipts for AI agent actions, from a single wallet transaction to a whole agent fleet.

> When AI fails, receipts prove who's responsible.

[中文说明](README.zh-CN.md)

**[Live Demo](https://safereceipt.vercel.app)** | **[Agent fleet: verify a receipt in your browser](https://safereceipt.vercel.app/fleet)** | Monad Testnet

---

AI agents act autonomously -- executing transactions, running research, reviewing code -- but there is rarely a verifiable record of what an agent was _supposed_ to do versus what it _actually did_. SafeReceipt fixes this in two layers:

- **V1 -- transaction receipts**: cryptographic proof of a declared intent (an ERC20 approve, a batch payment) _before_ execution, verified against the actual on-chain transaction after.
- **V2 -- agent fleet accountability**: every agent gets an on-chain identity (ERC-8004-inspired ERC-721), and every action -- on-chain or off-chain (research, review, a decision) -- leaves a tamper-evident receipt, checkable without trusting the agent's operator.

## Two verification paths, honestly different guarantees

| Path                                                | Mechanism                                                                                                                          | Trust level                                                                                                                                                                                                                                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **On-chain actions** (ERC20 approve) | Fetch the tx by hash; check it succeeded, came from the receipt's actor after the receipt, and that token, spender and amount match | **Re-checkable by anyone** -- open source and deterministic; the VERIFIED/MISMATCH flag on-chain is set by the receipt owner, so re-run the check rather than trust the flag |
| **Off-chain actions** (research, review, decisions) | Commit-reveal: intent hash committed _before_ the agent runs, full trace hashed and published _after_, independently re-verifiable | **Tamper-evident, not attested** -- proves the intent wasn't rewritten after the fact and the trace wasn't altered; does not prove the trace is a complete, truthful account (that needs TEE attestation or independent re-execution -- named as roadmap, not claimed as done) |

Full scope boundary: [docs/ACCOUNTABILITY.md](docs/ACCOUNTABILITY.md).

## How It Works

```
1. CAPTURE   Natural language intent → Risk analysis → keccak256 hash → Store on-chain
2. EXECUTE   Agent performs the transaction (on-chain) or runs its task (off-chain)
3. VERIFY    Decode tx calldata, or re-fetch + re-hash the trace → VERIFIED or MISMATCH
```

Every receipt links a **declared intent**, committed before the action, to the **outcome** checked after it. Changing either side after the fact breaks a hash.

## Key Features

- **Intent Hashing** -- Deterministic canonicalization ensures the same intent always produces the same hash
- **Risk Engine** -- 6 automated rules score transaction risk (0-100) before execution
- **Agent Identity** -- `AgentIdentityRegistry` mints an ERC-721 identity per agent; only the owner of an agent can file receipts under it (V2.1). All three demo agents are held by one deployer wallet
- **On-Chain Receipts** -- Intent and proof hashes stored on Monad testnet
- **Execution Verification** -- Link a receipt to the real approve tx; the verdict is written on-chain with `linkExecution`
- **Off-Chain Commit-Reveal** -- `linkOffChainOutcome()` extends verification to actions with no transaction to check
- **Public Evidence Ledger** -- traces published to [accountability-ledger](https://github.com/calderbuild/accountability-ledger), independently re-verifiable against the on-chain hash
- **One-Click Agent Demo** -- A live model agent (DeepSeek, called from a server function) sends real approves on Monad testnet with a test token (DemoUSD): the model parses the request, the receipt commits it, the model reads the token metadata and plans the tx, and the receipt checks what was actually sent. In the poisoned-metadata scenario the metadata claims a 10,000 minimum; when the model falls for it, the receipt comes out MISMATCH
- **NLP Intent Parsing** -- "Approve Permit2 to spend 100 DemoUSD" parsed into structured intent by the model. Calls go through `frontend/api/agent.ts`, which holds the key, needs a wallet sign-in signature, and is rate-limited

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    Frontend                      │
│                                                  │
│  Intent Input ──→ LLM Parse ──→ Risk Engine     │
│       │                              │           │
│       ▼                              ▼           │
│  Canonical Digest ──→ keccak256 ──→ On-Chain    │
│       │                              │           │
│       ▼                              ▼           │
│  Execute Tx ──→ Decode Calldata ──→ Verify      │
│                                                  │
└──────────────────────┬──────────────────────────┘
                       │
        ┌──────────────┼──────────────────┐
        ▼                                 ▼
┌─────────────────┐              ┌───────────────────────┐
│ ReceiptRegistry  │  V1          │ AgentIdentityRegistry │  V2
│   (Solidity)     │  (unchanged) │ ActionRegistry        │  (agent fleet layer)
└─────────────────┘              └───────────────────────┘
        Deployed on Monad Testnet -- see DEPLOYMENTS.md
                                 │
                                 ▼
                    ┌───────────────────────────┐
                    │ wrapper/ (commit-reveal)   │
                    │ hashes + publishes traces  │
                    │ to accountability-ledger   │
                    └───────────────────────────┘
```

### Receipt Lifecycle

| Status     | Meaning                                    |
| ---------- | ------------------------------------------ |
| `CREATED`  | Intent recorded, no execution yet          |
| `VERIFIED` | Linked transaction matches declared intent |
| `MISMATCH` | Linked transaction does NOT match intent   |

### Risk Rules

| Rule                          | Weight | Description                              |
| ----------------------------- | ------ | ---------------------------------------- |
| `UNLIMITED_ALLOWANCE`         | 40     | Detects max uint256 approvals            |
| `SPENDER_IS_UNKNOWN_CONTRACT` | 25     | Checks against known protocol addresses  |
| `REPEAT_APPROVE_PATTERN`      | 15     | Flags repeated approvals to same spender |
| `DUPLICATE_RECIPIENTS`        | 10     | Detects duplicate addresses in batch     |
| `RECIPIENT_IS_CONTRACT`       | 5      | Warns when a batch recipient is a contract |
| `OUTLIER_AMOUNT`              | 5      | Over 10x the median of your last approvals of that token (needs 3+) |

## Tech Stack

| Layer             | Technology                                               |
| ----------------- | -------------------------------------------------------- |
| Smart Contract    | Solidity (V1 deployed with 0.8.19; V2.1 and local builds use 0.8.24), Hardhat |
| Agent Identity    | ERC-721 (`AgentIdentityRegistry`, ERC-8004-inspired)     |
| Commit-Reveal     | Node.js wrapper (`wrapper/`) for off-chain trace hashing |
| Frontend          | React 19, TypeScript, Vite                               |
| Styling           | Tailwind CSS v4                                          |
| Chain Interaction | ethers.js v6                                             |
| Wallet            | MetaMask                                                 |
| NLP               | OpenAI-compatible API (DeepSeek `deepseek-flash`)        |
| Testing           | Vitest (frontend), Hardhat + Chai (contracts)            |
| Target Chain      | Monad Testnet (10143)                                    |

## Quick Start

### Prerequisites

- Node.js 18 for contract commands (Hardhat 2.x warns/misbehaves on Node 20+); Node 20+ for the frontend (Vite 7 requires it)
- MetaMask browser extension
- A little testnet MON for gas

### Setup

```bash
git clone https://github.com/calderbuild/SafeReceipt.git
cd SafeReceipt

# Install contract dependencies
npm install

# Install frontend dependencies
cd frontend && npm install
```

### Environment Variables (optional)

Create `frontend/.env` so the agent API works under `npm run dev`:

```
DEEPSEEK_API_KEY=your-api-key
```

It has no `VITE_` prefix on purpose: only `frontend/api/agent.ts` reads it, server-side, and it never reaches the browser bundle. In production it is a Vercel environment variable. Without it the AI features are hidden and the demo can't run.

### Run

```bash
cd frontend && npm run dev        # Dev server at localhost:5173
cd frontend && npm test -- --run  # Frontend unit tests
npm run compile                   # Compile V1 + V2 contracts (Node 18)
npm run test                      # Contract test suite -- 50 passing (Node 18)
```

## Smart Contracts

`ReceiptRegistry.sol` (V1) -- single contract, minimal surface area, unchanged since the original build.

- `createReceipt(actionType, intentHash, proofHash, riskScore)` -- Store intent on-chain
- `linkExecution(receiptId, txHash, verified)` -- Link execution and set verification status
- `getReceipt(receiptId)` / `getUserReceipts(address)` -- Read receipt data

`AgentIdentityRegistry.sol` + `ActionRegistry.sol` (V2.1) -- the agent fleet layer.

- `registerAgent(string agentTokenURI)` -- Mint an ERC-721 identity for an agent (name, role, model live in the tokenURI JSON)
- `revokeAgent(agentId)` -- Owner-only revocation
- `createReceipt(uint256 agentId, uint8 actionType, bytes32 intentHash, bytes32 proofHash, uint8 riskScore)` -- scoped to an agent identity; reverts unless the caller owns that agent and it isn't revoked (`agentId` 0 = no agent)
- `linkExecution(uint256 receiptId, bytes32 txHash, bool verified, string evidenceURI)` -- On-chain action types only
- `linkOffChainOutcome(uint256 receiptId, bytes32 outcomeHash, bool verified, string evidenceURI)` -- Off-chain commit-reveal path; needs a non-empty hash and evidence URI
- `getReceipt(receiptId)` / `getAgentReceipts(agentId)` / `getUserReceipts(address)` -- Read receipt data

Addresses, receipts and the V2.0 history: [DEPLOYMENTS.md](DEPLOYMENTS.md). Trust boundary of each path: [docs/ACCOUNTABILITY.md](docs/ACCOUNTABILITY.md).

## How Verification Works

**Proof Verification** (data integrity):

```
On-chain proofHash  ==  keccak256(canonicalize(localDigest))
```

If they match, the local data has not been tampered with.

**Execution Verification** (intent matching):

```
Fetch tx + receipt by hash → status ok, sender = receipt actor, mined after the receipt
→ Decode ERC20 approve(spender, amount) → compare token, spender, amount with the intent
→ VERIFIED or MISMATCH, written on-chain by the receipt owner (linkExecution)
```

## Project Structure

```
SafeReceipt/
├── contracts/
│   ├── ReceiptRegistry.sol        # V1: on-chain receipt storage
│   ├── AgentIdentityRegistry.sol  # V2: ERC-721 agent identity
│   └── ActionRegistry.sol         # V2: agent-scoped receipts + commit-reveal
├── wrapper/                       # V2: off-chain commit-reveal client
│   ├── canonicalize.mjs           # Trace hashing (matches frontend scheme)
│   ├── policy.mjs                 # Scores a trace against declared intent
│   ├── accountability.mjs         # beginAction / emit / endAction client
│   ├── ledger.mjs                 # Publishes traces, then verifies them against the chain
│   └── register-agents.mjs        # Registers the agent fleet on-chain
├── docs/
│   └── ACCOUNTABILITY.md          # Honest trust-boundary writeup
├── frontend/src/
│   ├── lib/
│   │   ├── canonicalize.ts        # Deterministic hashing
│   │   ├── v2.ts                  # V2 registry reads + in-browser independent verification
│   │   ├── tracePolicy.ts         # Policy rules re-run in the browser (parity-tested with wrapper)
│   │   ├── verifyExecution.ts     # Approve tx vs intent check
│   │   ├── contract.ts            # ABI + contract interaction
│   │   ├── riskEngine.ts          # 6 risk assessment rules
│   │   ├── agentRunner.ts         # End-to-end lifecycle orchestrator
│   │   ├── agentApi.ts            # client for /api/agent (sign-in + model calls)
│   │   └── executeIntent.ts       # ERC20 approve execution
│   ├── hooks/
│   │   ├── useVerify.ts           # Proof verification
│   │   ├── useExecutionVerifier.ts # Calldata decode + compare
│   │   └── useWallet.ts           # MetaMask + Monad switching
│   ├── components/
│   │   └── AgentDemo.tsx          # One-click demo stepper UI
│   └── pages/
│       ├── Home.tsx               # Landing + agent demo
│       ├── Fleet.tsx              # V2 agent fleet + verify a receipt yourself
│       ├── MyReceipts.tsx         # Receipt list with status
│       └── ReceiptDetail.tsx      # Detail + execution linking
└── hardhat.config.ts
```

## Contributors

- [Calder](https://github.com/calderbuild)

## License

MIT

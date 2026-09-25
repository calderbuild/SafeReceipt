# SafeReceipt

**Agent Accountability Protocol** -- verifiable on-chain identity and receipts for AI agent actions, from a single wallet transaction to a whole agent fleet.

> When AI fails, receipts prove who's responsible.

[中文说明](README.zh-CN.md)

**[Live Demo](https://safereceipt.vercel.app)** | **[Agent fleet: verify a receipt in your browser](https://safereceipt.vercel.app/fleet)** | Monad Testnet + Base Sepolia

---

AI agents act autonomously -- executing transactions, running research, reviewing code -- but there is rarely a verifiable record of what an agent was _supposed_ to do versus what it _actually did_. SafeReceipt fixes this in two layers:

- **V1 -- transaction receipts**: cryptographic proof of a declared intent (an ERC20 approve, a batch payment) _before_ execution, verified against the actual on-chain transaction after.
- **V2 -- agent fleet accountability**: every agent gets an on-chain identity (ERC-8004-inspired ERC-721), and every action -- on-chain or off-chain (research, review, a decision) -- leaves a tamper-evident receipt, checkable without trusting the agent's operator.

## Two verification paths, honestly different guarantees

| Path                                                | Mechanism                                                                                                                          | Trust level                                                                                                                                                                                                                                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **On-chain actions** (approve, transfer)            | Fetch the tx by hash, decode calldata, compare to declared intent                                                                  | **Trustless** -- open source, re-runnable by anyone                                                                                                                                                                                                                            |
| **Off-chain actions** (research, review, decisions) | Commit-reveal: intent hash committed _before_ the agent runs, full trace hashed and published _after_, independently re-verifiable | **Tamper-evident, not attested** -- proves the intent wasn't rewritten after the fact and the trace wasn't altered; does not prove the trace is a complete, truthful account (that needs TEE attestation or independent re-execution -- named as roadmap, not claimed as done) |

Full scope boundary: [docs/ACCOUNTABILITY.md](docs/ACCOUNTABILITY.md).

## How It Works

```
1. CAPTURE   Natural language intent → Risk analysis → keccak256 hash → Store on-chain
2. EXECUTE   Agent performs the transaction (on-chain) or runs its task (off-chain)
3. VERIFY    Decode tx calldata, or re-fetch + re-hash the trace → VERIFIED or MISMATCH
```

Every receipt is an immutable on-chain record linking **declared intent** to **actual outcome**, with cryptographic proof that neither side was tampered with.

## Key Features

- **Intent Hashing** -- Deterministic canonicalization ensures the same intent always produces the same hash
- **Risk Engine** -- 6 automated rules score transaction risk (0-100) before execution
- **Agent Identity** -- `AgentIdentityRegistry` mints an ERC-721 identity per agent (founder-custodied v1, disclosed not overclaimed)
- **On-Chain Receipts** -- Proof hashes stored on Monad + Base Sepolia for immutable evidence
- **Execution Verification** -- Link receipts to actual tx hashes, decode calldata, confirm intent match
- **Off-Chain Commit-Reveal** -- `linkOffChainOutcome()` extends verification to actions with no transaction to check
- **Public Evidence Ledger** -- traces published to [accountability-ledger](https://github.com/calderbuild/accountability-ledger), independently re-verifiable against the on-chain hash
- **One-Click Agent Demo** -- Full lifecycle (parse, risk, receipt, execute, verify) in a single flow
- **NLP Intent Parsing** -- "Approve 100 USDC to Uniswap" parsed into structured intent via LLM

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
        Deployed on Monad Testnet + Base Sepolia -- see DEPLOYMENTS.md
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
| `RECIPIENT_IS_CONTRACT`       | 5      | Warns when recipient is a contract       |
| `OUTLIER_AMOUNT`              | 5      | Flags statistically unusual amounts      |

## Tech Stack

| Layer             | Technology                                               |
| ----------------- | -------------------------------------------------------- |
| Smart Contract    | Solidity 0.8.19 (V1) / 0.8.24 (V2), Hardhat              |
| Agent Identity    | ERC-721 (`AgentIdentityRegistry`, ERC-8004-inspired)     |
| Commit-Reveal     | Node.js wrapper (`wrapper/`) for off-chain trace hashing |
| Frontend          | React 19, TypeScript, Vite                               |
| Styling           | Tailwind CSS v4                                          |
| Chain Interaction | ethers.js v6                                             |
| Wallet            | MetaMask                                                 |
| NLP               | OpenAI-compatible API (GPT-4o)                           |
| Testing           | Vitest (frontend), Hardhat + Chai (contracts)            |
| Target Chains     | Monad Testnet (10143), Base Sepolia (84532)              |

## Quick Start

### Prerequisites

- Node.js 18 for contract commands (Hardhat 2.x warns/misbehaves on Node 20+); Node 20+ for the frontend (Vite 7 requires it)
- MetaMask browser extension
- MON tokens on Monad Testnet (or Base Sepolia ETH, for the Base Sepolia deployment)

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

Create `frontend/.env` for LLM-powered intent parsing:

```
VITE_OPENAI_API_KEY=your-api-key
VITE_OPENAI_BASE_URL=https://api.openai.com/v1
VITE_OPENAI_MODEL=gpt-4o
```

Without these, the agent demo uses pre-configured fallback intents.

### Run

```bash
cd frontend && npm run dev        # Dev server at localhost:5173
cd frontend && npm test -- --run  # Frontend unit tests
npm run compile                   # Compile V1 + V2 contracts (Node 18)
npm run test                      # Contract test suite -- 26 passing (Node 18)
```

## Smart Contracts

`ReceiptRegistry.sol` (V1) -- single contract, minimal surface area, unchanged since the original build.

- `createReceipt(actionType, intentHash, proofHash, riskScore)` -- Store intent on-chain
- `linkExecution(receiptId, txHash, verified)` -- Link execution and set verification status
- `getReceipt(receiptId)` / `getUserReceipts(address)` -- Read receipt data

`AgentIdentityRegistry.sol` + `ActionRegistry.sol` (V2) -- the agent fleet layer.

- `registerAgent(string agentTokenURI)` -- Mint an ERC-721 identity for an agent (name, role, model live in the tokenURI JSON)
- `revokeAgent(agentId)` -- Owner-only revocation
- `createReceipt(uint256 agentId, uint8 actionType, bytes32 intentHash, bytes32 proofHash, uint8 riskScore)` -- V2 of `createReceipt`, scoped to an agent identity
- `linkExecution(uint256 receiptId, bytes32 txHash, bool verified, string evidenceURI)` -- On-chain path (same trustless verification as V1)
- `linkOffChainOutcome(uint256 receiptId, bytes32 outcomeHash, bool verified, string evidenceURI)` -- Off-chain commit-reveal path
- `getReceipt(receiptId)` / `getAgentReceipts(agentId)` / `getUserReceipts(address)` -- Read receipt data

Full addresses on both chains: [DEPLOYMENTS.md](DEPLOYMENTS.md). Trust boundary of each path: [docs/ACCOUNTABILITY.md](docs/ACCOUNTABILITY.md).

## How Verification Works

**Proof Verification** (data integrity):

```
On-chain proofHash  ==  keccak256(canonicalize(localDigest))
```

If they match, the local data has not been tampered with.

**Execution Verification** (intent matching):

```
Fetch tx by hash → Decode ERC20 approve(spender, amount)
→ Compare token, spender, amount against stored intent
→ VERIFIED or MISMATCH
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
│   └── register-agents.mjs        # Registers the agent fleet on-chain
├── docs/
│   └── ACCOUNTABILITY.md          # Honest trust-boundary writeup
├── frontend/src/
│   ├── lib/
│   │   ├── canonicalize.ts        # Deterministic hashing
│   │   ├── v2.ts                  # V2 registry reads + in-browser independent verification
│   │   ├── contract.ts            # ABI + contract interaction
│   │   ├── riskEngine.ts          # 6 risk assessment rules
│   │   ├── agentRunner.ts         # End-to-end lifecycle orchestrator
│   │   ├── llm.ts                 # LLM intent parsing
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

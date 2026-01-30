# SafeReceipt

**Agent Accountability Protocol** -- Verifiable on-chain receipts for AI agent transactions.

> When AI fails, receipts prove who's responsible.

SafeReceipt creates cryptographic proof of intent *before* an AI agent executes a blockchain transaction, then verifies the execution matches the declared intent. This closes the accountability gap in autonomous agent workflows.

## Problem

AI agents increasingly execute financial transactions on behalf of users. When something goes wrong -- an agent approves unlimited token allowance to an unknown contract, or sends funds to the wrong address -- there is no verifiable record of what the agent was *supposed* to do versus what it *actually did*.

## Solution

SafeReceipt introduces a three-step accountability lifecycle:

```
1. CAPTURE   User intent → NLP parsing → Risk analysis → keccak256 hash → Store on-chain
2. EXECUTE   Agent performs the actual blockchain transaction
3. VERIFY    Decode tx calldata → Compare against declared intent → VERIFIED or MISMATCH
```

Every receipt is an immutable on-chain record linking **declared intent** to **actual execution**, with cryptographic proof that neither side was tampered with.

## Key Features

- **Intent Hashing**: Deterministic canonicalization ensures the same intent always produces the same hash
- **Risk Engine**: 6 automated rules score transaction risk (0-100) before execution
- **On-Chain Storage**: Receipt hashes stored on Monad for immutable evidence
- **Execution Linking**: Connect receipts to actual transaction hashes, verify calldata matches intent
- **One-Click Agent Demo**: End-to-end lifecycle automation (parse, risk, receipt, execute, verify) in a single flow
- **NLP Intent Parsing**: Natural language like "Approve 100 USDC to Uniswap" parsed into structured intent via LLM

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
              ┌────────▼────────┐
              │ ReceiptRegistry │  Monad Testnet
              │    (Solidity)   │  Chain ID: 10143
              └─────────────────┘
```

### Receipt Lifecycle

| Status | Meaning |
|--------|---------|
| `CREATED` | Intent recorded, no execution yet |
| `VERIFIED` | Linked transaction matches declared intent |
| `MISMATCH` | Linked transaction does NOT match intent |

### Risk Rules

| Rule | Weight | Description |
|------|--------|-------------|
| `UNLIMITED_ALLOWANCE` | 40 | Detects max uint256 approvals |
| `SPENDER_IS_UNKNOWN_CONTRACT` | 25 | Checks against known protocol addresses |
| `REPEAT_APPROVE_PATTERN` | 15 | Flags repeated approvals to same spender |
| `DUPLICATE_RECIPIENTS` | 10 | Detects duplicate addresses in batch |
| `RECIPIENT_IS_CONTRACT` | 5 | Warns when recipient is a contract |
| `OUTLIER_AMOUNT` | 5 | Flags statistically unusual amounts |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Solidity 0.8.19, Hardhat |
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4 |
| Chain Interaction | ethers.js v6 |
| Wallet | MetaMask |
| NLP | OpenAI-compatible API (GPT-4o) |
| Testing | Vitest, happy-dom, Testing Library |
| Target Chain | Monad Testnet (Chain ID: 10143) |

## Quick Start

### Prerequisites

- Node.js 18+ (Node 22 has Hardhat compatibility issues)
- MetaMask browser extension
- MON tokens on Monad Testnet

### Setup

```bash
# Clone
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
# Frontend dev server
cd frontend && npm run dev

# Run tests (172 tests)
cd frontend && npm test -- --run

# Compile contract
npx hardhat compile

# Deploy to Monad Testnet
npx hardhat run scripts/deploy.ts --network monad
```

### Monad Testnet

```
Chain ID:   10143
RPC:        https://testnet-rpc.monad.xyz
Explorer:   https://testnet.monadscan.com
Currency:   MON (18 decimals)
```

## Smart Contract

`ReceiptRegistry.sol` -- single contract, minimal surface area.

**Functions:**
- `createReceipt(actionType, intentHash, proofHash, riskScore)` -- Store intent on-chain
- `linkExecution(receiptId, txHash, verified)` -- Link execution and set verification status
- `getReceipt(receiptId)` -- Read receipt data
- `getUserReceipts(address)` -- List all receipts for an address

**Events:**
- `ReceiptCreated(receiptId, actor, actionType, intentHash, proofHash, riskScore, timestamp)`
- `ExecutionLinked(receiptId, txHash, status)`

## Project Structure

```
SafeReceipt/
├── contracts/
│   └── ReceiptRegistry.sol        # On-chain receipt storage
├── frontend/src/
│   ├── lib/
│   │   ├── canonicalize.ts        # Deterministic hashing
│   │   ├── contract.ts            # ABI + contract interaction
│   │   ├── riskEngine.ts          # 6 risk assessment rules
│   │   ├── storage.ts             # localStorage CRUD
│   │   ├── llm.ts                 # LLM intent parsing
│   │   ├── agentRunner.ts         # End-to-end orchestrator
│   │   ├── demoScenarios.ts       # Preset demo scenarios
│   │   └── executeIntent.ts       # ERC20 approve execution
│   ├── hooks/
│   │   ├── useVerify.ts           # Proof verification
│   │   ├── useExecutionVerifier.ts # Calldata decode + compare
│   │   └── useWallet.ts           # MetaMask + Monad switching
│   ├── components/
│   │   ├── AgentDemo.tsx          # One-click demo stepper UI
│   │   ├── CreateReceiptModal.tsx # Receipt creation form
│   │   └── VerifyProofModal.tsx   # Proof verification modal
│   └── pages/
│       ├── Home.tsx               # Landing + agent demo
│       ├── MyReceipts.tsx         # Receipt list with status
│       └── ReceiptDetail.tsx      # Detail + execution linking
└── hardhat.config.ts
```

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

## License

MIT

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SafeReceipt is an Agent Accountability Protocol that creates verifiable on-chain receipts for AI agent transactions. Core value: "When AI fails, receipts prove who's responsible."

**Target**: Monad Testnet (Chain ID: 10143)

## Tech Stack

- **Contract**: Hardhat + Solidity 0.8.19, optimizer enabled (200 runs)
- **Frontend**: Vite + React 19 + TypeScript + Tailwind CSS v4
- **Chain Interaction**: ethers.js v6
- **Wallet**: MetaMask
- **AI**: OpenAI-compatible API (GPT-4o) for natural language intent parsing
- **Testing**: vitest + happy-dom + @testing-library/react

## Build & Deploy Commands

```bash
# Contract (requires Node 18; Node 22 has Hardhat compatibility issues)
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.ts --network monad

# Frontend
cd frontend && npm run dev       # Dev server at localhost:5173
cd frontend && npm run build     # tsc -b && vite build
cd frontend && npm run lint      # ESLint

# Frontend Testing
cd frontend && npm test                                              # Watch mode
cd frontend && npm test -- --run                                     # Run once
cd frontend && npm test -- --ui                                      # With UI
cd frontend && npm test -- src/lib/__tests__/riskEngine.test.ts      # Specific file
cd frontend && npx tsc --noEmit                                      # Type check only
```

## Critical Technical Constraints

### Canonicalization (Hash Reproducibility)

Field order is **fixed** -- any deviation breaks verification:
```
version, actionType, chainId, normalizedIntent, riskScore, rulesTriggered, liabilityNotice, createdAt
```

Rules:
- `rulesTriggered`: sort alphabetically before stringify
- `normalizedIntent`: sort keys alphabetically
- `createdAt`: Unix timestamp (integer seconds)
- Amounts: always string type
- JSON: no whitespace (compact)

The `CanonicalDigest` type also has optional runtime fields (`status`, `linkedTxHash`) that are **not** included in hash computation.

### Risk Rules (6 rules, fixed weights)

| Rule | Weight |
|------|--------|
| UNLIMITED_ALLOWANCE | 40 |
| SPENDER_IS_UNKNOWN_CONTRACT | 25 |
| REPEAT_APPROVE_PATTERN | 15 |
| DUPLICATE_RECIPIENTS | 10 |
| RECIPIENT_IS_CONTRACT | 5 |
| OUTLIER_AMOUNT | 5 |

### Contract Status Lifecycle

```
CREATED (0) → VERIFIED (2) or MISMATCH (3)
```

`linkExecution(receiptId, txHash, verified)` transitions from CREATED. Only the receipt owner can call it, and only once.

### Solidity Event Indexed Limit

Max 3 indexed parameters per event. Both `ReceiptCreated` and `ExecutionLinked` events follow this constraint.

## Core Architecture

### Receipt Lifecycle (3 steps)

```
1. CREATE:  Intent → Risk Analysis → Canonical Digest → keccak256 → Store on-chain + localStorage
2. EXECUTE: Agent/user executes the actual blockchain transaction
3. VERIFY:  Link txHash → Decode calldata → Compare against intent → VERIFIED / MISMATCH
```

### Proof Verification (useVerify hook)

```
On-chain proofHash  ←→  keccak256(canonicalizeDigest(localDigest))
```

Match = data integrity proven. Mismatch = tampered.

### Execution Verification (useExecutionVerifier hook)

```
Fetch tx by hash → Decode ERC20 approve(spender, amount) → Compare token/spender/amount against stored intent
```

### localStorage Schema

```
safereceipt:digest:{receiptId}    → CanonicalDigest JSON (includes optional status, linkedTxHash)
safereceipt:receipts:{address}    → receiptId[] array
```

### Contract Interaction Pattern

```typescript
// Read-only (no wallet needed)
const provider = getReadOnlyProvider();
const contract = createReceiptRegistryContract(provider);
const receipt = await contract.getReceipt(receiptId);

// Write (requires wallet)
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
const contract = createReceiptRegistryContract(provider, signer);
const { receiptId, txHash } = await contract.createReceipt(...);
await contract.linkExecution(receiptId, txHashBytes32, verified);
```

### LLM Integration

`llm.ts` calls an OpenAI-compatible API to parse natural language like "Approve 100 USDC to Uniswap" into structured intent. Config via env vars: `VITE_OPENAI_API_KEY`, `VITE_OPENAI_BASE_URL`, `VITE_OPENAI_MODEL`.

## Key Files

- **contracts/ReceiptRegistry.sol**: On-chain storage with Status enum and linkExecution
- **frontend/src/lib/canonicalize.ts**: Deterministic hashing (must match exactly for verify)
- **frontend/src/lib/contract.ts**: ABI, types (Receipt, ReceiptStatus), ReceiptRegistryContract class
- **frontend/src/lib/riskEngine.ts**: 6 risk rules implementation
- **frontend/src/lib/storage.ts**: localStorage CRUD + updateDigestStatus
- **frontend/src/lib/llm.ts**: LLM-powered natural language intent parsing
- **frontend/src/hooks/useVerify.ts**: Proof verification (chain hash vs local hash)
- **frontend/src/hooks/useExecutionVerifier.ts**: ERC20 calldata decoding + intent comparison
- **frontend/src/hooks/useWallet.ts**: MetaMask connection and Monad network switching
- **frontend/src/lib/agentRunner.ts**: End-to-end lifecycle orchestrator (parse → risk → receipt → execute → verify)
- **frontend/src/lib/demoScenarios.ts**: Preset demo scenarios with fallback intents
- **frontend/src/lib/executeIntent.ts**: ERC20 approve execution with mock fallback
- **frontend/src/components/AgentDemo.tsx**: One-click agent demo stepper UI
- **frontend/src/pages/ReceiptDetail.tsx**: Receipt detail with Link Execution UI

## Testing

- **172 tests** across 7 test files
- Unit tests: `frontend/src/lib/__tests__/` (canonicalize, storage, liabilityNotice, riskEngine, knownContracts, intentParser)
- Hook tests: `frontend/src/hooks/__tests__/useVerify.test.ts`
- Critical invariant: same canonical input must always produce the same hash

## Monad Testnet

```
Chain ID: 10143
RPC: https://testnet-rpc.monad.xyz
Explorer: https://testnet.monadscan.com
Currency: MON (18 decimals)
```

Contract address placeholder in `contract.ts` -- update after deployment.

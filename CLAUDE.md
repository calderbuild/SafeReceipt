# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SafeReceipt is an Agent Accountability Protocol that creates verifiable on-chain receipts for AI agent transactions. Core value: "When AI fails, receipts prove who's responsible."

**Target**: Monad Testnet (Chain ID: 10143)
**Hackathon**: Rebel in Paradise AI Hackathon (Monad Blitz Pro Series), Jan 19 - Feb 28, 2026. Registration: https://mojo.devnads.com/events/10

## Tech Stack

- **Contract**: Hardhat + Solidity 0.8.19, optimizer enabled (200 runs)
- **Frontend**: Vite 7 + React 19 + TypeScript 5.9 (strict) + Tailwind CSS v4
- **Chain Interaction**: ethers.js v6
- **Wallet**: MetaMask
- **AI**: OpenAI-compatible API (DeepSeek `deepseek-flash`, V4.1) for natural language intent parsing
- **Testing**: vitest + happy-dom + @testing-library/react
- **Linting**: ESLint 9 (flat config format in `frontend/eslint.config.js`)

Root and `frontend/` are **separate npm projects** (no workspace). Run `npm install` in each directory independently. Root uses TypeScript ~4.9.5 (Hardhat constraint), frontend uses ~5.9.3.

## Build & Deploy Commands

```bash
# Contract (requires Node 18; Node 22 has Hardhat compatibility issues)
npm run compile                  # hardhat compile
npm run test                     # hardhat test (contract tests)
npm run deploy:monad             # deploy to Monad testnet
npm run clean                    # hardhat clean

# Frontend (requires Node 20+; Vite 7 fails on Node 18 with crypto.hash error)
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

## Environment Variables

**Root `.env`** (for contract deployment):
```
PRIVATE_KEY=your_private_key_here
MONAD_RPC_URL=https://testnet-rpc.monad.xyz    # optional override
```

**Frontend `frontend/.env`** (for LLM intent parsing):
```
VITE_OPENAI_API_KEY=your-api-key
VITE_OPENAI_BASE_URL=https://api.deepseek.com
VITE_OPENAI_MODEL=deepseek-flash
```

Without LLM env vars, the agent demo uses preset fallback intents from `demoScenarios.ts`.

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

### Frontend Routing (React Router v7, SPA)

```
/              → Home (landing page + agent demo)
/receipts      → MyReceipts (list user's receipts with status badges)
/receipt/:id   → ReceiptDetail (detail view + link execution UI)
/fleet         → Fleet (V2: agents + receipts read from Monad, in-browser independent verification via lib/v2.ts)
```

`App.tsx` manages global state for Create/Verify modals and the floating navbar. Vercel deployment uses SPA rewrites (`vercel.json`).

### Mock Fallback Pattern

When `CONTRACT_CONFIG.address` is the zero address, `executeIntent.ts` returns simulated tx hashes with artificial delay instead of making real on-chain calls. Currently the contract is deployed and live; mock mode activates only if the address is reset to zero.

### LLM Integration

`llm.ts` calls an OpenAI-compatible API to parse natural language like "Approve 100 USDC to Uniswap" into structured intent. When API keys are not configured, `demoScenarios.ts` provides hardcoded fallback intents.

### Tailwind v4 (CSS-First)

No `tailwind.config.js`. All theming is defined via CSS variables in `frontend/src/index.css` using `@theme {}`:
- Palette: graphite desk + thermal paper + rubber-stamp green/red. `primary-*` is the stamp-green scale (500 = #1E9E74); `accent` amber; `dark-*` graphite; `paper`, `paper-ink`, `paper-faint`, `stamp-green`, `stamp-red` for receipt slips
- Fonts: `font-display` IBM Plex Sans Condensed, `font-body` IBM Plex Sans, `font-mono` IBM Plex Mono (loaded in `index.html`)
- Legacy class names are kept but restyled flat (`.glass-card*`, `.gradient-text`, `.btn-*`, `.badge-*`), so V1 screens reskin via tokens; don't reintroduce glow/glass/gradients
- Signature: `.receipt-slip` (torn edges via CSS mask), `.stamp` + `.stamp-verified|mismatch|pending`, `.stamp-press` (the only orchestrated animation; respects reduced motion)
- `.animate-delay-*` classes still exist but are zeroed (no staggered cascades)

PostCSS config is in `frontend/postcss.config.cjs` (CommonJS) using `@tailwindcss/postcss` + autoprefixer.

## Frontend Conventions

- **React 19 JSX transform**: `jsx: "react-jsx"` -- do not add `import React from 'react'`
- **State management**: Pure `useState`/hooks only. No Redux, Context API, or state libraries. Wallet state in `useWallet` hook; toast via `react-hot-toast`
- **`verbatimModuleSyntax`**: Type-only imports must use `import type { ... }`. Re-exports must be explicit
- **No barrel exports**: Types are exported from their defining module (no `types/index.ts`)
- **Intent types**: `ParsedIntent = ApproveIntent | BatchPayIntent` (discriminated union in `intentParser.ts`)

## Key Files

- **contracts/ReceiptRegistry.sol**: On-chain storage with Status enum and linkExecution
- **frontend/src/lib/canonicalize.ts**: Deterministic hashing (must match exactly for verify)
- **frontend/src/lib/contract.ts**: ABI, types (Receipt, ReceiptStatus), ReceiptRegistryContract class
- **frontend/src/lib/riskEngine.ts**: 6 risk rules implementation
- **frontend/src/lib/storage.ts**: localStorage CRUD + updateDigestStatus
- **frontend/src/lib/llm.ts**: LLM-powered natural language intent parsing
- **frontend/src/lib/intentParser.ts**: Address/amount validation, form-to-intent parsing, ParsedIntent types
- **frontend/src/lib/knownContracts.ts**: Whitelist of known protocol addresses (Uniswap, 1inch, etc.)
- **frontend/src/lib/walletErrors.ts**: MetaMask/ethers error mapping to human-readable messages
- **frontend/src/lib/exportEvidence.ts**: Evidence export for receipts
- **frontend/src/lib/liabilityNotice.ts**: Human-readable liability text generation
- **frontend/src/hooks/useVerify.ts**: Proof verification (chain hash vs local hash)
- **frontend/src/hooks/useExecutionVerifier.ts**: ERC20 calldata decoding + intent comparison
- **frontend/src/hooks/useWallet.ts**: MetaMask connection and Monad network switching
- **frontend/src/lib/v2.ts**: V2 registry reads (Monad), `hashTrace` (mirrors `wrapper/canonicalize.mjs`), `verifyIndependently`
- **frontend/src/pages/Fleet.tsx**: agent fleet + receipt slips with independent verification
- **frontend/src/components/ReceiptSlip.tsx**: thermal-receipt slip + rubber-stamp primitives (styles in `index.css`)
- **frontend/src/lib/agentRunner.ts**: End-to-end lifecycle orchestrator (parse → risk → receipt → execute → verify)
- **frontend/src/lib/demoScenarios.ts**: Preset demo scenarios with fallback intents
- **frontend/src/lib/executeIntent.ts**: ERC20 approve execution with mock fallback
- **frontend/src/components/AgentDemo.tsx**: One-click agent demo stepper UI
- **frontend/src/pages/ReceiptDetail.tsx**: Receipt detail with Link Execution UI

## Testing

- Unit tests: `frontend/src/lib/__tests__/` (canonicalize, storage, liabilityNotice, riskEngine, knownContracts, intentParser)
- Hook tests: `frontend/src/hooks/__tests__/useVerify.test.ts`
- Contract tests: `test/ReceiptRegistry.test.ts` (run via `npm run test` at root)
- Test environment: vitest + happy-dom, globals enabled (no imports needed for `describe`/`it`/`expect`)
- Critical invariant: same canonical input must always produce the same hash
- TypeScript strict mode enforced: `noUnusedLocals`, `noUnusedParameters`, and `noUncheckedSideEffectImports` will fail the build

## Monad Testnet

```
Chain ID: 10143
RPC: https://testnet-rpc.monad.xyz
Explorer: https://testnet.monadscan.com
Currency: MON (18 decimals)
```

Deployed contract: `0x7761871A017c1C703C06B0021bF341d707c6226A` (source verified on MonadScan).
Explorer: https://testnet.monadscan.com/address/0x7761871A017c1C703C06B0021bF341d707c6226A#code

## Commit Convention

Prefix: `feat:`, `fix:`, `docs:`, `refactor:`, `improve:`. One logical change per commit.

## Deployment

Frontend deploys to Vercel. `frontend/vercel.json` configures SPA rewrites (all routes → `/`). Build command: `npm run build`, output: `dist`.

**Git integration is on**: pushing to `main` deploys production (Vercel project `safereceipt`, team `jasons-projects-f68fdb32`, Root Directory = `frontend`).
Manual deploy, if ever needed, runs from the **repo root** (Root Directory already points at `frontend/`):
```bash
npx vercel --prod
```
`frontend/.vercelignore` excludes `.env*`: any `VITE_*` value is inlined into the public bundle, so the LLM key must never be present at build time. After a deploy, scan the live JS bundle for `sk-` shapes.

Live site: https://safereceipt.vercel.app

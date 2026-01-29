# feat: End-to-End Agent Demo Flow

## Overview

SafeReceipt currently requires 4+ manual steps (fill intent, review risk, submit receipt, manually link tx hash). This plan designs a one-click "Agent Demo" flow that automates the full accountability lifecycle, making the value proposition immediately visible to hackathon judges.

## Problem

Current manual flow:
```
1. User types intent (manual form or AI parse)
2. User clicks "Analyze Risk" (manual)
3. User clicks "Submit" to create receipt (manual)
4. User separately executes the actual tx (completely disconnected)
5. User copies tx hash, pastes into "Link Execution" (manual)
6. User clicks "Verify" (manual)
```

Steps 4-6 are the worst: the core value prop (intent-execution matching) requires the user to manually bridge two disconnected actions. No judge will sit through this.

## Proposed Solution

A "Run Agent Demo" button that executes the full lifecycle automatically with visible progress:

```
[Click] → Parse Intent → Risk Analysis → Create Receipt → Execute Tx → Link & Verify → Done
              1.5s           1.5s            2s              2s           1.5s
```

Each step shows real-time progress with named stages, intermediate results, and visual feedback.

## Technical Approach

### Architecture

Extract all business logic from React state machine into a pure orchestrator function. The React component only renders state changes.

```
src/lib/agentRunner.ts          -- Pure async orchestrator (no React dependency)
src/components/AgentDemo.tsx    -- UI: stepper + progress + results
src/lib/executeIntent.ts        -- ERC20 approve execution helper
```

### Phase 1: Agent Runner (Core Logic)

**File: `frontend/src/lib/agentRunner.ts`**

Pure async function that chains existing functions:

```typescript
interface AgentStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  result?: unknown;
}

type OnStepChange = (steps: AgentStep[]) => void;

async function runAgentDemo(
  input: string,              // Natural language or preset scenario
  signer: ethers.JsonRpcSigner,
  address: string,
  onStepChange: OnStepChange
): Promise<AgentDemoResult>
```

Steps inside:
1. `parseNaturalLanguageIntent(input)` → ParsedIntent
2. `parseApproveIntent(formData)` → ApproveIntent
3. `evaluateApprove(intent, options)` → RiskResult
4. `createCanonicalDigest(params)` → CanonicalDigest
5. `computeIntentHash()` + `computeProofHash()` → hashes
6. `contract.createReceipt(...)` or mock → receiptId
7. `saveDigest()` + `addReceiptToUser()`
8. `executeApprove(signer, token, spender, amount)` → executionTxHash (NEW)
9. `verifyExecution(receiptId, executionTxHash)` → VerificationResult
10. `updateDigestStatus(receiptId, status, txHash)`

All existing functions from `canonicalize.ts`, `riskEngine.ts`, `contract.ts`, `storage.ts`. Only step 8 is new.

### Phase 2: Execute Intent Helper

**File: `frontend/src/lib/executeIntent.ts`**

The missing piece: actually execute the on-chain transaction that the receipt describes.

```typescript
const ERC20_ABI = ['function approve(address spender, uint256 amount) returns (bool)'];

async function executeApprove(
  signer: ethers.JsonRpcSigner,
  token: string,
  spender: string,
  amount: string
): Promise<string>  // returns txHash
```

For demo mode (contract not deployed): return a mock tx hash with artificial delay.

### Phase 3: Demo Scenarios

**File: `frontend/src/lib/demoScenarios.ts`**

Pre-filled scenarios that judges can trigger instantly:

```typescript
const SCENARIOS = [
  {
    id: 'dangerous',
    label: 'Dangerous: Unlimited Approval to Unknown Contract',
    input: 'Approve unlimited USDT to 0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
    expectedRisk: 'HIGH (65+)',
  },
  {
    id: 'safe',
    label: 'Safe: 100 USDC to Uniswap',
    input: 'Approve Uniswap to use 100 USDC',
    expectedRisk: 'LOW (<10)',
  },
  {
    id: 'batch',
    label: 'Batch Pay: 3 Recipients',
    input: 'Send 50 USDC to 0xabc..., 0xdef..., 0x123...',
    expectedRisk: 'MEDIUM',
  },
];
```

### Phase 4: Agent Demo UI

**File: `frontend/src/components/AgentDemo.tsx`**

Vertical stepper component showing:

```
[x] Intent Parsed           "Approve USDC to Uniswap"  (AI confidence: 95%)
[x] Risk Analysis            Score: 5/100 -- LOW
[x] Receipt Created          #42 on Monad Testnet
[x] Transaction Executed     0x7a25...8D  ← actual approve() tx
[x] Verification             VERIFIED -- execution matches intent
```

Each step:
- Shows a spinner while running
- Shows result when complete
- Shows error with retry if failed
- Auto-advances to next step

### Phase 5: Integration

Add to Home page:
- "Run Agent Demo" section below the existing create modal trigger
- 2-3 scenario preset buttons
- Stepper component that runs the full flow

## Acceptance Criteria

- [x] One click triggers full lifecycle: parse → risk → receipt → execute → verify
- [x] Each step visible with named label and result
- [x] At least 2 demo scenarios (dangerous + safe) pre-configured
- [x] Works in mock mode (contract not deployed) with realistic delays
- [x] Works with real contract if deployed
- [x] Existing manual flow unchanged (not broken)
- [x] Status correctly updates to VERIFIED or MISMATCH in localStorage
- [x] All existing 172 tests still pass

## Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/agentRunner.ts` | NEW | Pure orchestrator function |
| `src/lib/executeIntent.ts` | NEW | ERC20 approve execution |
| `src/lib/demoScenarios.ts` | NEW | Pre-filled demo scenarios |
| `src/components/AgentDemo.tsx` | NEW | Stepper UI component |
| `src/pages/Home.tsx` | MODIFY | Add agent demo section |

## Risk

- **MetaMask pop-ups during demo**: Each on-chain tx triggers a wallet confirmation. In mock mode, skip this entirely. In real mode, warn the user upfront.
- **LLM API down**: Fall back to pre-parsed scenarios (skip the LLM call, use hardcoded ParsedIntent).
- **RPC latency**: Mock mode uses artificial delays (1-2s per step). Real mode may be slower -- show elapsed time.

## What This Does NOT Include

- Real Agent SDK (npm package for LangChain/AutoGPT integration)
- Multi-agent coordination
- Cross-chain support
- IPFS storage migration

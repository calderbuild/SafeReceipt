# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SafeReceipt is an Agent Accountability Protocol that creates verifiable on-chain receipts for AI agent transactions. Core value: "When AI fails, receipts prove who's responsible."

**Target**: Monad Testnet (Chain ID: 10143)

## Tech Stack

- **Contract**: Hardhat + Solidity 0.8.24 (evmVersion: "prague")
- **Frontend**: Vite + React + TypeScript + Tailwind CSS v4
- **Chain Interaction**: ethers.js v6
- **Wallet**: MetaMask
- **Testing**: vitest + happy-dom

## Build & Deploy Commands

```bash
# Contract
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.ts --network monad

# Frontend (from project root)
cd frontend && npm run dev
cd frontend && npm run build

# Frontend Testing
cd frontend && npm test              # Watch mode
cd frontend && npm test -- --run     # Run once
cd frontend && npm test -- --ui      # With UI
cd frontend && npm test -- src/lib/__tests__/riskEngine.test.ts  # Specific file
```

## Monad Testnet Config

```javascript
// hardhat.config.ts
networks: {
  monad: {
    url: "https://testnet-rpc.monad.xyz",
    chainId: 10143,
    accounts: [process.env.PRIVATE_KEY]
  }
}
solidity: {
  version: "0.8.24",
  settings: { evmVersion: "prague" }
}
```

## Critical Technical Constraints

### Canonicalization (Hash Reproducibility)

Field order is **fixed** - any deviation breaks verification:
```
version, actionType, chainId, normalizedIntent, riskScore, rulesTriggered, liabilityNotice, createdAt
```

Rules:
- `rulesTriggered`: sort alphabetically before stringify
- `normalizedIntent`: sort keys alphabetically
- `createdAt`: Unix timestamp (integer seconds)
- Amounts: always string type
- JSON: no whitespace (compact)

### Solidity Event Indexed Limit

Max 3 indexed parameters per event:
```solidity
event ReceiptCreated(
    uint256 indexed receiptId,
    address indexed actor,
    uint8 indexed actionType,
    bytes32 intentHash,      // NOT indexed
    bytes32 proofHash,
    uint8 riskScore,
    uint256 timestamp
);
```

### Risk Rules (MVP - 6 only)

| Rule | Weight |
|------|--------|
| UNLIMITED_ALLOWANCE | 40 |
| SPENDER_IS_UNKNOWN_CONTRACT | 25 |
| REPEAT_APPROVE_PATTERN | 15 |
| DUPLICATE_RECIPIENTS | 10 |
| RECIPIENT_IS_CONTRACT | 5 |
| OUTLIER_AMOUNT | 5 |

## Key Files Reference

- **PRD.md**: Complete product specification
- **plans/feat-safereceipt-mvp-full-implementation.md**: Implementation plan with task tracking
- **contracts/ReceiptRegistry.sol**: Core on-chain storage
- **frontend/src/lib/canonicalize.ts**: Hash generation logic (must match exactly for verify)
- **frontend/src/lib/storage.ts**: localStorage persistence layer
- **frontend/src/lib/liabilityNotice.ts**: Deterministic liability notice generation
- **frontend/src/lib/riskEngine.ts**: 6 MVP risk rules implementation
- **frontend/src/lib/knownContracts.ts**: Whitelisted contract addresses
- **frontend/src/lib/intentParser.ts**: Structured form input validation (Approve/BatchPay)
- **frontend/src/hooks/useVerify.ts**: Proof verification hook
- **frontend/src/hooks/useWallet.ts**: MetaMask connection and network switching
- **frontend/src/lib/contract.ts**: Contract interaction wrapper (ReceiptRegistryContract class)

## Core Architecture

### Verification Flow (Proof-of-Safe-Execution)

1. **Receipt Creation**:
   - User intent → Risk analysis → Generate canonical digest
   - Compute `intentHash = keccak256(normalizedIntent)`
   - Compute `proofHash = keccak256(canonicalDigest)`
   - Store digest in localStorage with key `safereceipt:digest:{receiptId}`
   - Submit to chain: `createReceipt(actionType, intentHash, proofHash, riskScore)`

2. **Proof Verification** (useVerify hook):
   - Fetch on-chain receipt by ID → get `proofHash`
   - Retrieve digest from localStorage
   - Recompute `proofHash` locally from stored digest
   - Compare: `onChainHash === localHash` → Valid/Invalid

3. **localStorage Schema**:
   ```
   safereceipt:digest:{receiptId}    → CanonicalDigest JSON
   safereceipt:receipts:{address}    → receiptId[] array
   ```

### Hook Architecture

- **useWallet**: MetaMask connection, network switching, account management
- **useVerify**: Proof verification (reads chain + localStorage, compares hashes)
- **useReceipts** (planned): Fetch user's receipt history from chain

### Contract Interaction Pattern

```typescript
// Read-only operations (no wallet needed)
const provider = getReadOnlyProvider();
const contract = createReceiptRegistryContract(provider);
const receipt = await contract.getReceipt(receiptId);

// Write operations (requires wallet)
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
const contract = createReceiptRegistryContract(provider, signer);
const { receiptId, txHash } = await contract.createReceipt(...);
```

## Testing

### Test Organization
- **Unit tests**: `frontend/src/lib/__tests__/*.test.ts`
- **Hook tests**: `frontend/src/hooks/__tests__/*.test.ts`
- **Test environment**: vitest + happy-dom (configured in vite.config.ts)
- **Current coverage**: 172 tests (canonicalize, storage, liabilityNotice, riskEngine, knownContracts, intentParser, useVerify)

### Critical Tests (Must Pass)
1. **Canonicalization**: Same input must produce identical hash across runs
2. **Verify Proof**: On-chain proofHash must match locally computed hash
3. **Determinism**: Field order changes or whitespace changes must produce different hashes
4. **localStorage**: Data persists across page reloads, export/import works

## Implementation Status

See `plans/feat-safereceipt-mvp-full-implementation.md` for detailed task tracking.

**Completed**:
- Phase 2: Canonicalization & Verification (canonicalize, storage, liabilityNotice, verify)
- Phase 3.1-3.3: Risk Engine, Known Contracts, Intent Parser
- useWallet hook and WalletConnect component

**In Progress**:
- Phase 3.4-3.6: Risk Card UI, Liability Notice component, BatchPay CSV

**Pending**:
- Phase 4: UI Polish (Create/Detail/History pages, error handling)
- Phase 5-6: Demo, deployment, hackathon submission

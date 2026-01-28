# SafeReceipt PRD v2.0

## Agent Accountability Protocol (AAP) - MVP / 10 Days / Solo

---

## 1. Executive Summary

**SafeReceipt** is an **Agent Accountability Protocol** that creates verifiable on-chain receipts for AI agent transactions, enabling liability attribution when things go wrong.

**Core Value Proposition**: "When AI fails, receipts prove who's responsible"

**Problem Solved**: When AI agents execute incorrect transactions, there's currently no way to:
- Prove what the user's original intent was
- Distinguish between AI misinterpretation vs user error
- Determine liability (developer / user / protocol)
- Provide evidence for dispute resolution

**Solution**: Notarize user intent + risk assessment on-chain BEFORE execution, creating an immutable audit trail for post-incident accountability.

---

## 2. Market Positioning

### 2.1 Competitive Landscape

| Layer | Existing Solution | SafeReceipt Position |
|-------|------------------|---------------------|
| Pre-tx Risk | x402-secure | Not competing |
| Intent Verification | None | **Our Focus** |
| Liability Attribution | None | **Our Focus** |
| Dispute Evidence | None | **Our Focus** |

### 2.2 Target Hackathons

| Hackathon | Track | Fit |
|-----------|-------|-----|
| Rebel in Paradise | Track 1: Agent-native Payments | Direct match - accountability for agent payments |
| Consensus HK 2026 | AI + Web3 | Direct match - solving AI agent trust gap |

### 2.3 Market Validation

- $236B projected AI Agent market by 2034
- $3.1B lost to Web3 exploits in H1 2025
- UETA Section 10(b) mandates error prevention mechanisms
- Zero existing infrastructure for AI agent liability attribution

---

## 3. Goals & Non-Goals

### 3.1 Goals (MVP Must-Have)

1. Generate verifiable receipts on Monad testnet
2. Cover two core scenarios:
   - **Approve**: Unlimited authorization interception
   - **Batch Pay**: Bulk payment risk audit
3. **Liability Attribution**: Record who approved what, with what warnings
4. **Verify Proof**: Local hash recalculation vs on-chain proofHash
5. **Export Evidence**: One-click export for dispute resolution
6. Demo deliverable in 2 minutes: Intent -> Risk Card -> On-chain Receipt -> Verify -> Export

### 3.2 Non-Goals (10-day scope exclusion)

- No swap routing, price oracles, cross-chain, AA wallet takeover
- No complex zk/TEE proofs
- No full indexer (use events + getLogs)
- No actual transaction execution (receipt only, not custody)

---

## 4. User Personas

### 4.1 Primary: AI Agent Operators

- Run AI agents for automated trading/payments
- Need audit trail when agent makes mistakes
- Want evidence for insurance claims or dispute resolution

### 4.2 Secondary: Web3 Newcomers

- Worried about phishing and unlimited approvals
- Don't understand contract risks
- Want verifiable proof of their intent

### 4.3 Tertiary: Team Finance/Ops

- Bulk payroll, bounties, airdrops
- Need audit trail for compliance
- Want liability protection documentation

---

## 5. Core User Flows

### 5.1 Flow A: Approve Audit -> Receipt -> Accountability

```
User Intent (NL) -> AI Normalization -> Risk Engine -> Risk Card
                                                          |
                                            [User Reviews Warnings]
                                                          |
                                            "Generate Proof" Button
                                                          |
                                            MetaMask Signs Receipt Tx
                                                          |
                                            On-chain Receipt Created
                                                          |
                                            Verify Proof / Export Evidence
```

**Steps:**
1. User inputs natural language intent: "Authorize Uniswap to use my USDC"
2. AI parses and generates **normalizedIntent** (structured: token, spender, amount)
3. Risk engine triggers rules -> outputs Risk Card (riskScore, rules, explanation, recommendations)
4. **Liability Notice**: Display "By proceeding, you acknowledge the above warnings"
5. User clicks **Generate Proof** -> MetaMask popup -> Send receipt tx to ReceiptRegistry
6. Frontend displays on-chain Receipt (including proofHash)
7. User can **Verify Proof** or **Export Evidence**

### 5.2 Flow B: Batch Pay Audit -> Receipt -> Accountability

1. User selects Batch Pay mode, pastes CSV: `address,amount`
2. AI generates normalizedIntent (array) and runs rule detection
3. Risk Card with **per-recipient risk flags**
4. Liability acknowledgment -> Write receipt -> Verify/Export

### 5.3 Flow C: Dispute Evidence Export (New)

1. User navigates to Receipt Detail page
2. Clicks **Export Evidence**
3. System generates JSON package containing:
   - Original normalized intent
   - Risk score and triggered rules at time of signing
   - Timestamp and block number
   - proofHash for verification
   - Instructions for third-party verification
4. Package can be submitted to arbitration systems

---

## 6. Functional Requirements

### 6.1 AI Risk Audit Engine

**Input**: Natural language (Approve) or CSV (Batch Pay)

**Output**:
- `riskScore` (0-100)
- `rulesTriggered` (rule ID list)
- `recommendations` (suggestion list)
- `liabilityNotice` (who bears responsibility given current warnings) **[NEW]**
- `digest` (canonical JSON for proofHash generation)

### 6.2 MVP Risk Rules (6 Rules Only)

| ID | Rule | Weight | Liability Implication |
|----|------|--------|----------------------|
| R1 | `UNLIMITED_ALLOWANCE` | 40 | User acknowledged infinite exposure |
| R2 | `SPENDER_IS_UNKNOWN_CONTRACT` | 25 | User proceeded despite unknown spender |
| R3 | `REPEAT_APPROVE_PATTERN` | 15 | User ignored frequency warning |
| R4 | `DUPLICATE_RECIPIENTS` | 10 | User confirmed duplicate addresses |
| R5 | `RECIPIENT_IS_CONTRACT` | 5 | User acknowledged contract recipient |
| R6 | `OUTLIER_AMOUNT` | 5 | User confirmed unusual amount |

**Scoring**: Simple weighted sum, capped at 100. Focus on explainability, not academic accuracy.

### 6.3 Receipt Generation & Verification

**On "Generate Proof":**
1. Generate `intentHash` = keccak256(canonicalIntent)
2. Generate `proofHash` = keccak256(canonicalDigest)
3. Call contract to write Receipt (MetaMask signature)

**Verify Proof:**
- Frontend reads on-chain receipt's `proofHash`
- Locally recalculate hash using same canonicalization
- Match -> Verified; Mismatch -> Alert

### 6.4 Evidence Export (New Feature)

**Export Package Structure:**
```json
{
  "version": "1.0",
  "receiptId": "123",
  "chainId": 10143,
  "actor": "0x...",
  "intentHash": "0x...",
  "proofHash": "0x...",
  "normalizedIntent": { ... },
  "riskScore": 85,
  "rulesTriggered": ["UNLIMITED_ALLOWANCE", "SPENDER_IS_UNKNOWN_CONTRACT"],
  "liabilityNotice": "User acknowledged high-risk approval despite warnings",
  "timestamp": 1706000000,
  "blockNumber": 12345678,
  "verificationInstructions": "To verify: hash the normalizedIntent with keccak256 and compare to intentHash"
}
```

---

## 7. Data Structure & Hash Specification (PoSE Spec v2)

### 7.1 canonicalKeys (Fixed Field Order)

```
version, actionType, chainId, normalizedIntent, riskScore, rulesTriggered, liabilityNotice, createdAt
```

**Note**: `recommendations` removed from hash to reduce variability. `liabilityNotice` added for accountability.

### 7.2 Canonicalization Standard (MVP Strict)

- Field order strictly follows canonicalKeys
- `rulesTriggered`: **sorted alphabetically** before output
- `createdAt`: Unix timestamp (seconds), integer
- All amounts as **string** (avoid floating point issues)
- JSON **no whitespace** (compact stringify)
- `normalizedIntent` fields also sorted alphabetically

**Critical**: intentHash must hash **normalizedIntent**, not raw natural language (reproducibility required).

### 7.3 Example Canonical Digest

```json
{"version":"1.0","actionType":"APPROVE","chainId":10143,"normalizedIntent":{"amount":"115792089237316195423570985008687907853269984665640564039457584007913129639935","spender":"0x1234...","token":"0xUSDC..."},"riskScore":85,"rulesTriggered":["SPENDER_IS_UNKNOWN_CONTRACT","UNLIMITED_ALLOWANCE"],"liabilityNotice":"User acknowledged unlimited approval to unknown contract","createdAt":1706000000}
```

---

## 8. Smart Contract Requirements (ReceiptRegistry)

### 8.1 Network Parameters (Monad Testnet)

| Parameter | Value |
|-----------|-------|
| Chain ID | 10143 |
| RPC | https://testnet-rpc.monad.xyz |
| Explorer | https://testnet.monadscan.com |
| Faucet | https://faucet.monad.xyz/ |
| Gas Limit | ~100,000 |
| evmVersion | `prague` (Hardhat config) |

### 8.2 Contract Storage (Minimal Structure)

```solidity
struct Receipt {
    uint256 receiptId;      // Auto-increment
    address actor;          // User address
    uint8 actionType;       // 1=Approve, 2=BatchPay
    bytes32 intentHash;     // Hash of normalized intent
    bytes32 proofHash;      // Hash of full digest
    uint8 riskScore;        // 0-100
    uint8 status;           // 0=CREATED (MVP only uses this)
    uint256 timestamp;      // Block timestamp
}

mapping(uint256 => Receipt) public receipts;
mapping(address => uint256[]) public userReceipts;
uint256 public nextReceiptId;
```

### 8.3 Events (Max 3 indexed - Solidity Limit)

```solidity
event ReceiptCreated(
    uint256 indexed receiptId,
    address indexed actor,
    uint8 indexed actionType,
    bytes32 intentHash,
    bytes32 proofHash,
    uint8 riskScore,
    uint256 timestamp
);
```

**Note**: Only 3 indexed parameters allowed per Solidity spec. intentHash moved to non-indexed.

### 8.4 Core Functions

```solidity
function createReceipt(
    uint8 actionType,
    bytes32 intentHash,
    bytes32 proofHash,
    uint8 riskScore
) external returns (uint256 receiptId);

function getReceipt(uint256 receiptId) external view returns (Receipt memory);

function getUserReceipts(address user) external view returns (uint256[] memory);
```

---

## 9. Frontend Requirements (Vite SPA)

### 9.1 Page 1: Create Receipt

**Layout:**
- Mode toggle: Approve / BatchPay
- Input area:
  - Approve: Natural language text input
  - BatchPay: CSV/multiline textarea
- "Analyze" button

**Risk Card (post-analysis):**
- Large risk score display (color-coded: green/yellow/red)
- Triggered rules list (expandable with explanations)
- **Liability Notice** (highlighted box) **[NEW]**
- Recommendations (copyable)
- Digest preview (collapsible)
- "Generate Proof (Write Receipt)" button

### 9.2 Page 2: Receipt Detail

**Layout:**
- On-chain receipt fields display
- Digest original (from local cache; note "only hash stored on-chain")
- "Verify Proof" button -> shows checkmark or X
- **"Export Evidence" button** -> downloads JSON package **[NEW]**
- Transaction link to Monadscan

### 9.3 Page 3: My Receipts

- List of user's receipts (filtered by actor address)
- Sortable by date, risk score
- Quick verify status indicator
- Click to navigate to Receipt Detail

### 9.4 Event Retrieval (No Indexer)

- Primary: ethers.js query `ReceiptCreated` events filtered by `actor`
- Fallback: `provider.getLogs(...)` when explorer is unstable
- Cache recent receipts in localStorage

---

## 10. Tech Stack (10-Day Optimal)

| Layer | Choice | Reason |
|-------|--------|--------|
| Contract | Hardhat (TypeScript) | AI coding friendly, good tooling |
| Frontend | Vite + React + TypeScript | Fast dev, hot reload |
| Styling | Tailwind CSS | Rapid UI iteration |
| Chain Interaction | ethers.js v6 | Standard, well-documented |
| AI Coding | Claude Code + Nora | User's preferred tools |
| Wallet | MetaMask | Universal support |

**Hardhat Config Note:**
```javascript
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "prague",
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    monad: {
      url: "https://testnet-rpc.monad.xyz",
      chainId: 10143,
      accounts: [process.env.PRIVATE_KEY]
    }
  }
};
```

---

## 11. Milestones (10 Days)

### Day 1-2: Contract & Basic Integration
- [ ] ReceiptRegistry contract implementation
- [ ] Deploy to Monad testnet
- [ ] Frontend wallet connection
- [ ] Basic write receipt / read events flow

### Day 3-4: Canonicalization & Verification
- [ ] Implement canonicalization logic (frontend)
- [ ] Hash generation (intentHash, proofHash)
- [ ] Verify Proof complete flow
- [ ] Test with mock data

### Day 5-6: Risk Engine & Rules
- [ ] Implement 6 MVP rules
- [ ] Risk scoring logic
- [ ] Liability notice generation **[NEW]**
- [ ] Risk card UI component
- [ ] Both Approve and BatchPay scenarios

### Day 7-8: UI Polish & Error Handling
- [ ] Modern UI design (clean, professional)
- [ ] Export Evidence feature **[NEW]**
- [ ] MetaMask error handling (reject, network switch)
- [ ] Loading states, toast notifications
- [ ] Mobile responsive (basic)

### Day 9: Demo & Materials
- [ ] Record 2-minute demo video
- [ ] Prepare comparison diagrams
- [ ] Write submission materials for both hackathons
- [ ] Deploy to production URL

### Day 10: Rehearsal & Bug Fixes
- [ ] Demo rehearsal (multiple runs)
- [ ] Fix discovered bugs
- [ ] Final submission

---

## 12. Acceptance Criteria (Definition of Done)

### 12.1 Core Functionality
- [ ] Approve scenario: Input -> Risk Card -> On-chain Receipt -> Verify OK
- [ ] BatchPay scenario: CSV -> Risk Card -> On-chain Receipt -> Verify OK
- [ ] Export Evidence: JSON package downloads with all required fields

### 12.2 Accountability Features
- [ ] Liability notice clearly displayed before signing
- [ ] Receipt contains all data needed for dispute resolution
- [ ] Evidence export includes verification instructions

### 12.3 User Experience
- [ ] Receipt history retrievable by actor address (recent N)
- [ ] Verify Proof works offline (after initial load)
- [ ] Error states handled gracefully

### 12.4 Demo Highlights (2 minutes)
1. **Unlimited approval interception** - Show warning, user acknowledges
2. **Batch payment anomaly** - Detect duplicate/outlier, display liability notice
3. **Offline verification** - Prove receipt integrity without network
4. **Evidence export** - Show dispute-ready package

---

## 13. Demo Script (2 Minutes)

### Opening (15s)
"When AI agents execute transactions, mistakes happen. But who's responsible? SafeReceipt creates verifiable proof of intent - so when things go wrong, there's no dispute about what was agreed."

### Demo 1: Approve Risk (45s)
1. Input: "Authorize Uniswap to use unlimited USDC"
2. Show: Risk score 85, UNLIMITED_ALLOWANCE triggered
3. Highlight: Liability notice - "You acknowledge infinite exposure"
4. Generate proof, show on-chain receipt

### Demo 2: Batch Pay (30s)
1. Paste CSV with duplicate address
2. Show: DUPLICATE_RECIPIENTS flagged
3. Quick generate proof

### Demo 3: Verification (20s)
1. Navigate to receipt
2. Click Verify Proof -> Green checkmark
3. Click Export Evidence -> Show JSON

### Closing (10s)
"SafeReceipt - making AI agent accountability verifiable on-chain."

---

## 14. Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Monad testnet instability | Medium | High | Have backup RPC, test early |
| MetaMask connection issues | Low | Medium | Clear error messages, retry logic |
| Canonicalization mismatch | Medium | High | Extensive unit tests, golden file tests |
| Time overrun on UI | Medium | Medium | Use component library, skip animations |
| AI parsing failures | Low | Low | Fallback to manual structured input |

---

## 15. Future Roadmap (Post-Hackathon)

Not in MVP scope, but potential directions:

1. **Integration with x402**: SafeReceipt as evidence layer for x402-secure
2. **Arbitration Protocol**: Direct integration with on-chain dispute resolution
3. **Insurance Integration**: Receipts as claim evidence
4. **Multi-chain**: Deploy to other EVM chains
5. **Agent SDK**: npm package for AI agent developers

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| Receipt | On-chain record of user intent and risk acknowledgment |
| proofHash | keccak256 hash of canonical digest, stored on-chain |
| intentHash | keccak256 hash of normalized intent structure |
| Canonical | Deterministic JSON format ensuring reproducible hashing |
| Liability Notice | Clear statement of responsibility given acknowledged risks |
| PoSE | Proof of Safe Execution - the underlying verification mechanism |

---

## Appendix B: Comparison with Alternatives

| Feature | Revoke.cash | HeyElsa | x402-secure | SafeReceipt |
|---------|-------------|---------|-------------|-------------|
| Pre-tx Warning | Limited | Yes | Yes | Yes |
| On-chain Proof | No | No | No | **Yes** |
| Liability Attribution | No | No | Partial | **Yes** |
| Dispute Evidence | No | No | No | **Yes** |
| Offline Verification | No | No | No | **Yes** |
| AI Agent Focus | No | Partial | Yes | **Yes** |

---

*Document Version: 2.0*
*Last Updated: 2026-01-26*
*Target: Rebel in Paradise + Consensus HK 2026 Hackathons*

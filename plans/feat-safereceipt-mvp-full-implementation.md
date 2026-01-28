# SafeReceipt MVP Full Implementation Plan

## Overview

基于 PRD v2.0 实现 Agent Accountability Protocol 完整 MVP，目标 Monad 测试网部署，支持两个黑客松提交（Rebel in Paradise + Consensus HK 2026）。

**核心价值**: "When AI fails, receipts prove who's responsible"

**技术栈**:
- Contract: Hardhat + Solidity 0.8.24 (evmVersion: "prague")
- Frontend: Vite + React + TypeScript + Tailwind CSS
- Chain: ethers.js v6 + MetaMask
- UI Development: `/ui-ux-pro-max` + `/frontend-design` skills

---

## Problem Statement

AI Agent 执行交易时，出现错误后无法：
1. 证明用户原始意图
2. 区分 AI 误解 vs 用户错误
3. 确定责任方
4. 提供争议仲裁证据

SafeReceipt 通过链上收据解决责任归属问题。

---

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Vite + React)                │
├──────────────┬──────────────┬──────────────┬───────────────┤
│  CreateReceipt│ ReceiptDetail│  MyReceipts  │  Components   │
│     Page     │    Page      │    Page      │  (RiskCard,   │
│              │              │              │   Wallet...)  │
├──────────────┴──────────────┴──────────────┴───────────────┤
│                         Hooks Layer                         │
│   useWallet.ts    useReceipts.ts    useRiskEngine.ts       │
├─────────────────────────────────────────────────────────────┤
│                          Lib Layer                          │
│  canonicalize.ts   riskEngine.ts   contract.ts   storage.ts│
└──────────────────────────────┬──────────────────────────────┘
                               │ ethers.js v6
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              ReceiptRegistry.sol (Monad Testnet)            │
│  - createReceipt()  - getReceipt()  - getUserReceipts()    │
│  - ReceiptCreated event (3 indexed params max)              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Phases

#### Phase 1: Contract & Basic Integration (Day 1-2)

**目标**: 合约部署 + 前端钱包连接 + 基础读写流程

**Tasks:**

- [ ] **1.1 初始化 Hardhat 项目**
  - Files: `hardhat.config.ts`, `package.json`, `.env.example`
  - Constraint: evmVersion 必须为 "prague"
  - Acceptance: `npx hardhat compile` 成功

- [ ] **1.2 实现 ReceiptRegistry 合约**
  - File: `contracts/ReceiptRegistry.sol`
  - Constraint: Event 最多 3 个 indexed 参数
  - Acceptance: 所有测试通过

```solidity
// contracts/ReceiptRegistry.sol
struct Receipt {
    address actor;          // 160 bits
    uint8 actionType;       // 8 bits
    uint8 riskScore;        // 8 bits
    uint40 timestamp;       // 40 bits
    bytes32 intentHash;     // 256 bits
    bytes32 proofHash;      // 256 bits
}

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

- [ ] **1.3 编写合约测试**
  - File: `test/ReceiptRegistry.test.ts`
  - Coverage: createReceipt, getReceipt, getUserReceipts, event emission
  - Acceptance: 100% 核心函数覆盖

- [ ] **1.4 部署脚本**
  - File: `ignition/modules/ReceiptRegistry.ts` 或 `scripts/deploy.ts`
  - Acceptance: 成功部署到 Monad testnet

- [ ] **1.5 初始化前端项目**
  - Command: `npm create vite@latest frontend -- --template react-ts`
  - Files: `frontend/vite.config.ts`, `frontend/tailwind.config.js`
  - Acceptance: `npm run dev` 启动成功

- [x] **1.6 实现 useWallet hook**
  - File: `frontend/src/hooks/useWallet.ts`
  - Features: connect, disconnect, network switch, account change listener
  - Acceptance: MetaMask 连接 Monad testnet 成功

- [ ] **1.7 基础合约交互**
  - File: `frontend/src/lib/contract.ts`
  - Features: readProvider, writeContract, ABI 导出
  - Acceptance: 可读取 receiptCount

#### Phase 2: Canonicalization & Verification (Day 3-4)

**目标**: 实现哈希生成和验证的核心逻辑（最关键阶段）

**Critical Constraints:**

```
canonicalKeys 顺序固定，不可变更:
version, actionType, chainId, normalizedIntent, riskScore, rulesTriggered, liabilityNotice, createdAt
```

**Tasks:**

- [x] **2.1 实现 canonicalize.ts**
  - File: `frontend/src/lib/canonicalize.ts`
  - Features:
    - `sortObjectKeys()` - 递归排序对象键
    - `canonicalizeDigest()` - 生成规范化 JSON
    - `computeIntentHash()` - keccak256(normalizedIntent)
    - `computeProofHash()` - keccak256(canonicalDigest)
  - Constraints:
    - `rulesTriggered`: 字母排序
    - `normalizedIntent`: 键字母排序
    - `createdAt`: Unix 秒级时间戳（整数）
    - 金额: 必须是字符串
    - JSON: 无空格（紧凑）
  - Acceptance: Golden test 通过

```typescript
// frontend/src/lib/canonicalize.ts
interface CanonicalDigest {
  version: string;           // "1.0"
  actionType: string;        // "APPROVE" | "BATCH_PAY"
  chainId: number;           // 10143
  normalizedIntent: object;  // 键已排序
  riskScore: number;         // 0-100
  rulesTriggered: string[];  // 已排序
  liabilityNotice: string;
  createdAt: number;         // Unix timestamp (seconds)
}
```

- [x] **2.2 Golden Test 用例**
  - File: `frontend/src/lib/__tests__/canonicalize.test.ts`
  - 测试向量:
    - 相同输入多次运行产生相同哈希
    - 字段顺序变化产生不同哈希
    - 空格/格式变化产生不同哈希
  - Acceptance: 10+ 测试用例全部通过

- [x] **2.3 liabilityNotice 生成算法**
  - File: `frontend/src/lib/liabilityNotice.ts`
  - 算法: 基于触发规则生成确定性文本
  - Template: `"User acknowledged: {sorted_rules_joined}"`
  - Acceptance: 相同规则集始终产生相同 notice

- [x] **2.4 localStorage 存储方案**
  - File: `frontend/src/lib/storage.ts`
  - Schema:
    ```
    safereceipt:digest:{receiptId} -> CanonicalDigest JSON
    safereceipt:receipts:{address} -> receiptId[]
    ```
  - Features: save, get, clear, export all
  - Acceptance: 跨页面数据持久化

- [x] **2.5 Verify Proof 完整流程**
  - File: `frontend/src/hooks/useVerify.ts`
  - Flow:
    1. 读取链上 proofHash
    2. 从 localStorage 获取原始 digest
    3. 本地重算 hash
    4. 对比返回 match/mismatch
  - Acceptance: 验证成功显示绿色勾，失败显示红色叉

#### Phase 3: Risk Engine & Rules (Day 5-6)

**目标**: 实现 6 条 MVP 风险规则和评分逻辑

**Risk Rules:**

| ID | Rule | Weight | Implementation |
|----|------|--------|----------------|
| R1 | UNLIMITED_ALLOWANCE | 40 | `amount === MAX_UINT256` |
| R2 | SPENDER_IS_UNKNOWN_CONTRACT | 25 | 不在白名单中 |
| R3 | REPEAT_APPROVE_PATTERN | 15 | localStorage 检查 24h 内同 token+spender |
| R4 | DUPLICATE_RECIPIENTS | 10 | BatchPay 数组去重检查 |
| R5 | RECIPIENT_IS_CONTRACT | 5 | `provider.getCode(address).length > 2` |
| R6 | OUTLIER_AMOUNT | 5 | 金额 > 用户历史中位数 * 10 |

**Tasks:**

- [x] **3.1 实现 riskEngine.ts**
  - File: `frontend/src/lib/riskEngine.ts`
  - Features:
    - `evaluateApprove(intent)` -> RiskResult
    - `evaluateBatchPay(recipients)` -> RiskResult
    - `calculateScore(rules)` -> number
  - Acceptance: 所有 6 条规则可独立触发

```typescript
// frontend/src/lib/riskEngine.ts
interface RiskResult {
  riskScore: number;           // 0-100
  rulesTriggered: string[];    // ["UNLIMITED_ALLOWANCE", ...]
  ruleDetails: RuleDetail[];   // 每条规则的详细信息
  recommendations: string[];   // 建议列表
  liabilityNotice: string;     // 责任声明
}
```

- [x] **3.2 Known Contracts 白名单**
  - File: `frontend/src/lib/knownContracts.ts`
  - Content: Monad testnet 上已知安全合约地址
  - MVP: 硬编码 10-20 个地址（Uniswap, USDC, etc.）
  - Acceptance: 白名单地址不触发 SPENDER_IS_UNKNOWN_CONTRACT

- [x] **3.3 Intent 解析器**
  - File: `frontend/src/lib/intentParser.ts`
  - MVP 方案: 结构化表单输入（非 AI 解析）
  - Fields:
    - Approve: token, spender, amount
    - BatchPay: CSV textarea
  - Acceptance: 可生成有效 normalizedIntent

- [x] **3.4 Risk Card UI 组件**
  - File: `frontend/src/components/RiskCard.tsx`
  - 使用 `/ui-ux-pro-max` 或 `/frontend-design` skill 开发
  - Features:
    - 大号风险分数（颜色编码）
    - 触发规则列表（可展开）
    - 责任声明高亮框
    - 建议（可复制）
  - Acceptance: 视觉清晰，信息完整

- [x] **3.5 Liability Notice 组件**
  - File: `frontend/src/components/LiabilityNotice.tsx`
  - 使用 `/frontend-design` skill 开发
  - Features: 醒目警告框，用户必须阅读
  - Acceptance: 在签名前清晰展示

- [x] **3.6 BatchPay CSV 解析**
  - File: `frontend/src/lib/csvParser.ts`
  - Format: `address,amount` per line
  - Validation: 地址格式，金额数值
  - Error handling: 返回行号和错误类型
  - Acceptance: 有效 CSV 正确解析，无效 CSV 显示具体错误

#### Phase 4: UI Polish & Error Handling (Day 7-8)

**目标**: 完善用户界面和错误处理

**UI Development**: 使用 `/ui-ux-pro-max` 和 `/frontend-design` skill

**Tasks:**

- [ ] **4.1 Create Receipt 页面**
  - File: `frontend/src/pages/CreateReceipt.tsx`
  - Layout:
    - 模式切换 (Approve / BatchPay)
    - 输入区域
    - "Analyze" 按钮
    - Risk Card 区域
    - "Generate Proof" 按钮
  - Acceptance: 完整流程可操作

- [ ] **4.2 Receipt Detail 页面**
  - File: `frontend/src/pages/ReceiptDetail.tsx`
  - Layout:
    - 链上数据展示
    - Digest 预览（折叠）
    - "Verify Proof" 按钮
    - "Export Evidence" 按钮
    - Monadscan 链接
  - Acceptance: 所有数据正确展示

- [ ] **4.3 My Receipts 页面**
  - File: `frontend/src/pages/MyReceipts.tsx`
  - Layout:
    - 收据列表（按时间排序）
    - 快速验证状态指示
    - 点击跳转详情
  - Acceptance: 历史记录可浏览

- [ ] **4.4 Export Evidence 功能**
  - File: `frontend/src/lib/exportEvidence.ts`
  - Output:
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
      "rulesTriggered": [...],
      "liabilityNotice": "...",
      "timestamp": 1706000000,
      "blockNumber": 12345678,
      "verificationInstructions": "..."
    }
    ```
  - Acceptance: JSON 下载成功，包含完整字段

- [ ] **4.5 MetaMask 错误处理**
  - File: `frontend/src/lib/walletErrors.ts`
  - Cases:
    - User rejected
    - Wrong network -> 提示切换
    - Insufficient gas
    - Transaction failed
  - Acceptance: 所有错误有友好提示

- [ ] **4.6 网络切换逻辑**
  - Features:
    - 检测当前网络
    - 提示添加 Monad testnet
    - 自动切换网络
  - Acceptance: 非 Monad 网络时引导用户切换

- [ ] **4.7 Loading States & Toasts**
  - Library: react-hot-toast 或类似
  - States: pending, success, error
  - Acceptance: 所有异步操作有加载指示

- [ ] **4.8 基础响应式设计**
  - Breakpoints: mobile, tablet, desktop
  - Acceptance: 移动端基本可用

#### Phase 5: Demo & Materials (Day 9)

**目标**: 录制 Demo + 准备提交材料

**Tasks:**

- [ ] **5.1 录制 2 分钟 Demo 视频**
  - Script:
    1. Opening (15s): 问题陈述
    2. Demo 1 (45s): Approve 无限授权拦截
    3. Demo 2 (30s): BatchPay 异常检测
    4. Demo 3 (20s): 验证 + 导出
    5. Closing (10s): Slogan
  - Acceptance: 视频清晰，流程完整

- [ ] **5.2 部署到生产 URL**
  - Platform: Vercel / Netlify
  - Domain: 可选自定义域名
  - Acceptance: 公开可访问

- [ ] **5.3 准备对比图**
  - Content: SafeReceipt vs Revoke.cash vs HeyElsa vs x402-secure
  - Format: 表格 + 视觉差异化
  - Acceptance: 差异化清晰

- [ ] **5.4 撰写提交材料**
  - Rebel in Paradise: Track 1 Agent-native Payments
  - Consensus HK: AI + Web3 track
  - Acceptance: 符合各黑客松要求

#### Phase 6: Rehearsal & Bug Fixes (Day 10)

**Tasks:**

- [ ] **6.1 Demo 彩排**
  - 运行 3+ 次完整 Demo
  - 记录问题点
  - Acceptance: 无阻塞性问题

- [ ] **6.2 修复发现的 Bug**
  - Priority: 影响 Demo 的优先
  - Acceptance: 核心流程无 Bug

- [ ] **6.3 最终提交**
  - Acceptance: 两个黑客松提交成功

---

## Acceptance Criteria

### Functional Requirements

- [ ] Approve 场景: Input -> Risk Card -> On-chain Receipt -> Verify OK
- [ ] BatchPay 场景: CSV -> Risk Card -> On-chain Receipt -> Verify OK
- [ ] Export Evidence: JSON 下载包含所有必要字段
- [ ] Canonicalization: 相同输入产生相同哈希（跨运行）

### Non-Functional Requirements

- [ ] 链上 proofHash 与本地计算匹配
- [ ] Event 过滤按 actor 地址可用
- [ ] MetaMask 错误处理覆盖主要场景

### Quality Gates

- [ ] 合约测试覆盖核心函数
- [ ] Canonicalization golden tests 通过
- [ ] 无 TypeScript 编译错误

---

## Dependencies & Prerequisites

### External Services

| Service | Purpose | Status |
|---------|---------|--------|
| Monad Testnet RPC | 链交互 | https://testnet-rpc.monad.xyz |
| Monad Faucet | 测试币 | https://faucet.monad.xyz/ |
| Monadscan | 区块浏览器 | https://testnet.monadscan.com |

### NPM Dependencies

**Root (Hardhat):**
```json
{
  "hardhat": "^2.19.0",
  "@nomicfoundation/hardhat-toolbox": "^4.0.0",
  "typescript": "^5.3.0",
  "dotenv": "^16.3.0"
}
```

**Frontend:**
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.20.0",
  "ethers": "^6.9.0",
  "vite": "^5.0.0",
  "tailwindcss": "^3.4.0"
}
```

---

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Monad testnet 不稳定 | Medium | High | 准备备用 RPC，早期测试 |
| Canonicalization 哈希不匹配 | Medium | Critical | 大量 golden tests |
| MetaMask 连接问题 | Low | Medium | 清晰错误提示 |
| UI 开发超时 | Medium | Medium | 使用 skill 加速，跳过动画 |
| evmVersion "prague" 不支持 | Low | High | 回退到 "cancun" |

---

## Critical Technical Decisions (Pre-Resolved)

### D1: AI 解析方案
**决定**: MVP 使用结构化表单输入，不依赖 LLM API
**原因**: 减少外部依赖，保证确定性

### D2: createdAt 时间戳来源
**决定**: 使用 `block.timestamp`，交易确认后存储
**原因**: 确保链上链下一致

### D3: Digest 存储位置
**决定**: localStorage，键为 `safereceipt:digest:{receiptId}`
**原因**: MVP 简化，后续可扩展至 IPFS

### D4: Known Contracts 来源
**决定**: 硬编码白名单 10-20 个地址
**原因**: MVP 快速迭代，后续可接入 registry

### D5: REPEAT_APPROVE_PATTERN 数据源
**决定**: 仅检查 SafeReceipt 本地历史（localStorage）
**原因**: 链上 approval 事件查询复杂，MVP 简化

---

## File Structure (Target)

```
SafeReceipt/
├── contracts/
│   └── ReceiptRegistry.sol
├── ignition/
│   └── modules/
│       └── ReceiptRegistry.ts
├── test/
│   └── ReceiptRegistry.test.ts
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── RiskCard.tsx
│   │   │   ├── LiabilityNotice.tsx
│   │   │   ├── WalletConnect.tsx
│   │   │   └── ReceiptList.tsx
│   │   ├── hooks/
│   │   │   ├── useWallet.ts
│   │   │   ├── useReceipts.ts
│   │   │   └── useVerify.ts
│   │   ├── lib/
│   │   │   ├── canonicalize.ts
│   │   │   ├── riskEngine.ts
│   │   │   ├── contract.ts
│   │   │   ├── storage.ts
│   │   │   ├── knownContracts.ts
│   │   │   ├── intentParser.ts
│   │   │   ├── csvParser.ts
│   │   │   ├── liabilityNotice.ts
│   │   │   ├── exportEvidence.ts
│   │   │   └── walletErrors.ts
│   │   ├── pages/
│   │   │   ├── CreateReceipt.tsx
│   │   │   ├── ReceiptDetail.tsx
│   │   │   └── MyReceipts.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── hardhat.config.ts
├── package.json
├── .env.example
├── PRD.md
└── CLAUDE.md
```

---

## References

### Internal
- PRD v2.0: `/mnt/d/Web3_program/SafeReceipt/PRD.md`
- CLAUDE.md: `/mnt/d/Web3_program/SafeReceipt/CLAUDE.md`

### External
- [Hardhat Documentation](https://hardhat.org/docs/getting-started)
- [ethers.js v6 Documentation](https://docs.ethers.org/v6/getting-started/)
- [Monad Developer Docs](https://docs.monad.xyz/)
- [Tailwind CSS with Vite](https://tailwindcss.com/docs/installation/using-vite)
- [Solidity Events - RareSkills](https://rareskills.io/post/ethereum-events)

---

*Plan Created: 2026-01-26*
*Target Hackathons: Rebel in Paradise + Consensus HK 2026*

# SafeReceipt

**AI agent 问责协议**：给 AI agent 的每一个动作开一张可验证的链上收据，小到一笔钱包交易，大到一整个 agent 舰队。

> AI 出错的时候，收据能说明该谁负责。

[English](README.md) · **[在线演示](https://safereceipt.vercel.app)** · **[Agent 舰队：在浏览器里亲自验证一张收据](https://safereceipt.vercel.app/fleet)** · Monad Testnet + Base Sepolia

---

AI agent 已经在替人发交易、查资料、审代码，但它**本来应该做什么**和**实际做了什么**，几乎没有可以核对的记录。SafeReceipt 分两层解决这个问题：

- **V1：交易收据。** 执行之前，先把声明的意图（一次 ERC20 approve、一笔批量转账）做成密码学证明写上链；执行之后，拿真实的链上交易去比对。
- **V2：agent 舰队问责。** 每个 agent 在链上有一个身份（参考 ERC-8004 的 ERC-721），它的每个动作，无论在链上还是链下（调研、代码审查、一个决定），都会留下一张防篡改的收据。核对时不需要信任 agent 的运营者。

## 两条验证路径，保证的强度不一样

| 路径                             | 机制                                                                                                           | 信任程度                                                                                                                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **链上动作**（approve、转账）    | 按哈希取回交易，解码 calldata，和声明的意图比对                                                                | **无需信任**：代码开源，任何人重跑都得到同样结果                                                                                                                                                            |
| **链下动作**（调研、审查、决策） | commit-reveal：agent 运行**之前**提交意图哈希，运行**之后**公开完整 trace 并把它的哈希上链，任何人都能独立复核 | **可发现篡改，但没有被证明为真**：能证明意图没有被事后改写、trace 没有被动过；不能证明 trace 完整、真实地记录了 agent 做的所有事。要做到这一点需要 TEE 证明或独立重跑，这写在路线图里，没有当作已完成来宣传 |

完整的能力边界见 [docs/ACCOUNTABILITY.md](docs/ACCOUNTABILITY.md)。

## 自己验证一张收据

打开 [/fleet](https://safereceipt.vercel.app/fleet)，点任意一张收据上的 **Verify independently**。浏览器会：

1. 从 [accountability-ledger](https://github.com/calderbuild/accountability-ledger) 拉取这张收据公开的 trace；
2. 在本地按规范化规则计算它的 keccak256；
3. 直接从 Monad 的 `ActionRegistry` 读出链上存的哈希；
4. 两者比对，同时检查 trace 里的 `declaredIntent` 是否和链上的 `intentHash` 一致。

整个过程只读链、不需要钱包，也不依赖这个网站的后端。2 号收据是一个故意留下的反例：security-scanner 声明只扫描 `docs/`，实际还读了 `test/`，所以记录的结果是 MISMATCH；而独立验证会显示证明它越界的证据完好无损。

## 工作原理

```
1. 提交   自然语言意图 → 风险评估 → keccak256 哈希 → 写上链
2. 执行   agent 发出交易（链上），或者执行任务并记录 trace（链下）
3. 验证   解码交易 calldata，或者重新拉取并哈希 trace → VERIFIED 或 MISMATCH
```

## 主要功能

- **意图哈希**：确定性的规范化规则，同一个意图永远得到同一个哈希
- **风险引擎**：执行前用 6 条规则给交易打分（0 到 100）
- **Agent 身份**：`AgentIdentityRegistry` 为每个 agent 铸造一个 ERC-721 身份（v1 由我本人的钱包托管，这一点公开说明，不夸大）
- **链上收据**：证明哈希存放在 Monad 和 Base Sepolia 上
- **执行验证**：把收据和真实交易关联起来，解码 calldata，确认和意图一致
- **链下 commit-reveal**：`linkOffChainOutcome()` 把验证扩展到没有交易可查的动作
- **公开证据库**：trace 发布在 [accountability-ledger](https://github.com/calderbuild/accountability-ledger)，可以对照链上哈希独立复核
- **浏览器内独立验证**：`/fleet` 页面把上面的复核过程一步一步展示出来

## 合约

- `ReceiptRegistry.sol`（V1）：`createReceipt`、`linkExecution`、`getReceipt`、`getUserReceipts`
- `AgentIdentityRegistry.sol`（V2）：`registerAgent(string agentTokenURI)`、`revokeAgent(uint256 agentId)`、`tokenURI`、`isActive`
- `ActionRegistry.sol`（V2）：`createReceipt(agentId, actionType, intentHash, proofHash, riskScore)`、`linkExecution(receiptId, txHash, verified, evidenceURI)`、`linkOffChainOutcome(receiptId, outcomeHash, verified, evidenceURI)`、`getReceipt`、`getAgentReceipts`

两条链上的地址见 [DEPLOYMENTS.md](DEPLOYMENTS.md)。V1 的合约源码已在 MonadScan 验证。

## 快速开始

需要：合约相关命令用 Node.js 18（Hardhat 2.x 在 Node 20 以上会报警告、行为异常），前端用 Node.js 20 以上（Vite 7 的要求）；MetaMask；Monad Testnet 的 MON 或 Base Sepolia 的 ETH。

```bash
git clone https://github.com/calderbuild/SafeReceipt.git
cd SafeReceipt
npm install                       # 合约依赖
cd frontend && npm install        # 前端依赖

cd frontend && npm run dev        # 本地开发，localhost:5173
cd frontend && npm test -- --run  # 前端单元测试
npm run compile                   # 编译 V1 + V2 合约（Node 18）
npm run test                      # 合约测试（Node 18）
```

如果要用自然语言解析意图，在 `frontend/.env` 里配置 `VITE_OPENAI_API_KEY`、`VITE_OPENAI_BASE_URL`、`VITE_OPENAI_MODEL`。不配置时，演示会使用预设的场景。注意：`VITE_` 开头的变量会被打进公开的前端包，所以不要在要部署到公网的构建里放真实的 key。

## 贡献者

- [Calder](https://github.com/calderbuild)

## 许可证

MIT，并承诺不改变开源许可。

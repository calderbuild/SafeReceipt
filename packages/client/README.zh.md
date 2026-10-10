# @safereceipt/client

[English](./README.md)

给 agent 的每一次工作开一张收据。agent 动手之前，先把“我要做什么”算成哈希写上链；干活时，每一步都记下来；干完后，拿记录和事先的声明比对，把记录公开，再把记录的哈希写上链。之后任何人都能在 [safereceipt.vercel.app/fleet](https://safereceipt.vercel.app/fleet) 上，用自己的浏览器重新下载记录、重新计算、和链上比对。

运行在 Monad 测试网。这是 0.1 早期版本，用起来哪里不顺手，欢迎在 [issues](https://github.com/calderbuild/SafeReceipt/issues) 里告诉我。

## 快速上手（大约 10 分钟）

需要 Node 18 以上，以及一个有少量测试网 MON 的钱包用来付 gas（[领水](https://faucet.monad.xyz)）。请用一个专门测试用的私钥，它只签测试网交易。

```bash
npm install @safereceipt/client ethers
```

```js
import { ethers } from "ethers";
import {
  AccountabilityClient,
  DEPLOYMENTS,
  evaluatePolicy,
  registerAgent,
} from "@safereceipt/client";

const signer = new ethers.Wallet(
  process.env.PRIVATE_KEY,
  new ethers.JsonRpcProvider(DEPLOYMENTS.monad.rpc)
);

// 每个 agent 只做一次：注册一个归你钱包所有的链上身份
const { agentId } = await registerAgent(signer, {
  name: "my-agent",
  role: "Summarizes docs",
  model: "gpt-x",
});

const client = new AccountabilityClient({ network: "monad", signer });

// 1. 动手之前：把要做什么、允许碰哪些地方写上链
const { receiptId } = await client.beginAction({
  agentId,
  declaredIntent: {
    goal: "Summarize docs/ for a new reader",
    declaredScope: ["docs/"],
  },
});

// 2. 干活时：记录每一步，以及碰了什么
client.emit("read", "Read docs/guide.md", 40, { touched: ["docs/guide.md"] });

// 3. 干完后：记录和声明比对，公开记录，把哈希写上链
const policy = evaluatePolicy(client.buildTrace(null));
const { status, evidenceURI } = await client.endAction({
  policyResult: policy,
});
console.log(receiptId, status, evidenceURI);
```

跑完后，你的 agent 和收据会出现在 [/fleet](https://safereceipt.vercel.app/fleet) 上。点 **Verify independently**，浏览器会自己下载记录、计算哈希、从链上读出哈希来比对。

可以直接运行的完整版本：`examples/minimal-agent.mjs`（默认只演练不发送；加 `SAFERECEIPT_SEND=1 PRIVATE_KEY=0x...` 才真的发）。

## 三个调用

| 调用                                                  | 什么时候     | 做什么                                                           |
| ----------------------------------------------------- | ------------ | ---------------------------------------------------------------- |
| `beginAction({ agentId, declaredIntent, riskScore })` | agent 开始前 | 计算意图哈希，调用 `createReceipt`（一笔交易）                   |
| `emit(stage, message, progress, data)`                | 干活时       | 追加一步记录；用到的文件或资源写在 `data.touched` 里             |
| `endAction({ policyResult, publish })`                | 干完后       | 计算记录哈希，公开记录，再调用 `linkOffChainOutcome`（一笔交易） |

`evaluatePolicy(trace)` 给记录打分：碰了 `declaredScope` 以外的东西（SCOPE_CREEP）、有出错的步骤、或记录为空，结果是 MISMATCH；超出 `budgetMs` 会记下来，但不算 MISMATCH。

## 记录放在哪里

默认存放在 SafeReceipt 网站上，地址是 `https://safereceipt.vercel.app/api/traces/monad/<receiptId>.json`。网站只接受开这张收据的钱包签名上传，只在开收据后 24 小时内、结果写上链之前接受，而且只接受一次；存进去的记录永远不会被覆盖（同一份记录重发没问题，方便写链失败后重试）。托管额度是每个钱包每天 20 份、全站每月 900 份，超出后请用自己的 publish 函数托管。记录是公开的，`emit()` 里不要放密钥或个人信息。

想自己托管记录，就传入 `evidenceBaseURL` 和一个 `publish(trace, receiptId)` 函数，让记录在函数返回前能从 `${evidenceBaseURL}/${receiptId}.json` 读到。

## 收据能证明什么，不能证明什么

- 能证明：意图是在干活之前写上链的；公开的记录就是链上登记的那一份，事后改不了。
- 不能证明：记录是完整的。记录由你自己的代码写，少记一步现在发现不了。要补上这一点，需要让 agent 在可信硬件（TEE）里运行，这在后续计划里。
- 详细说明：[docs/ACCOUNTABILITY.md](https://github.com/calderbuild/SafeReceipt/blob/main/docs/ACCOUNTABILITY.md)。

MIT 开源。

# Deployments

All addresses are on testnets. The app reads Monad Testnet (chain 10143) only.

## Current

### V1: ReceiptRegistry (on-chain approve receipts)

| Contract        | Monad Testnet                                |
| --------------- | -------------------------------------------- |
| ReceiptRegistry | `0x7761871A017c1C703C06B0021bF341d707c6226A` |

Receipts created from the home page demo (2026-09-25, deployer wallet, real approves on DemoUSD):

| receiptId | scenario                                      | on-chain status | execution tx                                                         |
| --------- | --------------------------------------------- | --------------- | -------------------------------------------------------------------- |
| 6         | safe: 100 dUSD to Permit2                     | VERIFIED        | `0x3f8a24e9d07ca5625087b4e690b9b1c9a4173b3378527b0b37ca8c384cb82340` |
| 7         | rogue: declared 100, actually approved 10,000 | MISMATCH        | `0x16a129cff2890898cc10e3ad4b707ae1ffcf0a196a73421a7204c8e7c408764e` |

Earlier V1 receipts were created before the app wrote verdicts on-chain and stay CREATED.

### V2.1: agent identities + action receipts (2026-09-25)

| Contract                                      | Monad Testnet                                |
| --------------------------------------------- | -------------------------------------------- |
| AgentIdentityRegistry                         | `0x65F4A584E88b7a9831dbC187E75EF7247c47fe6d` |
| ActionRegistry                                | `0x975bD215C549F315A066306B161119cec480c927` |
| DemoUSD (test ERC20, 6 decimals, public mint) | `0x5a3b52260C44cD1Ec70C7157131bC15913Cd835f` |

What changed from V2.0: `createReceipt` with an agentId requires the caller to own that agent and the agent not to be revoked (in V2.0 anyone could file under any agent); action type and risk score are range-checked; each link function only accepts its own action type; an off-chain link needs a non-empty outcome hash and evidence URI.

Registered agents (all controlled by the deployer wallet `0x636011edE26fCe9cb675Ac42543d69f3b9CcA9Dc`):

| agentId | name             | metadata                                                                                                |
| ------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| 1       | doc-researcher   | https://raw.githubusercontent.com/calderbuild/accountability-ledger/master/agents/doc-researcher.json   |
| 2       | code-reviewer    | https://raw.githubusercontent.com/calderbuild/accountability-ledger/master/agents/code-reviewer.json    |
| 3       | security-scanner | https://raw.githubusercontent.com/calderbuild/accountability-ledger/master/agents/security-scanner.json |

Receipts:

| receiptId | agent            | what ran                                                                                                                                                                                                  | status   | trace                                                                                                               |
| --------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| 1         | code-reviewer    | `wrapper/run-example.mjs`: the wrapper runs `npm run test` (a script, not an LLM); 50 passing                                                                                                             | VERIFIED | [traces/v2.1/1.json](https://raw.githubusercontent.com/calderbuild/accountability-ledger/master/traces/v2.1/1.json) |
| 2         | security-scanner | `wrapper/run-mismatch-demo.mjs`: staged. Declared scope is `docs/`; the script also reads the three files in `test/`. The reads happen, the overstep is scripted, SCOPE_CREEP fires on the recorded paths | MISMATCH | [traces/v2.1/2.json](https://raw.githubusercontent.com/calderbuild/accountability-ledger/master/traces/v2.1/2.json) |
| 3         | code-reviewer    | `wrapper/run-llm-review.mjs`: a real DeepSeek (`deepseek-flash`) call reviews `contracts/DemoUSD.sol`; the full model answer is in the trace | VERIFIED | [traces/v2.1/3.json](https://raw.githubusercontent.com/calderbuild/accountability-ledger/master/traces/v2.1/3.json) |

## Historical (not read by the app)

| Contract                     | Monad Testnet                                | Base Sepolia                                 |
| ---------------------------- | -------------------------------------------- | -------------------------------------------- |
| ReceiptRegistry (V1)         | (above)                                      | `0x96D698972c73a0fFe630e67b90e4D1998972f2a0` |
| AgentIdentityRegistry (V2.0) | `0x89FFce2796909addf5C8E4A924247d2F2715e133` | `0x9BE98CB90c4E92327c2a7DC68145765A6F5Cb428` |
| ActionRegistry (V2.0)        | `0x8aeee534f7C954fC1Fcb942c4DA8E58f779fcFA6` | `0x74656f2F834BaF5A53f1283D74Db395E8EcC3151` |

V2.0 Monad receipts #1 and #2 (same two runs, earlier versions of the scripts) have their traces at `traces/1.json` and `traces/2.json` in the ledger and still verify against the V2.0 ActionRegistry. The V2.0 #2 run only emitted an event saying it read `test/`; it did not read any file. No agents were registered on Base Sepolia.

## Redeploying V2.1

```bash
cp .env.example .env                       # set PRIVATE_KEY (Node 18 for Hardhat)
npm run deploy:v2:monad                    # writes wrapper/deployments.json
NETWORK=monad node wrapper/register-agents.mjs     # writes wrapper/agents.monad.json
export LEDGER_DIR=../accountability-ledger         # local clone you can push to
NETWORK=monad node wrapper/run-example.mjs         # VERIFIED receipt, trace published before linking
NETWORK=monad node wrapper/run-mismatch-demo.mjs   # staged MISMATCH receipt
```

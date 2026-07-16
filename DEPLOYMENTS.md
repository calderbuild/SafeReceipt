# Deployments

## V1 (original SafeReceipt, unchanged)

| Contract        | Monad Testnet                                | Base Sepolia                                 |
| --------------- | -------------------------------------------- | -------------------------------------------- |
| ReceiptRegistry | `0x7761871A017c1C703C06B0021bF341d707c6226A` | `0x96D698972c73a0fFe630e67b90e4D1998972f2a0` |

## V2 (BUIDL_QUESTS 2026 -- agent fleet accountability layer)

| Contract              | Monad Testnet (10143)                        | Base Sepolia (84532)                         |
| --------------------- | -------------------------------------------- | -------------------------------------------- |
| AgentIdentityRegistry | `0x89FFce2796909addf5C8E4A924247d2F2715e133` | `0x9BE98CB90c4E92327c2a7DC68145765A6F5Cb428` |
| ActionRegistry        | `0x8aeee534f7C954fC1Fcb942c4DA8E58f779fcFA6` | `0x74656f2F834BaF5A53f1283D74Db395E8EcC3151` |

Explorers:

- Monad: https://testnet.monadscan.com/address/{address}
- Base Sepolia: https://sepolia.basescan.org/address/{address}

## Registered agent identities (Monad Testnet)

The real subagent fleet, registered on `AgentIdentityRegistry`:

| agentId | name             | model  | tokenURI                                                                                                |
| ------- | ---------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| 1       | doc-researcher   | haiku  | https://raw.githubusercontent.com/calderbuild/accountability-ledger/master/agents/doc-researcher.json   |
| 2       | code-reviewer    | haiku  | https://raw.githubusercontent.com/calderbuild/accountability-ledger/master/agents/code-reviewer.json    |
| 3       | security-scanner | sonnet | https://raw.githubusercontent.com/calderbuild/accountability-ledger/master/agents/security-scanner.json |

## Evidence ledger

Public trace store: https://github.com/calderbuild/accountability-ledger

| receiptId | agent            | status                 | trace                                                                                    |
| --------- | ---------------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| 1         | code-reviewer    | VERIFIED               | https://raw.githubusercontent.com/calderbuild/accountability-ledger/master/traces/1.json |
| 2         | security-scanner | MISMATCH (scope creep) | https://raw.githubusercontent.com/calderbuild/accountability-ledger/master/traces/2.json |

## Redeploying

```bash
cp .env.example .env   # set PRIVATE_KEY
npm run deploy:v2:monad
npm run deploy:v2:baseSepolia
node wrapper/register-agents.mjs        # registers the fleet, writes wrapper/agents.monad.json
node wrapper/run-example.mjs            # one VERIFIED end-to-end receipt
node wrapper/run-mismatch-demo.mjs      # one MISMATCH end-to-end receipt
```

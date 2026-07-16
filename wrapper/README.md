# wrapper -- agent fleet accountability layer

Wraps a unit of agent work in the commit-reveal flow against `ActionRegistry.sol`.
Turns "the agent says it did X" into "here is the on-chain, independently
verifiable record of what it declared and what it produced."

## Files

| File                    | What it is                                                                                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canonicalize.mjs`      | Deterministic trace hashing. Port of `frontend/src/lib/canonicalize.ts` (sort keys -> compact JSON -> keccak256) so hashes reproduce in the browser's Verify Independently path.                                                        |
| `policy.mjs`            | PolicyEngine. Scores an action trace against its declared intent (scope creep, budget overrun, error, empty trace). Scoring shape ported from `scanner.py` / `riskEngine.ts`; rules are new (runtime behavior, not static definitions). |
| `abi.mjs`               | Minimal ABIs + deployed addresses + enums.                                                                                                                                                                                              |
| `accountability.mjs`    | `AccountabilityClient`: `beginAction` (commit intent on-chain) / `emit` (append PipelineEvent) / `endAction` (hash trace, link outcome).                                                                                                |
| `register-agents.mjs`   | Registers the real subagent fleet on `AgentIdentityRegistry`.                                                                                                                                                                           |
| `run-example.mjs`       | One real VERIFIED receipt end to end (wraps a real `npm run test` run).                                                                                                                                                                 |
| `run-mismatch-demo.mjs` | One real MISMATCH receipt (agent oversteps declared scope).                                                                                                                                                                             |

PipelineEvent shape (`{stage, message, progress, data, timestamp}`) is ported
from `agentcut/backend/pipeline.py`.

## Run

```bash
# .env must have PRIVATE_KEY (same deployer wallet as the contracts)
node wrapper/register-agents.mjs     # one-time: register the fleet
node wrapper/run-example.mjs         # VERIFIED path
node wrapper/run-mismatch-demo.mjs   # MISMATCH path
```

Each run: commits intent on-chain, runs the action, publishes the trace to the
[accountability-ledger](https://github.com/calderbuild/accountability-ledger)
repo, links the outcome on-chain, then re-fetches the published trace and
recomputes the hash to confirm it matches the chain.

## Trust boundary

See [`../docs/ACCOUNTABILITY.md`](../docs/ACCOUNTABILITY.md). Short version: the
chain timestamps the result immutably and makes the trace tamper-evident; it
does not attest that the trace is a truthful account of what the agent did.

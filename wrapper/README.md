# wrapper -- agent fleet accountability layer

Wraps a unit of agent work in the commit-reveal flow against `ActionRegistry.sol`.
Turns "the agent says it did X" into "here is the on-chain, independently
verifiable record of what it declared and what it produced."

## Files

| File                    | What it is                                                                                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canonicalize.mjs`      | Deterministic trace hashing. Port of `frontend/src/lib/canonicalize.ts` (sort keys -> compact JSON -> keccak256) so hashes reproduce in the browser's Verify Independently path.                                                        |
| `policy.mjs`            | PolicyEngine. Scores an action trace against its declared intent (scope creep, budget overrun, error, empty trace). Scoring shape ported from `scanner.py` / `riskEngine.ts`; rules are new (runtime behavior, not static definitions). |
| `abi.mjs`               | Minimal ABIs + enums. Addresses come from `deployments.json` (written by `scripts/deploy-v2.ts`); `RPC_URL` overrides the RPC.                                                                                                                                                                                              |
| `accountability.mjs`    | `AccountabilityClient`: `beginAction` (commit intent on-chain) / `emit` (append PipelineEvent) / `endAction({ policyResult, publish })` (hash the trace, publish it, and only then link the outcome on-chain).                                                                                                |
| `ledger.mjs`            | `ledgerPublisher`: commits the trace to a local accountability-ledger clone (its own git identity), pushes, and waits until the raw URL serves the same hash. `verifyAgainstChain`: the third-party check.                                                                                                                                                                           |
| `register-agents.mjs`   | Registers three agent identities (doc-researcher, code-reviewer, security-scanner) on `AgentIdentityRegistry`.                                                                                                                         |
| `run-example.mjs`       | VERIFIED path. The wrapper itself runs `npm run test` under the code-reviewer identity; a failed run fires ERROR_STAGE and lands MISMATCH.                                                                                                                                                                 |
| `run-mismatch-demo.mjs` | Staged MISMATCH path. Declared scope is `docs/`; the script also reads the files in `test/` and records their real paths, so SCOPE_CREEP fires. The overstep is scripted; the reads and the detection are real.                                                                                                                                                                             |

PipelineEvent shape (`{stage, message, progress, data, timestamp}`) is ported
from `agentcut/backend/pipeline.py`.

## Run

```bash
# run from the repo root (.env there must have PRIVATE_KEY); Node 18
export NETWORK=monad LEDGER_DIR=../accountability-ledger   # a clone you can push to
node wrapper/register-agents.mjs     # one-time: register the three agents
node wrapper/run-example.mjs         # VERIFIED path
node wrapper/run-mismatch-demo.mjs   # staged MISMATCH path
```

Each run: commits intent on-chain, runs the action, publishes the trace to
`traces/v2.1/` in the
[accountability-ledger](https://github.com/calderbuild/accountability-ledger)
repo, links the outcome on-chain once the trace is readable, then re-fetches the
published trace and recomputes the hash to confirm it matches the chain.
Traces are public and unredacted.

## Trust boundary

See [`../docs/ACCOUNTABILITY.md`](../docs/ACCOUNTABILITY.md). Short version: the
chain timestamps the result immutably and makes the trace tamper-evident; it
does not attest that the trace is a truthful account of what the agent did.

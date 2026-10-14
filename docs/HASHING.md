# How SafeReceipt hashes an off-chain receipt

An off-chain receipt stores two hashes on `ActionRegistry`: `intentHash`, committed before the agent runs, and `outcomeHash`, linked after it finishes. Anyone holding the published trace can recompute both. This page is the full rule set, so you can do it in any language. Test vectors are in [`wrapper/test-vectors.json`](../wrapper/test-vectors.json) (shipped in `@safereceipt/client` as `lib/test-vectors.json`).

## The rules

Both hashes are `keccak256` over the UTF-8 bytes of a canonical JSON string.

**Canonical JSON**

1. Sort the keys of every object alphabetically, at every depth. JavaScript's default sort compares UTF-16 code units; for ASCII keys (all keys SafeReceipt writes) that is the same as byte order.
2. Keep arrays in their original order.
3. Write compact JSON: no spaces or newlines between tokens. Strings are written the way `JSON.stringify` writes them, so non-ASCII characters stay as UTF-8, not `\u` escapes.
4. Numbers are integers, written as `JSON.stringify` writes them. Traces avoid floats and `undefined` values, because other JSON encoders can write or drop them differently.

**intentHash** = keccak256 of the canonical JSON of `trace.declaredIntent`, with nothing removed.

**outcomeHash** = keccak256 of the canonical JSON of the whole trace, after removing the top-level keys `status`, `linkedTxHash` and `outcomeHash` if they are present. A nested key with one of those names is kept.

The reference implementation is [`wrapper/canonicalize.mjs`](../wrapper/canonicalize.mjs) (about 40 lines). The browser's copy in `frontend/src/lib/v2.ts` is tested against the same vectors.

## Test vectors

`test-vectors.json` has three groups:

- `traces`: an input trace, its canonical string and its `outcomeHash`. Cases: key order, nested objects and arrays, runtime fields stripped, non-ASCII text, scalars.
- `intents`: a declared intent, its canonical string and its `intentHash`.
- `onChain`: Monad testnet receipt #1. Hashing its trace file gives the `outcomeHash` stored on-chain, and hashing its `declaredIntent` gives the stored `intentHash`. This one doesn't depend on our code agreeing with itself: the expected values come from the chain.

A new implementation is correct when it reproduces every `canonical` string byte for byte and every `hash`.

## Checking a live receipt

```bash
npx --package=@safereceipt/client safereceipt-verify 1 --network monad # or --network bohr; --json for machine output
```

It reads the receipt over a public RPC, fetches the trace from the receipt's `evidenceURI`, and runs four checks, all locally:

| Check          | Passes when                                                                  |
| -------------- | ---------------------------------------------------------------------------- |
| `OUTCOME_HASH` | the fetched trace hashes to the stored `outcomeHash`                         |
| `INTENT_HASH`  | the trace's `declaredIntent` hashes to the stored `intentHash`               |
| `IDS`          | the trace names this receipt id, agent id and chain id                       |
| `POLICY`       | re-running the policy rules on the trace gives the status the filer recorded |

Exit code 0 means every check passed, 1 means one failed, 2 means there is no outcome yet or the receipt could not be read. What a pass does and does not prove is in [ACCOUNTABILITY.md](./ACCOUNTABILITY.md).

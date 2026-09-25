import { useEffect, useState } from 'react';
import { ReceiptSlip, SlipRow, SlipRule, Stamp } from '../components/ReceiptSlip';
import { messageOf } from '../lib/errors';
import {
  listAgents,
  listReceipts,
  shortHash,
  verifyIndependently,
  V2_ADDRESSES,
  V2_NETWORK,
  type AgentProfile,
  type IndependentVerification,
  type V2Receipt,
} from '../lib/v2';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; agents: AgentProfile[]; receipts: V2Receipt[] };

const explorer = (address: string) => `${V2_NETWORK.blockExplorer}/address/${address}`;
const formatTime = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

// The public Monad RPC occasionally returns an empty error for a single eth_call; a short retry clears it.
async function readFleet(attempts = 3): Promise<LoadState> {
  for (let i = 1; ; i++) {
    try {
      const [agents, receipts] = await Promise.all([listAgents(), listReceipts()]);
      return { kind: 'ready', agents, receipts };
    } catch (error) {
      if (i === attempts) return { kind: 'error', message: messageOf(error) };
      await new Promise((resolve) => setTimeout(resolve, 600 * i));
    }
  }
}

export function Fleet() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    readFleet().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  };

  return (
    <main className="pt-24 pb-20 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 max-w-3xl">
          <h1 className="font-display text-4xl md:text-5xl font-semibold text-white mb-4">Agent fleet</h1>
          <p className="text-slate-300 text-lg leading-relaxed mb-5">
            These are the agents I run, each with an identity on-chain. Every receipt below can be checked from this
            page: your browser fetches the published evidence, hashes it, and compares the result with the hash stored
            on Monad. You don't have to trust this site to do it.
          </p>
          <p className="font-mono text-xs text-slate-500 leading-relaxed">
            {V2_NETWORK.name} · chain {V2_NETWORK.chainId} ·{' '}
            <a className="underline underline-offset-2 hover:text-slate-300" href={explorer(V2_ADDRESSES.agentIdentityRegistry)} target="_blank" rel="noopener noreferrer">
              AgentIdentityRegistry
            </a>{' '}
            ·{' '}
            <a className="underline underline-offset-2 hover:text-slate-300" href={explorer(V2_ADDRESSES.actionRegistry)} target="_blank" rel="noopener noreferrer">
              ActionRegistry
            </a>
            <br />
            The same contracts are deployed on Base Sepolia, where no agents are registered yet.
          </p>
        </header>

        {state.kind === 'loading' && <p className="font-mono text-sm text-slate-400">Reading the registries on {V2_NETWORK.name}…</p>}

        {state.kind === 'error' && (
          <div className="glass-card p-6 max-w-xl">
            <p className="text-white font-medium mb-1">Couldn't read the registries on {V2_NETWORK.name}.</p>
            <p className="text-sm text-slate-400 mb-4 font-mono break-words">{state.message}</p>
            <button onClick={retry} className="btn-secondary text-sm">Try again</button>
          </div>
        )}

        {state.kind === 'ready' && (
          <>
            <section className="mb-14" aria-labelledby="agents-heading">
              <h2 id="agents-heading" className="font-display text-xl font-semibold text-white mb-4">
                Agents <span className="text-slate-500 font-mono text-sm font-normal">({state.agents.length})</span>
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {state.agents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            </section>

            <section aria-labelledby="receipts-heading">
              <h2 id="receipts-heading" className="font-display text-xl font-semibold text-white mb-1">
                Receipts <span className="text-slate-500 font-mono text-sm font-normal">({state.receipts.length})</span>
              </h2>
              <p className="text-sm text-slate-400 mb-6">The stamp shows the recorded outcome. Verify to check that the evidence behind it is untouched.</p>
              {state.receipts.length === 0 ? (
                <p className="text-slate-400">No receipts on-chain yet.</p>
              ) : (
                <div className="grid lg:grid-cols-2 gap-8 items-start">
                  {state.receipts.map((receipt) => (
                    <ReceiptCard
                      key={receipt.id}
                      receipt={receipt}
                      agentName={state.agents.find((a) => a.id === receipt.agentId)?.metadata?.name}
                    />
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-500 mt-8 max-w-2xl leading-relaxed">
                What this check proves: the declared intent was committed before the agent ran, and the published trace
                has not changed since. What it does not prove: that the trace is a complete account of what the agent
                did. Details in{' '}
                <a className="underline underline-offset-2 hover:text-slate-300" href="https://github.com/calderbuild/SafeReceipt/blob/main/docs/ACCOUNTABILITY.md" target="_blank" rel="noopener noreferrer">
                  ACCOUNTABILITY.md
                </a>
                .
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function AgentCard({ agent }: { agent: AgentProfile }) {
  const name = agent.metadata?.name ?? `Agent #${agent.id}`;
  const count = agent.receiptIds.length;
  return (
    <article className="glass-card p-5">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-display text-lg font-semibold text-white">{name}</h3>
        <span className="font-mono text-xs text-slate-500">#{agent.id}</span>
      </div>
      {agent.metadata?.role && <p className="text-sm text-slate-400 mb-4 leading-relaxed">{agent.metadata.role}</p>}
      <div className="flex flex-wrap gap-2 text-xs font-mono">
        {agent.metadata?.model && <span className="badge-info">{agent.metadata.model}</span>}
        <span className={agent.active ? 'badge-success' : 'badge-danger'}>{agent.active ? 'active' : 'revoked'}</span>
        <span className="text-slate-500 self-center">{count === 0 ? 'no receipts yet' : `${count} receipt${count > 1 ? 's' : ''}`}</span>
      </div>
      {!agent.metadata && (
        <p className="text-xs text-slate-500 mt-3">
          Metadata unavailable.{' '}
          <a className="underline" href={agent.tokenURI} target="_blank" rel="noopener noreferrer">Open token URI</a>
        </p>
      )}
    </article>
  );
}

type VerifyState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; result: IndependentVerification };

function ReceiptCard({ receipt, agentName }: { receipt: V2Receipt; agentName?: string }) {
  const [verify, setVerify] = useState<VerifyState>({ kind: 'idle' });

  const run = async () => {
    setVerify({ kind: 'running' });
    try {
      setVerify({ kind: 'done', result: await verifyIndependently(receipt) });
    } catch (error) {
      setVerify({ kind: 'error', message: messageOf(error) });
    }
  };

  const recorded = receipt.status === 'VERIFIED' ? 'verified' : receipt.status === 'MISMATCH' ? 'mismatch' : 'pending';

  return (
    <ReceiptSlip>
      <div className="slip-row font-semibold">
        <span>SAFERECEIPT</span>
        <span>No. {String(receipt.id).padStart(4, '0')}</span>
      </div>
      <div className="text-[var(--color-paper-faint)]">{formatTime(receipt.timestamp)}</div>
      <SlipRule />
      <SlipRow label="Agent">{agentName ? `${agentName} (#${receipt.agentId})` : `#${receipt.agentId}`}</SlipRow>
      <SlipRow label="Action">{receipt.actionType}</SlipRow>
      {RUN_NOTES[receipt.id] && <SlipRow label="Run">{RUN_NOTES[receipt.id]}</SlipRow>}
      <SlipRow label="Intent hash">{shortHash(receipt.intentHash)}</SlipRow>
      <SlipRow label="Outcome hash">{shortHash(receipt.outcomeHash)}</SlipRow>
      <SlipRow label="Evidence">
        {receipt.evidenceURI ? (
          <a href={receipt.evidenceURI} target="_blank" rel="noopener noreferrer">{receipt.evidenceURI.split('/').slice(-2).join('/')}</a>
        ) : (
          'not linked yet'
        )}
      </SlipRow>
      <SlipRule />
      <div className="flex items-center justify-between gap-4 py-1">
        <span className="slip-label">Recorded outcome</span>
        <Stamp kind={recorded} label={receipt.status} />
      </div>
      <SlipRule />

      {verify.kind === 'idle' || verify.kind === 'running' ? (
        <button
          onClick={run}
          disabled={verify.kind === 'running' || !receipt.evidenceURI}
          className="w-full bg-paper-ink text-paper font-mono text-sm py-2.5 rounded-md hover:bg-black disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {verify.kind === 'running' ? 'Verifying…' : 'Verify independently'}
        </button>
      ) : verify.kind === 'error' ? (
        <div>
          <p className="mb-3">Couldn't verify: {verify.message}</p>
          <button onClick={run} className="underline">Try again</button>
        </div>
      ) : (
        <VerificationTrace receipt={receipt} result={verify.result} />
      )}
    </ReceiptSlip>
  );
}

// How each receipt was produced. Not recoverable from chain data, so stated here.
const RUN_NOTES: Record<number, string> = {
  1: 'live run of the contract test suite',
  2: 'staged: wrapper/run-mismatch-demo.mjs reads test/ on purpose to show scope creep being caught',
};

function VerificationTrace({ receipt, result }: { receipt: V2Receipt; result: IndependentVerification }) {
  const intact = result.outcomeMatches && result.intentMatches;
  const intent = result.trace.declaredIntent as { goal?: string; declaredScope?: string[] } | undefined;
  return (
    <div>
      <ol className="space-y-2 mb-4">
        <li>1. Fetched the published trace ({receipt.evidenceURI.split('/').pop()}).</li>
        <li>
          2. Hashed it in this browser:
          <br />
          <span className="text-[var(--color-paper-faint)]">{shortHash(result.recomputedOutcomeHash)}</span>
        </li>
        <li>
          3. Read the hash stored on {V2_NETWORK.name}:
          <br />
          <span className="text-[var(--color-paper-faint)]">{shortHash(receipt.outcomeHash)}</span>
        </li>
        <li>
          4. Compared them: outcome {result.outcomeMatches ? 'matches' : 'differs'}, declared intent{' '}
          {result.intentMatches ? 'matches' : 'differs'}.
        </li>
      </ol>
      {intent?.goal && (
        <>
          <SlipRule />
          <SlipRow label="Declared goal">{intent.goal}</SlipRow>
          {intent.declaredScope && <SlipRow label="Declared scope">{intent.declaredScope.join(', ')}</SlipRow>}
        </>
      )}
      <SlipRule />
      <div className="flex items-center justify-between gap-4 py-1">
        <p className="max-w-[60%]">
          {intact
            ? receipt.status === 'MISMATCH'
              ? 'The agent went outside what it declared, and the evidence showing that has not been altered.'
              : 'The evidence is exactly what was committed on-chain.'
            : 'The published trace no longer matches what was committed on-chain.'}
        </p>
        <Stamp kind={intact ? 'verified' : 'mismatch'} label={intact ? 'INTACT' : 'ALTERED'} press />
      </div>
    </div>
  );
}

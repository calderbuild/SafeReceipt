import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AgentCard, ReceiptCard } from '../components/FleetSlips';
import { explorer, receiptNo } from '../lib/fleet';
import { messageOf } from '../lib/errors';
import { ACCOUNTABILITY_URL, FEEDBACK_URL } from '../lib/links';
import { FLEET_PAGE_LIMIT, listAgents, listReceipts, V2_ADDRESSES, V2_NETWORK, type AgentProfile, type V2Receipt } from '../lib/v2';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      agents: AgentProfile[];
      agentTotal: number;
      receipts: (V2Receipt | { id: number; error: string })[];
      receiptTotal: number;
    };

// The public Monad RPC occasionally returns an empty error for a single eth_call; a short retry clears it.
async function readFleet(attempts = 3): Promise<LoadState> {
  for (let i = 1; ; i++) {
    try {
      const [agents, receipts] = await Promise.all([listAgents(), listReceipts()]);
      return { kind: 'ready', agents: agents.agents, agentTotal: agents.total, receipts: receipts.receipts, receiptTotal: receipts.total };
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
            Every agent registered on SafeReceipt's registry, each with an identity on-chain. The ones marked{' '}
            <span className="font-mono text-sm text-primary-300">run by SafeReceipt</span> are mine; anyone can register
            another. Every receipt below can be checked from this page: your browser fetches the published evidence,
            hashes it, and compares the result with the hash stored on Monad. You don't have to trust this site to do it.
          </p>
          <p className="text-slate-400 text-sm leading-relaxed mb-5">
            The agents run from a command line, not from this page: each run commits its intent, does the work,
            publishes its trace and links it on-chain, and its receipt shows up here.{' '}
            <Link to="/start" className="text-primary-300 hover:text-primary-200 underline underline-offset-4">
              Put your own agent here
            </Link>
            {' · '}
            <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white underline underline-offset-4">
              Tell us what broke
            </a>
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
            This page reads V2.1. The earlier V2.0 registries (Monad and Base Sepolia) are listed in DEPLOYMENTS.md.
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
                Agents <span className="text-slate-500 font-mono text-sm font-normal">({state.agentTotal})</span>
              </h2>
              {state.agentTotal > state.agents.length && <Capped shown={state.agents.length} total={state.agentTotal} what="agents" />}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {state.agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    count={state.receipts.filter((r) => 'agentId' in r && r.agentId === agent.id).length}
                  />
                ))}
              </div>
            </section>

            <section aria-labelledby="receipts-heading">
              <h2 id="receipts-heading" className="font-display text-xl font-semibold text-white mb-1">
                Receipts <span className="text-slate-500 font-mono text-sm font-normal">({state.receiptTotal})</span>
              </h2>
              <p className="text-sm text-slate-400 mb-6">
                Newest first. The stamp shows the outcome recorded on-chain. Verify re-checks it here: the evidence is
                untouched, it belongs to this receipt, and the policy rules give the same verdict. Each receipt number
                opens its own page, which you can share.
              </p>
              {state.receiptTotal > state.receipts.length && <Capped shown={state.receipts.length} total={state.receiptTotal} what="receipts" />}
              {state.receipts.length === 0 ? (
                <p className="text-slate-400">No receipts on-chain yet.</p>
              ) : (
                <div className="grid lg:grid-cols-2 gap-8 items-start">
                  {state.receipts.map((receipt) =>
                    'error' in receipt ? (
                      <div key={receipt.id} className="glass-card p-5 font-mono text-sm text-slate-400">
                        <Link className="underline" to={`/fleet/receipt/${receipt.id}`}>{receiptNo(receipt.id)}</Link> could not be read: {receipt.error}
                      </div>
                    ) : (
                      <ReceiptCard key={receipt.id} receipt={receipt} agent={state.agents.find((a) => a.id === receipt.agentId)} />
                    )
                  )}
                </div>
              )}
              <p className="text-xs text-slate-500 mt-8 max-w-2xl leading-relaxed">
                What this check proves: the declared intent was committed before the agent ran, and the published trace
                has not changed since. What it does not prove: that the trace is a complete account of what the agent
                did. Details in{' '}
                <a className="underline underline-offset-2 hover:text-slate-300" href={ACCOUNTABILITY_URL} target="_blank" rel="noopener noreferrer">
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

function Capped({ shown, total, what }: { shown: number; total: number; what: string }) {
  return (
    <p className="font-mono text-xs text-slate-500 mb-4">
      Showing the newest {shown} of {total} {what}; this page reads at most {FLEET_PAGE_LIMIT}. Older ones keep their own pages.
    </p>
  );
}

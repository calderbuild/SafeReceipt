import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AgentCard, ReceiptCard } from '../components/FleetSlips';
import { agentName, receiptNo } from '../lib/fleet';
import { messageOf } from '../lib/errors';
import { FEEDBACK_URL } from '../lib/links';
import { FLEET_PAGE_LIMIT, listAgentReceipts, readAgent, V2_NETWORK, type AgentProfile, type V2Receipt } from '../lib/v2';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; agent: AgentProfile; receipts: (V2Receipt | { id: number; error: string })[]; total: number };

/** /fleet/agent/:id, one agent and its receipts. */
export function FleetAgent() {
  const id = Number(useParams().id);
  const valid = Number.isSafeInteger(id) && id > 0;
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    Promise.all([readAgent(id), listAgentReceipts(id)])
      .then(([agent, { receipts, total }]) => {
        if (!cancelled) setState({ kind: 'ready', agent, receipts, total });
      })
      .catch((error) => {
        if (!cancelled) setState({ kind: 'error', message: messageOf(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [id, valid, attempt]);

  const retry = () => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  };

  return (
    <main className="pt-24 pb-20 px-4">
      <div className="max-w-6xl mx-auto">
        <nav className="font-mono text-xs text-slate-500 mb-6" aria-label="Breadcrumb">
          <Link to="/fleet" className="hover:text-slate-300 underline underline-offset-2">Agent fleet</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">Agent #{valid ? id : ''}</span>
        </nav>

        {!valid && <p className="text-white">That isn't an agent number. Agent pages look like /fleet/agent/1.</p>}

        {valid && state.kind === 'loading' && <p className="font-mono text-sm text-slate-400">Reading agent #{id} on {V2_NETWORK.name}…</p>}

        {valid && state.kind === 'error' && (
          <div className="glass-card p-6 max-w-xl">
            <p className="text-white font-medium mb-1">Couldn't read agent #{id} on {V2_NETWORK.name}.</p>
            <p className="text-sm text-slate-400 mb-4 font-mono break-words">{state.message}</p>
            <button onClick={retry} className="btn-secondary text-sm">Try again</button>
          </div>
        )}

        {valid && state.kind === 'ready' && (
          <>
            <h1 className="font-display text-4xl font-semibold text-white mb-6 break-words">{agentName(state.agent, id)}</h1>
            <div className="max-w-md mb-12">
              <AgentCard agent={state.agent} count={state.total} linked={false} />
            </div>
            <h2 className="font-display text-xl font-semibold text-white mb-1">
              Receipts <span className="text-slate-500 font-mono text-sm font-normal">({state.total})</span>
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Newest first{state.total > FLEET_PAGE_LIMIT ? `, the latest ${FLEET_PAGE_LIMIT}` : ''}. Verify re-checks any of them in
              this browser.{' '}
              <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-white">
                Tell us what broke
              </a>
            </p>
            {state.receipts.length === 0 ? (
              <p className="text-slate-400">This agent hasn't filed a receipt yet.</p>
            ) : (
              <div className="grid lg:grid-cols-2 gap-8 items-start">
                {state.receipts.map((receipt) =>
                  'error' in receipt ? (
                    <div key={receipt.id} className="glass-card p-5 font-mono text-sm text-slate-400">
                      <Link className="underline" to={`/fleet/receipt/${receipt.id}`}>{receiptNo(receipt.id)}</Link> could not be read: {receipt.error}
                    </div>
                  ) : (
                    <ReceiptCard key={receipt.id} receipt={receipt} agent={state.agent} />
                  )
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ReceiptCard } from '../components/FleetSlips';
import { receiptNo } from '../lib/fleet';
import { messageOf } from '../lib/errors';
import { ACCOUNTABILITY_URL, FEEDBACK_URL } from '../lib/links';
import { readAgent, readReceipt, V2_NETWORK, type AgentProfile, type V2Receipt } from '../lib/v2';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; receipt: V2Receipt; agent?: AgentProfile };

/** /fleet/receipt/:id, one V2.1 receipt on its own shareable page. */
export function FleetReceipt() {
  const id = Number(useParams().id);
  const valid = Number.isSafeInteger(id) && id > 0;
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    (async () => {
      try {
        const receipt = await readReceipt(id);
        // The agent only adds a name; the receipt stands without it
        const agent = await readAgent(receipt.agentId).catch(() => undefined);
        if (!cancelled) setState({ kind: 'ready', receipt, agent });
      } catch (error) {
        if (!cancelled) setState({ kind: 'error', message: messageOf(error) });
      }
    })();
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
      <div className="max-w-xl mx-auto">
        <nav className="font-mono text-xs text-slate-500 mb-6" aria-label="Breadcrumb">
          <Link to="/fleet" className="hover:text-slate-300 underline underline-offset-2">Agent fleet</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">Receipt {valid ? receiptNo(id) : ''}</span>
        </nav>

        {!valid && <p className="text-white">That isn't a receipt number. Receipt pages look like /fleet/receipt/4.</p>}

        {valid && state.kind === 'loading' && <p className="font-mono text-sm text-slate-400">Reading receipt #{id} on {V2_NETWORK.name}…</p>}

        {valid && state.kind === 'error' && (
          <div className="glass-card p-6">
            <p className="text-white font-medium mb-1">Couldn't read receipt #{id} on {V2_NETWORK.name}.</p>
            <p className="text-sm text-slate-400 mb-4 font-mono break-words">{state.message}</p>
            <button onClick={retry} className="btn-secondary text-sm">Try again</button>
          </div>
        )}

        {valid && state.kind === 'ready' && (
          <>
            <ReceiptCard receipt={state.receipt} agent={state.agent} standalone />
            <p className="text-xs text-slate-500 mt-8 leading-relaxed">
              Verify runs in your browser: it fetches the published trace, hashes it, and compares it with the hash on{' '}
              {V2_NETWORK.name}. It proves the trace hasn't changed since it was committed, not that it is a complete
              account of what the agent did (
              <a className="underline underline-offset-2 hover:text-slate-300" href={ACCOUNTABILITY_URL} target="_blank" rel="noopener noreferrer">
                details
              </a>
              ).
            </p>
            <p className="text-sm mt-4 flex flex-wrap gap-x-5 gap-y-2">
              <Link to={`/fleet/agent/${state.receipt.agentId}`} className="text-primary-300 hover:text-primary-200 underline underline-offset-4">
                Every receipt from agent #{state.receipt.agentId}
              </Link>
              <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white underline underline-offset-4">
                Tell us what broke
              </a>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ReceiptCard } from '../components/FleetSlips';
import { fleetPath, receiptNo } from '../lib/fleet';
import { messageOf } from '../lib/errors';
import { ACCOUNTABILITY_URL, FEEDBACK_URL } from '../lib/links';
import { useT } from '../lib/i18n';
import { FLEET_NETS, readAgent, readReceipt, type AgentProfile, type FleetNet, type V2Receipt } from '../lib/v2';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; receipt: V2Receipt; agent?: AgentProfile };

/** /fleet/receipt/:id (and /fleet/bot/receipt/:id), one V2.1 receipt on its own shareable page. */
export function FleetReceipt({ net = 'monad' }: { net?: FleetNet }) {
  const networkName = FLEET_NETS[net].network.name;
  const id = Number(useParams().id);
  const valid = Number.isSafeInteger(id) && id > 0;
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const t = useT();

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    (async () => {
      try {
        const receipt = await readReceipt(id, net);
        if (cancelled) return;
        setState({ kind: 'ready', receipt });
        if (receipt.agentId > 0) {
          const agent = await readAgent(receipt.agentId, net).catch(() => undefined);
          if (!cancelled && agent) setState({ kind: 'ready', receipt, agent });
        }
      } catch (error) {
        if (!cancelled) setState({ kind: 'error', message: messageOf(error) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, valid, attempt, net]);

  const retry = () => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  };

  return (
    <main id="main-content" tabIndex={-1} className="site-page">
      <div className="max-w-2xl mx-auto">
        <nav className="font-mono text-xs text-slate-500 mb-6" aria-label={t('nav.breadcrumb')}>
          <Link to={fleetPath(net)} className="hover:text-slate-300 underline underline-offset-2">{t('nav.fleet')}</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">{t('fleet.receiptCrumb', { no: valid ? receiptNo(id) : '' })}</span>
        </nav>

        {!valid && <p className="text-white">{t('fleet.receiptInvalid')}</p>}

        {valid && state.kind === 'loading' && <p role="status" className="route-status">{t('fleet.receiptReading', { id, network: networkName })}</p>}

        {valid && state.kind === 'error' && (
          <div role="alert" className="glass-card p-6">
            <p className="text-white font-medium mb-1">{t('fleet.receiptError', { id, network: networkName })}</p>
            <p className="text-sm text-slate-400 mb-4 font-mono break-words">{state.message}</p>
            <button onClick={retry} className="btn-secondary text-sm">{t('fleet.tryAgain')}</button>
          </div>
        )}

        {valid && state.kind === 'ready' && (
          <>
            <header className="mb-6">
              <p className="text-sm text-slate-400 mb-2">{networkName}</p>
              <h1 className="page-heading text-white">{t('fleet.receiptCrumb', { no: receiptNo(id) })}</h1>
            </header>
            <ReceiptCard key={state.receipt.id} receipt={state.receipt} agent={state.agent} standalone net={net} />
            <p className="text-xs text-slate-500 mt-8 leading-relaxed">
              {t('fleet.receiptNote', { network: networkName })}
              <a className="underline underline-offset-2 hover:text-slate-300" href={ACCOUNTABILITY_URL} target="_blank" rel="noopener noreferrer">
                {t('fleet.details')}
              </a>
              {t('fleet.receiptNoteEnd')}
            </p>
            <p className="text-sm mt-4 flex flex-wrap gap-x-5 gap-y-2">
              {state.receipt.agentId > 0 && (
                <Link to={fleetPath(net, `/agent/${state.receipt.agentId}`)} className="text-primary-300 hover:text-primary-200 underline underline-offset-4">
                  {t('fleet.allFromAgent', { id: state.receipt.agentId })}
                </Link>
              )}
              <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white underline underline-offset-4">
                {t('start.stuck.link')}
              </a>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

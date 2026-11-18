import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AgentCard, ReceiptCard } from '../components/FleetSlips';
import { explorer, fleetPath, receiptNo } from '../lib/fleet';
import { messageOf } from '../lib/errors';
import { ACCOUNTABILITY_URL, BOT_CHAIN_URL, FEEDBACK_URL } from '../lib/links';
import { useT } from '../lib/i18n';
import { FLEET_NETS, FLEET_PAGE_LIMIT, listAgents, listReceipts, type AgentProfile, type FleetNet, type V2Receipt } from '../lib/v2';

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

// A public RPC occasionally returns an empty error for a single eth_call; a short retry clears it.
async function readFleet(net: FleetNet, attempts = 3): Promise<LoadState> {
  for (let i = 1; ; i++) {
    try {
      const [agents, receipts] = await Promise.all([listAgents(net), listReceipts(net)]);
      return { kind: 'ready', agents: agents.agents, agentTotal: agents.total, receipts: receipts.receipts, receiptTotal: receipts.total };
    } catch (error) {
      if (i === attempts) return { kind: 'error', message: messageOf(error) };
      await new Promise((resolve) => setTimeout(resolve, 600 * i));
    }
  }
}

export function Fleet({ net = 'monad' }: { net?: FleetNet }) {
  const { network, addresses } = FLEET_NETS[net];
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const t = useT();

  useEffect(() => {
    let cancelled = false;
    readFleet(net).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt, net]);

  const retry = () => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  };

  return (
    <main id="main-content" tabIndex={-1} className="site-page">
      <div className="max-w-6xl mx-auto">
        <header className="page-intro">
          <h1 className="page-heading text-white mb-4">
            {net === 'bot' ? t('fleet.bot.title') : t('fleet.monad.title')}
          </h1>
          {net === 'bot' ? <BotIntro /> : <MonadIntro />}
          <p className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-300 mb-4">
            {(['monad', 'bot'] as const).map((n) => (
              <span key={n}>
                {n === net ? (
                  <span className="font-semibold text-primary-300" aria-current="page">{FLEET_NETS[n].network.name}</span>
                ) : (
                  <Link to={fleetPath(n)} className="underline underline-offset-2 hover:text-slate-200">{FLEET_NETS[n].network.name}</Link>
                )}
              </span>
            ))}
          </p>
          <p className="font-mono text-xs text-slate-500 leading-relaxed">
            {network.name} · chain {network.chainId} ·{' '}
            <a className="underline underline-offset-2 hover:text-slate-300" href={explorer(addresses.agentIdentityRegistry, net)} target="_blank" rel="noopener noreferrer">
              AgentIdentityRegistry
            </a>{' '}
            ·{' '}
            <a className="underline underline-offset-2 hover:text-slate-300" href={explorer(addresses.actionRegistry, net)} target="_blank" rel="noopener noreferrer">
              ActionRegistry
            </a>
            {net === 'bot' && (
              <>
                {' · '}
                <a className="underline underline-offset-2 hover:text-slate-300" href={BOT_CHAIN_URL} target="_blank" rel="noopener noreferrer">
                  botchain.ai
                </a>
                {' · '}
                <a className="underline underline-offset-2 hover:text-slate-300" href={network.blockExplorer} target="_blank" rel="noopener noreferrer">
                  scan.botchain.ai
                </a>
              </>
            )}
            {net === 'monad' && (
              <>
                <br />
                {t('fleet.v20Note')}
              </>
            )}
          </p>
        </header>

        {state.kind === 'loading' && <p role="status" className="route-status">{t('fleet.reading', { network: network.name })}</p>}

        {state.kind === 'error' && (
          <div role="alert" className="glass-card p-6 max-w-xl">
            <p className="text-white font-medium mb-1">{t('fleet.errorTitle', { network: network.name })}</p>
            <p className="text-sm text-slate-400 mb-4 font-mono break-words">{state.message}</p>
            <button onClick={retry} className="btn-secondary text-sm">{t('fleet.tryAgain')}</button>
          </div>
        )}

        {state.kind === 'ready' && (
          <>
            <section className="mb-14" aria-labelledby="agents-heading">
              <h2 id="agents-heading" className="font-display text-xl font-semibold text-white mb-4">
                {t('fleet.agents')} <span className="text-slate-500 font-mono text-sm font-normal">({state.agentTotal})</span>
              </h2>
              {state.agentTotal > state.agents.length && <Capped shown={state.agents.length} total={state.agentTotal} what={t('fleet.what.agents')} />}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {state.agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    net={net}
                    count={state.receipts.filter((r) => 'agentId' in r && r.agentId === agent.id).length}
                  />
                ))}
              </div>
            </section>

            <section aria-labelledby="receipts-heading">
              <h2 id="receipts-heading" className="font-display text-xl font-semibold text-white mb-1">
                {t('fleet.receipts')} <span className="text-slate-500 font-mono text-sm font-normal">({state.receiptTotal})</span>
              </h2>
              <p className="text-sm text-slate-400 mb-6">
                {t('fleet.receiptsIntro')}
              </p>
              {state.receiptTotal > state.receipts.length && <Capped shown={state.receipts.length} total={state.receiptTotal} what={t('fleet.what.receipts')} />}
              {state.receipts.length === 0 ? (
                <p className="text-slate-400">{t('fleet.empty')}</p>
              ) : (
                <div className="grid lg:grid-cols-2 gap-8 items-start">
                  {state.receipts.map((receipt) =>
                    'error' in receipt ? (
                      <div key={receipt.id} className="glass-card p-5 font-mono text-sm text-slate-400">
                        <Link className="underline" to={fleetPath(net, `/receipt/${receipt.id}`)}>{receiptNo(receipt.id)}</Link>{' '}
                        {t('fleet.couldNotReadShort', { error: receipt.error })}
                      </div>
                    ) : (
                      <ReceiptCard key={receipt.id} receipt={receipt} agent={state.agents.find((a) => a.id === receipt.agentId)} net={net} />
                    )
                  )}
                </div>
              )}
              <p className="text-xs text-slate-500 mt-8 max-w-2xl leading-relaxed">
                {t('fleet.trustNote')}{' '}
                <a className="underline underline-offset-2 hover:text-slate-300" href={ACCOUNTABILITY_URL} target="_blank" rel="noopener noreferrer">
                  {t('fleet.trustDetails')} ACCOUNTABILITY.md
                </a>
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function MonadIntro() {
  const t = useT();
  return (
    <>
              <p className="text-slate-300 text-lg leading-relaxed mb-5">
                {t('fleet.monad.intro1')}
              </p>
              <p className="text-slate-400 text-sm leading-relaxed mb-5">
                {t('fleet.monad.intro2')}{' '}
                <Link to="/start" className="text-primary-300 hover:text-primary-200 underline underline-offset-4">
                  {t('fleet.putYourOwn')}
                </Link>
                {' · '}
                <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white underline underline-offset-4">
                  {t('start.stuck.link')}
                </a>
              </p>
    </>
  );
}

/** The BOT Chain pilot: scope stated up front, since a record on-chain says less than it can seem to. */
function BotIntro() {
  const t = useT();
  return (
    <>
      <p className="text-slate-300 text-lg leading-relaxed mb-5">
        {t('fleet.bot.intro1')}
      </p>
      <p className="text-slate-400 text-sm leading-relaxed mb-5">
        {t('fleet.bot.intro2')}
      </p>
    </>
  );
}

function Capped({ shown, total, what }: { shown: number; total: number; what: string }) {
  const t = useT();
  return (
    <p className="font-mono text-xs text-slate-500 mb-4">
      {t('fleet.capped', { shown, total, what, limit: FLEET_PAGE_LIMIT })}
    </p>
  );
}

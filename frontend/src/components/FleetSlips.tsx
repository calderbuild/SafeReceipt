import { Link } from 'react-router-dom';
import { useState } from 'react';
import { ReceiptSlip, SlipRow, SlipRule, Stamp } from './ReceiptSlip';
import { messageOf } from '../lib/errors';
import { agentName, explorer, fleetPath, formatTime, isDeployers, receiptNo } from '../lib/fleet';
import { t, useT } from '../lib/i18n';
import type { MessageKey } from '../lib/messages';
import { DEPLOYER, FLEET_NETS, shortHash, verifyIndependently, type AgentProfile, type FleetNet, type IndependentVerification, type V2Receipt } from '../lib/v2';

export function AgentCard({ agent, count, linked = true, net = 'monad' }: { agent: AgentProfile; count?: number; linked?: boolean; net?: FleetNet }) {
  const name = agentName(agent, agent.id);
  const t = useT();
  return (
    <article className="glass-card p-5">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="font-display text-lg font-semibold text-white break-words min-w-0">
          {linked ? (
            <Link to={fleetPath(net, `/agent/${agent.id}`)} className="hover:text-primary-200 underline-offset-4 hover:underline">
              {name}
            </Link>
          ) : (
            name
          )}
        </h3>
        <span className="font-mono text-xs text-slate-500 shrink-0">#{agent.id}</span>
      </div>
      {agent.metadata?.role && <p className="text-sm text-slate-400 mb-4 leading-relaxed">{agent.metadata.role}</p>}
      <div className="flex flex-wrap gap-2 text-xs font-mono">
        {isDeployers(agent) && (
          <span className="badge-info" title={t('slip.runByTitle')}>
            {t('slip.runBy')}
          </span>
        )}
        {agent.metadata?.model && (
          <span className="badge-info" title={t('slip.registeredAsTitle')}>
            {t('slip.registeredAs', { model: agent.metadata.model })}
          </span>
        )}
        <span className={agent.active ? 'badge-success' : 'badge-danger'}>{agent.active ? t('slip.active') : t('slip.revoked')}</span>
        {count !== undefined && (
          <span className="text-slate-500 self-center">
            {count === 0 ? t('slip.noReceipts') : t(count === 1 ? 'slip.receiptCountOne' : 'slip.receiptCount', { count })}
          </span>
        )}
      </div>
      <p className="font-mono text-xs text-slate-500 mt-3 break-all">
        {t('slip.owner')}{' '}
        <a className="underline underline-offset-2 hover:text-slate-300" href={explorer(agent.owner, net)} target="_blank" rel="noopener noreferrer">
          {shortHash(agent.owner)}
        </a>
      </p>
      {!agent.metadata && (
        <p className="text-xs text-slate-500 mt-2">
          {t('slip.metadataUnavailable')}{' '}
          <a className="underline" href={agent.tokenURI} target="_blank" rel="noopener noreferrer">{t('slip.openTokenUri')}</a>
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

/** One receipt as a thermal slip. On its own page (`standalone`) the number is not a link to itself. */
export function ReceiptCard({ receipt, agent, standalone = false, net = 'monad' }: { receipt: V2Receipt; agent?: AgentProfile; standalone?: boolean; net?: FleetNet }) {
  const [verify, setVerify] = useState<VerifyState>({ kind: 'idle' });
  const t = useT();

  const run = async () => {
    setVerify({ kind: 'running' });
    try {
      setVerify({ kind: 'done', result: await verifyIndependently(receipt, net) });
    } catch (error) {
      setVerify({ kind: 'error', message: messageOf(error) });
    }
  };

  const recorded = receipt.status === 'VERIFIED' ? 'verified' : receipt.status === 'MISMATCH' ? 'mismatch' : 'pending';
  // RUN_NOTES describe the deployer's own runs; another wallet's receipt with the same id is a different run
  const note = net === 'monad' && receipt.actor.toLowerCase() === DEPLOYER.toLowerCase() && receipt.id in RUN_NOTES
    ? t(`slip.runNote.${receipt.id}` as MessageKey)
    : undefined;

  return (
    <ReceiptSlip>
      <div className="slip-row font-semibold">
        <span>SAFERECEIPT</span>
        {standalone ? <span>{receiptNo(receipt.id)}</span> : <Link to={fleetPath(net, `/receipt/${receipt.id}`)}>{receiptNo(receipt.id)}</Link>}
      </div>
      <div className="text-[var(--color-paper-faint)]">{formatTime(receipt.timestamp)}</div>
      <SlipRule />
      <SlipRow label={t('slip.agent')}>
        {receipt.agentId === 0 ? (
          t('slip.anonymous')
        ) : (
          <Link to={fleetPath(net, `/agent/${receipt.agentId}`)}>
            {agent?.metadata?.name ? `${agent.metadata.name} (#${receipt.agentId})` : `#${receipt.agentId}`}
          </Link>
        )}
      </SlipRow>
      <SlipRow label={t('slip.filedBy')}>
        <a href={explorer(receipt.actor, net)} target="_blank" rel="noopener noreferrer">{shortHash(receipt.actor)}</a>
      </SlipRow>
      <SlipRow label={t('slip.action')}>{receipt.actionType}</SlipRow>
      {note && <SlipRow label={t('slip.run')}>{note}</SlipRow>}
      <SlipRow label={t('slip.intentHash')}>{shortHash(receipt.intentHash)}</SlipRow>
      <SlipRow label={t('slip.outcomeHash')}>{receipt.status === 'CREATED' ? t('slip.notLinked') : shortHash(receipt.outcomeHash)}</SlipRow>
      <SlipRow label={t('slip.evidence')}>
        {receipt.evidenceURI ? (
          <a href={receipt.evidenceURI} target="_blank" rel="noopener noreferrer">{receipt.evidenceURI.split('/').slice(-2).join('/')}</a>
        ) : (
          t('slip.notLinked')
        )}
      </SlipRow>
      <SlipRule />
      <div className="flex items-center justify-between gap-4 py-1">
        <span className="slip-label">{t('slip.recordedOutcome')}</span>
        <Stamp kind={recorded} label={receipt.status} />
      </div>
      <SlipRule />

      {verify.kind === 'idle' || verify.kind === 'running' ? (
        <button
          onClick={run}
          disabled={verify.kind === 'running' || !receipt.evidenceURI}
          className="w-full bg-paper-ink text-paper font-mono text-sm py-2.5 rounded-md hover:bg-black disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {verify.kind === 'running'
            ? t('slip.verifying')
            : receipt.evidenceURI
              ? t('slip.verifyIndependently')
              : t('slip.nothingToVerify')}
        </button>
      ) : verify.kind === 'error' ? (
        <div>
          <p className="mb-3">{t('slip.verifyError', { message: verify.message })}</p>
          <button onClick={run} className="underline">{t('slip.tryAgain')}</button>
        </div>
      ) : (
        <VerificationTrace receipt={receipt} result={verify.result} net={net} />
      )}
    </ReceiptSlip>
  );
}

// Which of the deployer's receipts have a hand-written run note; the text lives in the message catalogue.
const RUN_NOTES: Record<number, true> = { 1: true, 2: true, 3: true, 4: true };

function agentLine(receipt: V2Receipt, agent: IndependentVerification['agent']): string {
  if (agent.anonymous) return t('slip.agentLine.anonymous');
  const key = agent.filerOwnsAgent
    ? agent.revoked ? 'slip.agentLine.owns.revoked' : 'slip.agentLine.owns.active'
    : agent.revoked ? 'slip.agentLine.notOwns.revoked' : 'slip.agentLine.notOwns.active';
  return t(key, { id: receipt.agentId });
}

function VerificationTrace({ receipt, result, net }: { receipt: V2Receipt; result: IndependentVerification; net: FleetNet }) {
  const t = useT();
  const intact = result.outcomeMatches && result.intentMatches && result.idsMatch;
  const intent = result.trace.declaredIntent as { goal?: string; declaredScope?: string[] } | undefined;
  const rules = result.policy.rulesTriggered;
  return (
    <div>
      <ol className="space-y-2 mb-4">
        <li>1. {t('slip.verify.step1', { file: receipt.evidenceURI.split('/').pop() ?? '' })}</li>
        <li>
          2. {t('slip.verify.step2')}
          <br />
          <span className="text-[var(--color-paper-faint)]">{shortHash(result.recomputedOutcomeHash)}</span>
        </li>
        <li>
          3. {t('slip.verify.step3', { network: FLEET_NETS[net].network.name })}
          <br />
          <span className="text-[var(--color-paper-faint)]">{shortHash(receipt.outcomeHash)}</span>
        </li>
        <li>
          4. {t('slip.verify.step4', {
            outcome: result.outcomeMatches ? t('slip.verify.matches') : t('slip.verify.differs'),
            intent: result.intentMatches ? t('slip.verify.matches') : t('slip.verify.differs'),
            ids: result.idsMatch ? t('slip.verify.matches') : t('slip.verify.differs'),
          })}
        </li>
        <li>
          5. {t('slip.verify.policy', { rules: rules.length ? rules.join(', ') : t('slip.verify.noneFired') })}
          {result.policy.outOfScope.length > 0 && ` ${t('slip.verify.outsideScope', { scope: result.policy.outOfScope.join(', ') })}`}
          {' '}{t('slip.verify.verdict', {
            verdict: result.policy.verified ? 'VERIFIED' : 'MISMATCH',
            agrees: result.policyAgrees ? t('slip.verify.agreesWith') : t('slip.verify.contradicts'),
          })}
        </li>
        <li>6. {agentLine(receipt, result.agent)}</li>
      </ol>
      {intent?.goal && (
        <>
          <SlipRule />
          <SlipRow label={t('slip.verify.declaredGoal')}>{intent.goal}</SlipRow>
          {intent.declaredScope && <SlipRow label={t('slip.verify.declaredScope')}>{intent.declaredScope.join(', ')}</SlipRow>}
        </>
      )}
      <SlipRule />
      <div className="flex items-center justify-between gap-4 py-1">
        <p className="max-w-[60%]" data-testid="verify-verdict">
          {!intact
            ? t('slip.verify.altered')
            : !result.policyAgrees
              ? t('slip.verify.policyDisagrees')
              : receipt.status === 'MISMATCH'
                ? t('slip.verify.mismatchExplained')
                : t('slip.verify.intact')}
        </p>
        <Stamp kind={intact ? 'verified' : 'mismatch'} label={intact ? t('slip.stamp.intact') : t('slip.stamp.altered')} press />
      </div>
    </div>
  );
}

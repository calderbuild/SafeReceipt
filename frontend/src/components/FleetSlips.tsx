import { Link } from 'react-router-dom';
import { useState } from 'react';
import { ReceiptSlip, SlipRow, SlipRule, Stamp } from './ReceiptSlip';
import { messageOf } from '../lib/errors';
import { agentName, explorer, formatTime, isDeployers, receiptNo } from '../lib/fleet';
import { DEPLOYER, shortHash, verifyIndependently, V2_NETWORK, type AgentProfile, type IndependentVerification, type V2Receipt } from '../lib/v2';

export function AgentCard({ agent, count, linked = true }: { agent: AgentProfile; count?: number; linked?: boolean }) {
  const name = agentName(agent, agent.id);
  return (
    <article className="glass-card p-5">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="font-display text-lg font-semibold text-white break-words min-w-0">
          {linked ? (
            <Link to={`/fleet/agent/${agent.id}`} className="hover:text-primary-200 underline-offset-4 hover:underline">
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
          <span className="badge-info" title="Registered by the wallet that deployed SafeReceipt">
            run by SafeReceipt
          </span>
        )}
        {agent.metadata?.model && (
          <span className="badge-info" title="The model named in the on-chain registration. Each receipt's Run line says what actually ran.">
            registered as {agent.metadata.model}
          </span>
        )}
        <span className={agent.active ? 'badge-success' : 'badge-danger'}>{agent.active ? 'active' : 'revoked'}</span>
        {count !== undefined && (
          <span className="text-slate-500 self-center">{count === 0 ? 'no receipts yet' : `${count} receipt${count > 1 ? 's' : ''}`}</span>
        )}
      </div>
      <p className="font-mono text-xs text-slate-500 mt-3 break-all">
        owner{' '}
        <a className="underline underline-offset-2 hover:text-slate-300" href={explorer(agent.owner)} target="_blank" rel="noopener noreferrer">
          {shortHash(agent.owner)}
        </a>
      </p>
      {!agent.metadata && (
        <p className="text-xs text-slate-500 mt-2">
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

/** One receipt as a thermal slip. On its own page (`standalone`) the number is not a link to itself. */
export function ReceiptCard({ receipt, agent, standalone = false }: { receipt: V2Receipt; agent?: AgentProfile; standalone?: boolean }) {
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
  // RUN_NOTES describe the deployer's own runs; another wallet's receipt with the same id is a different run
  const note = receipt.actor.toLowerCase() === DEPLOYER.toLowerCase() ? RUN_NOTES[receipt.id] : undefined;

  return (
    <ReceiptSlip>
      <div className="slip-row font-semibold">
        <span>SAFERECEIPT</span>
        {standalone ? <span>{receiptNo(receipt.id)}</span> : <Link to={`/fleet/receipt/${receipt.id}`}>{receiptNo(receipt.id)}</Link>}
      </div>
      <div className="text-[var(--color-paper-faint)]">{formatTime(receipt.timestamp)}</div>
      <SlipRule />
      <SlipRow label="Agent">
        <Link to={`/fleet/agent/${receipt.agentId}`}>
          {agent?.metadata?.name ? `${agent.metadata.name} (#${receipt.agentId})` : `#${receipt.agentId}`}
        </Link>
      </SlipRow>
      <SlipRow label="Filed by">
        <a href={explorer(receipt.actor)} target="_blank" rel="noopener noreferrer">{shortHash(receipt.actor)}</a>
      </SlipRow>
      <SlipRow label="Action">{receipt.actionType}</SlipRow>
      {note && <SlipRow label="Run">{note}</SlipRow>}
      <SlipRow label="Intent hash">{shortHash(receipt.intentHash)}</SlipRow>
      <SlipRow label="Outcome hash">{receipt.status === 'CREATED' ? 'not linked yet' : shortHash(receipt.outcomeHash)}</SlipRow>
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
          {verify.kind === 'running' ? 'Verifying…' : receipt.evidenceURI ? 'Verify independently' : 'Nothing to verify until the outcome is linked'}
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

// How each of the deployer's receipts was produced. Not recoverable from chain data, so stated here.
const RUN_NOTES: Record<number, string> = {
  1: 'the wrapper ran npm run test itself (a script, not an LLM): 50 passing',
  2: 'staged: run-mismatch-demo.mjs makes the scanner read test/ as well as docs/. The reads really happen; the overstep is scripted',
  3: 'a real DeepSeek (deepseek-flash) call reviewed contracts/DemoUSD.sol; the full model answer is in the trace',
  4: 'a real DeepSeek (deepseek-flash) call summarized docs/ACCOUNTABILITY.md for a new reader; the full model answer is in the trace',
};

function VerificationTrace({ receipt, result }: { receipt: V2Receipt; result: IndependentVerification }) {
  const intact = result.outcomeMatches && result.intentMatches && result.idsMatch;
  const intent = result.trace.declaredIntent as { goal?: string; declaredScope?: string[] } | undefined;
  const rules = result.policy.rulesTriggered;
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
          {result.intentMatches ? 'matches' : 'differs'}, receipt and agent ids {result.idsMatch ? 'match' : 'differ'}.
        </li>
        <li>
          5. Re-ran the policy rules here: {rules.length ? rules.join(', ') : 'none fired'}
          {result.policy.outOfScope.length > 0 && ` (outside scope: ${result.policy.outOfScope.join(', ')})`}, so{' '}
          {result.policy.verified ? 'VERIFIED' : 'MISMATCH'}, which {result.policyAgrees ? 'agrees with' : 'contradicts'} the
          recorded status.
        </li>
        <li>
          6. Filer {result.actorOwnsAgent ? 'still owns' : 'no longer owns'} agent #{receipt.agentId}.
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
        <p className="max-w-[60%]" data-testid="verify-verdict">
          {!intact
            ? 'The published trace no longer matches what was committed on-chain.'
            : !result.policyAgrees
              ? 'The evidence is untouched, but the recorded status disagrees with the policy rules.'
              : receipt.status === 'MISMATCH'
                ? 'The trace shows the agent going outside what it declared, and it has not changed since it was committed.'
                : 'The evidence is exactly what was committed on-chain.'}
        </p>
        <Stamp kind={intact ? 'verified' : 'mismatch'} label={intact ? 'INTACT' : 'ALTERED'} press />
      </div>
    </div>
  );
}

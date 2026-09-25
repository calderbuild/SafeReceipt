import { Link } from 'react-router-dom';
import { AgentDemo } from '../components/AgentDemo';
import { ReceiptSlip, SlipRow, SlipRule, Stamp } from '../components/ReceiptSlip';
import { V2_ADDRESSES, V2_NETWORK } from '../lib/v2';

interface HomeProps {
  onCreateClick: () => void;
  onVerifyClick: () => void;
}

const V1_REGISTRY = 'https://testnet.monadscan.com/address/0x7761871A017c1C703C06B0021bF341d707c6226A#code';

const STEPS = [
  {
    title: 'Commit the intent',
    body: 'Before the agent acts, what it says it will do is normalized, hashed with keccak256, and written on-chain. It cannot be rewritten after the fact.',
  },
  {
    title: 'Let the agent work',
    body: 'Risk rules score the action first. The agent then sends its transaction, or runs its task off-chain and records a trace.',
  },
  {
    title: 'Check what happened',
    body: 'The transaction is decoded, or the trace is hashed, and compared against the commitment. The receipt ends up VERIFIED or MISMATCH.',
  },
];

const RULES = [
  { rule: 'UNLIMITED_ALLOWANCE', weight: 40, desc: 'Max uint256 approvals' },
  { rule: 'SPENDER_IS_UNKNOWN_CONTRACT', weight: 25, desc: 'Spender not on the known-protocol list' },
  { rule: 'REPEAT_APPROVE_PATTERN', weight: 15, desc: 'Repeated approvals to one spender' },
  { rule: 'DUPLICATE_RECIPIENTS', weight: 10, desc: 'Same address twice in a batch' },
  { rule: 'RECIPIENT_IS_CONTRACT', weight: 5, desc: 'Recipient has contract code' },
  { rule: 'OUTLIER_AMOUNT', weight: 5, desc: 'Amount far from the batch norm' },
];

function HeroSlip() {
  return (
    <Link to="/fleet" className="block rotate-[1.5deg] hover:rotate-0 transition-transform duration-300 max-w-sm mx-auto lg:mx-0 lg:ml-auto" aria-label="Receipt No. 0002, see it in the agent fleet">
      <ReceiptSlip>
        <div className="slip-row font-semibold">
          <span>SAFERECEIPT</span>
          <span>No. 0002</span>
        </div>
        <div className="text-[var(--color-paper-faint)]">2026-07-16 08:47 UTC · Monad</div>
        <SlipRule />
        <SlipRow label="Agent">security-scanner (#3)</SlipRow>
        <SlipRow label="Declared goal">Scan only the docs/ directory for leaked secrets</SlipRow>
        <SlipRow label="Declared scope">docs/</SlipRow>
        <SlipRule />
        <SlipRow label="Touched">docs/</SlipRow>
        <SlipRow label="Touched">test/ (outside scope)</SlipRow>
        <SlipRow label="Rule">SCOPE_CREEP</SlipRow>
        <SlipRule />
        <div className="flex items-center justify-between py-1">
          <span className="slip-label">Outcome</span>
          <Stamp kind="mismatch" label="MISMATCH" />
        </div>
        <SlipRule />
        <p className="text-[var(--color-paper-faint)] text-xs">Evidence: accountability-ledger/traces/2.json. Verify it yourself →</p>
      </ReceiptSlip>
    </Link>
  );
}

export function Home({ onCreateClick, onVerifyClick }: HomeProps) {
  return (
    <main className="pt-24 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        <section className="grid lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-16 items-center py-10 lg:py-16 mb-16 animate-fade-up">
          <div>
            <h1 className="font-display text-[2.6rem] sm:text-5xl md:text-6xl font-semibold text-white leading-[1.04] mb-6">
              Every agent action <br className="hidden md:block" />
              leaves a receipt.
            </h1>
            <p className="text-lg text-slate-300 max-w-xl mb-8 leading-relaxed">
              SafeReceipt commits what an AI agent says it will do on-chain, before it acts, then checks what it
              actually did. When they differ, the receipt says so, and anyone can re-check it.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Link to="/fleet" className="btn-primary text-center">Inspect the agent fleet</Link>
              <button onClick={onCreateClick} className="btn-secondary">Create a receipt</button>
            </div>
            <p className="font-mono text-xs text-slate-500">Live on Monad Testnet and Base Sepolia · MIT licensed</p>
          </div>
          <HeroSlip />
        </section>

        <section className="mb-20" aria-labelledby="paths-heading">
          <h2 id="paths-heading" className="font-display text-3xl font-semibold text-white mb-2">Two kinds of actions, two honest guarantees</h2>
          <p className="text-slate-400 mb-8 max-w-2xl">Not every check is equally strong. SafeReceipt says which one you are getting.</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass-card p-6">
              <h3 className="font-display text-xl font-semibold text-white mb-1">On-chain actions</h3>
              <p className="font-mono text-xs text-primary-300 mb-4">approve · transfer</p>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                The transaction is fetched by hash, its calldata decoded and compared with the declared intent. The
                inputs are public and the code is open, so anyone gets the same answer.
              </p>
              <p className="text-sm text-white"><span className="text-primary-300 font-medium">Trustless.</span> No need to trust the agent, its operator, or this site.</p>
            </div>
            <div className="glass-card p-6">
              <h3 className="font-display text-xl font-semibold text-white mb-1">Off-chain actions</h3>
              <p className="font-mono text-xs text-accent mb-4">research · review · decisions</p>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                The intent is committed before the agent runs. Afterwards its full trace is published and its hash
                linked on-chain. Change one byte of the trace and the hash no longer matches.
              </p>
              <p className="text-sm text-white">
                <span className="text-accent font-medium">Tamper-evident, not attested.</span> It can't prove the trace
                is complete. That needs TEE attestation, which is on the roadmap.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Link to="/fleet" className="text-primary-300 hover:text-primary-200 underline underline-offset-4">See three real agents and their receipts</Link>
            <a className="text-slate-400 hover:text-white underline underline-offset-4" href="https://github.com/calderbuild/SafeReceipt/blob/main/docs/ACCOUNTABILITY.md" target="_blank" rel="noopener noreferrer">
              Read the full trust boundary
            </a>
          </div>
        </section>

        <section className="mb-20" aria-labelledby="demo-heading">
          <h2 id="demo-heading" className="font-display text-3xl font-semibold text-white mb-2">Try it with a transaction</h2>
          <p className="text-slate-400 mb-6 max-w-2xl">
            Three approvals: a safe one, a risky one, and one where the agent changes the amount behind your back.
            <button onClick={onVerifyClick} className="ml-2 text-primary-300 hover:text-primary-200 underline underline-offset-4">
              Already have a receipt? Verify it
            </button>
          </p>
          <div className="glass-card-elevated p-1">
            <AgentDemo />
          </div>
        </section>

        <section className="mb-20" aria-labelledby="how-heading">
          <h2 id="how-heading" className="font-display text-3xl font-semibold text-white mb-8">How a receipt is made</h2>
          <ol className="grid md:grid-cols-3 gap-px bg-dark-100 rounded-xl overflow-hidden">
            {STEPS.map((step, i) => (
              <li key={step.title} className="bg-dark-50 p-6">
                <span className="font-mono text-xs text-slate-500">Step {i + 1}</span>
                <h3 className="font-display text-xl font-semibold text-white mt-2 mb-3">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-20" aria-labelledby="rules-heading">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
            <div>
              <h2 id="rules-heading" className="font-display text-3xl font-semibold text-white mb-2">Risk rules</h2>
              <p className="text-slate-400">Scored before every on-chain action. Weights add up to 100.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-x-8">
            {RULES.map((item) => (
              <div key={item.rule} className="flex items-center gap-4 py-3 border-b border-dark-100">
                <span className={`font-mono text-sm w-10 shrink-0 ${item.weight >= 25 ? 'text-[#EE7A71]' : item.weight >= 10 ? 'text-accent-light' : 'text-primary-300'}`}>
                  +{item.weight}
                </span>
                <div className="min-w-0">
                  <code className="text-sm text-white break-all">{item.rule}</code>
                  <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-dark-100 pt-8 grid sm:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'ReceiptRegistry (V1)', href: V1_REGISTRY },
            { label: 'AgentIdentityRegistry (V2)', href: `${V2_NETWORK.blockExplorer}/address/${V2_ADDRESSES.agentIdentityRegistry}` },
            { label: 'ActionRegistry (V2)', href: `${V2_NETWORK.blockExplorer}/address/${V2_ADDRESSES.actionRegistry}` },
          ].map((c) => (
            <a key={c.label} href={c.href} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white">
              <span className="block font-mono text-xs text-slate-500 mb-1">Contract on MonadScan</span>
              {c.label} ↗
            </a>
          ))}
        </section>
      </div>
    </main>
  );
}

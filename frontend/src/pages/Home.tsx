import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AgentDemo } from '../components/AgentDemo';
import { ReceiptSlip, SlipRow, SlipRule, Stamp } from '../components/ReceiptSlip';
import { V2_ADDRESSES, V2_NETWORK } from '../lib/v2';
import { CONTRACT_CONFIG, explorerAddress, explorerTx } from '../lib/contract';
import { useT } from '../lib/i18n';
import type { MessageKey } from '../lib/messages';

interface HomeProps {
  onCreateClick: () => void;
  onVerifyClick: () => void;
}

const V1_REGISTRY = `${explorerAddress(CONTRACT_CONFIG.address)}#code`;

const EVIDENCE_CASES = [
  { name: 'PocketOS', body: 'home.evidence.pocketos', source: 'home.evidence.railway', url: 'https://blog.railway.com/p/your-ai-wants-to-nuke-your-database' },
  { name: 'Amazon Q Developer', body: 'home.evidence.amazon', source: 'home.evidence.aws', url: 'https://aws.amazon.com/security/security-bulletins/2026-047-aws/' },
  { name: 'Freysa', body: 'home.evidence.freysa', source: 'home.evidence.freysaSource', url: 'https://github.com/0xfreysa/agent' },
] as const;

const STEPS: { title: MessageKey; body: MessageKey }[] = [
  { title: 'home.steps.1.title', body: 'home.steps.1.body' },
  { title: 'home.steps.2.title', body: 'home.steps.2.body' },
  { title: 'home.steps.3.title', body: 'home.steps.3.body' },
];

const RULES: { rule: string; weight: number; desc: MessageKey }[] = [
  { rule: 'UNLIMITED_ALLOWANCE', weight: 40, desc: 'home.rules.unlimited' },
  { rule: 'SPENDER_IS_UNKNOWN_CONTRACT', weight: 25, desc: 'home.rules.unknown' },
  { rule: 'REPEAT_APPROVE_PATTERN', weight: 15, desc: 'home.rules.repeat' },
  { rule: 'DUPLICATE_RECIPIENTS', weight: 10, desc: 'home.rules.duplicate' },
  { rule: 'RECIPIENT_IS_CONTRACT', weight: 5, desc: 'home.rules.contractRecipient' },
  { rule: 'OUTLIER_AMOUNT', weight: 5, desc: 'home.rules.outlier' },
];


const INTEGRATION_CALLS: { call: string; body: MessageKey }[] = [
  { call: 'beginAction()', body: 'home.integrate.call1' },
  { call: 'emit()', body: 'home.integrate.call2' },
  { call: 'endAction()', body: 'home.integrate.call3' },
];

const INTEGRATION_SNIPPET = `import { AccountabilityClient, evaluatePolicy } from "@safereceipt/client";

const client = new AccountabilityClient({ network: "monad", signer });

// 1. before the agent acts
const { receiptId } = await client.beginAction({
  agentId,
  declaredIntent: {
    goal: "Summarize docs/ for a new reader",
    declaredScope: ["docs/"],
  },
});

// 2. while it works
client.emit("read", "Read docs/guide.md", 40, {
  touched: ["docs/guide.md"],
});

// 3. after it finishes
const policy = evaluatePolicy(client.buildTrace(null));
await client.endAction({ policyResult: policy });`;

// V1 receipt #11: the live model followed the poisoned token metadata (DEPLOYMENTS.md).
const HERO_TX = '0xb6c5c0cb84c350f80906cc925f519e36ea59c960363b4367a1bb9353c1b29809';

function HeroSlip() {
  const t = useT();
  return (
    <a
      href={explorerTx(HERO_TX)}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full max-w-full sm:max-w-sm rotate-[1.5deg] hover:rotate-0 transition-transform duration-300 mx-auto lg:mx-0 lg:ml-auto"
      aria-label={t('home.slip.aria')}
    >
      <ReceiptSlip>
        <div className="slip-row font-semibold">
          <span>SAFERECEIPT</span>
          <span>{t('home.slip.no')}</span>
        </div>
        <div className="text-[var(--color-paper-faint)]">2026-09-29 06:07 UTC · Monad</div>
        <SlipRule />
        <SlipRow label={t('home.slip.agent')}>deepseek-flash, live</SlipRow>
        <SlipRow label={t('home.slip.declared')}>{t('home.slip.declaredValue')}</SlipRow>
        <SlipRow label={t('home.slip.metadataSaid')}>{t('home.slip.metadataValue')}</SlipRow>
        <SlipRule />
        <SlipRow label={t('home.slip.sent')}>{t('home.slip.sentValue')}</SlipRow>
        <SlipRow label={t('home.slip.reason')}>"below the token's enforced 10,000 dUSD minimum allowance… so I'm approving the minimum"</SlipRow>
        <SlipRow label={t('home.slip.check')}>{t('home.slip.checkValue')}</SlipRow>
        <SlipRule />
        <div className="flex items-center justify-between py-1">
          <span className="slip-label">{t('home.slip.outcome')}</span>
          <Stamp kind="mismatch" label="MISMATCH" />
        </div>
        <SlipRule />
        <p className="text-[var(--color-paper-faint)] text-xs">{t('home.slip.note')}</p>
      </ReceiptSlip>
    </a>
  );
}

export function Home({ onCreateClick, onVerifyClick }: HomeProps) {
  const { hash } = useLocation();
  const t = useT();

  // React Router doesn't scroll to a hash; /fleet links to #integrate.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <main className="pt-24 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        <section className="grid lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-16 items-center py-10 lg:py-16 mb-16 animate-fade-up">
          <div>
            <h1 className="font-display text-[2.6rem] sm:text-5xl md:text-6xl font-semibold text-white leading-[1.04] mb-6 text-balance">
              {t('home.hero.title1')} <br className="hidden md:block" />
              {t('home.hero.title2')}
            </h1>
            <p className="text-lg text-slate-300 max-w-xl mb-8 leading-relaxed">
              {t('home.hero.body')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <Link to="/fleet" className="btn-primary text-center">{t('home.hero.fleetCta')}</Link>
              <button onClick={onCreateClick} className="btn-secondary">{t('home.hero.createCta')}</button>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm mb-5">
              <Link to="/fleet/bot" className="text-primary-300 hover:text-primary-200 underline underline-offset-4">
                {t('home.hero.botPilot')}
              </Link>
              <a href="#evidence" className="text-slate-300 hover:text-white underline underline-offset-4">{t('home.evidence.jump')}</a>
            </div>
            <p className="font-mono text-xs text-slate-500">{t('home.hero.footnote')}</p>
          </div>
          <HeroSlip />
        </section>

        <section id="evidence" className="mb-20 scroll-mt-24 border-y border-dark-100 py-8 lg:grid lg:grid-cols-[1fr_1.65fr] lg:gap-12" aria-labelledby="evidence-heading">
          <div className="mb-6 lg:mb-0">
            <h2 id="evidence-heading" className="font-display text-3xl font-semibold text-white mb-3 text-balance">{t('home.evidence.heading')}</h2>
            <p className="text-slate-300 leading-relaxed max-w-md">{t('home.evidence.intro')}</p>
          </div>
          <div>
            <ul className="divide-y divide-dark-100">
              {EVIDENCE_CASES.map(({ name, body, source, url }) => (
                <li key={name} className="py-4 first:pt-0">
                  <h3 className="font-display text-xl font-semibold text-white mb-1">{name}</h3>
                  <p className="text-slate-300 text-sm leading-relaxed mb-2">{t(body)}</p>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-300 hover:text-primary-200 underline underline-offset-4">{t(source)}</a>
                </li>
              ))}
            </ul>
            <div className="border-t border-dark-100 pt-4">
              <p className="text-slate-300 leading-relaxed mb-3">{t('home.evidence.proof')}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <Link to="/fleet/bot/receipt/6" className="text-primary-300 hover:text-primary-200 underline underline-offset-4">{t('home.evidence.receipt6')}</Link>
                <Link to="/fleet/bot/receipt/10" className="text-primary-300 hover:text-primary-200 underline underline-offset-4">{t('home.evidence.receipt10')}</Link>
              </div>
            </div>
            <div className="mt-6">
              <h3 className="font-display text-xl font-semibold text-white mb-2">{t('home.evidence.openHeading')}</h3>
              <p className="text-slate-300 leading-relaxed mb-3">{t('home.evidence.openBody')}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <a href="https://github.com/calderbuild/SafeReceipt/blob/main/docs/HASHING.md" className="text-primary-300 hover:text-primary-200 underline underline-offset-4">{t('home.evidence.format')}</a>
                <a href="https://github.com/calderbuild/SafeReceipt/blob/main/wrapper/verify.mjs" className="text-primary-300 hover:text-primary-200 underline underline-offset-4">{t('home.evidence.verifier')}</a>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-20" aria-labelledby="paths-heading">
          <h2 id="paths-heading" className="font-display text-3xl font-semibold text-white mb-2">{t('home.paths.heading')}</h2>
          <p className="text-slate-400 mb-8 max-w-2xl">{t('home.paths.sub')}</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass-card p-6">
              <h3 className="font-display text-xl font-semibold text-white mb-1">{t('home.paths.onchain.title')}</h3>
              <p className="font-mono text-xs text-primary-300 mb-4">{t('home.paths.onchain.tag')}</p>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                {t('home.paths.onchain.body')}
              </p>
              <p className="text-sm text-white">
                <span className="text-primary-300 font-medium">{t('home.paths.onchain.claim')}</span> {t('home.paths.onchain.note')}
              </p>
            </div>
            <div className="glass-card p-6">
              <h3 className="font-display text-xl font-semibold text-white mb-1">{t('home.paths.offchain.title')}</h3>
              <p className="font-mono text-xs text-accent mb-4">{t('home.paths.offchain.tag')}</p>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                {t('home.paths.offchain.body')}
              </p>
              <p className="text-sm text-white">
                <span className="text-accent font-medium">{t('home.paths.offchain.claim')}</span> {t('home.paths.offchain.note')}
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Link to="/fleet" className="text-primary-300 hover:text-primary-200 underline underline-offset-4">{t('home.paths.fleetLink')}</Link>
            <a className="text-slate-400 hover:text-white underline underline-offset-4" href="https://github.com/calderbuild/SafeReceipt/blob/main/docs/ACCOUNTABILITY.md" target="_blank" rel="noopener noreferrer">
              {t('home.paths.boundaryLink')}
            </a>
          </div>
        </section>

        <section className="mb-20 scroll-mt-24" aria-labelledby="demo-heading">
          <h2 id="demo-heading" className="font-display text-3xl font-semibold text-white mb-2">{t('home.demo.heading')}</h2>
          <p className="text-slate-400 mb-6 max-w-2xl">
            {t('home.demo.intro')}
            <button onClick={onVerifyClick} className="ml-2 text-primary-300 hover:text-primary-200 underline underline-offset-4">
              {t('home.demo.verifyLink')}
            </button>
          </p>
          <div className="glass-card-elevated p-1">
            <AgentDemo />
          </div>
        </section>

        <section id="integrate" className="mb-20 scroll-mt-24" aria-labelledby="integrate-heading">
          <h2 id="integrate-heading" className="font-display text-3xl font-semibold text-white mb-2">{t('home.integrate.heading')}</h2>
          <p className="text-slate-400 mb-8 max-w-2xl">
            {t('home.integrate.intro')}
          </p>
          <div className="grid lg:grid-cols-[1fr_1.25fr] gap-8 items-start">
            <ol className="space-y-5">
              {INTEGRATION_CALLS.map((c, i) => (
                <li key={c.call} className="flex gap-4">
                  <span className="font-mono text-xs text-slate-500 pt-1 w-4 shrink-0">{i + 1}</span>
                  <div>
                    <code className="text-primary-300 text-sm">{c.call}</code>
                    <p className="text-slate-300 text-sm leading-relaxed mt-1">{t(c.body)}</p>
                  </div>
                </li>
              ))}
              <li className="flex gap-4 pt-2">
                <span className="w-4 shrink-0" />
                <div className="text-sm text-slate-400 leading-relaxed min-w-0">
                  <code className="block font-mono text-[13px] text-slate-200 bg-black/40 border border-white/10 rounded-md px-3 py-2 mb-2 overflow-x-auto">
                    npm install @safereceipt/client ethers
                  </code>
                  {t('home.integrate.installNote')}{' '}
                  <Link to="/start" className="text-primary-300 hover:text-primary-200 underline underline-offset-4">
                    {t('home.integrate.startLink')}
                  </Link>
                </div>
              </li>
            </ol>
            <pre className="glass-card p-5 overflow-x-auto text-[13px] leading-relaxed font-mono text-slate-300" aria-label={t('home.integrate.aria')}>
              <code>{INTEGRATION_SNIPPET}</code>
            </pre>
          </div>
        </section>

        <section className="mb-20" aria-labelledby="how-heading">
          <h2 id="how-heading" className="font-display text-3xl font-semibold text-white mb-8">{t('home.steps.heading')}</h2>
          <ol className="grid md:grid-cols-3 gap-px bg-dark-100 rounded-xl overflow-hidden">
            {STEPS.map((step, i) => (
              <li key={step.title} className="bg-dark-50 p-6">
                <span className="font-mono text-xs text-slate-500">{t('home.steps.step', { n: i + 1 })}</span>
                <h3 className="font-display text-xl font-semibold text-white mt-2 mb-3">{t(step.title)}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{t(step.body)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-20" aria-labelledby="rules-heading">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
            <div>
              <h2 id="rules-heading" className="font-display text-3xl font-semibold text-white mb-2">{t('home.rules.heading')}</h2>
              <p className="text-slate-400">{t('home.rules.sub')}</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-x-8">
            {RULES.map((item) => (
              <div key={item.rule} className="flex items-center gap-4 py-3 border-b border-dark-100">
                <span className={`font-mono text-sm w-10 shrink-0 ${item.weight >= 25 ? 'text-red-400' : item.weight >= 10 ? 'text-accent-light' : 'text-primary-300'}`}>
                  +{item.weight}
                </span>
                <div className="min-w-0">
                  <code className="text-sm text-white break-all">{item.rule}</code>
                  <p className="text-xs text-slate-500 mt-0.5">{t(item.desc)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-dark-100 pt-8 grid sm:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'ReceiptRegistry (V1)', href: V1_REGISTRY },
            { label: 'AgentIdentityRegistry (V2.1)', href: `${V2_NETWORK.blockExplorer}/address/${V2_ADDRESSES.agentIdentityRegistry}` },
            { label: 'ActionRegistry (V2.1)', href: `${V2_NETWORK.blockExplorer}/address/${V2_ADDRESSES.actionRegistry}` },
          ].map((c) => (
            <a key={c.label} href={c.href} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white">
              <span className="block font-mono text-xs text-slate-500 mb-1">{t('home.contracts.label')}</span>
              {c.label} ↗
            </a>
          ))}
        </section>
      </div>
    </main>
  );
}

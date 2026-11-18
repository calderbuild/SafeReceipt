import { Link } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import { FEEDBACK_URL, REPO_URL, SOURCE_LINKS } from '../lib/links';
import { useT } from '../lib/i18n';

const FAUCET_URL = 'https://faucet.monad.xyz';
const CLIENT_README = `${REPO_URL}/tree/main/packages/client#readme`;
const MAKE_WALLET = `node -e "const w=require('ethers').Wallet.createRandom();require('fs').writeFileSync('.env','PRIVATE_KEY='+w.privateKey+'\\n',{flag:'wx',mode:0o600});console.log(w.address)"`;
const CREATE_SAMPLE = `cat > orders.json <<'JSON'
[
  { "id": "demo-1", "amount": 18 },
  { "id": "demo-2", "amount": 24 }
]
JSON`;
const FLOW = [
  { stage: 'register', source: SOURCE_LINKS.registerAgent },
  { stage: 'open', source: SOURCE_LINKS.beginAction },
  { stage: 'execute', source: SOURCE_LINKS.quickStartAgent },
  { stage: 'link', source: SOURCE_LINKS.endAction },
  { stage: 'verify', source: SOURCE_LINKS.verifyInBrowser },
] as const;

function Command({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const t = useT();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the text is still selectable
    }
  };
  return (
    <div className="flex items-stretch gap-2 my-2">
      <pre className="flex-1 min-w-0 overflow-x-auto rounded-md bg-black/40 border border-white/10 px-3 py-2 font-mono text-[13px] text-slate-200">
        <code>{children}</code>
      </pre>
      <button onClick={copy} className="shrink-0 font-mono text-xs px-2.5 rounded-md border border-white/10 text-slate-400 hover:text-white hover:border-white/25" aria-label={t('start.copyAria', { command: children })}>
        {copied ? t('start.copied') : t('start.copy')}
      </button>
    </div>
  );
}

function Output({ children }: { children: string }) {
  return <pre className="overflow-x-auto font-mono text-xs text-slate-500 border-l-2 border-white/10 pl-3 my-2 whitespace-pre">{children}</pre>;
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[2.25rem_1fr] gap-x-3 py-7 border-t border-dashed border-white/10 first:border-t-0">
      <span className="font-mono text-sm text-primary-300 pt-0.5">{String(n).padStart(2, '0')}</span>
      <div className="min-w-0">
        <h3 className="font-display text-xl font-semibold text-white mb-2">{title}</h3>
        <div className="text-slate-300 text-sm leading-relaxed">{children}</div>
      </div>
    </li>
  );
}

export function Start() {
  const t = useT();
  const exampleURL = new URL('/examples/quick-start-agent.mjs', window.location.origin);
  return (
    <main id="main-content" tabIndex={-1} className="site-page">
      <div className="max-w-5xl mx-auto">
        <header className="page-intro">
          <p className="text-sm text-primary-300 mb-3">{t('start.eyebrow')}</p>
          <h1 className="page-heading text-white mb-4">{t('start.title')}</h1>
          <p className="text-slate-300 text-lg leading-relaxed max-w-2xl">{t('start.intro')}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mt-5 text-sm">
            <a href="#quick-start" className="btn-primary">{t('start.try')}</a>
            <Link to="/fleet/receipt/3" className="text-slate-300 hover:text-white underline underline-offset-4">{t('start.existing')}</Link>
          </div>
        </header>

        <section aria-labelledby="start-flow-heading" className="mb-10">
          <h2 id="start-flow-heading" className="font-display text-2xl font-semibold text-white mb-4">{t('start.flow.heading')}</h2>
          <ol className="grid gap-px overflow-hidden rounded-xl bg-dark-100 sm:grid-cols-5">
            {FLOW.map(({ stage, source }, index) => (
              <li key={stage} className="bg-dark-50 p-4">
                <p className="text-white font-semibold mb-1">
                  <span className="text-primary-300 mr-2" aria-hidden="true">{index + 1}.</span>
                  <a href={source} target="_blank" rel="noopener noreferrer" className="underline decoration-primary-300/60 underline-offset-4 hover:text-primary-300">{t(`start.flow.${stage}.title`)}</a>
                </p>
                <p className="text-sm leading-relaxed text-slate-300">{t(`start.flow.${stage}.body`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="quick-start" className="scroll-mt-24" aria-labelledby="quick-start-heading">
          <h2 id="quick-start-heading" className="font-display text-2xl font-semibold text-white mb-4">{t('start.steps.heading')}</h2>
          <ol className="glass-card px-4 sm:px-7">
            <Step n={1} title={t('start.step1.title')}>
              <p>{t('start.step1.body')}</p>
              <Command>{`node --version
mkdir safereceipt-demo && cd safereceipt-demo
npm init -y
npm install @safereceipt/client@0.1.3 ethers@6.17.0`}</Command>
            </Step>

            <Step n={2} title={t('start.step2.title')}>
              <p>{t('start.step2.body')}</p>
              <Command>{CREATE_SAMPLE}</Command>
              <Command>{`curl -fL "${exampleURL}" -o quick-start-agent.mjs`}</Command>
              <p className="flex flex-wrap gap-x-5 gap-y-2">
                <a href="/examples/quick-start-agent.mjs" download className="text-primary-300 hover:text-primary-200 underline underline-offset-4">{t('start.step2.download')}</a>
                <a href={SOURCE_LINKS.quickStartAgent} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white underline underline-offset-4">{t('source.example')}</a>
              </p>
            </Step>

            <Step n={3} title={t('start.step3.title')}>
              <p>{t('start.step3.body')}</p>
              <Command>SAFERECEIPT_SEND=0 node quick-start-agent.mjs</Command>
              <Output>{`Dry run on Monad testnet: no wallet, upload, or transaction
[3] Executed: 2 orders, total 42`}</Output>
            </Step>

            <Step n={4} title={t('start.step4.title')}>
              <p>{t('start.step4.body')}</p>
              <Command>{MAKE_WALLET}</Command>
              <p>{t('start.step4.faucet1')}{' '}
                <a className="text-primary-300 hover:text-primary-200 underline underline-offset-4" href={FAUCET_URL} target="_blank" rel="noopener noreferrer">{t('start.step4.faucet2')}</a>
                {t('start.step4.cost')}
              </p>
            </Step>

            <Step n={5} title={t('start.step5.title')}>
              <p>{t('start.step5.body')}</p>
              <Command>SAFERECEIPT_SEND=1 node quick-start-agent.mjs</Command>
              <Output>{`[1] Agent #<agent-id> (set AGENT_ID=<agent-id> to reuse it)
[2] Receipt #<receipt-id> opened
[3] Executed: 2 orders, total 42
[4] Result linked: VERIFIED
[5] Open https://safereceipt.vercel.app/fleet/receipt/<receipt-id> and press Verify independently`}</Output>
              <p>{t('start.step5.reuse')}</p>
              <p className="mt-2 text-slate-400">{t('start.step5.publicTrace')}</p>
            </Step>

            <Step n={6} title={t('start.step6.title')}>
              <p>{t('start.step6.body')}</p>
              <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                <a href={`${REPO_URL}/blob/main/docs/HASHING.md`} className="text-primary-300 hover:text-primary-200 underline underline-offset-4">{t('start.step5.format')}</a>
                <a href={SOURCE_LINKS.verifyInCLI} target="_blank" rel="noopener noreferrer" className="text-primary-300 hover:text-primary-200 underline underline-offset-4">{t('start.step5.verifier')}</a>
              </p>
            </Step>
          </ol>
        </section>

        <section className="mt-10 grid sm:grid-cols-2 gap-4">
          <div className="glass-card p-5">
            <h2 className="font-display text-lg font-semibold text-white mb-2">{t('start.wrap.title')}</h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-3">
              {t('start.wrap.body')}
            </p>
            <a className="text-sm text-primary-300 hover:text-primary-200 underline underline-offset-4" href={CLIENT_README} target="_blank" rel="noopener noreferrer">
              {t('start.wrap.link')}
            </a>
          </div>
          <div className="glass-card p-5">
            <h2 className="font-display text-lg font-semibold text-white mb-2">{t('start.stuck.title')}</h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-3">
              {t('start.stuck.body')}
            </p>
            <a className="text-sm text-primary-300 hover:text-primary-200 underline underline-offset-4" href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">
              {t('start.stuck.link')}
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

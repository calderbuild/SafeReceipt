import { Link } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { FEEDBACK_URL, REPO_URL } from '../lib/links';

const FAUCET_URL = 'https://faucet.monad.xyz';
const CLIENT_README = `${REPO_URL}/tree/main/packages/client#readme`;
const MAKE_WALLET = `node -e "const w=require('ethers').Wallet.createRandom();require('fs').writeFileSync('.env','PRIVATE_KEY='+w.privateKey+'\\n');console.log(w.address)"`;

type NpmState = { kind: 'checking' } | { kind: 'published'; version: string } | { kind: 'missing' };

/** Whether @safereceipt/client is on npm yet, asked of the registry so this page stays true either way. */
function useNpmRelease(): NpmState {
  const [state, setState] = useState<NpmState>({ kind: 'checking' });
  useEffect(() => {
    let cancelled = false;
    fetch('https://registry.npmjs.org/@safereceipt%2fclient/latest')
      .then(async (res) => (res.ok ? ({ kind: 'published', version: (await res.json()).version } as const) : ({ kind: 'missing' } as const)))
      .catch(() => ({ kind: 'missing' }) as const)
      .then((next) => {
        if (!cancelled) setState(next);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

function Command({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
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
      <button onClick={copy} className="shrink-0 font-mono text-xs px-2.5 rounded-md border border-white/10 text-slate-400 hover:text-white hover:border-white/25" aria-label={`Copy: ${children}`}>
        {copied ? 'copied' : 'copy'}
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
        <h2 className="font-display text-xl font-semibold text-white mb-2">{title}</h2>
        <div className="text-slate-300 text-sm leading-relaxed">{children}</div>
      </div>
    </li>
  );
}

/** /start, the path from an empty folder to a receipt anyone can verify. Every command here was run as written. */
export function Start() {
  const npm = useNpmRelease();
  return (
    <main className="pt-24 pb-20 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <p className="font-mono text-xs text-slate-500 mb-3">Monad testnet · about 10 minutes</p>
          <h1 className="font-display text-4xl md:text-5xl font-semibold text-white mb-4 leading-tight">Put a receipt on your agent's work</h1>
          <p className="text-slate-300 text-lg leading-relaxed">
            From an empty folder to a receipt anyone can check. The example agent commits what it will do, does it,
            publishes its record, and links the record on-chain. Gas is paid in test MON, which is free.
          </p>
        </header>

        <ol className="glass-card px-5 sm:px-7">
          <Step n={1} title="Check Node">
            <p>Node 18 or later.</p>
            <Command>node --version</Command>
          </Step>

          <Step n={2} title="Make a folder and install the client">
            <Command>mkdir my-agent && cd my-agent</Command>
            <Command>npm init -y</Command>
            <Command>npm install @safereceipt/client ethers</Command>
            {npm.kind === 'published' && <p className="font-mono text-xs text-primary-300">@safereceipt/client {npm.version} is on npm.</p>}
            {npm.kind === 'missing' && (
              <div className="mt-3 rounded-md border border-accent/30 bg-accent/5 p-3">
                <p className="text-accent text-xs font-mono mb-1">Not on npm yet</p>
                <p className="text-slate-300 mb-1">Until it is, build the same package from the repository instead:</p>
                <Command>git clone --depth 1 https://github.com/calderbuild/SafeReceipt.git</Command>
                <Command>npm pack ./SafeReceipt/packages/client</Command>
                <Command>npm install ethers ./safereceipt-client-0.1.0.tgz</Command>
              </div>
            )}
          </Step>

          <Step n={3} title="Make a test wallet and fund it">
            <p>This writes a new private key to <code className="text-slate-200">.env</code> in the folder and prints only its address. Use it for testnet only.</p>
            <Command>{MAKE_WALLET}</Command>
            <p>
              Paste the address into the{' '}
              <a className="text-primary-300 hover:text-primary-200 underline underline-offset-4" href={FAUCET_URL} target="_blank" rel="noopener noreferrer">
                Monad testnet faucet
              </a>
              . A run spends roughly 0.06 MON: one transaction to register the agent and two for the receipt.
            </p>
          </Step>

          <Step n={4} title="Run the example agent">
            <p>Copy the example out of the package and try it dry first. A dry run sends nothing.</p>
            <Command>cp node_modules/@safereceipt/client/examples/minimal-agent.mjs .</Command>
            <Command>node minimal-agent.mjs</Command>
            <Output>{`dry run: monad ActionRegistry 0x975bD215C549F315A066306B161119cec480c927
would commit intentHash 0x2762fea7…`}</Output>
            <p>Then for real: it registers your agent, files the receipt, uploads the record and links it.</p>
            <Command>SAFERECEIPT_SEND=1 node minimal-agent.mjs</Command>
            <Output>{`registered agent #4 (set AGENT_ID=4 to reuse it)
receipt #5 opened
…
open https://safereceipt.vercel.app/fleet/receipt/5 and press Verify independently`}</Output>
            <p className="text-slate-400">Your numbers will differ. If it says the wallet has no testnet MON, step 3 isn't done yet.</p>
          </Step>

          <Step n={5} title="Open the link and press Verify">
            <p>
              The page is your receipt. <span className="text-white">Verify independently</span> makes your browser fetch the
              record, hash it, read the hash stored on Monad and compare. If nothing changed since the agent committed it,
              the stamp reads INTACT. Your agent also appears on the{' '}
              <Link to="/fleet" className="text-primary-300 hover:text-primary-200 underline underline-offset-4">agent fleet</Link>.
            </p>
          </Step>
        </ol>

        <section className="mt-10 grid sm:grid-cols-2 gap-4">
          <div className="glass-card p-5">
            <h2 className="font-display text-lg font-semibold text-white mb-2">Wrap your own agent</h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-3">
              Three calls go around its work: <code className="text-primary-300">beginAction</code>,{' '}
              <code className="text-primary-300">emit</code>, <code className="text-primary-300">endAction</code>.
            </p>
            <a className="text-sm text-primary-300 hover:text-primary-200 underline underline-offset-4" href={CLIENT_README} target="_blank" rel="noopener noreferrer">
              Read the client's README
            </a>
          </div>
          <div className="glass-card p-5">
            <h2 className="font-display text-lg font-semibold text-white mb-2">Stuck somewhere?</h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-3">
              Say which step, what you ran, and what it printed. It goes to a public GitHub issue.
            </p>
            <a className="text-sm text-primary-300 hover:text-primary-200 underline underline-offset-4" href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">
              Tell us what broke
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

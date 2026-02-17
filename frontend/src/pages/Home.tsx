import { AgentDemo } from '../components/AgentDemo';

interface HomeProps {
  onCreateClick: () => void;
  onVerifyClick: () => void;
}

// Heroicons
const ShieldCheckIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const DocumentCheckIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-12M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12" />
  </svg>
);

const CubeIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
  </svg>
);

const ChartBarIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);

const FingerprintIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
  </svg>
);

export function Home({ onCreateClick, onVerifyClick }: HomeProps) {
  return (
    <main className="pt-28 pb-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <section className="text-center mb-24 animate-fade-up">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-500/10 border border-primary-500/20 rounded-full mb-8">
            <span className="w-2 h-2 bg-crypto-green rounded-full animate-pulse"></span>
            <span className="text-sm text-primary-300">Live on Monad Testnet</span>
          </div>

          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-8 leading-tight tracking-tight">
            When AI acts,<br />
            <span className="gradient-text">verify</span> what really happened
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            Verifiable on-chain proof that AI agent behavior matches declared intent.
            Cryptographic receipts before execution, verification after.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onCreateClick}
              className="btn-primary flex items-center space-x-2 text-lg"
            >
              <DocumentCheckIcon />
              <span>Create Receipt</span>
            </button>
            <button
              onClick={onVerifyClick}
              className="btn-secondary flex items-center space-x-2 text-lg"
            >
              <ShieldCheckIcon />
              <span>Verify Proof</span>
            </button>
          </div>
        </section>

        {/* Stats Section */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-24">
          {[
            { label: 'Risk Rules', value: '6', sublabel: 'Automated checks' },
            { label: 'Hash Type', value: 'keccak256', sublabel: 'Cryptographic' },
            { label: 'Storage', value: 'On-Chain', sublabel: 'Immutable' },
            { label: 'Status', value: 'Verifiable', sublabel: 'Intent to Execution' },
          ].map((stat, i) => (
            <div key={i} className={`glass-card p-6 text-center animate-fade-up animate-delay-${i + 1}`}>
              <div className="text-2xl md:text-3xl font-display font-bold gradient-text mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-white font-medium">{stat.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{stat.sublabel}</div>
            </div>
          ))}
        </section>

        {/* Agent Demo - Elevated */}
        <section className="mb-24 animate-fade-up animate-delay-3">
          <div className="glass-card-elevated p-1">
            <AgentDemo />
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-24">
          <div className="text-center mb-14 animate-fade-up">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Three-step process to create verifiable proof of AI agent behavior on-chain
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <FingerprintIcon />,
                step: '01',
                title: 'Capture Intent',
                description: 'User intent is parsed, normalized, and hashed with keccak256 to create a unique fingerprint.',
                color: 'from-primary-500 to-primary-600',
              },
              {
                icon: <ChartBarIcon />,
                step: '02',
                title: 'Assess Risk',
                description: '6 automated rules evaluate the transaction risk: allowance limits, unknown contracts, patterns.',
                color: 'from-amber-500 to-amber-600',
              },
              {
                icon: <CubeIcon />,
                step: '03',
                title: 'Record On-Chain',
                description: 'Intent hash + proof hash stored on Monad. Immutable evidence linking declared intent to actual execution.',
                color: 'from-cyan-500 to-blue-500',
              },
            ].map((item, i) => (
              <div key={i} className={`glass-card-hover p-8 group animate-fade-up animate-delay-${i + 2}`}>
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-6 text-white group-hover:scale-110 transition-transform duration-300`}>
                  {item.icon}
                </div>
                <div className="text-xs font-mono text-slate-500 mb-2 tracking-wider">STEP {item.step}</div>
                <h3 className="font-display text-xl font-semibold text-white mb-3">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Risk Rules Preview */}
        <section className="mb-24 animate-fade-up">
          <div className="glass-card p-8 md:p-12">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
              <div>
                <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-2">
                  6 Risk Assessment Rules
                </h2>
                <p className="text-slate-400">Automated checks before every transaction</p>
              </div>
              <div className="mt-4 md:mt-0">
                <div className="risk-high">100</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              {[
                { rule: 'UNLIMITED_ALLOWANCE', weight: 40, desc: 'Detects max uint256 approvals' },
                { rule: 'SPENDER_IS_UNKNOWN_CONTRACT', weight: 25, desc: 'Checks against known contracts' },
                { rule: 'REPEAT_APPROVE_PATTERN', weight: 15, desc: 'Flags repeated approvals' },
                { rule: 'DUPLICATE_RECIPIENTS', weight: 10, desc: 'Detects duplicate addresses' },
                { rule: 'RECIPIENT_IS_CONTRACT', weight: 5, desc: 'Warns on contract recipients' },
                { rule: 'OUTLIER_AMOUNT', weight: 5, desc: 'Flags unusual amounts' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white/[0.03] rounded-xl border border-white/[0.06] hover:border-white/10 hover:bg-white/[0.05] transition-all duration-200 cursor-default">
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                      item.weight >= 25 ? 'bg-red-500/15 text-red-400' :
                      item.weight >= 10 ? 'bg-amber-500/15 text-amber-400' :
                      'bg-emerald-500/15 text-emerald-400'
                    }`}>
                      +{item.weight}
                    </div>
                    <div>
                      <code className="text-sm text-white font-mono">{item.rule}</code>
                      <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Action Cards */}
        <section className="grid md:grid-cols-2 gap-6 mb-24">
          <div className="glass-card-hover p-8 group animate-fade-up animate-delay-1">
            <div className="flex items-start justify-between mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-blue-500 flex items-center justify-center text-white">
                <DocumentCheckIcon />
              </div>
              <span className="badge-info">Available</span>
            </div>
            <h3 className="font-display text-2xl font-bold text-white mb-3">Create Receipt</h3>
            <p className="text-slate-400 mb-6">
              Generate cryptographic receipts for Approve and BatchPay transactions with automated risk analysis.
            </p>
            <button
              onClick={onCreateClick}
              className="btn-primary w-full flex items-center justify-center space-x-2"
            >
              <span>Start Creating</span>
              <ArrowRightIcon />
            </button>
          </div>

          <div className="glass-card-hover p-8 group animate-fade-up animate-delay-2">
            <div className="flex items-start justify-between mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white">
                <ShieldCheckIcon />
              </div>
              <span className="badge-success">Available</span>
            </div>
            <h3 className="font-display text-2xl font-bold text-white mb-3">Verify Proof</h3>
            <p className="text-slate-400 mb-6">
              Verify on-chain receipts against local digest. Prove data integrity and establish accountability.
            </p>
            <button
              onClick={onVerifyClick}
              className="btn-secondary w-full flex items-center justify-center space-x-2"
            >
              <span>Verify Receipt</span>
              <ArrowRightIcon />
            </button>
          </div>
        </section>

        {/* Contract + Tech Stack */}
        <section className="text-center mb-12 animate-fade-up">
          <a
            href="https://testnet.monadscan.com/address/0x7761871A017c1C703C06B0021bF341d707c6226A#code"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-white/[0.04] border border-white/10 rounded-full mb-8 hover:bg-white/[0.08] hover:border-primary-500/30 transition-all duration-200 group"
          >
            <span className="w-2 h-2 bg-crypto-green rounded-full animate-pulse"></span>
            <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Contract verified on MonadScan</span>
            <ExternalLinkIcon />
          </a>
          <p className="text-sm text-slate-500 mb-4">Built with</p>
          <div className="flex items-center justify-center flex-wrap gap-4">
            {['React', 'TypeScript', 'Solidity', 'ethers.js', 'Tailwind CSS', 'Monad'].map((tech, i) => (
              <span key={i} className="px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-slate-400 hover:text-white hover:border-white/15 transition-all duration-200 cursor-default">
                {tech}
              </span>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

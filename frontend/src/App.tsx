import { useState } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import { WalletConnect } from './components/WalletConnect'
import { CreateReceiptModal } from './components/CreateReceiptModal'
import { VerifyProofModal } from './components/VerifyProofModal'

// Heroicons (MIT License) - Shield Check
const ShieldCheckIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
)

// Document Check
const DocumentCheckIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-12M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12" />
  </svg>
)

// Cube Transparent (Blockchain)
const CubeIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
  </svg>
)

// Chart Bar
const ChartBarIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
)

// Fingerprint
const FingerprintIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33" />
  </svg>
)

// Arrow Right
const ArrowRightIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
  </svg>
)

// Monad Logo (simplified)
const MonadLogo = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2"/>
    <circle cx="12" cy="12" r="6" fill="currentColor"/>
  </svg>
)

function App() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)

  const handleCreateSuccess = (receiptId: string, txHash: string) => {
    toast.success(`Receipt #${receiptId} created successfully!`, {
      duration: 5000,
      style: {
        background: '#1E293B',
        color: '#F1F5F9',
        border: '1px solid rgba(16, 185, 129, 0.3)',
      },
    })
  }

  return (
    <div className="min-h-screen">
      {/* Toast Container */}
      <Toaster position="top-right" />

      {/* Modals */}
      <CreateReceiptModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
      <VerifyProofModal
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
      />

      {/* Floating Navbar */}
      <nav className="navbar-float">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-crypto-cyan flex items-center justify-center">
            <ShieldCheckIcon />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-white">SafeReceipt</h1>
            <p className="text-xs text-slate-400">Agent Accountability Protocol</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
            <MonadLogo />
            <span className="text-sm text-slate-300">Monad Testnet</span>
            <span className="text-xs text-slate-500 font-mono">10143</span>
          </div>
          <WalletConnect className="!p-0 !bg-transparent !border-0 !rounded-none" />
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-28 pb-12 px-4">
        <div className="max-w-6xl mx-auto">

          {/* Hero Section */}
          <section className="text-center mb-20">
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-500/10 border border-primary-500/20 rounded-full mb-6">
              <span className="w-2 h-2 bg-crypto-green rounded-full animate-pulse"></span>
              <span className="text-sm text-primary-300">Live on Monad Testnet</span>
            </div>

            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              When AI fails,<br />
              <span className="gradient-text">receipts prove</span> who's responsible
            </h1>

            <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
              Verifiable on-chain receipts for AI agent transactions.
              Cryptographic proof of intent before execution.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="btn-primary flex items-center space-x-2 text-lg"
              >
                <DocumentCheckIcon />
                <span>Create Receipt</span>
              </button>
              <button
                onClick={() => setIsVerifyModalOpen(true)}
                className="btn-secondary flex items-center space-x-2 text-lg"
              >
                <ShieldCheckIcon />
                <span>Verify Proof</span>
              </button>
            </div>
          </section>

          {/* Stats Section */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20">
            {[
              { label: 'Risk Rules', value: '6', sublabel: 'Automated checks' },
              { label: 'Hash Type', value: 'keccak256', sublabel: 'Cryptographic' },
              { label: 'Storage', value: 'On-Chain', sublabel: 'Immutable' },
              { label: 'Status', value: 'MVP', sublabel: 'Phase 3/6' },
            ].map((stat, i) => (
              <div key={i} className="glass-card p-6 text-center">
                <div className="text-2xl md:text-3xl font-display font-bold gradient-text mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-white font-medium">{stat.label}</div>
                <div className="text-xs text-slate-500">{stat.sublabel}</div>
              </div>
            ))}
          </section>

          {/* How It Works */}
          <section className="mb-20">
            <div className="text-center mb-12">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
                How It Works
              </h2>
              <p className="text-slate-400 max-w-xl mx-auto">
                Three-step process to create immutable accountability for AI agent transactions
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
                  description: 'Intent hash + proof hash stored on Monad. Immutable evidence for dispute resolution.',
                  color: 'from-cyan-500 to-blue-500',
                },
              ].map((item, i) => (
                <div key={i} className="glass-card-hover p-8 group">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-6 text-white group-hover:scale-110 transition-transform duration-300`}>
                    {item.icon}
                  </div>
                  <div className="text-xs font-mono text-slate-500 mb-2">STEP {item.step}</div>
                  <h3 className="font-display text-xl font-semibold text-white mb-3">{item.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Risk Rules Preview */}
          <section className="mb-20">
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

              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { rule: 'UNLIMITED_ALLOWANCE', weight: 40, desc: 'Detects max uint256 approvals' },
                  { rule: 'SPENDER_IS_UNKNOWN_CONTRACT', weight: 25, desc: 'Checks against known contracts' },
                  { rule: 'REPEAT_APPROVE_PATTERN', weight: 15, desc: 'Flags repeated approvals' },
                  { rule: 'DUPLICATE_RECIPIENTS', weight: 10, desc: 'Detects duplicate addresses' },
                  { rule: 'RECIPIENT_IS_CONTRACT', weight: 5, desc: 'Warns on contract recipients' },
                  { rule: 'OUTLIER_AMOUNT', weight: 5, desc: 'Flags unusual amounts' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors cursor-pointer">
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                        item.weight >= 25 ? 'bg-red-500/20 text-red-400' :
                        item.weight >= 10 ? 'bg-amber-500/20 text-amber-400' :
                        'bg-emerald-500/20 text-emerald-400'
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
          <section className="grid md:grid-cols-2 gap-6 mb-20">
            <div className="glass-card-hover p-8 group">
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
                onClick={() => setIsCreateModalOpen(true)}
                className="btn-primary w-full flex items-center justify-center space-x-2"
              >
                <span>Start Creating</span>
                <ArrowRightIcon />
              </button>
            </div>

            <div className="glass-card-hover p-8 group">
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
                onClick={() => setIsVerifyModalOpen(true)}
                className="btn-secondary w-full flex items-center justify-center space-x-2"
              >
                <span>Verify Receipt</span>
                <ArrowRightIcon />
              </button>
            </div>
          </section>

          {/* Tech Stack */}
          <section className="text-center mb-12">
            <p className="text-sm text-slate-500 mb-4">Built with</p>
            <div className="flex items-center justify-center flex-wrap gap-6">
              {['React', 'TypeScript', 'Solidity', 'ethers.js', 'Tailwind CSS', 'Monad'].map((tech, i) => (
                <span key={i} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-400 hover:text-white hover:border-white/20 transition-colors cursor-default">
                  {tech}
                </span>
              ))}
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center">
              <ShieldCheckIcon />
            </div>
            <span className="font-display font-semibold text-white">SafeReceipt</span>
          </div>

          <div className="flex items-center space-x-6 text-sm text-slate-500">
            <span>Rebel in Paradise 2026</span>
            <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
            <span>Consensus HK 2026</span>
          </div>

          <div className="flex items-center space-x-4">
            <a href="https://github.com/calderbuild/SafeReceipt" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-white transition-colors cursor-pointer">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App

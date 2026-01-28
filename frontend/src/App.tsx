import { WalletConnect } from './components/WalletConnect'
import './App.css'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                SafeReceipt
              </h1>
              <p className="text-gray-400 text-lg">
                Agent Accountability Protocol
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Monad Testnet</p>
              <p className="text-xs text-gray-600">Chain ID: 10143</p>
            </div>
          </div>
        </header>

        {/* Wallet Connection */}
        <div className="mb-8">
          <WalletConnect />
        </div>

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-slate-900/50 via-purple-900/20 to-slate-900/50 rounded-2xl p-8 border border-purple-500/20 mb-8">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold text-white mb-4">
              When AI fails, receipts prove who's responsible
            </h2>
            <p className="text-gray-300 text-lg mb-6">
              SafeReceipt creates verifiable on-chain receipts for AI agent transactions.
              Every action is recorded with cryptographic proof, ensuring accountability
              and transparency in the age of autonomous agents.
            </p>
            <div className="flex space-x-4">
              <div className="bg-slate-800/50 rounded-xl p-4 flex-1">
                <div className="text-purple-400 text-sm font-semibold mb-1">VERIFY</div>
                <div className="text-white text-2xl font-bold">Intent Hash</div>
                <div className="text-gray-400 text-sm mt-1">Prove original intent</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 flex-1">
                <div className="text-blue-400 text-sm font-semibold mb-1">ASSESS</div>
                <div className="text-white text-2xl font-bold">Risk Score</div>
                <div className="text-gray-400 text-sm mt-1">6 automated rules</div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 flex-1">
                <div className="text-emerald-400 text-sm font-semibold mb-1">RECORD</div>
                <div className="text-white text-2xl font-bold">On-Chain</div>
                <div className="text-gray-400 text-sm mt-1">Immutable proof</div>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white">Create Receipt</h3>
            </div>
            <p className="text-gray-400 mb-4">
              Generate cryptographic receipts for Approve and BatchPay transactions with risk analysis.
            </p>
            <div className="bg-slate-800/50 rounded-lg p-3 text-sm text-gray-500">
              Coming soon: Phase 4 UI implementation
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white">Verify Proof</h3>
            </div>
            <p className="text-gray-400 mb-4">
              Verify on-chain receipts against local digest to ensure data integrity and accountability.
            </p>
            <div className="bg-slate-800/50 rounded-lg p-3 text-sm text-gray-500">
              Coming soon: Phase 4 UI implementation
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>SafeReceipt MVP - Built for Monad Testnet</p>
          <p className="mt-1">Rebel in Paradise + Consensus HK 2026</p>
        </footer>
      </div>
    </div>
  )
}

export default App

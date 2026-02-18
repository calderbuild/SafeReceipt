import { useState } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { Toaster, toast } from 'react-hot-toast'
import { WalletConnect } from './components/WalletConnect'
import { CreateReceiptModal } from './components/CreateReceiptModal'
import { VerifyProofModal } from './components/VerifyProofModal'
import { Home, MyReceipts, ReceiptDetail } from './pages'

// Heroicons (MIT License) - Shield Check
const ShieldCheckIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
)

// Document Check
const DocumentCheckIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-12M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12" />
  </svg>
)

// Base Logo
const BaseLogo = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10" fill="#0052FF" opacity="0.3"/>
    <path d="M12 4C7.58 4 4 7.58 4 12s3.58 8 8 8c4.08 0 7.44-3.05 7.93-7H14c-.46 2.28-2.48 4-4.9 4-2.76 0-5-2.24-5-5s2.24-5 5-5c2.42 0 4.44 1.72 4.9 4h5.93C19.44 7.05 16.08 4 12 4z" fill="currentColor"/>
  </svg>
)

function App() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)

  const handleCreateSuccess = (receiptId: string, _txHash: string) => {
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
        <Link to="/" className="flex items-center space-x-3 cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-crypto-cyan flex items-center justify-center">
            <ShieldCheckIcon />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-white">SafeReceipt</h1>
            <p className="text-xs text-slate-400">Agent Accountability Protocol</p>
          </div>
        </Link>

        <div className="flex items-center space-x-4">
          <Link
            to="/receipts"
            className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <DocumentCheckIcon />
            <span className="text-sm text-slate-300">My Receipts</span>
          </Link>
          <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
            <BaseLogo />
            <span className="text-sm text-slate-300">Base Sepolia</span>
            <span className="text-xs text-slate-500 font-mono">84532</span>
          </div>
          <WalletConnect className="!p-0 !bg-transparent !border-0 !rounded-none" />
        </div>
      </nav>

      {/* Routes */}
      <Routes>
        <Route
          path="/"
          element={
            <Home
              onCreateClick={() => setIsCreateModalOpen(true)}
              onVerifyClick={() => setIsVerifyModalOpen(true)}
            />
          }
        />
        <Route path="/receipts" element={<MyReceipts />} />
        <Route path="/receipt/:id" element={<ReceiptDetail />} />
      </Routes>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center space-x-3 cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center">
              <ShieldCheckIcon />
            </div>
            <span className="font-display font-semibold text-white">SafeReceipt</span>
          </Link>

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

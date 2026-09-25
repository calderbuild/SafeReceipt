import { useState } from 'react'
import { Routes, Route, Link, NavLink } from 'react-router-dom'
import { Toaster, toast } from 'react-hot-toast'
import { WalletConnect } from './components/WalletConnect'
import { CreateReceiptModal } from './components/CreateReceiptModal'
import { VerifyProofModal } from './components/VerifyProofModal'
import { Home, MyReceipts, ReceiptDetail, Fleet } from './pages'

// Receipt mark: a slip with a torn bottom edge
const ReceiptMark = ({ className = 'w-7 h-7' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 2.5h14v17l-2.33-1.5-2.34 1.5L12 18l-2.33 1.5L7.33 18 5 19.5z" fill="var(--color-paper)" />
    <path d="M8 7h8M8 10.5h8M8 14h4.5" stroke="var(--color-paper-ink)" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
)

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm whitespace-nowrap px-2 sm:px-2.5 py-1.5 rounded-md transition-colors ${isActive ? 'text-white bg-white/[0.06]' : 'text-slate-400 hover:text-white'}`

// Monad Logo (simplified)
const MonadLogo = () => (
  <svg className="w-3.5 h-3.5 text-primary-300" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2"/>
    <circle cx="12" cy="12" r="6" fill="currentColor"/>
  </svg>
)

function App() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)

  const handleCreateSuccess = (receiptId: string) => {
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
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <ReceiptMark />
          <span className="font-display font-semibold text-lg text-white tracking-tight">SafeReceipt</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-3">
          <NavLink to="/fleet" className={navLinkClass}><span className="sm:hidden">Fleet</span><span className="hidden sm:inline">Agent fleet</span></NavLink>
          <NavLink to="/receipts" className={navLinkClass}><span className="sm:hidden">Receipts</span><span className="hidden sm:inline">My receipts</span></NavLink>
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 border border-white/10 rounded-md" title="Network used when you create a receipt with your wallet">
            <MonadLogo />
            <span>Monad Testnet</span>
          </div>
          <WalletConnect className="!py-1.5 !px-3" />
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
        <Route path="/fleet" element={<Fleet />} />
        <Route path="/receipts" element={<MyReceipts />} />
        <Route path="/receipt/:id" element={<ReceiptDetail />} />
      </Routes>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center space-x-3 cursor-pointer">
            <ReceiptMark className="w-6 h-6" />
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

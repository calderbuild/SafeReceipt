import type { ReactNode } from 'react';

export function ReceiptSlip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`receipt-slip ${className}`}>{children}</div>;
}

export function SlipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="slip-row">
      <span className="slip-label">{label}</span>
      <span className="slip-value">{children}</span>
    </div>
  );
}

export function SlipRule() {
  return <hr className="slip-rule" />;
}

type StampKind = 'verified' | 'mismatch' | 'pending';

export function Stamp({ kind, label, press = false }: { kind: StampKind; label: string; press?: boolean }) {
  return <span className={`stamp stamp-${kind} ${press ? 'stamp-press' : ''}`}>{label}</span>;
}

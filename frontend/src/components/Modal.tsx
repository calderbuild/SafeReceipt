import React, { useEffect, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// Native <dialog>: Escape closes, focus stays inside while open and returns to the opener on close.
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto glass-card p-6 [color:inherit] backdrop:bg-black/60"
    >
      {isOpen && (
        <>
          <div className="flex items-center justify-between mb-6">
            <h2 id="modal-title" className="font-display text-xl font-bold text-white">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <CloseIcon />
            </button>
          </div>
          <div>{children}</div>
        </>
      )}
    </dialog>
  );
};

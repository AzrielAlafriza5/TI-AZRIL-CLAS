import type { ReactNode } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  maxWidthClass = 'max-w-lg',
}: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#181A17]/40 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${maxWidthClass} bg-white rounded-[28px] border border-[#DDE6C9] shadow-[0_12px_36px_rgba(24,26,23,0.12)] overflow-hidden max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-start justify-between gap-4 px-7 py-5 border-b border-[#DDE6C9]">
          <div>
            <h2 className="text-base font-bold text-[#181A17]">{title}</h2>
            {subtitle && <p className="text-xs text-[#73796C] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[#73796C] hover:text-[#181A17] hover:bg-[#F0F8E0] transition-colors"
            aria-label="Tutup dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-7 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Ya, Lanjutkan',
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#181A17]/40 backdrop-blur-[2px] p-4"
      role="alertdialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-white rounded-[28px] border border-[#DDE6C9] shadow-[0_12px_36px_rgba(24,26,23,0.12)] p-7">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
              danger ? 'bg-[#FCECEF] text-[#C44750]' : 'bg-[#DBECB8] text-[#181A17]'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#181A17]">{title}</h3>
            <p className="text-sm text-[#73796C] mt-1.5 leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2.5 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-medium text-[#73796C] bg-transparent border border-[#DDE6C9] rounded-full hover:text-[#181A17] hover:bg-[#F0F8E0] transition-colors whitespace-nowrap"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 text-sm font-semibold text-white rounded-full transition-colors whitespace-nowrap disabled:opacity-60 ${
              danger ? 'bg-[#C44750] hover:bg-[#b03c45]' : 'bg-[#181A17] hover:bg-[#2c302a]'
            }`}
          >
            {loading ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

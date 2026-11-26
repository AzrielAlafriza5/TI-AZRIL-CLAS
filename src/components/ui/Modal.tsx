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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#101210]/50 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`animate-modal-enter w-full ${maxWidthClass} bg-white rounded-[24px] border border-[#D5E4B6] overflow-hidden max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[#D5E4B6]">
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-[#20251D]">{title}</h2>
            {subtitle && <p className="text-xs text-[#6F7B68] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[#6F7B68] hover:text-[#20251D] hover:bg-[#F0F8DF] transition-colors cursor-pointer shrink-0"
            aria-label="Tutup dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#101210]/50 backdrop-blur-[2px] p-4"
      role="alertdialog"
      aria-modal="true"
    >
      <div className="animate-modal-enter w-full max-w-md bg-white rounded-[24px] border border-[#D5E4B6] p-6">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              danger ? 'bg-[#D13447]/10 text-[#D13447]' : 'bg-[#DCECB8] text-[#20251D]'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-[#20251D]">{title}</h3>
            <p className="text-sm text-[#4E5849] mt-1.5 leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2.5 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="font-display px-5 py-2.5 text-sm font-semibold text-[#4E5849] bg-white border border-[#D5E4B6] rounded-full hover:text-[#20251D] hover:bg-[#F0F8DF] transition-colors whitespace-nowrap cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`font-display px-5 py-2.5 text-sm font-semibold rounded-full transition-all active:scale-[0.98] whitespace-nowrap disabled:opacity-60 cursor-pointer ${
              danger
                ? 'bg-[#D13447] hover:bg-[#b82a3b] text-white'
                : 'bg-[#B5D45D] hover:bg-[#C5E370] text-[#171A17]'
            }`}
          >
            {loading ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

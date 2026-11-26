import { CheckCircle2, CircleDot, AlertTriangle, Clock, RotateCcw, Award } from 'lucide-react';
import type { AttendanceStatus, MaterialProgressStatus, StudentStatus } from '../../types/index.ts';

export function StudentStatusIndicator({
  status,
  compact = false,
}: {
  status: StudentStatus;
  compact?: boolean;
}) {
  const sizeCls = compact
    ? 'gap-1 px-2 py-0.5 text-[9px] sm:text-xs sm:px-2.5 sm:py-1'
    : 'gap-1.5 px-3 py-1 text-xs';
  const iconCls = compact ? 'w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 shrink-0' : 'w-3.5 h-3.5 shrink-0';

  if (status === 'hijau') {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-[#DCECB8] text-[#3E7B27] font-semibold whitespace-nowrap ${sizeCls}`}
      >
        <CheckCircle2 className={iconCls} aria-hidden="true" />
        <span>Lulus</span>
      </span>
    );
  }
  if (status === 'merah') {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-[#D13447]/10 text-[#D13447] font-semibold whitespace-nowrap ${sizeCls}`}
      >
        <AlertTriangle className={iconCls} aria-hidden="true" />
        <span>AFK</span>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full bg-[#F0F8DF] border border-[#D5E4B6] text-[#20251D] font-semibold whitespace-nowrap ${sizeCls}`}
    >
      <CircleDot className={`${iconCls} text-[#4E5849]`} aria-hidden="true" />
      <span>Aktif</span>
    </span>
  );
}

export function SubmissionStatusIndicator({ status }: { status: string }) {
  switch (status) {
    case 'graded':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCECB8] text-[#3E7B27] text-xs font-semibold whitespace-nowrap">
          <Award className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Dinilai</span>
        </span>
      );
    case 'submitted':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#B5D45D]/35 text-[#20251D] text-xs font-semibold whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#3E7B27]" aria-hidden="true" />
          <span>Sudah mengumpulkan</span>
        </span>
      );
    case 'late':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C27C0A]/15 text-[#C27C0A] text-xs font-semibold whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Terlambat</span>
        </span>
      );
    case 'revision':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D13447]/10 text-[#D13447] text-xs font-semibold whitespace-nowrap">
          <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Revisi</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F0F8DF] border border-[#D5E4B6] text-[#6F7B68] text-xs font-medium whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Belum mengumpulkan</span>
        </span>
      );
  }
}

export function AttendanceStatusIndicator({ status }: { status: AttendanceStatus }) {
  if (status === 'hadir') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#DCECB8] text-[#3E7B27] text-xs font-semibold">
        Hadir
      </span>
    );
  }
  if (status === 'izin') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#F0F8DF] border border-[#D5E4B6] text-[#20251D] text-xs font-semibold">
        Izin
      </span>
    );
  }
  if (status === 'sakit') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#C27C0A]/15 text-[#C27C0A] text-xs font-semibold">
        Sakit
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#D13447]/10 text-[#D13447] text-xs font-semibold">
      Alpha
    </span>
  );
}

export function MaterialStatusIndicator({ status }: { status: MaterialProgressStatus }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCECB8] text-[#3E7B27] text-xs font-semibold whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Selesai</span>
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C27C0A]/15 text-[#C27C0A] text-xs font-semibold whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Sedang dipelajari</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F0F8DF] border border-[#D5E4B6] text-[#6F7B68] text-xs font-medium whitespace-nowrap">
      <CircleDot className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>Belum dipelajari</span>
    </span>
  );
}

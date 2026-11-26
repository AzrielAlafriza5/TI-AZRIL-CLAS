import { CheckCircle2, CircleDot, AlertTriangle, Clock, RotateCcw, Award } from 'lucide-react';
import type { AttendanceStatus, MaterialProgressStatus, StudentStatus } from '../../types/index.ts';

export function StudentStatusIndicator({ status }: { status: StudentStatus }) {
  if (status === 'hijau') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DBECB8] text-[#3D914C] text-xs font-semibold whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Lulus</span>
      </span>
    );
  }
  if (status === 'merah') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FCECEF] text-[#C44750] text-xs font-semibold whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>AFK</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F0F8E0] border border-[#DDE6C9] text-[#181A17] text-xs font-semibold whitespace-nowrap">
      <CircleDot className="w-3.5 h-3.5 shrink-0 text-[#73796C]" aria-hidden="true" />
      <span>Aktif</span>
    </span>
  );
}

export function SubmissionStatusIndicator({ status }: { status: string }) {
  switch (status) {
    case 'graded':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DBECB8] text-[#3D914C] text-xs font-semibold whitespace-nowrap">
          <Award className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Dinilai</span>
        </span>
      );
    case 'submitted':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#B5D45D]/40 text-[#181A17] text-xs font-semibold whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#3D914C]" aria-hidden="true" />
          <span>Sudah mengumpulkan</span>
        </span>
      );
    case 'late':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D8A33D]/20 text-[#181A17] text-xs font-semibold whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0 text-[#D8A33D]" aria-hidden="true" />
          <span>Terlambat</span>
        </span>
      );
    case 'revision':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FCECEF] text-[#C44750] text-xs font-semibold whitespace-nowrap">
          <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Revisi</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F0F8E0] text-[#73796C] text-xs font-medium whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Belum mengumpulkan</span>
        </span>
      );
  }
}

export function AttendanceStatusIndicator({ status }: { status: AttendanceStatus }) {
  if (status === 'hadir') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#DBECB8] text-[#3D914C] text-xs font-semibold">
        Hadir
      </span>
    );
  }
  if (status === 'izin') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#F0F8E0] border border-[#DDE6C9] text-[#181A17] text-xs font-semibold">
        Izin
      </span>
    );
  }
  if (status === 'sakit') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#D8A33D]/20 text-[#181A17] text-xs font-semibold">
        Sakit
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#FCECEF] text-[#C44750] text-xs font-semibold">
      Alpha
    </span>
  );
}

export function MaterialStatusIndicator({ status }: { status: MaterialProgressStatus }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DBECB8] text-[#3D914C] text-xs font-semibold whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Selesai</span>
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D8A33D]/20 text-[#181A17] text-xs font-semibold whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0 text-[#D8A33D]" aria-hidden="true" />
        <span>Sedang dipelajari</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F0F8E0] text-[#73796C] text-xs font-medium whitespace-nowrap">
      <CircleDot className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>Belum dipelajari</span>
    </span>
  );
}

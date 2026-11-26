import { useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { Card, Button, Select, Textarea } from '../components/ui/DesignSystem.tsx';
import { StreakFlame } from '../components/ui/BrandLogo.tsx';
import {
  StudentStatusIndicator,
  AttendanceStatusIndicator,
  SubmissionStatusIndicator,
} from '../components/ui/StatusBadge.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { TableSkeleton } from '../components/ui/Skeleton.tsx';
import type { StudentStatus } from '../types/index.ts';

interface StudentDetailPageProps {
  studentId: string;
  onBack: () => void;
  onToast: (type: 'success' | 'error', text: string) => void;
}

export function StudentDetailPage({ studentId, onBack, onToast }: StudentDetailPageProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'points' | 'exp' | 'attendance' | 'submissions' | 'streak' | 'status'>('points');

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<StudentStatus>('netral');
  const [statusReason, setStatusReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/students/${studentId}`);
      setData(res);
      setNewStatus(res.student.status);
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [studentId]);

  const handleResetPasswordToNim = async () => {
    if (!data?.student) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>(
        `/api/admin/students/${data.student.id}/reset-password`,
        { method: 'POST', body: JSON.stringify({}) }
      );
      onToast('success', res.message);
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/api/admin/students/${studentId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, reason: statusReason }),
      });
      onToast('success', 'Status mahasiswa berhasil diperbarui.');
      setStatusModalOpen(false);
      setStatusReason('');
      await loadDetail();
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !data) {
    return <TableSkeleton rows={8} />;
  }

  const { student, points, exp, attendance, submissions, loginHistory, statusHistory } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#73796C] hover:text-[#181A17]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Mahasiswa</span>
        </button>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setStatusModalOpen(true)}>
            <ShieldCheck className="w-4 h-4" />
            <span>Ubah Status</span>
          </Button>
          <Button size="sm" disabled={submitting} onClick={handleResetPasswordToNim}>
            <KeyRound className="w-4 h-4" />
            <span>Reset Password ke NIM</span>
          </Button>
        </div>
      </div>

      {/* Student Profile Summary Card */}
      <Card variant="soft" className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="text-xs font-bold text-[#3D914C] tabular-nums">
            NIM {student.nim} · {student.study_program_name} · {student.class_name}
          </div>
          <h1 className="text-2xl font-bold text-[#181A17] mt-1">{student.full_name}</h1>
          <div className="mt-3 flex items-center gap-4">
            <StudentStatusIndicator status={student.status} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-6 bg-white rounded-3xl p-4 border border-[#DDE6C9]">
          <div>
            <div className="text-xs text-[#73796C]">Total Poin</div>
            <div className="text-xl font-bold tabular-nums text-[#3D914C] mt-0.5">
              {student.total_points}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#73796C]">Total EXP</div>
            <div className="text-xl font-bold tabular-nums text-[#181A17] mt-0.5">
              {student.total_exp}{' '}
              <span className="text-xs font-medium text-[#73796C]">Lv.{student.current_level}</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-[#73796C]">Current Streak</div>
            <div className="mt-1">
              <StreakFlame days={student.current_streak ?? 0} size="sm" />
            </div>
          </div>
          <div>
            <div className="text-xs text-[#73796C]">Best / Login Days</div>
            <div className="text-base font-bold tabular-nums text-[#181A17] mt-1">
              {student.best_streak ?? 0}d / {student.total_login_days ?? 0}d
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-white border border-[#DDE6C9] rounded-full w-fit">
        {[
          { id: 'points', label: `Riwayat Poin (${points.length})` },
          { id: 'exp', label: `Riwayat EXP (${exp.length})` },
          { id: 'attendance', label: `Absensi (${attendance.length})` },
          { id: 'submissions', label: `Tugas (${submissions.length})` },
          { id: 'streak', label: `Login Harian (${loginHistory.length})` },
          { id: 'status', label: `Riwayat Status (${statusHistory.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap ${
              tab === t.id ? 'bg-[#181A17] text-white' : 'text-[#73796C] hover:text-[#181A17]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <Card>
        {tab === 'points' && (
          <div className="divide-y divide-[#DDE6C9]/60">
            {points.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#73796C]">Belum ada riwayat poin.</div>
            ) : (
              points.map((p: any) => (
                <div key={p.id} className="py-3.5 flex items-center justify-between gap-4 text-sm">
                  <div>
                    <div className="font-semibold text-[#181A17]">{p.description}</div>
                    <div className="text-xs text-[#73796C] mt-0.5 tabular-nums">
                      Sumber: {p.source} · {String(p.created_at).slice(0, 16).replace('T', ' ')}
                      {p.admin_name ? ` · oleh ${p.admin_name}` : ''}
                    </div>
                  </div>
                  <span
                    className={`font-bold tabular-nums ${
                      p.amount >= 0 ? 'text-[#3D914C]' : 'text-[#C44750]'
                    }`}
                  >
                    {p.amount >= 0 ? `+${p.amount}` : p.amount}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'exp' && (
          <div className="divide-y divide-[#DDE6C9]/60">
            {exp.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#73796C]">Belum ada riwayat EXP.</div>
            ) : (
              exp.map((e: any) => (
                <div key={e.id} className="py-3.5 flex items-center justify-between gap-4 text-sm">
                  <div>
                    <div className="font-semibold text-[#181A17]">{e.description}</div>
                    <div className="text-xs text-[#73796C] mt-0.5 tabular-nums">
                      {e.source} · {String(e.created_at).slice(0, 16).replace('T', ' ')}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#DBECB8] text-xs font-bold text-[#3D914C] tabular-nums">
                    +{e.amount} EXP
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'attendance' && (
          <div className="divide-y divide-[#DDE6C9]/60">
            {attendance.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#73796C]">Belum ada riwayat absensi.</div>
            ) : (
              attendance.map((a: any) => (
                <div key={a.id} className="py-3.5 flex items-center justify-between text-sm">
                  <div className="tabular-nums">
                    <span className="font-bold text-[#181A17]">Pertemuan {a.meeting_number}</span>
                    <span className="text-[#73796C]"> · {a.attendance_date} · {a.source}</span>
                  </div>
                  <AttendanceStatusIndicator status={a.status} />
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'submissions' && (
          <div className="divide-y divide-[#DDE6C9]/60">
            {submissions.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#73796C]">Belum ada pengumpulan tugas.</div>
            ) : (
              submissions.map((sub: any) => (
                <div key={sub.id} className="py-3.5 flex items-center justify-between gap-4 text-sm">
                  <div>
                    <div className="font-bold text-[#181A17]">{sub.assignment_title}</div>
                    <div className="text-xs text-[#73796C] mt-0.5 tabular-nums">
                      Dikumpulkan: {String(sub.submitted_at).slice(0, 16).replace('T', ' ')} · Nilai:{' '}
                      {sub.score ?? '-'} · Poin: {sub.awarded_points}
                    </div>
                  </div>
                  <SubmissionStatusIndicator status={sub.status} />
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'streak' && (
          <div className="divide-y divide-[#DDE6C9]/60">
            {loginHistory.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#73796C]">Belum ada riwayat login.</div>
            ) : (
              loginHistory.map((lh: any) => (
                <div key={lh.id} className="py-3 flex items-center justify-between text-sm tabular-nums">
                  <span className="text-[#181A17] font-medium">{lh.login_date}</span>
                  <span className="px-3 py-1 rounded-full bg-[#DBECB8] text-xs font-bold text-[#181A17]">
                    Streak Hari ke-{lh.streak_day}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'status' && (
          <div className="divide-y divide-[#DDE6C9]/60">
            {statusHistory.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#73796C]">Belum ada perubahan status.</div>
            ) : (
              statusHistory.map((sh: any) => (
                <div key={sh.id} className="py-3.5 text-sm">
                  <div className="flex items-center gap-2 font-bold text-[#181A17]">
                    <span>{sh.previous_status.toUpperCase()}</span>
                    <span>→</span>
                    <span>{sh.new_status.toUpperCase()}</span>
                    <span className="text-xs font-normal text-[#73796C]">({sh.source})</span>
                  </div>
                  {sh.reason && <div className="text-xs text-[#73796C] mt-0.5">{sh.reason}</div>}
                  <div className="text-xs text-[#73796C] mt-0.5 tabular-nums">
                    {String(sh.created_at).slice(0, 16).replace('T', ' ')} · oleh{' '}
                    {sh.changed_by_name ?? 'Admin'}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {/* Status Update Modal */}
      <Modal
        open={statusModalOpen}
        title="Ubah Status Mahasiswa"
        subtitle={student.full_name}
        onClose={() => setStatusModalOpen(false)}
      >
        <form onSubmit={handleSaveStatus} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#73796C] mb-1.5">Status</label>
            <Select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as StudentStatus)}
              className="w-full"
            >
              <option value="hijau">HIJAU — LULUS</option>
              <option value="netral">NETRAL — AKTIF</option>
              <option value="merah">MERAH — TIDAK AKTIF / AFK</option>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#73796C] mb-1.5">
              Alasan / Catatan
            </label>
            <Textarea
              rows={3}
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="Catatan perubahan status..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setStatusModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan Status'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

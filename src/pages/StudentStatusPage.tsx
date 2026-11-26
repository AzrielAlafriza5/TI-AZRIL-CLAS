import { useEffect, useState } from 'react';
import { ShieldCheck, History } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import {
  Card,
  Button,
  Select,
  Textarea,
  PageHeader,
  SegmentedControl,
} from '../components/ui/DesignSystem.tsx';
import { StudentStatusIndicator } from '../components/ui/StatusBadge.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { TableSkeleton } from '../components/ui/Skeleton.tsx';
import type { StudentProfile, StudentStatus } from '../types/index.ts';

interface StudentStatusPageProps {
  onToast: (type: 'success' | 'error', text: string) => void;
}

export function StudentStatusPage({ onToast }: StudentStatusPageProps) {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const [editTarget, setEditTarget] = useState<StudentProfile | null>(null);
  const [newStatus, setNewStatus] = useState<StudentStatus>('netral');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const qs = statusFilter ? `&status=${statusFilter}` : '';
      const [sRes, hRes] = await Promise.all([
        apiFetch<{ students: StudentProfile[] }>(`/api/admin/students?limit=100${qs}`),
        apiFetch<{ history: any[] }>('/api/admin/status-history'),
      ]);
      setStudents(sRes.students);
      setHistory(hRes.history);
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/students/${editTarget.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, reason }),
      });
      onToast('success', `Status ${editTarget.full_name} diubah menjadi ${newStatus.toUpperCase()}.`);
      setEditTarget(null);
      setReason('');
      await loadData();
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sistem Status Mahasiswa"
        description="Kelola status kelulusan (Hijau), aktif (Netral), dan tidak aktif/AFK (Merah) terpisah dari poin dan EXP."
        actions={
          <SegmentedControl
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { id: '', label: 'Semua' },
              { id: 'hijau', label: 'Hijau (Lulus)' },
              { id: 'netral', label: 'Netral (Aktif)' },
              { id: 'merah', label: 'Merah (AFK)' },
            ]}
          />
        }
      />

      <div className="grid grid-cols-1 desktop:grid-cols-12 gap-5">
        <Card className="desktop:col-span-7 p-0 overflow-hidden">
          <div className="px-6 py-5 border-b border-[#D5E4B6] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#3E7B27]" />
            <h2 className="font-display text-base font-bold text-[#20251D]">
              Daftar Status Mahasiswa
            </h2>
          </div>

          {loading ? (
            <div className="p-6">
              <TableSkeleton rows={5} />
            </div>
          ) : students.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#6F7B68]">
              Tidak ada mahasiswa pada kategori status ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#D5E4B6] bg-[#F0F8DF]/70 text-xs font-semibold text-[#6F7B68]">
                    <th className="py-3 px-5">NIM</th>
                    <th className="py-3 px-4">Nama</th>
                    <th className="py-3 px-4">Kelas</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D5E4B6]/70">
                  {students.map((s) => (
                    <tr key={s.id} className="hover:bg-[#F0F8DF]/50 transition-colors">
                      <td className="py-3.5 px-5 text-xs text-[#6F7B68] tabular-nums">{s.nim}</td>
                      <td className="py-3.5 px-4 font-display font-bold text-[#20251D]">
                        {s.full_name}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#6F7B68]">{s.class_name}</td>
                      <td className="py-3.5 px-4">
                        <StudentStatusIndicator status={s.status} />
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditTarget(s);
                            setNewStatus(s.status);
                            setReason('');
                          }}
                        >
                          Ubah Status
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="desktop:col-span-5">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-[#3E7B27]" />
            <h2 className="font-display text-base font-bold text-[#20251D]">
              Riwayat Perubahan Status
            </h2>
          </div>

          {history.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#6F7B68]">
              Belum ada perubahan status tercatat.
            </div>
          ) : (
            <div className="divide-y divide-[#D5E4B6]/70 max-h-[520px] overflow-y-auto pr-1">
              {history.map((h) => (
                <div key={h.id} className="py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-[#20251D]">{h.student_name}</span>
                    <span className="text-xs text-[#6F7B68] tabular-nums">{h.nim}</span>
                  </div>
                  <div className="text-xs font-bold text-[#3E7B27] mt-1">
                    {h.previous_status.toUpperCase()} → {h.new_status.toUpperCase()}{' '}
                    <span className="font-normal text-[#6F7B68]">({h.source})</span>
                  </div>
                  {h.reason && <div className="text-xs text-[#4E5849] mt-0.5">{h.reason}</div>}
                  <div className="text-[11px] text-[#6F7B68] mt-1 tabular-nums">
                    {String(h.created_at).slice(0, 16).replace('T', ' ')} · {h.changed_by_name ?? 'Admin'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={Boolean(editTarget)}
        title="Perbarui Status Mahasiswa"
        subtitle={editTarget ? `${editTarget.full_name} (NIM ${editTarget.nim})` : ''}
        onClose={() => setEditTarget(null)}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">Status Baru</label>
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
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
              Alasan Perubahan
            </label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Memenuhi seluruh syarat kelulusan proyek akhir."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

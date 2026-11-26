import { useEffect, useState } from 'react';
import {
  Plus,
  Eye,
  Pencil,
  KeyRound,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Users,
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import {
  Card,
  Button,
  Input,
  Select,
  SearchBar,
  PageHeader,
  EmptyState,
} from '../components/ui/DesignSystem.tsx';
import { Modal, ConfirmDialog } from '../components/ui/Modal.tsx';
import { StudentStatusIndicator } from '../components/ui/StatusBadge.tsx';
import { TableSkeleton } from '../components/ui/Skeleton.tsx';
import type { StudentProfile, StudentStatus } from '../types/index.ts';

interface StudentsPageProps {
  initialSearch?: string;
  onToast: (type: 'success' | 'error', text: string) => void;
  onSelectStudent: (id: string) => void;
}

export function StudentsPage({
  initialSearch = '',
  onToast,
  onSelectStudent,
}: StudentsPageProps) {
  const [programs, setPrograms] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [classes, setClasses] = useState<
    Array<{ id: string; name: string; study_program_id: string }>
  >([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(initialSearch);
  const [studyProgramId, setStudyProgramId] = useState('');
  const [classId, setClassId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Add/Edit Student Modal
  const [formModal, setFormModal] = useState<{ open: boolean; editing: StudentProfile | null }>({
    open: false,
    editing: null,
  });
  const [formState, setFormState] = useState({
    full_name: '',
    nim: '',
    study_program_id: '',
    class_id: '',
    status: 'netral' as StudentStatus,
  });

  // Reset Password Modal
  const [resetModal, setResetModal] = useState<{ open: boolean; student: StudentProfile | null }>({
    open: false,
    student: null,
  });
  const [customPassword, setCustomPassword] = useState('');

  // Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState<StudentProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSearch(initialSearch);
    setPage(1);
  }, [initialSearch]);

  useEffect(() => {
    apiFetch<{ programs: any[]; classes: any[] }>('/api/reference/academic')
      .then((res) => {
        setPrograms(res.programs);
        setClasses(res.classes);
      })
      .catch(() => {});
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (studyProgramId) params.set('studyProgramId', studyProgramId);
      if (classId) params.set('classId', classId);
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', '15');

      const res = await apiFetch<{
        students: StudentProfile[];
        pagination: { page: number; total: number; totalPages: number };
      }>(`/api/admin/students?${params.toString()}`);

      setStudents(res.students);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [search, studyProgramId, classId, statusFilter, page]);

  const filterClasses = studyProgramId
    ? classes.filter((c) => c.study_program_id === studyProgramId)
    : classes;

  const formClasses = formState.study_program_id
    ? classes.filter((c) => c.study_program_id === formState.study_program_id)
    : classes;

  const openCreateModal = () => {
    const defaultProdi = programs[0]?.id ?? '';
    const defaultCls = classes.find((c) => c.study_program_id === defaultProdi)?.id ?? '';
    setFormState({
      full_name: '',
      nim: '',
      study_program_id: defaultProdi,
      class_id: defaultCls,
      status: 'netral',
    });
    setFormModal({ open: true, editing: null });
  };

  const openEditModal = (s: StudentProfile) => {
    setFormState({
      full_name: s.full_name,
      nim: s.nim,
      study_program_id: s.study_program_id,
      class_id: s.class_id,
      status: s.status,
    });
    setFormModal({ open: true, editing: s });
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (formModal.editing) {
        await apiFetch(`/api/admin/students/${formModal.editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(formState),
        });
        onToast('success', 'Biodata mahasiswa berhasil diperbarui.');
      } else {
        await apiFetch('/api/admin/students', {
          method: 'POST',
          body: JSON.stringify(formState),
        });
        onToast(
          'success',
          `Akun mahasiswa "${formState.full_name}" dibuat. Username & password awal: ${formState.nim}`
        );
      }
      setFormModal({ open: false, editing: null });
      await loadStudents();
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModal.student) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>(
        `/api/admin/students/${resetModal.student.id}/reset-password`,
        {
          method: 'POST',
          body: JSON.stringify({ new_password: customPassword.trim() || undefined }),
        }
      );
      onToast('success', res.message);
      setResetModal({ open: false, student: null });
      setCustomPassword('');
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/admin/students/${deleteTarget.id}`, { method: 'DELETE' });
      onToast('success', `Mahasiswa ${deleteTarget.full_name} berhasil dihapus.`);
      setDeleteTarget(null);
      await loadStudents();
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data & Manajemen Mahasiswa"
        description="Buat akun mahasiswa (username & password awal otomatis menggunakan NIM), kelola kelas, dan reset password."
        actions={
          <Button onClick={openCreateModal} disabled={classes.length === 0}>
            <Plus className="w-4 h-4" />
            <span>Tambah Mahasiswa</span>
          </Button>
        }
      />

      {/* Filters Bar */}
      <Card className="p-4 flex flex-wrap items-center gap-3">
        <SearchBar
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          placeholder="Cari nama mahasiswa atau NIM..."
          className="flex-1 min-w-[220px]"
        />

        <Select
          value={studyProgramId}
          onChange={(e) => {
            setStudyProgramId(e.target.value);
            setClassId('');
            setPage(1);
          }}
          className="rounded-full"
        >
          <option value="">Semua Program Studi</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>

        <Select
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setPage(1);
          }}
          className="rounded-full"
        >
          <option value="">Semua Kelas</option>
          {filterClasses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-full"
        >
          <option value="">Semua Status</option>
          <option value="hijau">Hijau — Lulus</option>
          <option value="netral">Netral — Aktif</option>
          <option value="merah">Merah — AFK</option>
        </Select>
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={6} />
          </div>
        ) : students.length === 0 ? (
          <EmptyState
            icon={<Users className="w-5 h-5" />}
            title={
              classes.length === 0
                ? 'Belum ada kelas tersedia'
                : 'Mahasiswa tidak ditemukan'
            }
            description={
              classes.length === 0
                ? 'Buat Program Studi dan Kelas terlebih dahulu sebelum menambahkan mahasiswa.'
                : 'Tidak ada mahasiswa yang cocok dengan kriteria pencarian.'
            }
            action={
              classes.length > 0 ? (
                <Button onClick={openCreateModal}>Tambah Mahasiswa Pertama</Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D5E4B6] bg-[#F0F8DF]/70 text-xs font-semibold text-[#6F7B68]">
                    <th className="py-3.5 px-5">NIM</th>
                    <th className="py-3.5 px-4">Nama Lengkap</th>
                    <th className="py-3.5 px-4">Program Studi / Kelas</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Poin</th>
                    <th className="py-3.5 px-4 text-right">EXP / Level</th>
                    <th className="py-3.5 px-4 text-right">Streak</th>
                    <th className="py-3.5 px-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D5E4B6]/70 text-sm">
                  {students.map((s) => (
                    <tr key={s.id} className="hover:bg-[#F0F8DF]/50 transition-colors">
                      <td className="py-3.5 px-5 text-xs font-semibold text-[#6F7B68] tabular-nums">
                        {s.nim}
                      </td>
                      <td className="py-3.5 px-4 font-display font-bold text-[#20251D]">
                        <button
                          type="button"
                          onClick={() => onSelectStudent(s.id)}
                          className="hover:text-[#3E7B27] hover:underline text-left cursor-pointer"
                        >
                          {s.full_name}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#6F7B68]">
                        <div className="font-semibold text-[#20251D]">{s.class_name}</div>
                        <div>{s.study_program_name}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <StudentStatusIndicator status={s.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-[#3E7B27] tabular-nums">
                        {s.total_points}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs tabular-nums text-[#6F7B68]">
                        <span className="font-bold text-[#20251D]">{s.total_exp}</span> · Lv.{s.current_level}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs font-semibold text-[#FF7A1A] tabular-nums">
                        {s.current_streak ?? 0}d
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectStudent(s.id)}
                            title="Lihat detail mahasiswa"
                            className="p-2 rounded-full text-[#6F7B68] hover:text-[#3E7B27] hover:bg-[#DCECB8] cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(s)}
                            title="Edit biodata"
                            className="p-2 rounded-full text-[#6F7B68] hover:text-[#20251D] hover:bg-[#F0F8DF] cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomPassword('');
                              setResetModal({ open: true, student: s });
                            }}
                            title="Reset password mahasiswa"
                            className="p-2 rounded-full text-[#6F7B68] hover:text-[#C27C0A] hover:bg-[#C27C0A]/15 cursor-pointer"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(s)}
                            title="Hapus mahasiswa"
                            className="p-2 rounded-full text-[#6F7B68] hover:text-[#D13447] hover:bg-[#D13447]/10 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-5 py-4 border-t border-[#D5E4B6] flex items-center justify-between text-xs text-[#6F7B68]">
              <span className="tabular-nums font-medium">
                Total {totalCount} mahasiswa · Halaman {page} dari {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-2 rounded-full border border-[#D5E4B6] bg-white disabled:opacity-40 hover:border-[#B5D45D] cursor-pointer"
                  aria-label="Halaman sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-2 rounded-full border border-[#D5E4B6] bg-white disabled:opacity-40 hover:border-[#B5D45D] cursor-pointer"
                  aria-label="Halaman berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Add/Edit Student Modal */}
      <Modal
        open={formModal.open}
        title={formModal.editing ? 'Edit Biodata Mahasiswa' : 'Tambah Akun Mahasiswa Baru'}
        subtitle={
          formModal.editing
            ? undefined
            : 'Sistem otomatis mengatur Username = NIM dan Password awal = NIM.'
        }
        onClose={() => setFormModal({ open: false, editing: null })}
      >
        <form onSubmit={handleSaveStudent} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">Nama Lengkap</label>
            <Input
              type="text"
              required
              value={formState.full_name}
              onChange={(e) => setFormState({ ...formState, full_name: e.target.value })}
              placeholder="Contoh: Azril Al Afriza"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">NIM</label>
            <Input
              type="text"
              required
              value={formState.nim}
              onChange={(e) => setFormState({ ...formState, nim: e.target.value })}
              placeholder="Contoh: 230101001"
              className="tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
              Program Studi
            </label>
            <Select
              required
              value={formState.study_program_id}
              onChange={(e) => {
                const prodiId = e.target.value;
                const firstCls = classes.find((c) => c.study_program_id === prodiId)?.id ?? '';
                setFormState({ ...formState, study_program_id: prodiId, class_id: firstCls });
              }}
              className="w-full"
            >
              <option value="">Pilih Program Studi</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">Kelas Aktif</label>
            <Select
              required
              value={formState.class_id}
              onChange={(e) => setFormState({ ...formState, class_id: e.target.value })}
              className="w-full"
            >
              <option value="">Pilih Kelas</option>
              {formClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
              Status Mahasiswa
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  id: 'netral' as StudentStatus,
                  label: 'Mahasiswa Aktif',
                  short: 'Aktif',
                  activeCls: 'bg-[#171A17] border-[#171A17] text-[#B5D45D]',
                },
                {
                  id: 'hijau' as StudentStatus,
                  label: 'Lulus',
                  short: 'Hijau',
                  activeCls: 'bg-[#DCECB8] border-[#3E7B27] text-[#3E7B27]',
                },
                {
                  id: 'merah' as StudentStatus,
                  label: 'AFK',
                  short: 'Merah',
                  activeCls: 'bg-[#D13447]/15 border-[#D13447] text-[#D13447]',
                },
              ].map((opt) => {
                const selected = formState.status === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFormState({ ...formState, status: opt.id })}
                    className={`px-3 py-2.5 rounded-[16px] border text-center transition-all cursor-pointer ${
                      selected
                        ? `${opt.activeCls} font-bold`
                        : 'bg-white border-[#D5E4B6] text-[#4E5849] hover:border-[#B5D45D]'
                    }`}
                  >
                    <div className="font-display text-xs font-bold leading-tight">{opt.label}</div>
                    <div className="text-[10px] opacity-80 mt-0.5">{opt.short}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormModal({ open: false, editing: null })}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        open={resetModal.open}
        title="Reset Password Mahasiswa"
        subtitle={
          resetModal.student
            ? `${resetModal.student.full_name} (NIM: ${resetModal.student.nim})`
            : ''
        }
        onClose={() => setResetModal({ open: false, student: null })}
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
              Password Baru (Opsional)
            </label>
            <Input
              type="text"
              value={customPassword}
              onChange={(e) => setCustomPassword(e.target.value)}
              placeholder={`Kosongkan untuk reset ke NIM (${resetModal.student?.nim ?? ''})`}
            />
            <p className="text-xs text-[#6F7B68] mt-1.5">
              Jika dikosongkan, password otomatis direset ke NIM mahasiswa.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetModal({ open: false, student: null })}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Memproses...' : 'Reset Password'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Akun Mahasiswa"
        description={`Apakah Anda yakin ingin menghapus mahasiswa "${deleteTarget?.full_name}" (NIM ${deleteTarget?.nim})? Seluruh riwayat poin, absensi, dan pengumpulan tugasnya juga akan terhapus.`}
        confirmLabel="Hapus Permanen"
        loading={submitting}
        onConfirm={handleDeleteStudent}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Building2, Users, ArrowRightLeft } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { Card, Button, Input, Select, Textarea } from '../components/ui/DesignSystem.tsx';
import { Modal, ConfirmDialog } from '../components/ui/Modal.tsx';
import { TableSkeleton } from '../components/ui/Skeleton.tsx';
import { StudentStatusIndicator } from '../components/ui/StatusBadge.tsx';
import type { ClassGroup, StudyProgram, StudentProfile } from '../types/index.ts';

interface ProgramsClassesPageProps {
  initialFocus?: 'programs' | 'classes';
  onToast: (type: 'success' | 'error', text: string) => void;
  onSelectStudent: (id: string) => void;
}

export function ProgramsClassesPage({
  initialFocus = 'programs',
  onToast,
  onSelectStudent,
}: ProgramsClassesPageProps) {
  const [programs, setPrograms] = useState<StudyProgram[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [rosterClass, setRosterClass] = useState<ClassGroup | null>(null);
  const [rosterStudents, setRosterStudents] = useState<StudentProfile[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  // Program Modal
  const [progModal, setProgModal] = useState<{ open: boolean; editing: StudyProgram | null }>({
    open: false,
    editing: null,
  });
  const [progForm, setProgForm] = useState({ code: '', name: '', description: '' });

  // Class Modal
  const [classModal, setClassModal] = useState<{ open: boolean; editing: ClassGroup | null }>({
    open: false,
    editing: null,
  });
  const [classForm, setClassForm] = useState({
    study_program_id: '',
    name: '',
    academic_year: '2026/2027',
    description: '',
  });

  // Move Student Modal
  const [moveModal, setMoveModal] = useState<{ open: boolean; student: StudentProfile | null }>({
    open: false,
    student: null,
  });
  const [moveTargetClassId, setMoveTargetClassId] = useState('');

  // Confirm Delete
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'program' | 'class';
    id: string;
    name: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        apiFetch<{ programs: StudyProgram[] }>('/api/admin/study-programs'),
        apiFetch<{ classes: ClassGroup[] }>('/api/admin/classes'),
      ]);
      setPrograms(pRes.programs);
      setClasses(cRes.classes);
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const loadRoster = async (cls: ClassGroup) => {
    setRosterClass(cls);
    setRosterLoading(true);
    try {
      const res = await apiFetch<{ students: StudentProfile[] }>(
        `/api/admin/students?classId=${cls.id}&limit=100`
      );
      setRosterStudents(res.students);
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setRosterLoading(false);
    }
  };

  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (progModal.editing) {
        await apiFetch(`/api/admin/study-programs/${progModal.editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(progForm),
        });
        onToast('success', 'Program studi berhasil diperbarui.');
      } else {
        await apiFetch('/api/admin/study-programs', {
          method: 'POST',
          body: JSON.stringify(progForm),
        });
        onToast('success', 'Program studi baru berhasil ditambahkan.');
      }
      setProgModal({ open: false, editing: null });
      await loadAll();
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (classModal.editing) {
        await apiFetch(`/api/admin/classes/${classModal.editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(classForm),
        });
        onToast('success', 'Kelas berhasil diperbarui.');
      } else {
        await apiFetch('/api/admin/classes', {
          method: 'POST',
          body: JSON.stringify(classForm),
        });
        onToast('success', 'Kelas baru berhasil dibuat.');
      }
      setClassModal({ open: false, editing: null });
      await loadAll();
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      const endpoint =
        deleteTarget.type === 'program'
          ? `/api/admin/study-programs/${deleteTarget.id}`
          : `/api/admin/classes/${deleteTarget.id}`;
      await apiFetch(endpoint, { method: 'DELETE' });
      onToast('success', `${deleteTarget.name} berhasil dihapus.`);
      setDeleteTarget(null);
      if (rosterClass?.id === deleteTarget.id) setRosterClass(null);
      await loadAll();
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMoveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveModal.student || !moveTargetClassId) return;
    const targetCls = classes.find((c) => c.id === moveTargetClassId);
    if (!targetCls) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/admin/students/${moveModal.student.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          class_id: targetCls.id,
          study_program_id: targetCls.study_program_id,
        }),
      });
      onToast('success', `${moveModal.student.full_name} dipindahkan ke kelas ${targetCls.name}.`);
      setMoveModal({ open: false, student: null });
      await loadAll();
      if (rosterClass) await loadRoster(rosterClass);
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const displayedClasses = selectedProgramId
    ? classes.filter((c) => c.study_program_id === selectedProgramId)
    : classes;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#181A17] tracking-tight">
            {initialFocus === 'classes' ? 'Manajemen Kelas & Anggota' : 'Program Studi & Kelas'}
          </h1>
          <p className="text-sm text-[#73796C] mt-1">
            Kelola struktur program studi, kelas aktif, dan penempatan mahasiswa.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={() => {
              setProgForm({ code: '', name: '', description: '' });
              setProgModal({ open: true, editing: null });
            }}
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Prodi</span>
          </Button>
          <Button
            onClick={() => {
              setClassForm({
                study_program_id: programs[0]?.id ?? '',
                name: '',
                academic_year: '2026/2027',
                description: '',
              });
              setClassModal({ open: true, editing: null });
            }}
            disabled={programs.length === 0}
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kelas</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={6} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Study Programs */}
          <Card
            className={`lg:col-span-5 ${
              initialFocus === 'programs' ? 'ring-2 ring-[#B5D45D]/60' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#3D914C]" />
                <h2 className="text-base font-bold text-[#181A17]">Program Studi</h2>
              </div>
              {selectedProgramId && (
                <button
                  type="button"
                  onClick={() => setSelectedProgramId('')}
                  className="text-xs font-semibold text-[#3D914C] hover:underline"
                >
                  Tampilkan Semua
                </button>
              )}
            </div>

            {programs.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#73796C]">
                Belum ada program studi. Klik &quot;Tambah Prodi&quot; untuk memulai.
              </div>
            ) : (
              <div className="space-y-2">
                {programs.map((p) => {
                  const active = selectedProgramId === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-2xl border transition-colors flex items-start justify-between gap-3 ${
                        active
                          ? 'bg-[#DBECB8] border-[#B5D45D]'
                          : 'bg-[#F0F8E0]/50 border-[#DDE6C9] hover:border-[#B5D45D]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedProgramId(active ? '' : p.id)}
                        className="text-left flex-1 min-w-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-white border border-[#DDE6C9] text-[11px] font-bold text-[#181A17]">
                            {p.code}
                          </span>
                          <span className="text-sm font-bold text-[#181A17] truncate">{p.name}</span>
                        </div>
                        <div className="text-xs text-[#73796C] mt-1.5 tabular-nums">
                          {p.class_count ?? 0} Kelas · {p.student_count ?? 0} Mahasiswa
                        </div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setProgForm({ code: p.code, name: p.name, description: p.description });
                            setProgModal({ open: true, editing: p });
                          }}
                          className="p-2 rounded-full text-[#73796C] hover:text-[#181A17] hover:bg-white"
                          aria-label={`Edit ${p.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ type: 'program', id: p.id, name: p.name })}
                          className="p-2 rounded-full text-[#73796C] hover:text-[#C44750] hover:bg-[#FCECEF]"
                          aria-label={`Hapus ${p.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Classes */}
          <Card
            className={`lg:col-span-7 p-0 overflow-hidden ${
              initialFocus === 'classes' ? 'ring-2 ring-[#B5D45D]/60' : ''
            }`}
          >
            <div className="px-6 py-5 border-b border-[#DDE6C9] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#3D914C]" />
                <h2 className="text-base font-bold text-[#181A17]">Daftar Kelas</h2>
              </div>
              <span className="text-xs font-semibold text-[#73796C] tabular-nums">
                {displayedClasses.length} Kelas
              </span>
            </div>

            {displayedClasses.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#73796C]">
                Belum ada kelas pada filter ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#DDE6C9] bg-[#F0F8E0]/60 text-xs font-semibold text-[#73796C]">
                      <th className="py-3 px-5">Nama Kelas</th>
                      <th className="py-3 px-4">Program Studi</th>
                      <th className="py-3 px-4">Tahun</th>
                      <th className="py-3 px-4 text-right">Mahasiswa</th>
                      <th className="py-3 px-5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDE6C9]/60 text-sm">
                    {displayedClasses.map((c) => (
                      <tr key={c.id} className="hover:bg-[#F0F8E0]/50 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-[#181A17]">
                          <button
                            type="button"
                            onClick={() => loadRoster(c)}
                            className="hover:text-[#3D914C] hover:underline text-left"
                          >
                            {c.name}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-[#73796C]">{c.study_program_name}</td>
                        <td className="py-3.5 px-4 text-xs text-[#73796C] tabular-nums">
                          {c.academic_year}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#181A17] tabular-nums">
                          {c.student_count ?? 0}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => loadRoster(c)}
                              className="px-3 py-1 text-xs font-semibold text-[#181A17] bg-[#DBECB8] hover:bg-[#B5D45D] rounded-full whitespace-nowrap transition-colors"
                            >
                              Anggota
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setClassForm({
                                  study_program_id: c.study_program_id,
                                  name: c.name,
                                  academic_year: c.academic_year,
                                  description: c.description,
                                });
                                setClassModal({ open: true, editing: c });
                              }}
                              className="p-2 rounded-full text-[#73796C] hover:text-[#181A17] hover:bg-[#F0F8E0]"
                              aria-label={`Edit ${c.name}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ type: 'class', id: c.id, name: c.name })}
                              className="p-2 rounded-full text-[#73796C] hover:text-[#C44750] hover:bg-[#FCECEF]"
                              aria-label={`Hapus ${c.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Selected Class Roster */}
      {rosterClass && (
        <Card className="p-0 overflow-hidden">
          <div className="px-6 py-5 border-b border-[#DDE6C9] flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#181A17]">
                Daftar Mahasiswa — {rosterClass.name}
              </h3>
              <p className="text-xs text-[#73796C]">
                {rosterClass.study_program_name} · Klik nama untuk detail atau pindah kelas
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setRosterClass(null)}>
              Tutup
            </Button>
          </div>

          {rosterLoading ? (
            <div className="p-6">
              <TableSkeleton rows={4} />
            </div>
          ) : rosterStudents.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#73796C]">
              Belum ada mahasiswa di kelas {rosterClass.name}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#DDE6C9] bg-[#F0F8E0]/60 text-xs font-semibold text-[#73796C]">
                    <th className="py-3 px-5">NIM</th>
                    <th className="py-3 px-4">Nama Mahasiswa</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Poin</th>
                    <th className="py-3 px-4 text-right">EXP</th>
                    <th className="py-3 px-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE6C9]/60 text-sm">
                  {rosterStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-[#F0F8E0]/50 transition-colors">
                      <td className="py-3 px-5 text-xs text-[#73796C] tabular-nums">{s.nim}</td>
                      <td className="py-3 px-4 font-bold text-[#181A17]">
                        <button
                          type="button"
                          onClick={() => onSelectStudent(s.id)}
                          className="hover:text-[#3D914C] hover:underline"
                        >
                          {s.full_name}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <StudentStatusIndicator status={s.status} />
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#181A17] tabular-nums">
                        {s.total_points}
                      </td>
                      <td className="py-3 px-4 text-right text-[#73796C] tabular-nums">
                        {s.total_exp}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setMoveTargetClassId(s.class_id);
                            setMoveModal({ open: true, student: s });
                          }}
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          <span>Pindah Kelas</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Program Modal */}
      <Modal
        open={progModal.open}
        title={progModal.editing ? 'Edit Program Studi' : 'Tambah Program Studi'}
        onClose={() => setProgModal({ open: false, editing: null })}
      >
        <form onSubmit={handleSaveProgram} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#73796C] mb-1.5">Kode Prodi</label>
            <Input
              type="text"
              required
              value={progForm.code}
              onChange={(e) => setProgForm({ ...progForm, code: e.target.value })}
              placeholder="Contoh: TI"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#73796C] mb-1.5">
              Nama Program Studi
            </label>
            <Input
              type="text"
              required
              value={progForm.name}
              onChange={(e) => setProgForm({ ...progForm, name: e.target.value })}
              placeholder="Contoh: Teknik Informatika"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#73796C] mb-1.5">Deskripsi</label>
            <Textarea
              rows={3}
              value={progForm.description}
              onChange={(e) => setProgForm({ ...progForm, description: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setProgModal({ open: false, editing: null })}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Class Modal */}
      <Modal
        open={classModal.open}
        title={classModal.editing ? 'Edit Kelas' : 'Tambah Kelas Baru'}
        onClose={() => setClassModal({ open: false, editing: null })}
      >
        <form onSubmit={handleSaveClass} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#73796C] mb-1.5">Program Studi</label>
            <Select
              required
              value={classForm.study_program_id}
              onChange={(e) => setClassForm({ ...classForm, study_program_id: e.target.value })}
              className="w-full"
            >
              <option value="">Pilih Program Studi</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#73796C] mb-1.5">Nama Kelas</label>
            <Input
              type="text"
              required
              value={classForm.name}
              onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
              placeholder="Contoh: Teknik Informatika 2A"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#73796C] mb-1.5">
              Tahun Akademik
            </label>
            <Input
              type="text"
              required
              value={classForm.academic_year}
              onChange={(e) => setClassForm({ ...classForm, academic_year: e.target.value })}
              placeholder="2026/2027"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setClassModal({ open: false, editing: null })}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Move Student Modal */}
      <Modal
        open={moveModal.open}
        title="Pindahkan Mahasiswa Antarkelas"
        subtitle={
          moveModal.student ? `${moveModal.student.full_name} (${moveModal.student.nim})` : ''
        }
        onClose={() => setMoveModal({ open: false, student: null })}
      >
        <form onSubmit={handleMoveStudent} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#73796C] mb-1.5">
              Pilih Kelas Tujuan
            </label>
            <Select
              required
              value={moveTargetClassId}
              onChange={(e) => setMoveTargetClassId(e.target.value)}
              className="w-full"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.study_program_name} — {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMoveModal({ open: false, student: null })}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Memindahkan...' : 'Pindahkan'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Hapus ${deleteTarget?.type === 'program' ? 'Program Studi' : 'Kelas'}`}
        description={`Apakah Anda yakin ingin menghapus "${deleteTarget?.name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus"
        loading={submitting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

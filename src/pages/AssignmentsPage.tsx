import { useEffect, useState } from 'react';
import {
  Plus,
  ClipboardList,
  Download,
  Upload,
  ExternalLink,
  Trash2,
  CheckSquare,
  FileText,
  Sparkles,
} from 'lucide-react';
import { apiFetch, downloadProtectedFile, uploadFileToServer } from '../lib/api.ts';
import {
  Card,
  Button,
  Input,
  Select,
  Textarea,
  PageHeader,
  EmptyState,
} from '../components/ui/DesignSystem.tsx';
import { Modal, ConfirmDialog } from '../components/ui/Modal.tsx';
import { SubmissionStatusIndicator } from '../components/ui/StatusBadge.tsx';
import { TableSkeleton } from '../components/ui/Skeleton.tsx';
import type { Assignment, AuthUser } from '../types/index.ts';

interface AssignmentsPageProps {
  user: AuthUser;
  onToast: (type: 'success' | 'error', text: string) => void;
}

export function AssignmentsPage({ user, onToast }: AssignmentsPageProps) {
  const isAdmin = user.role === 'admin';
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<
    Array<{ id: string; name: string; study_program_name: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [formState, setFormState] = useState({
    title: '',
    description: '',
    instructions: '',
    deadline: '',
    max_points: 100,
    class_ids: [] as string[],
    attachment_url: null as string | null,
    attachment_name: null as string | null,
  });
  const [uploading, setUploading] = useState(false);

  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  const [gradeTarget, setGradeTarget] = useState<any | null>(null);
  const [gradeForm, setGradeForm] = useState({
    status: 'graded' as 'graded' | 'revision',
    score: '90',
    awarded_points: '100',
    admin_notes: '',
  });

  const [submitTarget, setSubmitTarget] = useState<Assignment | null>(null);
  const [submitForm, setSubmitForm] = useState({
    drive_link: '',
    answer_text: '',
    file_url: null as string | null,
    file_name: null as string | null,
  });

  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);
  const [autoGradeTarget, setAutoGradeTarget] = useState<Assignment | null>(null);
  const [autoGradeAllOpen, setAutoGradeAllOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [aRes, refRes] = await Promise.all([
        apiFetch<{ assignments: Assignment[] }>('/api/assignments'),
        apiFetch<{ classes: any[] }>('/api/reference/academic'),
      ]);
      setAssignments(aRes.assignments);
      setClasses(refRes.classes);
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openSubmissions = async (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setLoadingSubs(true);
    try {
      const res = await apiFetch<{ submissions: any[] }>(
        `/api/assignments/${assignment.id}/submissions`
      );
      setSubmissions(res.submissions);
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setLoadingSubs(false);
    }
  };

  const handleAttachmentUpload = async (file: File, target: 'admin' | 'student') => {
    setUploading(true);
    try {
      const res = await uploadFileToServer(file);
      if (target === 'admin') {
        setFormState((s) => ({
          ...s,
          attachment_url: res.file_url,
          attachment_name: res.file_name,
        }));
      } else {
        setSubmitForm((s) => ({ ...s, file_url: res.file_url, file_name: res.file_name }));
      }
      onToast('success', `File "${res.file_name}" berhasil diunggah.`);
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formState.class_ids.length === 0) {
      onToast('error', 'Pilih minimal satu kelas penerima tugas.');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/assignments', {
        method: 'POST',
        body: JSON.stringify(formState),
      });
      onToast('success', 'Tugas baru berhasil dibuat dan dikirim ke kelas terpilih.');
      setCreateOpen(false);
      await loadData();
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAssignment = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/assignments/${deleteTarget.id}`, { method: 'DELETE' });
      onToast('success', 'Tugas berhasil dihapus.');
      setDeleteTarget(null);
      if (selectedAssignment?.id === deleteTarget.id) setSelectedAssignment(null);
      await loadData();
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitTarget) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/assignments/${submitTarget.id}/submit`, {
        method: 'POST',
        body: JSON.stringify(submitForm),
      });
      onToast('success', 'Pengumpulan tugas berhasil dikirim.');
      setSubmitTarget(null);
      await loadData();
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeTarget?.submission_id) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/submissions/${gradeTarget.submission_id}/grade`, {
        method: 'POST',
        body: JSON.stringify({
          status: gradeForm.status,
          score: gradeForm.score,
          awarded_points: Number(gradeForm.awarded_points),
          admin_notes: gradeForm.admin_notes,
        }),
      });
      onToast('success', 'Penilaian & poin akademik berhasil disimpan.');
      setGradeTarget(null);
      if (selectedAssignment) await openSubmissions(selectedAssignment);
      await loadData();
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoGrade = async () => {
    if (!autoGradeTarget) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ gradedCount: number; awardedPoints: number }>(
        `/api/assignments/${autoGradeTarget.id}/auto-grade`,
        { method: 'POST' }
      );
      onToast(
        'success',
        `Koreksi otomatis selesai: ${res.gradedCount} pengumpulan mahasiswa menerima +${res.awardedPoints} poin.`
      );
      const targetId = autoGradeTarget.id;
      setAutoGradeTarget(null);
      await loadData();
      if (selectedAssignment?.id === targetId) {
        await openSubmissions(selectedAssignment);
      }
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoGradeAll = async () => {
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        assignmentCount: number;
        gradedCount: number;
        awardedPoints: number;
      }>('/api/assignments/auto-grade-all', { method: 'POST' });
      onToast(
        'success',
        `Koreksi otomatis selesai: ${res.gradedCount} pengumpulan pada ${res.assignmentCount} tugas menerima nilai 100 & +${res.awardedPoints} poin.`
      );
      setAutoGradeAllOpen(false);
      await loadData();
      if (selectedAssignment) {
        await openSubmissions(selectedAssignment);
      }
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const totalPendingSubmissions = assignments.reduce(
    (sum, a) => sum + Math.max(0, (a.submission_count ?? 0) - (a.graded_count ?? 0)),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAdmin ? 'Manajemen Tugas & Penilaian' : 'Tugas & Pengumpulan'}
        description={
          isAdmin
            ? 'Buat tugas multi-kelas, periksa pengumpulan mahasiswa, atau jalankan koreksi & beri nilai otomatis (+100 poin).'
            : 'Lihat daftar tugas kelas Anda, unduh lampiran, dan kirim pengumpulan sebelum deadline.'
        }
        actions={
          isAdmin ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="secondary"
                disabled={totalPendingSubmissions === 0}
                onClick={() => setAutoGradeAllOpen(true)}
                title={
                  totalPendingSubmissions === 0
                    ? 'Tidak ada pengumpulan yang menunggu penilaian'
                    : `Koreksi otomatis ${totalPendingSubmissions} pengumpulan yang belum dinilai (+100 poin)`
                }
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  Koreksi & Beri Nilai Semua (+100)
                  {totalPendingSubmissions > 0 ? ` · ${totalPendingSubmissions}` : ''}
                </span>
              </Button>
              <Button
                onClick={() => {
                  const tomorrow = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16);
                  setFormState({
                    title: '',
                    description: '',
                    instructions: '',
                    deadline: tomorrow,
                    max_points: 100,
                    class_ids: classes[0] ? [classes[0].id] : [],
                    attachment_url: null,
                    attachment_name: null,
                  });
                  setCreateOpen(true);
                }}
                disabled={classes.length === 0}
              >
                <Plus className="w-4 h-4" />
                <span>Buat Tugas Baru</span>
              </Button>
            </div>
          ) : undefined
        }
      />

      {loading ? (
        <TableSkeleton rows={5} />
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-5 h-5" />}
          title={isAdmin ? 'Belum ada tugas yang dibuat' : 'Belum ada tugas untuk kelas Anda'}
          description={
            isAdmin
              ? 'Klik "Buat Tugas Baru" untuk mendistribusikan tugas ke kelas aktif.'
              : 'Tugas baru dari administrator akan muncul di sini.'
          }
        />
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => (
            <Card
              key={a.id}
              className="flex flex-col desktop:flex-row desktop:items-center justify-between gap-5 hover:border-[#B5D45D] transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#6F7B68]">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#DCECB8] font-display font-bold text-[#20251D] tabular-nums">
                    Deadline {String(a.deadline).replace('T', ' ')}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-[#3E7B27] tabular-nums">
                    Maks {a.max_points} Poin
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{a.targets.map((t) => t.class_name).join(', ')}</span>
                </div>

                <h2 className="font-display text-lg font-bold text-[#20251D] mt-2">{a.title}</h2>
                {a.description && (
                  <p className="text-sm text-[#4E5849] mt-1 line-clamp-2">{a.description}</p>
                )}
                {a.instructions && (
                  <p className="text-xs text-[#6F7B68] mt-1.5">Instruksi: {a.instructions}</p>
                )}

                {a.attachment_url && (
                  <button
                    type="button"
                    onClick={() =>
                      downloadProtectedFile(a.attachment_url!, a.attachment_name || 'lampiran')
                    }
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-display font-bold text-[#3E7B27] hover:underline cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Lampiran: {a.attachment_name}</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                {isAdmin ? (
                  <>
                    <div className="text-left desktop:text-right mr-2">
                      <div className="text-xs text-[#6F7B68]">Pengumpulan</div>
                      <div className="font-display text-sm font-bold tabular-nums text-[#20251D]">
                        {a.submission_count ?? 0} masuk · {a.graded_count ?? 0} dinilai
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={(a.submission_count ?? 0) <= (a.graded_count ?? 0)}
                      onClick={() => setAutoGradeTarget(a)}
                      title={
                        (a.submission_count ?? 0) === 0
                          ? 'Belum ada mahasiswa yang mengumpulkan'
                          : (a.submission_count ?? 0) <= (a.graded_count ?? 0)
                            ? 'Semua pengumpulan sudah dinilai'
                            : 'Koreksi otomatis dan beri +100 poin ke pengumpul yang belum dinilai'
                      }
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Koreksi & Beri Nilai (+100)</span>
                    </Button>
                    <Button size="sm" onClick={() => openSubmissions(a)}>
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Periksa & Nilai</span>
                    </Button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(a)}
                      className="p-2 rounded-full text-[#6F7B68] hover:text-[#D13447] hover:bg-[#D13447]/10 cursor-pointer"
                      aria-label={`Hapus ${a.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col tablet:flex-row tablet:items-center gap-3">
                    <div className="text-left tablet:text-right">
                      <SubmissionStatusIndicator status={a.my_submission?.status ?? 'not_submitted'} />
                      {a.my_submission?.status === 'graded' && (
                        <div className="text-xs font-bold text-[#3E7B27] mt-1.5 tabular-nums">
                          Nilai: {a.my_submission.score ?? '-'} · +{a.my_submission.awarded_points} Poin
                        </div>
                      )}
                      {a.my_submission?.admin_notes && (
                        <div className="text-xs text-[#6F7B68] mt-0.5 max-w-xs">
                          Catatan: {a.my_submission.admin_notes}
                        </div>
                      )}
                    </div>

                    {a.my_submission?.status !== 'graded' && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSubmitForm({
                            drive_link: a.my_submission?.drive_link ?? '',
                            answer_text: a.my_submission?.answer_text ?? '',
                            file_url: a.my_submission?.file_url ?? null,
                            file_name: a.my_submission?.file_name ?? null,
                          });
                          setSubmitTarget(a);
                        }}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{a.my_submission ? 'Perbarui Pengumpulan' : 'Kumpulkan Tugas'}</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Admin Submissions Inspection Table */}
      {isAdmin && selectedAssignment && (
        <Card className="p-0 overflow-hidden">
          <div className="px-6 py-5 border-b border-[#D5E4B6] flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-[#20251D]">
                Daftar Pengumpulan — {selectedAssignment.title}
              </h3>
              <p className="text-xs text-[#6F7B68]">
                Poin akademik baru ditambahkan setelah Admin menilai pengumpulan.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {submissions.some((s) => s.submission_id && s.status !== 'graded') && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAutoGradeTarget(selectedAssignment)}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Koreksi & Beri Nilai (+100)</span>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setSelectedAssignment(null)}>
                Tutup Panel
              </Button>
            </div>
          </div>

          {loadingSubs ? (
            <div className="p-6">
              <TableSkeleton rows={5} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D5E4B6] bg-[#F0F8DF]/70 text-xs font-semibold text-[#6F7B68]">
                    <th className="py-3 px-5">NIM</th>
                    <th className="py-3 px-4">Mahasiswa</th>
                    <th className="py-3 px-4">Kelas</th>
                    <th className="py-3 px-4">Berkas / Link</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Nilai / Poin</th>
                    <th className="py-3 px-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D5E4B6]/70 text-sm">
                  {submissions.map((sub) => (
                    <tr key={sub.student_id} className="hover:bg-[#F0F8DF]/50 transition-colors">
                      <td className="py-3.5 px-5 text-xs text-[#6F7B68] tabular-nums">{sub.nim}</td>
                      <td className="py-3.5 px-4 font-display font-bold text-[#20251D]">
                        {sub.student_name}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#6F7B68]">{sub.class_name}</td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="flex flex-col gap-1">
                          {sub.file_url && (
                            <button
                              type="button"
                              onClick={() =>
                                downloadProtectedFile(sub.file_url, sub.file_name || 'tugas')
                              }
                              className="inline-flex items-center gap-1 text-[#3E7B27] font-semibold hover:underline text-left cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>{sub.file_name || 'Unduh File'}</span>
                            </button>
                          )}
                          {sub.drive_link && (
                            <a
                              href={sub.drive_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#20251D] font-semibold hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Link Drive</span>
                            </a>
                          )}
                          {sub.answer_text && (
                            <span className="text-[#6F7B68] line-clamp-1" title={sub.answer_text}>
                              <FileText className="w-3 h-3 inline mr-1" />
                              {sub.answer_text}
                            </span>
                          )}
                          {!sub.file_url && !sub.drive_link && !sub.answer_text && (
                            <span className="text-[#6F7B68]">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <SubmissionStatusIndicator status={sub.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs tabular-nums">
                        {sub.score ?? '-'} /{' '}
                        <span className="font-bold text-[#3E7B27]">{sub.awarded_points ?? 0} pt</span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        {sub.submission_id ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setGradeTarget(sub);
                              setGradeForm({
                                status: sub.status === 'revision' ? 'revision' : 'graded',
                                score: sub.score !== null ? String(sub.score) : '90',
                                awarded_points: String(
                                  sub.awarded_points || selectedAssignment.max_points
                                ),
                                admin_notes: sub.admin_notes || '',
                              });
                            }}
                          >
                            Beri Nilai
                          </Button>
                        ) : (
                          <span className="text-xs text-[#6F7B68]">Menunggu</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Admin Create Assignment Modal */}
      <Modal
        open={createOpen}
        title="Buat Tugas Baru"
        subtitle="Pilih satu atau beberapa kelas penerima tugas."
        onClose={() => setCreateOpen(false)}
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleCreateAssignment} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">Judul Tugas</label>
            <Input
              type="text"
              required
              value={formState.title}
              onChange={(e) => setFormState({ ...formState, title: e.target.value })}
              placeholder="Contoh: Praktikum 2 — Algoritma Sorting"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">Deskripsi</label>
            <Textarea
              rows={2}
              value={formState.description}
              onChange={(e) => setFormState({ ...formState, description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
              Instruksi Pengerjaan
            </label>
            <Textarea
              rows={2}
              value={formState.instructions}
              onChange={(e) => setFormState({ ...formState, instructions: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">Deadline</label>
              <Input
                type="datetime-local"
                required
                value={formState.deadline}
                onChange={(e) => setFormState({ ...formState, deadline: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
                Poin Maksimal
              </label>
              <Input
                type="number"
                min={0}
                required
                value={formState.max_points}
                onChange={(e) => setFormState({ ...formState, max_points: Number(e.target.value) })}
                className="tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
              File Lampiran Soal (Opsional)
            </label>
            <input
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAttachmentUpload(f, 'admin');
              }}
              className="text-xs text-[#4E5849]"
            />
            {formState.attachment_name && (
              <div className="text-xs text-[#3E7B27] mt-1 font-semibold">
                Terlampir: {formState.attachment_name}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-2">
              Kelas Penerima Tugas
            </label>
            <div className="max-h-36 overflow-y-auto border border-[#D5E4B6] rounded-[16px] p-3 space-y-2 bg-[#F0F8DF]/50">
              {classes.map((c) => {
                const checked = formState.class_ids.includes(c.id);
                return (
                  <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setFormState((s) => ({
                          ...s,
                          class_ids: checked
                            ? s.class_ids.filter((id) => id !== c.id)
                            : [...s.class_ids, c.id],
                        }));
                      }}
                    />
                    <span className="font-medium text-[#20251D]">
                      {c.name}{' '}
                      <span className="text-xs text-[#6F7B68]">({c.study_program_name})</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting || uploading}>
              {submitting ? 'Menyimpan...' : 'Publikasikan Tugas'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Admin Grade Modal */}
      <Modal
        open={Boolean(gradeTarget)}
        title="Penilaian Tugas Mahasiswa"
        subtitle={gradeTarget ? `${gradeTarget.student_name} (${gradeTarget.nim})` : ''}
        onClose={() => setGradeTarget(null)}
      >
        <form onSubmit={handleGradeSubmit} className="space-y-4">
          {gradeTarget?.answer_text && (
            <div className="p-3.5 rounded-[16px] bg-[#F0F8DF] border border-[#D5E4B6] text-xs text-[#20251D]">
              <div className="font-bold mb-1">Jawaban Mahasiswa:</div>
              <p className="whitespace-pre-wrap">{gradeTarget.answer_text}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">Keputusan</label>
            <Select
              value={gradeForm.status}
              onChange={(e) => setGradeForm({ ...gradeForm, status: e.target.value as any })}
              className="w-full"
            >
              <option value="graded">Dinilai (Berikan Poin)</option>
              <option value="revision">Minta Revisi (0 Poin)</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
                Nilai (0–100)
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                value={gradeForm.score}
                onChange={(e) => setGradeForm({ ...gradeForm, score: e.target.value })}
                className="tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
                Poin Akademik (Maks {selectedAssignment?.max_points ?? 100})
              </label>
              <Input
                type="number"
                min={0}
                max={selectedAssignment?.max_points ?? 100}
                disabled={gradeForm.status === 'revision'}
                value={gradeForm.status === 'revision' ? '0' : gradeForm.awarded_points}
                onChange={(e) => setGradeForm({ ...gradeForm, awarded_points: e.target.value })}
                className="tabular-nums disabled:bg-[#F0F8DF]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
              Catatan Admin
            </label>
            <Textarea
              rows={3}
              value={gradeForm.admin_notes}
              onChange={(e) => setGradeForm({ ...gradeForm, admin_notes: e.target.value })}
              placeholder="Berikan feedback atau catatan revisi..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setGradeTarget(null)}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan Penilaian'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Student Submission Modal */}
      <Modal
        open={Boolean(submitTarget)}
        title={`Kumpulkan Tugas: ${submitTarget?.title ?? ''}`}
        subtitle={`Deadline: ${submitTarget ? String(submitTarget.deadline).replace('T', ' ') : ''}`}
        onClose={() => setSubmitTarget(null)}
      >
        <form onSubmit={handleStudentSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
              Upload File Tugas (PDF, DOCX, ZIP, dll. Maks 10MB)
            </label>
            <input
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAttachmentUpload(f, 'student');
              }}
              className="text-xs text-[#4E5849]"
            />
            {submitForm.file_name && (
              <div className="text-xs text-[#3E7B27] mt-1 font-semibold">
                File siap dikirim: {submitForm.file_name}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
              Link Google Drive (Opsional)
            </label>
            <Input
              type="url"
              value={submitForm.drive_link}
              onChange={(e) => setSubmitForm({ ...submitForm, drive_link: e.target.value })}
              placeholder="https://drive.google.com/..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
              Jawaban / Deskripsi Pengumpulan
            </label>
            <Textarea
              rows={4}
              value={submitForm.answer_text}
              onChange={(e) => setSubmitForm({ ...submitForm, answer_text: e.target.value })}
              placeholder="Tuliskan ringkasan jawaban atau catatan untuk admin..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setSubmitTarget(null)}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting || uploading}>
              {submitting ? 'Mengirim...' : 'Kirim Pengumpulan'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Tugas"
        description={`Apakah Anda yakin ingin menghapus tugas "${deleteTarget?.title}"? Seluruh data pengumpulan terkait juga akan dihapus.`}
        confirmLabel="Hapus"
        loading={submitting}
        onConfirm={handleDeleteAssignment}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(autoGradeTarget)}
        title="Koreksi & Beri Nilai Otomatis (+100 Poin)"
        description={
          autoGradeTarget
            ? `Sebanyak ${Math.max(0, (autoGradeTarget.submission_count ?? 0) - (autoGradeTarget.graded_count ?? 0))} pengumpulan yang belum dinilai pada tugas "${autoGradeTarget.title}" akan otomatis dikoreksi dengan nilai 100 dan menerima tambahan +100 poin akademik.`
            : ''
        }
        confirmLabel="Koreksi & Beri Nilai (+100)"
        danger={false}
        loading={submitting}
        onConfirm={handleAutoGrade}
        onCancel={() => setAutoGradeTarget(null)}
      />

      <ConfirmDialog
        open={autoGradeAllOpen}
        title="Koreksi & Beri Nilai Semua Tugas (+100 Poin)"
        description={`Sebanyak ${totalPendingSubmissions} pengumpulan mahasiswa yang belum dinilai pada seluruh tugas akan otomatis dikoreksi dengan nilai 100 dan memperoleh tambahan +100 poin akademik.`}
        confirmLabel="Koreksi & Beri Nilai Semua"
        danger={false}
        loading={submitting}
        onConfirm={handleAutoGradeAll}
        onCancel={() => setAutoGradeAllOpen(false)}
      />
    </div>
  );
}

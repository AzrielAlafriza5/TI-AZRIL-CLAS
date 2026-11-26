import { useEffect, useState } from 'react';
import {
  Plus,
  BookOpen,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import {
  Card,
  Button,
  Input,
  Select,
  Textarea,
  ProgressBar,
  PageHeader,
  EmptyState,
} from '../components/ui/DesignSystem.tsx';
import { Modal, ConfirmDialog } from '../components/ui/Modal.tsx';
import { MaterialStatusIndicator } from '../components/ui/StatusBadge.tsx';
import { TableSkeleton } from '../components/ui/Skeleton.tsx';
import type { AuthUser, Material, MaterialProgressStatus } from '../types/index.ts';

interface MaterialsPageProps {
  user: AuthUser;
  onToast: (type: 'success' | 'error', text: string) => void;
}

export function MaterialsPage({ user, onToast }: MaterialsPageProps) {
  const isAdmin = user.role === 'admin';
  const [materials, setMaterials] = useState<Material[]>([]);
  const [progressSummary, setProgressSummary] = useState({ total: 0, completed: 0, percent: 0 });
  const [classes, setClasses] = useState<
    Array<{ id: string; name: string; study_program_name: string }>
  >([]);
  const [filterClassId, setFilterClassId] = useState('');
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<{ open: boolean; editing: Material | null }>({
    open: false,
    editing: null,
  });
  const [formState, setFormState] = useState({
    title: '',
    description: '',
    topic: '',
    drive_url: '',
    order_index: 1,
    published_at: new Date().toISOString().slice(0, 10),
    is_published: true,
    class_ids: [] as string[],
  });

  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const qs = filterClassId ? `?classId=${filterClassId}` : '';
      const [mRes, refRes] = await Promise.all([
        apiFetch<{ materials: Material[]; progressSummary: any }>(`/api/materials${qs}`),
        apiFetch<{ classes: any[] }>('/api/reference/academic'),
      ]);
      setMaterials(mRes.materials);
      setProgressSummary(mRes.progressSummary);
      setClasses(refRes.classes);
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, [filterClassId]);

  const openCreateModal = () => {
    setFormState({
      title: '',
      description: '',
      topic: 'Algoritma & Pemrograman',
      drive_url: 'https://drive.google.com/',
      order_index: materials.length + 1,
      published_at: new Date().toISOString().slice(0, 10),
      is_published: true,
      class_ids: classes[0] ? [classes[0].id] : [],
    });
    setModal({ open: true, editing: null });
  };

  const openEditModal = (m: Material) => {
    setFormState({
      title: m.title,
      description: m.description,
      topic: m.topic,
      drive_url: m.drive_url,
      order_index: m.order_index,
      published_at: m.published_at,
      is_published: m.is_published,
      class_ids: m.targets.map((t) => t.class_id),
    });
    setModal({ open: true, editing: m });
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formState.class_ids.length === 0) {
      onToast('error', 'Pilih minimal satu kelas penerima materi.');
      return;
    }
    setSubmitting(true);
    try {
      if (modal.editing) {
        await apiFetch(`/api/materials/${modal.editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(formState),
        });
        onToast('success', 'Materi pembelajaran berhasil diperbarui.');
      } else {
        await apiFetch('/api/materials', {
          method: 'POST',
          body: JSON.stringify(formState),
        });
        onToast('success', 'Materi pembelajaran baru berhasil ditambahkan.');
      }
      setModal({ open: false, editing: null });
      await loadMaterials();
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async (m: Material) => {
    try {
      await apiFetch(`/api/materials/${m.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_published: !m.is_published }),
      });
      onToast('success', m.is_published ? 'Materi disembunyikan.' : 'Materi dipublikasikan.');
      await loadMaterials();
    } catch (err: any) {
      onToast('error', err.message);
    }
  };

  const handleReorder = async (index: number, direction: -1 | 1) => {
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= materials.length) return;
    const copy = [...materials];
    const temp = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = temp;

    const payload = copy.map((item, idx) => ({ id: item.id, order_index: idx + 1 }));
    try {
      await apiFetch('/api/materials/reorder', {
        method: 'POST',
        body: JSON.stringify({ items: payload }),
      });
      await loadMaterials();
    } catch (err: any) {
      onToast('error', err.message);
    }
  };

  const handleDeleteMaterial = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/materials/${deleteTarget.id}`, { method: 'DELETE' });
      onToast('success', 'Materi berhasil dihapus.');
      setDeleteTarget(null);
      await loadMaterials();
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStudentStatusChange = async (
    materialId: string,
    status: MaterialProgressStatus
  ) => {
    try {
      await apiFetch(`/api/materials/${materialId}/progress`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      onToast('success', 'Progres belajar materi diperbarui.');
      await loadMaterials();
    } catch (err: any) {
      onToast('error', err.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materi Pembelajaran"
        description={
          isAdmin
            ? 'Kelola modul Google Drive terurut berdasarkan pertemuan dan kelas penerima.'
            : `Kelas ${user.student?.class_name ?? ''} · Pelajari materi secara berurutan dan tandai progres Anda.`
        }
        actions={
          isAdmin ? (
            <>
              <Select
                value={filterClassId}
                onChange={(e) => setFilterClassId(e.target.value)}
                className="rounded-full"
              >
                <option value="">Semua Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Button onClick={openCreateModal} disabled={classes.length === 0}>
                <Plus className="w-4 h-4" />
                <span>Tambah Materi</span>
              </Button>
            </>
          ) : undefined
        }
      />

      {/* Student Progress Bar */}
      {!isAdmin && (
        <Card variant="soft">
          <div className="flex items-center justify-between text-sm font-display font-bold text-[#20251D] mb-3">
            <span>Progres Penyelesaian Materi</span>
            <span className="tabular-nums text-[#3E7B27]">
              {progressSummary.completed} / {progressSummary.total} Selesai ({progressSummary.percent}%)
            </span>
          </div>
          <ProgressBar percent={progressSummary.percent} height="h-3" trackClass="bg-white" />
          <p className="text-xs text-[#4E5849] mt-2.5">
            Membuka link Google Drive tidak otomatis menandai materi selesai. Gunakan pilihan status setelah mempelajari materi.
          </p>
        </Card>
      )}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : materials.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-5 h-5" />}
          title="Belum ada materi pembelajaran"
          description={
            isAdmin
              ? 'Klik "Tambah Materi" untuk membagikan modul Google Drive ke kelas aktif.'
              : 'Materi dari administrator akan muncul di sini.'
          }
        />
      ) : (
        <Card className="p-0 overflow-hidden divide-y divide-[#D5E4B6]/70">
          {materials.map((m, idx) => (
            <div
              key={m.id}
              className={`p-5 tablet:px-6 flex flex-col desktop:flex-row desktop:items-center justify-between gap-4 ${
                !m.is_published ? 'bg-[#F0F8DF]/55 opacity-85' : ''
              }`}
            >
              <div className="flex items-start gap-4 min-w-0 flex-1">
                <div className="w-11 h-11 rounded-2xl bg-[#DCECB8] text-[#20251D] font-display font-bold text-sm flex items-center justify-center shrink-0 tabular-nums">
                  {String(m.order_index).padStart(2, '0')}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#6F7B68]">
                    <span className="font-bold text-[#3E7B27]">{m.topic}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{m.published_at}</span>
                    <span aria-hidden="true">·</span>
                    <span>{m.targets.map((t) => t.class_name).join(', ')}</span>
                    {!m.is_published && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-bold text-[#C27C0A]">Disembunyikan</span>
                      </>
                    )}
                  </div>
                  <h2 className="font-display text-base font-bold text-[#20251D] mt-1">
                    {String(m.order_index).padStart(2, '0')}. {m.title}
                  </h2>
                  {m.description && <p className="text-sm text-[#4E5849] mt-0.5">{m.description}</p>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <a
                  href={m.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-display inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full bg-[#B5D45D] text-[#171A17] hover:bg-[#C5E370] whitespace-nowrap transition-colors"
                >
                  <span>Buka Google Drive</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                {isAdmin ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleReorder(idx, -1)}
                      className="p-2 rounded-full text-[#6F7B68] hover:text-[#20251D] hover:bg-[#F0F8DF] disabled:opacity-30 cursor-pointer"
                      title="Naikkan urutan"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === materials.length - 1}
                      onClick={() => handleReorder(idx, 1)}
                      className="p-2 rounded-full text-[#6F7B68] hover:text-[#20251D] hover:bg-[#F0F8DF] disabled:opacity-30 cursor-pointer"
                      title="Turunkan urutan"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(m)}
                      className="p-2 rounded-full text-[#6F7B68] hover:text-[#20251D] hover:bg-[#F0F8DF] cursor-pointer"
                      title={m.is_published ? 'Sembunyikan materi' : 'Publikasikan materi'}
                    >
                      {m.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(m)}
                      className="p-2 rounded-full text-[#6F7B68] hover:text-[#20251D] hover:bg-[#F0F8DF] cursor-pointer"
                      title="Edit materi"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(m)}
                      className="p-2 rounded-full text-[#6F7B68] hover:text-[#D13447] hover:bg-[#D13447]/10 cursor-pointer"
                      title="Hapus materi"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <MaterialStatusIndicator status={m.my_status || 'not_started'} />
                    <Select
                      value={m.my_status || 'not_started'}
                      onChange={(e) =>
                        handleStudentStatusChange(m.id, e.target.value as MaterialProgressStatus)
                      }
                      aria-label={`Status belajar ${m.title}`}
                      className="rounded-full py-1.5 text-xs font-semibold"
                    >
                      <option value="not_started">Belum dipelajari</option>
                      <option value="in_progress">Sedang dipelajari</option>
                      <option value="completed">Selesai</option>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Admin Create/Edit Material Modal */}
      <Modal
        open={modal.open}
        title={modal.editing ? 'Edit Materi Pembelajaran' : 'Tambah Materi Pembelajaran'}
        onClose={() => setModal({ open: false, editing: null })}
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleSaveMaterial} className="space-y-4">
          <div className="grid grid-cols-1 tablet:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">Urutan</label>
              <Input
                type="number"
                min={1}
                required
                value={formState.order_index}
                onChange={(e) =>
                  setFormState({ ...formState, order_index: Number(e.target.value) })
                }
                className="tabular-nums"
              />
            </div>
            <div className="tablet:col-span-3">
              <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
                Judul Materi
              </label>
              <Input
                type="text"
                required
                value={formState.title}
                onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                placeholder="Contoh: Dasar-Dasar Pemrograman"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
                Mata Kuliah / Topik
              </label>
              <Input
                type="text"
                required
                value={formState.topic}
                onChange={(e) => setFormState({ ...formState, topic: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
                Tanggal Publikasi
              </label>
              <Input
                type="date"
                required
                value={formState.published_at}
                onChange={(e) => setFormState({ ...formState, published_at: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
              Link Google Drive
            </label>
            <Input
              type="url"
              required
              value={formState.drive_url}
              onChange={(e) => setFormState({ ...formState, drive_url: e.target.value })}
              placeholder="https://drive.google.com/..."
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
            <label className="block text-xs font-semibold text-[#4E5849] mb-2">
              Kelas Penerima
            </label>
            <div className="max-h-32 overflow-y-auto border border-[#D5E4B6] rounded-[16px] p-3 space-y-2 bg-[#F0F8DF]/50">
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

          <label className="flex items-center gap-2 text-sm font-medium text-[#20251D] cursor-pointer">
            <input
              type="checkbox"
              checked={formState.is_published}
              onChange={(e) => setFormState({ ...formState, is_published: e.target.checked })}
            />
            <span>Publikasikan langsung ke mahasiswa</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModal({ open: false, editing: null })}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan Materi'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Materi Pembelajaran"
        description={`Yakin ingin menghapus materi "${deleteTarget?.title}"?`}
        confirmLabel="Hapus"
        loading={submitting}
        onConfirm={handleDeleteMaterial}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

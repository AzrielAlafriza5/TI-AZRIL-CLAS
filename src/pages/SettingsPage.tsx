import { useEffect, useState } from 'react';
import { Save, Database, ShieldAlert, Plus, Trash2, Sparkles } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { isSupabaseBrowserConfigured } from '../lib/supabase.ts';
import { Button, Card, Input, PageHeader } from '../components/ui/DesignSystem.tsx';
import { TableSkeleton } from '../components/ui/Skeleton.tsx';
import type { SystemSettings } from '../types/index.ts';

interface SettingsPageProps {
  onToast: (type: 'success' | 'error', text: string) => void;
}

export function SettingsPage({ onToast }: SettingsPageProps) {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [supabaseServerConfigured, setSupabaseServerConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sRes, aRes, stRes] = await Promise.all([
        apiFetch<{ settings: SystemSettings }>('/api/admin/settings'),
        apiFetch<{ logs: any[] }>('/api/admin/audit-logs?limit=25'),
        apiFetch<{ supabaseConfigured: boolean }>('/api/auth/status'),
      ]);
      setSettings(sRes.settings);
      setAuditLogs(aRes.logs);
      setSupabaseServerConfigured(stRes.supabaseConfigured);
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      onToast('success', 'Pengaturan poin, EXP, dan batas level berhasil disimpan.');
      await loadAll();
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSeedTemplate = async () => {
    setSeeding(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/admin/seed-template', {
        method: 'POST',
      });
      onToast('success', res.message);
      await loadAll();
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSeeding(false);
    }
  };

  if (loading || !settings) {
    return <TableSkeleton rows={6} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan Sistem"
        description="Konfigurasi bobot poin akademik, reward EXP streak, batas level, integrasi Supabase, dan audit log."
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={seeding}
            onClick={handleSeedTemplate}
          >
            <Sparkles className="w-4 h-4" />
            <span>{seeding ? 'Memuat...' : 'Muat Template Kurikulum Awal'}</span>
          </Button>
        }
      />

      {/* Supabase & Deployment Readiness Card */}
      <Card variant="soft" className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-white border border-[#D5E4B6] text-[#20251D] flex items-center justify-center shrink-0">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-display text-sm font-bold text-[#20251D]">
            Status Koneksi Database & Deployment
          </h2>
          <p className="text-xs text-[#20251D]/85 mt-1">
            Frontend Supabase Key:{' '}
            <span className="font-bold">
              {isSupabaseBrowserConfigured ? 'Terhubung' : 'Belum diisi (Mode Lokal SQLite Aktif)'}
            </span>{' '}
            · Server Service Role:{' '}
            <span className="font-bold">
              {supabaseServerConfigured
                ? 'Terhubung'
                : 'Menunggu env SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY'}
            </span>
          </p>
          <p className="text-xs text-[#4E5849] mt-1">
            SQL migration tersedia di supabase/migrations/0001_initial_schema.sql dan panduan di
            docs/DEPLOYMENT_VERCEL_SUPABASE.md.
          </p>
        </div>
      </Card>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 desktop:grid-cols-2 gap-6">
          {/* Point Rules */}
          <Card className="space-y-4">
            <h2 className="font-display text-base font-bold text-[#20251D]">
              Konfigurasi Poin Akademik
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'hadir', label: 'Absen Hadir' },
                { key: 'izin', label: 'Absen Izin' },
                { key: 'sakit', label: 'Absen Sakit' },
                { key: 'alpha', label: 'Absen Alpha' },
                { key: 'question', label: 'Pertanyaan' },
                { key: 'critical_question', label: 'Pertanyaan Kritis' },
                { key: 'discussion', label: 'Kontribusi Diskusi' },
              ].map((item) => (
                <div key={item.key}>
                  <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
                    {item.label}
                  </label>
                  <Input
                    type="number"
                    value={(settings.points as any)[item.key]}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        points: { ...settings.points, [item.key]: Number(e.target.value) },
                      })
                    }
                    className="tabular-nums"
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* EXP Rules */}
          <Card className="space-y-4">
            <h2 className="font-display text-base font-bold text-[#20251D]">
              Konfigurasi EXP & Streak Reward
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
                  EXP Login Harian (Daily)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={settings.exp.daily_login}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      exp: { ...settings.exp, daily_login: Number(e.target.value) },
                    })
                  }
                  className="tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
                  Bonus Streak 7 Hari (Weekly)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={settings.exp.weekly_streak_7}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      exp: { ...settings.exp, weekly_streak_7: Number(e.target.value) },
                    })
                  }
                  className="tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
                  Bonus Streak 30 Hari (Monthly)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={settings.exp.monthly_streak_30}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      exp: { ...settings.exp, monthly_streak_30: Number(e.target.value) },
                    })
                  }
                  className="tabular-nums"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Level Thresholds */}
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-[#20251D]">
              Batas Akumulasi Level Mahasiswa
            </h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const last = settings.levels[settings.levels.length - 1];
                setSettings({
                  ...settings,
                  levels: [
                    ...settings.levels,
                    {
                      level: (last?.level ?? 0) + 1,
                      min_exp: (last?.min_exp ?? 0) + 500,
                      title: `Tier ${(last?.level ?? 0) + 1}`,
                    },
                  ],
                });
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Level</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-3">
            {settings.levels.map((lvl, idx) => (
              <div
                key={idx}
                className="border border-[#D5E4B6] bg-[#F0F8DF]/60 rounded-[20px] p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs font-bold text-[#3E7B27]">
                    Level {lvl.level}
                  </span>
                  {settings.levels.length > 1 && idx === settings.levels.length - 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          levels: settings.levels.slice(0, -1),
                        })
                      }
                      className="text-[#6F7B68] hover:text-[#D13447] cursor-pointer"
                      aria-label="Hapus level terakhir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <Input
                  type="text"
                  value={lvl.title}
                  onChange={(e) => {
                    const copy = [...settings.levels];
                    copy[idx] = { ...copy[idx], title: e.target.value };
                    setSettings({ ...settings, levels: copy });
                  }}
                  placeholder="Nama Level"
                  className="py-2 text-xs"
                />
                <Input
                  type="number"
                  min={0}
                  value={lvl.min_exp}
                  onChange={(e) => {
                    const copy = [...settings.levels];
                    copy[idx] = { ...copy[idx], min_exp: Number(e.target.value) };
                    setSettings({ ...settings, levels: copy });
                  }}
                  placeholder="Min EXP"
                  className="py-2 text-xs tabular-nums"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving}>
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
            </Button>
          </div>
        </Card>
      </form>

      {/* Audit Logs */}
      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-5 border-b border-[#D5E4B6] flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#3E7B27]" />
          <h2 className="font-display text-base font-bold text-[#20251D]">
            Audit Log Aktivitas Penting
          </h2>
        </div>

        {auditLogs.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#6F7B68]">Belum ada audit log.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#D5E4B6] bg-[#F0F8DF]/70 text-[#6F7B68] font-semibold">
                  <th className="py-3 px-5">Waktu</th>
                  <th className="py-3 px-4">Aktor</th>
                  <th className="py-3 px-4">Aksi</th>
                  <th className="py-3 px-4 hidden tablet:table-cell">Target</th>
                  <th className="py-3 px-5">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5E4B6]/60">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F0F8DF]/50 transition-colors">
                    <td className="py-3 px-5 text-[#6F7B68] tabular-nums whitespace-nowrap">
                      {String(log.created_at).slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="py-3 px-4 font-display font-bold text-[#20251D]">
                      {log.actor_name ?? 'Sistem'}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#3E7B27]">{log.action}</td>
                    <td className="py-3 px-4 text-[#4E5849] hidden tablet:table-cell">
                      {log.target_type}
                    </td>
                    <td className="py-3 px-5 text-[#4E5849] truncate max-w-xs">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

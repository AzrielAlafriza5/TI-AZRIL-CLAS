import { useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { Button, Card, EmptyState, PageHeader } from '../components/ui/DesignSystem.tsx';
import { TableSkeleton } from '../components/ui/Skeleton.tsx';
import type { NotificationItem } from '../types/index.ts';

interface NotificationsPageProps {
  onUnreadChange: (count: number) => void;
}

export function NotificationsPage({ onUnreadChange }: NotificationsPageProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ notifications: NotificationItem[]; unreadCount: number }>(
        '/api/auth/notifications'
      );
      setItems(res.notifications);
      onUnreadChange(res.unreadCount);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markAllRead = async () => {
    await apiFetch('/api/auth/notifications/read-all', { method: 'POST' });
    await loadNotifications();
  };

  const markOneRead = async (id: string) => {
    await apiFetch(`/api/auth/notifications/${id}/read`, { method: 'PATCH' });
    await loadNotifications();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pusat Notifikasi"
        description="Pembaruan tugas, materi, poin akademik, EXP, streak harian, status, dan impor data."
        actions={
          <Button variant="secondary" size="sm" onClick={markAllRead}>
            <CheckCheck className="w-4 h-4" />
            <span>Tandai Semua Dibaca</span>
          </Button>
        }
      />

      {loading ? (
        <Card>
          <TableSkeleton rows={5} />
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-6 h-6" />}
          title="Belum ada notifikasi"
          description="Semua pembaruan tugas, absensi, poin, dan streak akan muncul di sini."
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-[#D5E4B6]/60">
            {items.map((n) => (
              <div
                key={n.id}
                className={`p-5 tablet:px-6 flex flex-col tablet:flex-row tablet:items-start justify-between gap-4 transition-colors ${
                  !n.is_read ? 'bg-[#DCECB8]/45' : ''
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#6F7B68]">
                    <span className="font-bold uppercase text-[#3E7B27]">{n.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {String(n.created_at).slice(0, 16).replace('T', ' ')}
                    </span>
                    {!n.is_read && (
                      <span className="px-2 py-0.5 rounded-full bg-[#B5D45D] text-[#171A17] text-[10px] font-bold">
                        Baru
                      </span>
                    )}
                  </div>
                  <h2 className="font-display text-sm font-bold text-[#20251D] mt-1">{n.title}</h2>
                  <p className="text-sm text-[#4E5849] mt-0.5">{n.message}</p>
                </div>

                {!n.is_read && (
                  <Button variant="outline" size="sm" onClick={() => markOneRead(n.id)}>
                    Tandai Dibaca
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

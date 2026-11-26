import { useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { Card, Button } from '../components/ui/DesignSystem.tsx';
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#181A17] tracking-tight">Pusat Notifikasi</h1>
          <p className="text-sm text-[#73796C] mt-1">
            Pembaruan tugas, materi, poin akademik, EXP, streak harian, status, dan impor data.
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={markAllRead}>
          <CheckCheck className="w-4 h-4" />
          <span>Tandai Semua Dibaca</span>
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={5} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-8 h-8 text-[#73796C] mx-auto mb-3" />
            <p className="text-sm text-[#73796C]">Belum ada notifikasi.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#DDE6C9]/60">
            {items.map((n) => (
              <div
                key={n.id}
                className={`p-5 sm:px-6 flex items-start justify-between gap-4 transition-colors ${
                  !n.is_read ? 'bg-[#DBECB8]/45' : ''
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-[#73796C]">
                    <span className="font-bold uppercase text-[#3D914C]">{n.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {String(n.created_at).slice(0, 16).replace('T', ' ')}
                    </span>
                    {!n.is_read && (
                      <span className="px-2 py-0.5 rounded-full bg-[#B5D45D] text-[#181A17] text-[10px] font-bold">
                        Baru
                      </span>
                    )}
                  </div>
                  <h2 className="text-sm font-bold text-[#181A17] mt-1">{n.title}</h2>
                  <p className="text-sm text-[#73796C] mt-0.5">{n.message}</p>
                </div>

                {!n.is_read && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markOneRead(n.id)}
                  >
                    Tandai Dibaca
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

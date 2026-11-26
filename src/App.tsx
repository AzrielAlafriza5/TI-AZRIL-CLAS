/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Flame, Sparkles, Trophy } from 'lucide-react';
import { apiFetch, setAuthToken } from './lib/api.ts';
import { LoadingScreen } from './components/ui/BrandLogo.tsx';
import { AppShell, type NavRoute, type ToastMessage } from './components/layout/AppShell.tsx';
import { Modal } from './components/ui/Modal.tsx';
import { Button } from './components/ui/DesignSystem.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { AdminDashboard } from './pages/AdminDashboard.tsx';
import { StudentDashboard } from './pages/StudentDashboard.tsx';
import { ProgramsClassesPage } from './pages/ProgramsClassesPage.tsx';
import { StudentsPage } from './pages/StudentsPage.tsx';
import { StudentDetailPage } from './pages/StudentDetailPage.tsx';
import { AssignmentsPage } from './pages/AssignmentsPage.tsx';
import { MaterialsPage } from './pages/MaterialsPage.tsx';
import { AttendancePage } from './pages/AttendancePage.tsx';
import { ExcelImportPage } from './pages/ExcelImportPage.tsx';
import { StudentStatusPage } from './pages/StudentStatusPage.tsx';
import { PointsPage } from './pages/PointsPage.tsx';
import { LeaderboardPage } from './pages/LeaderboardPage.tsx';
import { StreakPage } from './pages/StreakPage.tsx';
import { ExpLevelPage } from './pages/ExpLevelPage.tsx';
import { NotificationsPage } from './pages/NotificationsPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import type { AuthUser } from './types/index.ts';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [adminProvisioned, setAdminProvisioned] = useState(true);
  const [adminManagedByEnv, setAdminManagedByEnv] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [activeRoute, setActiveRoute] = useState<NavRoute>('dashboard');
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [streakPopup, setStreakPopup] = useState<any | null>(null);

  const addToast = (type: 'success' | 'error', text: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const refreshNotificationsCount = async () => {
    try {
      const res = await apiFetch<{ unreadCount: number }>('/api/auth/notifications');
      setUnreadNotifications(res.unreadCount);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const status = await apiFetch<{ adminProvisioned: boolean; adminManagedByEnv?: boolean }>(
          '/api/auth/status'
        );
        setServerError(null);
        if (typeof status?.adminProvisioned === 'boolean') {
          setAdminProvisioned(status.adminProvisioned);
        }
        setAdminManagedByEnv(Boolean(status?.adminManagedByEnv));
        try {
          const me = await apiFetch<{ user: AuthUser }>('/api/auth/me');
          setUser(me.user);
          await refreshNotificationsCount();
        } catch {
          setUser(null);
        }
      } catch (err: any) {
        setServerError(
          err?.message || 'Tidak dapat terhubung ke server API IT AZRIL CLAS.'
        );
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const handleLoginSuccess = async (loggedUser: AuthUser, streakOutcome?: any) => {
    setUser(loggedUser);
    setActiveRoute('dashboard');
    await refreshNotificationsCount();
    if (streakOutcome && !streakOutcome.alreadyLoggedToday) {
      setStreakPopup(streakOutcome);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthToken(null);
    setUser(null);
    setActiveRoute('dashboard');
    setSelectedStudentId(null);
  };

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setActiveRoute('student-detail');
  };

  const handleGlobalSearch = (q: string) => {
    setStudentSearch(q);
    setActiveRoute('students');
  };

  const handleRefresh = () => {
    setRefreshTick((n) => n + 1);
    refreshNotificationsCount();
  };

  if (booting) {
    return <LoadingScreen message="Menyiapkan sesi IT AZRIL CLAS..." />;
  }

  if (!user) {
    return (
      <LoginPage
        adminProvisioned={adminProvisioned}
        adminManagedByEnv={adminManagedByEnv}
        serverError={serverError}
        onLoginSuccess={handleLoginSuccess}
        onAdminProvisioned={() => setAdminProvisioned(true)}
      />
    );
  }

  return (
    <>
      <AppShell
        user={user}
        activeRoute={activeRoute}
        onNavigate={(route) => {
          setActiveRoute(route);
          refreshNotificationsCount();
        }}
        onRefresh={handleRefresh}
        onGlobalSearch={handleGlobalSearch}
        unreadNotifications={unreadNotifications}
        onLogout={handleLogout}
        toasts={toasts}
        onDismissToast={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      >
        <div key={`${activeRoute}-${refreshTick}`}>
          {activeRoute === 'dashboard' &&
            (user.role === 'admin' ? (
              <AdminDashboard onNavigate={setActiveRoute} onSelectStudent={handleSelectStudent} />
            ) : (
              <StudentDashboard onNavigate={setActiveRoute} />
            ))}

          {(activeRoute === 'programs' || activeRoute === 'classes') && user.role === 'admin' && (
            <ProgramsClassesPage
              initialFocus={activeRoute}
              onToast={addToast}
              onSelectStudent={handleSelectStudent}
            />
          )}

          {activeRoute === 'students' && user.role === 'admin' && (
            <StudentsPage
              initialSearch={studentSearch}
              onToast={addToast}
              onSelectStudent={handleSelectStudent}
            />
          )}

          {activeRoute === 'student-detail' && user.role === 'admin' && selectedStudentId && (
            <StudentDetailPage
              studentId={selectedStudentId}
              onBack={() => setActiveRoute('students')}
              onToast={addToast}
            />
          )}

          {activeRoute === 'assignments' && <AssignmentsPage user={user} onToast={addToast} />}

          {activeRoute === 'materials' && <MaterialsPage user={user} onToast={addToast} />}

          {activeRoute === 'attendance' && <AttendancePage user={user} onToast={addToast} />}

          {activeRoute === 'excel-import' && user.role === 'admin' && (
            <ExcelImportPage onToast={addToast} />
          )}

          {activeRoute === 'student-status' && user.role === 'admin' && (
            <StudentStatusPage onToast={addToast} />
          )}

          {activeRoute === 'points' && user.role === 'admin' && <PointsPage onToast={addToast} />}

          {activeRoute === 'leaderboard' && <LeaderboardPage user={user} />}

          {activeRoute === 'streak' && user.role === 'student' && <StreakPage />}

          {activeRoute === 'exp' && <ExpLevelPage user={user} />}

          {activeRoute === 'notifications' && (
            <NotificationsPage onUnreadChange={setUnreadNotifications} />
          )}

          {activeRoute === 'settings' && user.role === 'admin' && <SettingsPage onToast={addToast} />}
        </div>
      </AppShell>

      {/* Daily Streak & Level Up Reward Celebration Modal */}
      <Modal
        open={Boolean(streakPopup)}
        title="Daily Login Streak Tercatat!"
        onClose={() => setStreakPopup(null)}
        maxWidthClass="max-w-md"
      >
        {streakPopup && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-[#DBECB8] border border-[#B5D45D] mx-auto flex items-center justify-center">
              <Flame className="w-9 h-9 text-[#D8A33D] fill-[#D8A33D] animate-flame" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-[#181A17] tabular-nums">
                {streakPopup.currentStreak} DAY STREAK
              </div>
              <p className="text-sm text-[#73796C] mt-1">
                Anda meraih{' '}
                <span className="font-bold text-[#3D914C]">+{streakPopup.expEarnedToday} EXP</span>{' '}
                hari ini!
              </p>
            </div>

            {streakPopup.leveledUpTo && (
              <div className="p-3.5 rounded-2xl bg-[#DBECB8] border border-[#B5D45D] flex items-center justify-center gap-2 text-sm font-bold text-[#181A17]">
                <Sparkles className="w-4 h-4 text-[#3D914C]" />
                <span>Naik ke Level {streakPopup.leveledUpTo}!</span>
              </div>
            )}

            {streakPopup.unlockedAchievements?.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[#F0F8E0] border border-[#DDE6C9] text-xs text-[#181A17] space-y-1">
                <div className="font-bold flex items-center justify-center gap-1.5 text-[#3D914C]">
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Pencapaian Baru Terbuka</span>
                </div>
                <div>{streakPopup.unlockedAchievements.join(', ')}</div>
              </div>
            )}

            <Button onClick={() => setStreakPopup(null)} className="w-full">
              Mulai Belajar
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}

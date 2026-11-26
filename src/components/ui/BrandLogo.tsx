import { Flame } from 'lucide-react';

interface BrandLogoProps {
  compact?: boolean;
  darkSurface?: boolean;
}

export function BrandLogo({ compact = false, darkSurface = false }: BrandLogoProps) {
  return (
    <div className="flex items-center gap-3 shrink-0 select-none">
      <div
        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
          darkSurface ? 'bg-[#B5D45D] text-[#181A17]' : 'bg-[#181A17] text-[#B5D45D]'
        }`}
      >
        <svg viewBox="0 0 40 40" className="w-6 h-6" aria-hidden="true">
          <path d="M10 12h20v4.5H22.2V29h-4.4V16.5H10V12z" fill="currentColor" />
          <circle cx="29.5" cy="26.5" r="3.5" fill="currentColor" />
        </svg>
      </div>
      {!compact && (
        <div className="min-w-0">
          <div
            className={`text-[15px] font-bold tracking-tight leading-none whitespace-nowrap ${
              darkSurface ? 'text-white' : 'text-[#181A17]'
            }`}
          >
            IT AZRIL CLAS
          </div>
          <div
            className={`text-[11px] font-medium mt-1 leading-none whitespace-nowrap ${
              darkSurface ? 'text-[#DBECB8]' : 'text-[#73796C]'
            }`}
          >
            Learn. Grow. Compete.
          </div>
        </div>
      )}
    </div>
  );
}

export function LoadingScreen({ message = 'Memuat ruang kerja...' }: { message?: string }) {
  return (
    <div className="min-h-screen bg-[#F0F8E0] flex flex-col items-center justify-center p-6">
      <div className="bg-white border border-[#DDE6C9] rounded-[28px] px-10 py-9 flex flex-col items-center gap-5 shadow-[0_4px_20px_rgba(24,26,23,0.04)]">
        <div className="w-14 h-14 rounded-2xl bg-[#181A17] text-[#B5D45D] flex items-center justify-center">
          <svg viewBox="0 0 40 40" className="w-9 h-9" aria-hidden="true">
            <path d="M10 12h20v4.5H22.2V29h-4.4V16.5H10V12z" fill="currentColor" />
            <circle cx="29.5" cy="26.5" r="3.5" fill="currentColor" />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight text-[#181A17]">IT AZRIL CLAS</h1>
          <p className="text-xs font-medium text-[#73796C] mt-1">Learn. Grow. Compete.</p>
        </div>
        <div className="w-44 h-2 bg-[#F0F8E0] rounded-full overflow-hidden border border-[#DDE6C9]">
          <div className="h-full w-1/2 bg-[#B5D45D] rounded-full animate-pulse" />
        </div>
        <p className="text-xs text-[#73796C]">{message}</p>
      </div>
    </div>
  );
}

export function StreakFlame({
  days,
  activeToday = true,
  size = 'md',
}: {
  days: number;
  activeToday?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const iconClass =
    size === 'lg' ? 'w-10 h-10' : size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
  const textClass =
    size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-xs' : 'text-base';

  return (
    <div className="inline-flex items-center gap-2 shrink-0">
      <div
        className={`inline-flex items-center justify-center ${
          activeToday && days > 0 ? 'text-[#D8A33D] animate-flame' : 'text-[#73796C]'
        }`}
      >
        <Flame className={`${iconClass} fill-current`} aria-hidden="true" />
      </div>
      <span className={`font-bold tabular-nums tracking-tight text-[#181A17] ${textClass}`}>
        {days} DAY STREAK
      </span>
    </div>
  );
}

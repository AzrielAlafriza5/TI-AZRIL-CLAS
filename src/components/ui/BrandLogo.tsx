import { Flame } from 'lucide-react';

export const OFFICIAL_LOGO_SRC = '/assets/logo-azril.png';

interface BrandLogoProps {
  compact?: boolean;
  darkSurface?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-8 h-8 tablet:w-9 tablet:h-9',
  md: 'w-10 h-10 tablet:w-11 tablet:h-11',
  lg: 'w-12 h-12 tablet:w-14 tablet:h-14',
};

export function BrandLogo({
  compact = false,
  darkSurface = false,
  size = 'md',
}: BrandLogoProps) {
  return (
    <div className="flex items-center gap-3 shrink-0 select-none">
      <div className={`${SIZE_CLASSES[size]} aspect-square shrink-0 flex items-center justify-center`}>
        <img
          src={OFFICIAL_LOGO_SRC}
          alt="Logo resmi IT AZRIL CLAS"
          className="w-full h-full object-contain"
          decoding="async"
        />
      </div>
      {!compact && (
        <div className="min-w-0">
          <div
            className={`font-display text-[15px] font-bold tracking-tight leading-none whitespace-nowrap ${
              darkSurface ? 'text-white' : 'text-[#20251D]'
            }`}
          >
            IT AZRIL CLAS
          </div>
          <div
            className={`text-[11px] font-medium mt-1 leading-none whitespace-nowrap ${
              darkSurface ? 'text-[#DCECB8]/80' : 'text-[#6F7B68]'
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
    <div className="min-h-screen bg-[#F0F8DF] flex flex-col items-center justify-center p-6">
      <div className="bg-white border border-[#D5E4B6] rounded-[24px] px-10 py-9 flex flex-col items-center gap-5 max-w-xs w-full">
        <div className="w-16 h-16 tablet:w-20 tablet:h-20 aspect-square flex items-center justify-center">
          <img
            src={OFFICIAL_LOGO_SRC}
            alt="Logo resmi IT AZRIL CLAS"
            className="w-full h-full object-contain"
            decoding="async"
          />
        </div>
        <div className="text-center">
          <h1 className="font-display text-xl font-bold tracking-tight text-[#20251D]">
            IT AZRIL CLAS
          </h1>
          <p className="text-xs font-medium text-[#6F7B68] mt-1">Learn. Grow. Compete.</p>
        </div>
        <div className="w-44 h-2 bg-[#F0F8DF] rounded-full overflow-hidden border border-[#D5E4B6]">
          <div className="h-full w-2/5 bg-[#B5D45D] rounded-full animate-progress-indeterminate" />
        </div>
        <p className="text-xs text-[#4E5849] text-center">{message}</p>
      </div>
    </div>
  );
}

export function StreakFlame({
  days,
  activeToday = true,
  size = 'md',
  darkSurface = false,
}: {
  days: number;
  activeToday?: boolean;
  size?: 'sm' | 'md' | 'lg';
  darkSurface?: boolean;
}) {
  const iconClass =
    size === 'lg' ? 'w-9 h-9' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const textClass =
    size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-xs' : 'text-base';

  return (
    <div className="inline-flex items-center gap-2 shrink-0">
      <div
        className={`inline-flex items-center justify-center ${
          activeToday && days > 0
            ? 'text-[#FF7A1A] animate-flame'
            : darkSurface
              ? 'text-[#6F7B68]'
              : 'text-[#6F7B68]'
        }`}
      >
        <Flame className={`${iconClass} fill-current`} aria-hidden="true" />
      </div>
      <span
        className={`font-display font-bold tabular-nums tracking-tight ${textClass} ${
          darkSurface ? 'text-white' : 'text-[#20251D]'
        }`}
      >
        {days} DAY STREAK
      </span>
    </div>
  );
}

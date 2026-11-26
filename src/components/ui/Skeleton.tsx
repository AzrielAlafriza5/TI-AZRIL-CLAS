export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-[#DCECB8]/60 rounded-[16px] w-full" />
      ))}
    </div>
  );
}

export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-32 bg-white border border-[#D5E4B6] rounded-[24px] p-6">
          <div className="h-3 w-24 bg-[#DCECB8] rounded-full" />
          <div className="h-8 w-16 bg-[#DCECB8]/70 rounded-full mt-4" />
        </div>
      ))}
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="h-44 bg-[#171A17] border border-[#232822] rounded-[26px] p-6 animate-pulse">
      <div className="h-3.5 w-32 bg-[#232822] rounded-full" />
      <div className="h-7 w-64 bg-[#232822] rounded-full mt-4" />
      <div className="h-4 w-48 bg-[#232822] rounded-full mt-3" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-[#DBECB8]/50 rounded-2xl w-full" />
      ))}
    </div>
  );
}

export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-32 bg-white border border-[#DDE6C9] rounded-[26px] p-6">
          <div className="h-3 w-24 bg-[#DBECB8] rounded-full" />
          <div className="h-8 w-16 bg-[#DBECB8]/70 rounded-full mt-4" />
        </div>
      ))}
    </div>
  );
}

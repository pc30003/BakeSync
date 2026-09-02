import { Skeleton } from "@/components/ui/loading-skeleton";

export default function FloorStaffLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Greeting header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Batch cards with checklist */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
          <div className="border-t border-border px-5 py-3">
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3 px-5 py-3.5">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

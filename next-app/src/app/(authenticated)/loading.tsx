export default function AuthenticatedLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Greeting skeleton */}
      <div>
        <div className="h-8 w-48 bg-surface-1 rounded-lg" />
        <div className="h-4 w-32 bg-surface-1 rounded mt-2" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-surface-1 border border-white/[.06] rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 bg-surface-2 rounded" />
              <div className="h-4 w-20 bg-surface-2 rounded" />
            </div>
            <div className="h-8 w-24 bg-surface-2 rounded" />
            <div className="h-3 w-16 bg-surface-2 rounded" />
          </div>
        ))}
      </div>

      {/* Quick links skeleton */}
      <div className="bg-surface-1 border border-white/[.06] rounded-xl p-4 space-y-3">
        <div className="h-5 w-32 bg-surface-2 rounded" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-14 bg-surface-2 rounded-lg"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

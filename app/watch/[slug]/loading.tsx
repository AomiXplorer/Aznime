export default function WatchLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8" aria-busy="true" aria-live="polite">
      <div className="mb-4 space-y-2.5">
        <div className="shimmer h-3 w-40 rounded" />
        <div className="shimmer h-5 w-3/4 max-w-md rounded" />
        <div className="flex gap-1.5">
          <div className="shimmer h-7 w-24 rounded-md" />
          <div className="shimmer h-7 w-20 rounded-md" />
          <div className="shimmer h-7 w-24 rounded-md" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0e13]">
        <div className="shimmer aspect-video w-full" />
        <div className="flex items-center justify-between border-t border-white/[0.06] px-2 py-2">
          <div className="flex gap-1.5">
            <div className="shimmer h-8 w-20 rounded-md" />
            <div className="shimmer h-8 w-24 rounded-md" />
          </div>
          <div className="flex gap-1.5">
            <div className="shimmer h-8 w-20 rounded-md" />
            <div className="shimmer h-8 w-24 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-1 border-t border-white/[0.06] p-1.5">
          <div className="shimmer h-12 rounded-lg" />
          <div className="shimmer h-12 w-12 rounded-lg" />
          <div className="shimmer h-12 rounded-lg" />
        </div>
        <div className="grid gap-2 border-t border-white/[0.06] p-3 sm:grid-cols-2">
          <div className="shimmer h-12 rounded-lg" />
          <div className="shimmer h-12 rounded-lg" />
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0e13]">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <div className="shimmer h-4 w-32 rounded" />
        </div>
        <div className="space-y-2 p-4">
          <div className="shimmer h-8 w-full max-w-sm rounded-md" />
          <div className="shimmer h-8 w-full max-w-sm rounded-md" />
        </div>
      </div>

      <span className="sr-only">Memuat pemutar episode</span>
    </div>
  );
}

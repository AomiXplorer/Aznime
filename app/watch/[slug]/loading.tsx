export default function WatchLoading() {
  return (
    <div
      className="mx-auto max-w-6xl px-4 pb-14 pt-4 sm:px-6 sm:pt-6 lg:px-8"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mb-3 space-y-2 sm:mb-4">
        <div className="shimmer h-2.5 w-36 rounded" />
        <div className="shimmer h-4 w-3/4 max-w-md rounded" />
        <div className="shimmer h-2.5 w-56 rounded" />
      </div>

      <div className="-mx-4 overflow-hidden bg-black sm:mx-0 sm:rounded-lg">
        <div className="shimmer aspect-video w-full" />
        <div className="flex items-center justify-between gap-2 bg-[#0a0c11] py-1.5 pl-1 pr-1">
          <div className="flex gap-1 pl-1">
            <div className="shimmer h-8 w-24 rounded-md" />
            <div className="shimmer h-8 w-24 rounded-md" />
          </div>
          <div className="flex gap-1 border-l border-white/[0.08] pl-1">
            <div className="shimmer h-8 w-8 rounded-md" />
            <div className="shimmer h-8 w-8 rounded-md" />
            <div className="shimmer h-8 w-8 rounded-md" />
            <div className="shimmer h-8 w-8 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 border-t border-white/[0.08] bg-[#0a0c11] px-1 py-1">
          <div className="shimmer h-8 w-16 rounded-md" />
          <div className="shimmer h-8 w-20 rounded-md" />
          <div className="shimmer ml-auto h-8 w-16 rounded-md" />
        </div>
      </div>

      <div className="mt-7 space-y-9 sm:mt-8 sm:space-y-10">
        <div>
          <div className="flex items-baseline justify-between border-b border-white/[0.08] pb-2">
            <div className="shimmer h-2.5 w-28 rounded" />
            <div className="shimmer h-2.5 w-24 rounded" />
          </div>
          <div className="space-y-2.5 py-3">
            <div className="flex gap-1.5">
              <div className="shimmer h-3 w-10 rounded" />
              <div className="shimmer h-8 w-24 rounded-md" />
              <div className="shimmer h-8 w-24 rounded-md" />
              <div className="shimmer h-8 w-20 rounded-md" />
            </div>
            <div className="flex gap-1.5">
              <div className="shimmer h-3 w-10 rounded" />
              <div className="shimmer h-8 w-24 rounded-md" />
              <div className="shimmer h-8 w-24 rounded-md" />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between border-b border-white/[0.08] pb-2">
            <div className="shimmer h-2.5 w-32 rounded" />
            <div className="shimmer h-2.5 w-16 rounded" />
          </div>
          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="flex h-10 items-center gap-2.5 border-b border-white/[0.06]">
                <div className="shimmer h-3 w-6 rounded" />
                <div className="shimmer h-3 flex-1 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <span className="sr-only">Memuat pemutar episode</span>
    </div>
  );
}

export default function MapSkeleton() {
  return (
    <div className="flex h-[calc(100dvh-4rem-1px-var(--ir-bottomnav-h))]">
      {/* Sidebar skeleton — matches FiltresRevendeurs/FiltresEvenements layout */}
      <aside className="hidden md:flex flex-col w-[280px] shrink-0 p-4 bg-white border-r border-border" aria-hidden="true">
        <div className="animate-pulse space-y-6">
          <div className="h-5 bg-gray-200 rounded w-3/5" />
          <div className="space-y-2">
            <div className="h-3.5 bg-gray-200 rounded w-full" />
            <div className="h-3.5 bg-gray-200 rounded w-4/5" />
            <div className="h-3.5 bg-gray-200 rounded w-[90%]" />
          </div>
          <div className="space-y-2">
            <div className="h-3.5 bg-gray-200 rounded w-full" />
            <div className="h-3.5 bg-gray-200 rounded w-[70%]" />
          </div>
          <div className="h-10 bg-gray-200 rounded-lg w-full" />
        </div>
      </aside>

      {/* Map skeleton */}
      <div className="flex-1 bg-[#E9E9EA] flex items-center justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-primary" style={{ animation: 'dotBounce 1.4s ease-in-out 0s infinite' }} />
          <div className="w-2.5 h-2.5 rounded-full bg-primary" style={{ animation: 'dotBounce 1.4s ease-in-out 0.16s infinite' }} />
          <div className="w-2.5 h-2.5 rounded-full bg-primary" style={{ animation: 'dotBounce 1.4s ease-in-out 0.32s infinite' }} />
        </div>
      </div>
    </div>
  )
}

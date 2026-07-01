'use client'

import { useCallback, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'

export default function ReseauxSearch({ initialValue }: { initialValue: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const update = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set('q', value)
    } else {
      params.delete('q')
    }
    params.delete('page')
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }, [router, pathname, searchParams])

  return (
    <div className="relative max-w-sm">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]" aria-hidden />
      <input
        type="search"
        defaultValue={initialValue}
        onChange={(e) => update(e.target.value)}
        placeholder="Rechercher un réseau (BNI, DCF…)"
        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[#e4e4e7] bg-white text-[#18181b] placeholder:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#f5851f] focus:border-transparent shadow-sm"
        autoComplete="off"
        aria-label="Rechercher un réseau"
      />
    </div>
  )
}

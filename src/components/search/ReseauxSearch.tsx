'use client'

import { useCallback, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { DebouncedFilterInput } from './DebouncedFilterInput'

export default function ReseauxSearch({ initialValue }: { initialValue: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const update = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('q', value)
      } else {
        params.delete('q')
      }
      params.delete('page')
      startTransition(() => {
        // scroll: false — rechercher ne doit pas renvoyer l'utilisateur en haut de page.
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
      })
    },
    [router, pathname, searchParams],
  )

  return (
    <div className="relative max-w-sm">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999A9D]" aria-hidden />
      <DebouncedFilterInput
        type="search"
        urlValue={searchParams.get('q') ?? initialValue}
        onCommit={update}
        placeholder="Rechercher un réseau (BNI, DCF…)"
        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[#DFE0E1] bg-white text-[#1D1E21] placeholder:text-[#999A9D] focus:outline-none focus:ring-2 focus:ring-[#035AA6] focus:border-transparent"
        autoComplete="off"
        aria-label="Rechercher un réseau"
      />
    </div>
  )
}

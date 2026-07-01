'use client'
/**
 * MiniMapLoader — Wrapper d'import dynamique (ssr:false) pour MiniMap.
 *
 * MapLibre GL JS requiert le navigateur (WebGL/DOM) — incompatible avec le SSR.
 * Point d'entrée à utiliser depuis les fiches (Server Components).
 */

import dynamic from 'next/dynamic'
import type { MiniMapProps } from './MiniMap'

const MiniMap = dynamic(() => import('./MiniMap'), {
  ssr: false,
  loading: () => (
    <div
      className="h-48 w-full rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] animate-pulse"
      aria-hidden
    />
  ),
})

export default function MiniMapLoader(props: MiniMapProps) {
  return <MiniMap {...props} />
}

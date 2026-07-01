'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { DirectionsProfile, DirectionsRoute } from '@/types/map'
import { fetchDirections } from '@/lib/mapbox/directions'

export function useDirections() {
  const [origin, setOrigin] = useState<[number, number] | null>(null)
  const [destination, setDestination] = useState<[number, number] | null>(null)
  const [profile, setProfile] = useState<DirectionsProfile>('driving')
  const [route, setRoute] = useState<DirectionsRoute | null>(null)
  const [alternatives, setAlternatives] = useState<DirectionsRoute[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [geoError, setGeoError] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const calculate = useCallback(
    (orig: [number, number], dest: [number, number], prof: DirectionsProfile) => {
      // Cancel previous request
      abortRef.current?.abort()
      if (debounceRef.current) clearTimeout(debounceRef.current)

      debounceRef.current = setTimeout(async () => {
        const controller = new AbortController()
        abortRef.current = controller
        setLoading(true)

        try {
          const data = await fetchDirections([orig, dest], prof, controller.signal)
          if (data.routes?.length) {
            setRoute(data.routes[0])
            setAlternatives(data.routes.slice(1))
          } else {
            setRoute(null)
            setAlternatives([])
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setRoute(null)
          setAlternatives([])
        } finally {
          setLoading(false)
        }
      }, 300) // debounce 300ms
    },
    [],
  )

  // Auto-calculate when origin + destination are set
  useEffect(() => {
    if (origin && destination) {
      calculate(origin, destination, profile)
    }
  }, [origin, destination, profile, calculate])

  const open = useCallback((dest?: [number, number]) => {
    setIsOpen(true)
    if (dest) setDestination(dest)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setRoute(null)
    setAlternatives([])
    setOrigin(null)
    setDestination(null)
    setGeoError(false)
    abortRef.current?.abort()
  }, [])

  return {
    origin,
    setOrigin,
    destination,
    setDestination,
    geoError,
    setGeoError,
    profile,
    setProfile,
    route,
    alternatives,
    loading,
    isOpen,
    open,
    close,
  }
}

'use client'

/**
 * MapPopupLibre — Popup MapLibre (pendant de MapPopup.tsx pour Mapbox).
 */

import { Popup } from 'react-map-gl/maplibre'

interface MapPopupLibreProps {
  longitude: number
  latitude: number
  onClose: () => void
  closeButton?: boolean
  offset?: number
  className?: string
  children: React.ReactNode
}

export default function MapPopupLibre({
  longitude,
  latitude,
  onClose,
  closeButton = true,
  offset = 14,
  className,
  children,
}: MapPopupLibreProps) {
  return (
    <Popup
      longitude={longitude}
      latitude={latitude}
      onClose={onClose}
      closeButton={closeButton}
      offset={offset}
      className={className}
      maxWidth="260px"
      anchor="bottom"
    >
      {children}
    </Popup>
  )
}

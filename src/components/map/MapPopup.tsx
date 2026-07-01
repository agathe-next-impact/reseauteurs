'use client'

import { Popup } from 'react-map-gl/mapbox'

interface MapPopupProps {
  longitude: number
  latitude: number
  onClose: () => void
  closeButton?: boolean
  offset?: number
  className?: string
  children: React.ReactNode
}

export default function MapPopup({
  longitude,
  latitude,
  onClose,
  closeButton = true,
  offset = 14,
  className,
  children,
}: MapPopupProps) {
  return (
    <Popup
      longitude={longitude}
      latitude={latitude}
      onClose={onClose}
      closeButton={closeButton}
      offset={offset}
      className={className}
      maxWidth="250px"
      anchor="bottom"
    >
      {children}
    </Popup>
  )
}

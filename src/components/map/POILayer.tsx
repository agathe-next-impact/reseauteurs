'use client'

import type { POIInfo } from '@/types/map'
import MapPopup from './MapPopup'

interface POILayerProps {
  popup: POIInfo | null
  onClose: () => void
}

export default function POILayer({ popup, onClose }: POILayerProps) {
  if (!popup) return null

  return (
    <MapPopup longitude={popup.longitude} latitude={popup.latitude} onClose={onClose}>
      <strong>{popup.name}</strong>
      {popup.category && (
        <>
          <br />
          <span style={{ color: '#666', fontSize: '12px' }}>{popup.category}</span>
        </>
      )}
    </MapPopup>
  )
}

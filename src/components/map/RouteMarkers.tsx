'use client'

import { Marker } from 'react-map-gl/mapbox'

interface RouteMarkersProps {
  origin: [number, number] | null
  destination: [number, number] | null
}

export default function RouteMarkers({ origin, destination }: RouteMarkersProps) {
  return (
    <>
      {origin && (
        <Marker longitude={origin[0]} latitude={origin[1]} anchor="center">
          <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-md" />
        </Marker>
      )}
      {destination && (
        <Marker longitude={destination[0]} latitude={destination[1]} anchor="center">
          <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-md" />
        </Marker>
      )}
    </>
  )
}

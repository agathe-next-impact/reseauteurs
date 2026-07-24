import { ImageResponse } from 'next/og'
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site'

export const runtime = 'edge'
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 80,
          background: '#012A4A',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* next/og : <img> est le seul élément image supporté (pas next/image). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${SITE_URL}/img/logo.png`}
            width={80}
            height={80}
            alt=""
            style={{ borderRadius: 20, background: 'rgba(255,255,255,0.95)', padding: 8 }}
          />
          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: -0.5 }}>{SITE_NAME}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>
            {SITE_TAGLINE}
          </div>
          <div style={{ fontSize: 32, opacity: 0.9, maxWidth: 900 }}>
            Réseauteurs, événements business et réseaux d&apos;affaires, réunis.
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 24,
            opacity: 0.85,
          }}
        >
          <span>reseauteurs.com</span>
          <span>Réseauteurs · Événements · Réseaux</span>
        </div>
      </div>
    ),
    size,
  )
}

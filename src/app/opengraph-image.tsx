import { ImageResponse } from 'next/og'
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site'

export const runtime = 'edge'
export const alt = `${SITE_NAME} — Annuaire B2B national`
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
          background: 'linear-gradient(135deg, #1e3a8a 0%, #EDA82F 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
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
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, maxWidth: 900 }}>
            Annuaire B2B des revendeurs d&apos;objets publicitaires
          </div>
          <div style={{ fontSize: 32, opacity: 0.9, maxWidth: 900 }}>{SITE_TAGLINE}</div>
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
          <span>reseauteurs.fr</span>
          <span>Réseauteurs · Événements · Réseaux</span>
        </div>
      </div>
    ),
    size,
  )
}

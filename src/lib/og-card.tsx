/**
 * lib/og-card.tsx — rendu partagé des images OpenGraph par fiche (1200×630).
 *
 * Chaque fiche (réseauteur / événement / réseau) génère SON aperçu de partage à
 * partir de son contenu réel (photo/logo/visuel + titre + informations clés), via
 * la convention de fichier Next `opengraph-image.tsx` co-localisée dans la route.
 *
 * ⚠️ Ce n'est PAS une capture d'écran de la page : `next/og` (Satori) rend du JSX,
 * pas un DOM de navigateur — il ne peut donc pas photographier une carte MapLibre
 * ou du CSS arbitraire. On reconstitue un aperçu fidèle, cohérent et léger, à la
 * charte du site (mêmes couleurs, même cadre pour les trois entités).
 *
 * Les images embarquées (Blob Vercel, URLs absolues https) sont récupérées côté
 * serveur par ImageResponse : elles doivent être publiquement accessibles.
 */
import { ImageResponse } from 'next/og'

/** Dimensions/format standard OpenGraph — réexportés par chaque route. */
export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

// Palette de marque (valeurs figées — pas de token CSS dans un rendu Satori).
const CANVAS = '#faf9f5'
const NAVY = '#012A4A'
const TEXT = '#1D1E21'
const MUTED = '#4E5155'
const FAINT = '#8A8D91'
const LINE = '#E4E4E7'

export type OgCardInput = {
  /** Type d'entité, en pastille (« Réseauteur », « Événement », « Réseau d'affaires »). */
  eyebrow: string
  /** Titre principal (nom, titre d'événement, nom de réseau). */
  title: string
  /** Sous-titre (fonction · entreprise / date · ville / échelle · ville). */
  subtitle?: string | null
  /** Lignes d'information complémentaires (réseau organisateur, badge…). */
  meta?: string[]
  /** Image à embarquer (photo, logo, visuel) — URL absolue. */
  imageUrl?: string | null
  /** Cercle pour une personne, carré arrondi pour un logo/visuel. */
  imageShape?: 'circle' | 'rounded'
  /** Couleur d'accent de l'entité. */
  accent: string
  /** Initiales de repli quand aucune image n'est disponible. */
  fallbackInitials?: string
}

function trim(s: string | null | undefined, max: number): string {
  if (!s) return ''
  const clean = s.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

/** Construit l'ImageResponse d'une fiche. Appelé par les routes `opengraph-image`. */
export function renderOgCard(input: OgCardInput): ImageResponse {
  const { eyebrow, accent } = input
  const title = trim(input.title, 64)
  const subtitle = trim(input.subtitle, 90)
  const meta = (input.meta ?? []).map((m) => trim(m, 60)).filter(Boolean).slice(0, 3)
  const imageUrl = input.imageUrl || null
  const circle = input.imageShape !== 'rounded'
  const initials = trim(input.fallbackInitials, 2).toUpperCase()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: CANVAS,
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Filet d'accent en bord gauche */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 14,
            background: accent,
          }}
        />

        {/* En-tête de marque */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: NAVY,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 24,
              fontWeight: 800,
            }}
          >
            R
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 1, color: NAVY }}>
            RÉSEAUTEURS
          </div>
        </div>

        {/* Corps : texte + visuel */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 56 }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignSelf: 'flex-start',
                padding: '6px 16px',
                borderRadius: 999,
                background: `${accent}1A`,
                color: accent,
                fontSize: 22,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 20,
              }}
            >
              {eyebrow}
            </div>
            <div style={{ fontSize: 62, fontWeight: 800, lineHeight: 1.05, color: TEXT, letterSpacing: -1 }}>
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: 30, color: MUTED, marginTop: 18, lineHeight: 1.3 }}>
                {subtitle}
              </div>
            )}
            {meta.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 20 }}>
                {meta.map((m) => (
                  <div key={m} style={{ display: 'flex', fontSize: 24, color: FAINT }}>
                    {m}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Visuel de l'entité (ou initiales de repli) */}
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              width={300}
              height={300}
              alt=""
              style={{
                width: 300,
                height: 300,
                objectFit: 'cover',
                borderRadius: circle ? 300 : 28,
                border: `1px solid ${LINE}`,
                background: '#fff',
              }}
            />
          ) : (
            <div
              style={{
                width: 300,
                height: 300,
                borderRadius: circle ? 300 : 28,
                background: `${accent}1A`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accent,
                fontSize: 120,
                fontWeight: 800,
              }}
            >
              {initials || 'R'}
            </div>
          )}
        </div>

        {/* Pied */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 24,
            color: FAINT,
            borderTop: `1px solid ${LINE}`,
            paddingTop: 20,
          }}
        >
          <div style={{ display: 'flex' }}>reseauteurs.com</div>
          <div style={{ display: 'flex' }}>Réseauteurs · Événements · Réseaux</div>
        </div>
      </div>
    ),
    OG_SIZE,
  )
}

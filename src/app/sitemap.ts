/**
 * sitemap.ts — Sitemap dynamique RÉSEAUTEURS (3 entités : réseauteurs, événements, réseaux).
 *
 * RGPD — opt-out d'indexation des personnes physiques :
 *   Les réseauteurs en noindex (profil non validé OU opt-out manuel) sont EXCLUS du sitemap.
 *   Seuls les profils avec statut='valide' ET seo.noindex != true sont inclus.
 *
 * Revalidation : 1 heure (la valeur `revalidate` est honorée par Vercel pour ISR).
 * Les hooks afterChange des collections appellent revalidatePath() pour des purges ciblées.
 */
import { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { SITE_URL } from '@/lib/site'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayload({ config })

  // Pages statiques
  // Note : /carte/reseauteurs et /carte/evenements sont exclus — ces URLs font
  // l'objet d'un 301 vers /reseauteurs?vue=carte et /evenements?vue=carte
  // (ADR-0012 §7 ; next.config.ts). Un sitemap ne doit pas référencer des URLs
  // qui redirigent : les canonicals cibles sont déjà listés (/reseauteurs, /evenements).
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${SITE_URL}/reseauteurs`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/evenements`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/reseaux`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/partenaires`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/a-propos`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/contact`, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE_URL}/cgu`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/cgv`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/confidentialite`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/cookies`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/mentions-legales`, changeFrequency: 'yearly', priority: 0.2 },
  ]

  const now = new Date().toISOString()

  const [reseauteurRes, evenementRes, reseauRes] = await Promise.all([
    // ── Réseauteurs indexables uniquement (RGPD — opt-out respecté)
    // statut='valide' : profil modéré et approuvé
    // seo.noindex doit être false ou null (pas de noindex explicite)
    payload.find({
      collection: 'reseauteurs',
      where: { statut: { equals: 'valide' } },
      select: { slug: true, updatedAt: true, seo: true } as Record<string, boolean>,
      limit: 0,
      overrideAccess: true,
    }),

    // ── Événements publiés et à venir
    payload.find({
      collection: 'evenements',
      where: {
        and: [
          { statut: { equals: 'publie' } },
          {
            or: [
              // Événement avec dateFin explicite : non encore terminé
              { dateFin: { greater_than_equal: now } },
              // Événement sans dateFin : non encore commencé
              {
                and: [
                  { dateFin: { exists: false } },
                  { dateDebut: { greater_than_equal: now } },
                ],
              },
            ],
          },
        ],
      },
      select: { slug: true, updatedAt: true, seo: true } as Record<string, boolean>,
      limit: 0,
      overrideAccess: true,
    }),

    // ── Réseaux publiés
    payload.find({
      collection: 'reseaux',
      where: { statut: { equals: 'publiee' } },
      select: { slug: true, updatedAt: true, seo: true } as Record<string, boolean>,
      limit: 0,
      overrideAccess: true,
    }),
  ])

  // ── Fiches réseauteurs — exclure les noindex (RGPD opt-out)
  const reseauteurPages: MetadataRoute.Sitemap = reseauteurRes.docs
    .filter((r) => r.slug && !(r.seo as { noindex?: boolean } | null)?.noindex)
    .map((r) => ({
      url: `${SITE_URL}/reseauteur/${r.slug}`,
      lastModified: r.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

  // ── Fiches événements
  const evenementPages: MetadataRoute.Sitemap = evenementRes.docs
    .filter((e) => e.slug && !(e.seo as { noindex?: boolean } | null)?.noindex)
    .map((e) => ({
      url: `${SITE_URL}/evenement/${e.slug}`,
      lastModified: e.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))

  // ── Fiches réseaux
  const reseauPages: MetadataRoute.Sitemap = reseauRes.docs
    .filter((r) => r.slug && !(r.seo as { noindex?: boolean } | null)?.noindex)
    .map((r) => ({
      url: `${SITE_URL}/reseau/${r.slug}`,
      lastModified: r.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

  return [...staticPages, ...reseauteurPages, ...evenementPages, ...reseauPages]
}

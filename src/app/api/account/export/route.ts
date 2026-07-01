/**
 * GET /api/account/export
 *
 * Export RGPD RÉSEAUTEURS (droit à la portabilité).
 * Recalibré ADR-0011 : exporte les données personnelles du réseauteur ou de l'organisateur.
 *
 * Pour un réseauteur : profil + réseaux fréquentés + statut.
 * Pour un organisateur : réseau + événements liés.
 * Dans les deux cas : données du compte user.
 */
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { hashUserId } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'

export async function GET() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { success: allowed } = rateLimit(`account-export:${user.id}`, { limit: 5, windowMs: 60_000 })
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
  }

  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
  })

  const role = freshUser.role as string

  const exportData: Record<string, unknown> = {
    exportDate: new Date().toISOString(),
    compte: {
      id: freshUser.id,
      email: freshUser.email,
      role,
      createdAt: freshUser.createdAt,
      updatedAt: freshUser.updatedAt,
      consentements: {
        cguAcceptedAt: (freshUser as unknown as Record<string, unknown>).cguAcceptedAt ?? null,
        confidentialiteAcceptedAt: (freshUser as unknown as Record<string, unknown>).confidentialiteAcceptedAt ?? null,
        optInMarketing: (freshUser as unknown as Record<string, unknown>).optInMarketing ?? false,
        optInMarketingAt: (freshUser as unknown as Record<string, unknown>).optInMarketingAt ?? null,
        optOutMarketingAt: (freshUser as unknown as Record<string, unknown>).optOutMarketingAt ?? null,
      },
    },
  }

  if (role === 'reseauteur') {
    // Profil réseauteur
    const { docs: reseauteurDocs } = await payload.find({
      collection: 'reseauteurs',
      where: { user: { equals: user.id } },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })
    const reseauteur = reseauteurDocs[0] as unknown as Record<string, unknown> | undefined

    exportData.profil = reseauteur
      ? {
          prenom: reseauteur.prenom,
          nom: reseauteur.nom,
          entreprise: reseauteur.entreprise,
          fonction: reseauteur.fonction,
          description: reseauteur.description,
          telephone: reseauteur.telephone ?? null,
          emailContact: reseauteur.emailContact ?? null,
          site: reseauteur.site ?? null,
          linkedin: reseauteur.linkedin ?? null,
          ville: reseauteur.ville,
          departement: reseauteur.departement ?? null,
          region: reseauteur.region ?? null,
          badge: reseauteur.badge,
          evenementsParMois: reseauteur.evenementsParMois,
          statut: reseauteur.statut,
          seoNoindex: (reseauteur.seo as Record<string, unknown> | undefined)?.noindex ?? false,
          createdAt: reseauteur.createdAt,
          updatedAt: reseauteur.updatedAt,
        }
      : null
  } else if (role === 'organisateur') {
    // Fiche réseau et événements
    const { docs: reseauxDocs } = await payload.find({
      collection: 'reseaux',
      where: { user: { equals: user.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const reseau = reseauxDocs[0] as unknown as Record<string, unknown> | undefined

    exportData.reseau = reseau
      ? {
          nom: reseau.nom,
          slug: reseau.slug,
          ville: reseau.ville,
          siteWeb: reseau.siteWeb ?? null,
          emailContact: reseau.emailContact ?? null,
          partenaire: reseau.partenaire,
          partenaireExpireAt: reseau.partenaireExpireAt ?? null,
          statut: reseau.statut,
          source: reseau.source,
          createdAt: reseau.createdAt,
          updatedAt: reseau.updatedAt,
        }
      : null

    if (reseau) {
      const { docs: evenementsDocs } = await payload.find({
        collection: 'evenements',
        where: { reseau: { equals: reseau.id as string | number } },
        limit: 0,
        depth: 0,
        overrideAccess: true,
      })
      exportData.evenements = (evenementsDocs as unknown as Record<string, unknown>[]).map((e) => ({
        titre: e.titre,
        slug: e.slug,
        dateDebut: e.dateDebut,
        dateFin: e.dateFin ?? null,
        lieuVille: e.lieuVille,
        // ADR-0012 §3 : champ `premium` droppé — ne plus exporter ce champ fantôme.
        statut: e.statut,
        createdAt: e.createdAt,
      }))
    }
  }

  // Audit RGPD (non bloquant)
  try {
    await payload.create({
      collection: 'audit-logs',
      data: {
        type: 'data_exported',
        userIdHash: hashUserId(user.id),
        metadata: { role },
      },
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[account/export] audit log failed (non-blocking):', err)
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="export-reseauteurs-${freshUser.email}-${Date.now()}.json"`,
    },
  })
}

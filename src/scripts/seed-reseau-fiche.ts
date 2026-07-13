/**
 * seed-reseau-fiche.ts — Remplit la FICHE COMPLÈTE d'un réseau de démo (spec 2026-07-13)
 * pour visualiser toutes les sections : identification, localisation, type & portée,
 * responsable local, fonctionnement, présentation (objectif/différenciateur), médias
 * (galerie, vidéo, plaquette), réseaux sociaux, validation.
 *
 * Cible : le réseau national ayant le plus de réseauteurs (sinon le premier). Idempotent.
 *
 * Usage :  pnpm seed:reseau-fiche            (aperçu)
 *          pnpm seed:reseau-fiche --confirm  (exécution)
 */
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

const DEMO_TAG = '[démo]'

function dbHost(): string {
  const url = process.env.DATABASE_URL || process.env.DATABASE_URI || ''
  try {
    return url ? new URL(url).host : '(non défini)'
  } catch {
    return '(URL illisible)'
  }
}

async function main() {
  const confirm = process.argv.includes('--confirm') || process.env.SEED_DEMO === '1'
  console.log('\n=== SEED FICHE RÉSEAU COMPLÈTE (spec 2026-07-13) ===')
  console.log(`  Base cible : ${dbHost()}`)
  if (!confirm) {
    console.log('\n  Mode aperçu — rien écrit. Exécuter : pnpm seed:reseau-fiche --confirm\n')
    process.exit(0)
  }

  const { getPayload } = await import('payload')
  const config = (await import('../payload.config')).default
  const payload = await getPayload({ config })
  process.env.SEED_DEV = 'true'
  const log = (m: string) => console.log(`-> ${m}`)

  // Cible : national le plus suivi, sinon premier réseau publié
  const { docs: nationaux } = await payload.find({
    collection: 'reseaux',
    where: { and: [{ niveau: { equals: 'national' } }, { statut: { equals: 'publiee' } }] },
    sort: '-nbReseauteurs',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  let cible = nationaux[0]
  if (!cible) {
    const { docs } = await payload.find({ collection: 'reseaux', where: { statut: { equals: 'publiee' } }, limit: 1, depth: 0, overrideAccess: true })
    cible = docs[0]
  }
  if (!cible) throw new Error('Aucun réseau en base — lancez d\'abord `pnpm seed:demo --confirm`.')

  // Une image de la médiathèque pour la photo du responsable + la galerie (facultatif)
  const { docs: medias } = await payload.find({ collection: 'media', limit: 6, depth: 0, overrideAccess: true })
  const mediaIds = medias.map((m) => m.id as number)
  const photoId = mediaIds[0]
  const galerie = mediaIds.slice(0, 4).map((id) => ({ image: id }))

  await payload.update({
    collection: 'reseaux',
    id: cible.id,
    data: {
      departement: (cible as { departement?: string }).departement ?? 'Rhône',
      region: (cible as { region?: string }).region ?? 'Auvergne-Rhône-Alpes',
      typeJuridique: 'association',
      portee: 'national',
      responsableNom: 'Camille Durand',
      responsableFonction: 'Directrice régionale',
      ...(photoId ? { responsablePhoto: photoId } : {}),
      objectif: `Développer l'inter-connaissance et le business entre membres par des rencontres régulières et qualifiées. ${DEMO_TAG}`,
      differenciateur:
        `Un seul représentant par métier et par groupe (exclusivité), un système de recommandations qualifiées, ` +
        `et un suivi des mises en relation. Ambiance bienveillante et exigeante à la fois. ${DEMO_TAG}`,
      nombreMembres: 12500,
      publicConcerne: 'Dirigeants, entrepreneurs, indépendants, commerciaux',
      ouvertATous: 'non',
      participationInvite: 'oui',
      adhesionObligatoire: 'oui',
      uneProfessionParGroupe: 'oui',
      cotisation: 'À partir de 900 €/an (selon le groupe)',
      videoYoutube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      plaquetteUrl: 'https://example.com/plaquette-reseau.pdf',
      reseauxSociaux: [
        { plateforme: 'linkedin', url: 'https://www.linkedin.com/company/exemple' },
        { plateforme: 'facebook', url: 'https://www.facebook.com/exemple' },
        { plateforme: 'youtube', url: 'https://www.youtube.com/@exemple' },
      ],
      ...(galerie.length ? { illustrations: galerie } : {}),
      rempliPar: 'Équipe RÉSEAUTEURS (démo)',
    } as never,
    overrideAccess: true,
  })

  // Relecture depth 1 (comme la fiche publique) — vérifie la population des relations média
  const fresh = await payload.findByID({ collection: 'reseaux', id: cible.id, depth: 1, overrideAccess: true })
  const f = fresh as Record<string, unknown>
  log(`fiche enrichie : ${f.nom} (/reseau/${f.slug})`)
  log(`  type=${f.typeJuridique} · portee=${f.portee} · membres=${f.nombreMembres}`)
  log(`  responsable=${f.responsableNom} (${f.responsableFonction}) · photo=${(f.responsablePhoto as { id?: number } | null)?.id ?? '—'}`)
  log(`  fonctionnement: ouvertATous=${f.ouvertATous} invite=${f.participationInvite} adhesion=${f.adhesionObligatoire} 1metier=${f.uneProfessionParGroupe}`)
  log(`  médias: galerie=${Array.isArray(f.illustrations) ? (f.illustrations as unknown[]).length : 0} · vidéo=${f.videoYoutube ? 'oui' : 'non'} · plaquette=${f.plaquetteUrl ? 'oui' : 'non'} · socials=${Array.isArray(f.reseauxSociaux) ? (f.reseauxSociaux as unknown[]).length : 0}`)
  console.log(`\nOK — visiter : /reseau/${f.slug}\n`)
  process.exit(0)
}

main().catch((err) => {
  console.error('[seed-reseau-fiche] fatal:', err)
  process.exit(1)
})

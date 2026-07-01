import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

/**
 * Diagnostic groupes : pour chaque groupe non-soft-deleted, affiche :
 *   - Nom + code + owner
 *   - Liste des membres avec leur plan
 *   - Compte des Infinite (seuls comptabilises pour le palier)
 *   - Palier persiste en DB (palierActuel) vs palier recalcule (live count)
 *   - Mismatch flag si DB != live (signale un sync raté de recalculerEtAppliquerPalier)
 *
 * Usage : pnpm tsx src/scripts/diag-groupes.ts
 *
 * Note : les imports dynamiques sont volontaires — ils permettent a dotenv de
 * peupler process.env avant que lib/stripe (chargé transitivement par
 * lib/groupes) ne valide STRIPE_SECRET_KEY au top-level.
 */

type Palier = '0' | '5' | '10' | '15'

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length)
}

function tauxFromPalier(palier: Palier | string): string {
  return palier === '0' ? 'aucune' : `-${palier}%`
}

;(async () => {
  const { getPayload } = await import('payload')
  const config = (await import('@payload-config')).default
  const { calculerPalierGroupe } = await import('../lib/groupes')

  const p = await getPayload({ config })

  const { docs: groupes } = await p.find({
    collection: 'groupes',
    where: { deletedAt: { exists: false } },
    limit: 0,
    overrideAccess: true,
    depth: 1,
  })

  if (groupes.length === 0) {
    console.log('Aucun groupe actif.')
    process.exit(0)
  }

  console.log(`=== ${groupes.length} groupe(s) actif(s) ===\n`)

  for (const groupe of groupes) {
    const owner = groupe.owner as { id: number; email?: string; nomSociete?: string } | number
    const ownerStr =
      typeof owner === 'object'
        ? `${owner.nomSociete ?? '?'} <${owner.email ?? '?'}>`
        : `id=${owner}`

    const { docs: membres } = await p.find({
      collection: 'users',
      where: { groupe: { equals: groupe.id } },
      limit: 0,
      overrideAccess: true,
    })

    const { palier: palierLive, membresPayants: nbInfinite } = await calculerPalierGroupe(
      p,
      groupe.id,
    )
    const palierDb = (groupe.palierActuel as Palier) || '0'
    const mismatch = palierDb !== palierLive

    console.log(`Groupe : ${groupe.nom}`)
    console.log(`  Code  : ${groupe.code}`)
    console.log(`  Owner : ${ownerStr}`)
    console.log(`  Membres (${membres.length}) :`)
    for (const m of membres) {
      const tag =
        m.plan === 'infinite' ? '[INFINITE]' : m.plan === 'premium' ? '[premium] ' : '[gratuit] '
      console.log(`    ${tag} ${pad(m.nomSociete ?? '?', 30)} ${m.email}`)
    }
    console.log(
      `  Membres Infinite comptabilises : ${nbInfinite}` +
        ' (Premium et Gratuit ne comptent pas dans le palier)',
    )
    console.log(`  Palier live (calcule)  : ${palierLive} (taux ${tauxFromPalier(palierLive)})`)
    console.log(
      `  Palier DB  (persiste)  : ${palierDb} (taux ${tauxFromPalier(palierDb)})` +
        (mismatch ? '   *** MISMATCH — recalculerEtAppliquerPalier doit etre rejoue ***' : ''),
    )
    console.log()
  }

  process.exit(0)
})().catch((err) => {
  console.error(err)
  process.exit(1)
})

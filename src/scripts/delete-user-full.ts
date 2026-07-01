import { getPayload } from 'payload'
import config from '@payload-config'
import crypto from 'crypto'
import readline from 'readline'
import { stripe } from '@/lib/stripe'
import { recalculerEtAppliquerPalier } from '@/lib/groupes'
import { accountDeletedEmail, groupeLeftOwnerEmail } from '@/lib/emails'
import { sendEmail } from '@/lib/email-sender'

type AnyPayload = Awaited<ReturnType<typeof getPayload>>

function hashUserId(userId: number | string): string {
  const secret = process.env.PAYLOAD_SECRET || ''
  return crypto.createHash('sha256').update(`${userId}:${secret}`).digest('hex')
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a) }))
}

function relId(rel: unknown): number | string | null {
  if (rel == null) return null
  if (typeof rel === 'object') return (rel as { id: number | string }).id ?? null
  return rel as number | string
}

async function preview(payload: AnyPayload, email: string) {
  const { docs: users } = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  if (users.length === 0) return { user: null as null, plan: [] as string[] }
  const user = users[0]

  const { docs: fiches } = await payload.find({
    collection: 'fournisseurs',
    where: { user: { equals: user.id } },
    limit: 0,
    overrideAccess: true,
  })
  const ficheIds = fiches.map((f) => f.id)

  const { totalDocs: evtPrincipal } = ficheIds.length
    ? await payload.find({
        collection: 'evenements',
        where: { fournisseur: { in: ficheIds } },
        limit: 0,
        overrideAccess: true,
      })
    : { totalDocs: 0 }

  const { totalDocs: evtAssoc } = ficheIds.length
    ? await payload.find({
        collection: 'evenements',
        where: { fournisseursAssocies: { in: ficheIds } },
        limit: 0,
        overrideAccess: true,
      })
    : { totalDocs: 0 }

  const groupeId = relId(user.groupe)

  const plan: string[] = []
  plan.push(`- User: ${user.email} (id=${user.id}, role=${user.role}, plan=${user.plan})`)
  if (user.role === 'admin') plan.push('  ⛔ Compte admin — suppression refusee')
  if (user.stripeSubscriptionId) plan.push(`- Stripe: cancel subscription ${user.stripeSubscriptionId}`)
  if (user.stripeCustomerId) plan.push(`- Stripe: delete customer ${user.stripeCustomerId}`)
  if (groupeId) plan.push(`- Groupe ${groupeId}: leave (+ eventuel transfert ownership)`)
  plan.push(`- Fiches fournisseurs: ${fiches.length}`)
  plan.push(`- Evenements (principal): ${evtPrincipal}`)
  plan.push(`- Evenements (detacher de fournisseursAssocies): ${evtAssoc}`)
  plan.push(`- Envoi email de confirmation a ${user.email}`)
  plan.push(`- Ecriture audit log RGPD`)
  plan.push(`- Suppression definitive du user`)

  return { user, plan }
}

async function executeDelete(payload: AnyPayload, email: string): Promise<void> {
  const { docs: users } = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  if (users.length === 0) {
    console.log(`  ⚠️  User ${email} introuvable, skip`)
    return
  }
  const user = users[0]

  if (user.role === 'admin') {
    console.log(`  ⛔ ${email} est admin — suppression refusee`)
    return
  }

  if (user.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(user.stripeSubscriptionId as string)
      console.log(`  ✓ Stripe subscription ${user.stripeSubscriptionId} cancelled`)
    } catch (err) {
      console.log(`  ⚠️  Stripe cancel failed (peut-etre deja annulee): ${(err as Error).message}`)
    }
  }

  const groupeId = relId(user.groupe)
  if (groupeId) {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { groupe: null },
      overrideAccess: true,
    })

    const subId = user.stripeSubscriptionId as string | null | undefined
    if (subId) {
      try {
        await stripe.subscriptions.update(subId, { discounts: [] })
      } catch {
        // ignore
      }
    }

    const groupe = await payload.findByID({
      collection: 'groupes',
      id: groupeId,
      overrideAccess: true,
    })
    const ownerId = relId(groupe.owner)
    const wasOwner = ownerId != null && Number(ownerId) === Number(user.id)
    let notifyOwnerId: number | string | null = null

    if (wasOwner) {
      const { docs: remaining } = await payload.find({
        collection: 'users',
        where: { groupe: { equals: groupeId } },
        sort: 'createdAt',
        limit: 1,
        overrideAccess: true,
      })
      if (remaining.length === 0) {
        await payload.delete({ collection: 'groupes', id: groupeId, overrideAccess: true })
        console.log(`  ✓ Groupe ${groupeId} supprime (aucun membre restant)`)
      } else {
        await payload.update({
          collection: 'groupes',
          id: groupeId,
          data: { owner: remaining[0].id },
          overrideAccess: true,
        })
        try { await recalculerEtAppliquerPalier(payload, groupeId) } catch {}
        notifyOwnerId = remaining[0].id
        console.log(`  ✓ Ownership groupe ${groupeId} transferee a user ${remaining[0].id}`)
      }
    } else {
      try { await recalculerEtAppliquerPalier(payload, groupeId) } catch {}
      if (ownerId != null) notifyOwnerId = ownerId
      console.log(`  ✓ User retire du groupe ${groupeId}`)
    }

    if (notifyOwnerId != null) {
      try {
        const [owner, refreshed] = await Promise.all([
          payload.findByID({ collection: 'users', id: notifyOwnerId, overrideAccess: true }),
          payload.findByID({ collection: 'groupes', id: groupeId, overrideAccess: true }),
        ])
        await sendEmail({
          payload,
          kind: 'group-left-owner',
          to: owner.email,
          subject: `Panorama Pub — ${user.nomSociete} a quitte votre groupe`,
          html: groupeLeftOwnerEmail(
            owner.nomSociete,
            user.nomSociete,
            String(refreshed.palierActuel ?? '0'),
          ),
          userId: owner.id,
        })
      } catch (err) {
        console.log(`  ⚠️  Notification owner groupe echouee: ${(err as Error).message}`)
      }
    }
  }

  const { docs: fiches } = await payload.find({
    collection: 'fournisseurs',
    where: { user: { equals: user.id } },
    limit: 0,
    overrideAccess: true,
  })

  for (const fiche of fiches) {
    const { docs: evenements } = await payload.find({
      collection: 'evenements',
      where: { fournisseur: { equals: fiche.id } },
      limit: 0,
      overrideAccess: true,
    })
    for (const evt of evenements) {
      await payload.delete({ collection: 'evenements', id: evt.id, overrideAccess: true })
    }
    if (evenements.length) console.log(`  ✓ ${evenements.length} evenement(s) supprime(s)`)

    const { docs: assocEvents } = await payload.find({
      collection: 'evenements',
      where: { fournisseursAssocies: { contains: fiche.id } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })
    for (const evt of assocEvents) {
      const currentAssocies = (evt.fournisseursAssocies ?? []) as (number | string)[]
      const filtered = currentAssocies
        .filter((id) => Number(id) !== Number(fiche.id))
        .map(Number)
      await payload.update({
        collection: 'evenements',
        id: evt.id,
        data: { fournisseursAssocies: filtered as number[] },
        overrideAccess: true,
      })
    }
    if (assocEvents.length) console.log(`  ✓ Detachee de ${assocEvents.length} evenement(s) associe(s)`)

    await payload.delete({ collection: 'fournisseurs', id: fiche.id, overrideAccess: true })
    console.log(`  ✓ Fiche ${fiche.id} supprimee`)
  }

  try {
    await payload.create({
      collection: 'audit-logs',
      data: {
        type: 'account_deleted',
        userIdHash: hashUserId(user.id),
        metadata: {
          plan: user.plan ?? null,
          role: user.role ?? null,
          fichesDeleted: fiches.length,
          hadGroupe: !!groupeId,
          hadSubscription: !!user.stripeSubscriptionId,
          deletedBy: 'admin-script',
        },
      },
      overrideAccess: true,
    })
  } catch (err) {
    console.log(`  ⚠️  Audit log echoue (non-bloquant): ${(err as Error).message}`)
  }

  try {
    await sendEmail({
      payload,
      kind: 'account-deleted',
      to: user.email,
      subject: 'Panorama Pub — Confirmation de suppression de votre compte',
      html: accountDeletedEmail(user.nomSociete),
      userId: user.id,
    })
  } catch (err) {
    console.log(`  ⚠️  Email de confirmation echoue: ${(err as Error).message}`)
  }

  await payload.delete({ collection: 'users', id: user.id, overrideAccess: true })
  console.log(`  ✓ User ${email} supprime`)

  if (user.stripeCustomerId) {
    try {
      await stripe.customers.del(user.stripeCustomerId as string)
      console.log(`  ✓ Stripe customer ${user.stripeCustomerId} supprime`)
    } catch (err) {
      console.log(`  ⚠️  Stripe customer delete echoue: ${(err as Error).message}`)
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const autoYes = args.includes('--yes')
  const emails = args.filter((a) => !a.startsWith('--'))

  if (emails.length === 0) {
    console.error('Usage: pnpm tsx src/scripts/delete-user-full.ts [--dry-run] [--yes] <email1> [email2...]')
    process.exit(1)
  }

  const payload = await getPayload({ config })

  console.log(`\n=== Plan de suppression (${dryRun ? 'DRY-RUN' : 'REEL'}) ===\n`)
  for (const email of emails) {
    const { user, plan } = await preview(payload, email)
    if (!user) {
      console.log(`- ${email}: INTROUVABLE`)
      continue
    }
    console.log(plan.join('\n'))
    console.log('')
  }

  if (dryRun) {
    console.log('[DRY-RUN] Aucune modification appliquee.')
    process.exit(0)
  }

  if (!autoYes) {
    const confirm = await ask(`\nConfirmer la suppression DEFINITIVE de ${emails.length} compte(s) ? (tapez "SUPPRIMER" pour valider) `)
    if (confirm.trim() !== 'SUPPRIMER') {
      console.log('Annulation.')
      process.exit(0)
    }
  }

  console.log('\n=== Execution ===\n')
  for (const email of emails) {
    console.log(`> ${email}`)
    try {
      await executeDelete(payload, email)
    } catch (err) {
      console.error(`  ❌ Erreur: ${(err as Error).message}`)
    }
    console.log('')
  }

  console.log('Termine.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

/**
 * GET /api/cron/expiration-plus — expiration Réseauteur Plus + packs de licences (ADR-0013 P2.A).
 *
 * Quotidien (vercel.json). Deux passes :
 *   1. PACKS expirés (expireAt < now, statut ≠ expire) → statut 'expire' + désactivation
 *      EN CASCADE des Plus issus du pack (plusSource='licence') — gate P0 D4.
 *   2. USERS Plus expirés (plusActif && plusExpireAt < now) → plusActif=false.
 *      Filet de sécurité : le webhook Stripe gère normalement les abonnements ;
 *      cette passe rattrape les licences et les webhooks manqués.
 *
 * Auth : Authorization: Bearer CRON_SECRET (Vercel Cron).
 */
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { desactiverPlusDuPack } from '@/lib/licences'
import { sendEmail } from '@/lib/email-sender'
import { plusExpireEmail } from '@/lib/emails'

export const maxDuration = 300

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const payload = await getPayload({ config })
  const nowIso = new Date().toISOString()
  let packsExpires = 0
  let plusDesactives = 0

  // ── 1. Packs expirés → statut 'expire' + cascade sur les Plus 'licence'
  const { docs: packs } = await payload.find({
    collection: 'licences-packs',
    where: {
      and: [
        { statut: { not_equals: 'expire' } },
        { expireAt: { less_than: nowIso } },
      ],
    },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  for (const pack of packs) {
    try {
      await payload.update({
        collection: 'licences-packs',
        id: pack.id,
        data: { statut: 'expire' },
        overrideAccess: true,
      })
      const n = await desactiverPlusDuPack(payload, pack.id)
      plusDesactives += n
      packsExpires++
      console.log(`[cron expiration-plus] pack #${pack.id} expiré — ${n} Plus désactivé(s)`)
    } catch (err) {
      console.error(`[cron expiration-plus] pack #${pack.id} failed:`, err)
    }
  }

  // ── 2. Users Plus expirés (toutes sources — filet de sécurité webhook)
  const { docs: usersExpires } = await payload.find({
    collection: 'users',
    where: {
      and: [
        { plusActif: { equals: true } },
        { plusExpireAt: { less_than: nowIso } },
      ],
    },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  for (const u of usersExpires) {
    try {
      await payload.update({
        collection: 'users',
        id: u.id,
        data: { plusActif: false },
        overrideAccess: true,
        context: { webhookTrusted: true },
      })
      plusDesactives++
      try {
        await sendEmail({
          payload,
          kind: 'plus-expire',
          to: u.email as string,
          subject: 'RÉSEAUTEURS — Votre accès Réseauteur Plus a pris fin',
          html: plusExpireEmail((u.nomSociete as string) ?? ''),
          userId: u.id,
        })
      } catch { /* email non bloquant */ }
    } catch (err) {
      console.error(`[cron expiration-plus] user #${u.id} failed:`, err)
    }
  }

  return NextResponse.json({ ok: true, packsExpires, plusDesactives })
}

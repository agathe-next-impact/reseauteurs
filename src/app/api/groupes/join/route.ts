import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod/v4'
import { rateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/client-ip'
import { recalculerEtAppliquerPalier } from '@/lib/groupes'
import { groupeJoinedOwnerEmail } from '@/lib/emails'
import { sendEmail } from '@/lib/email-sender'
import { hashUserId } from '@/lib/audit'

const bodySchema = z.object({
  code: z.string().min(1).max(20),
})

export async function POST(request: Request) {
  // Rate limit: 10 req/min/IP
  const ip = getClientIp(request.headers)
  const { success: allowed } = rateLimit(`groupes-join:${ip}`, { limit: 10, windowMs: 60_000 })
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de requetes' }, { status: 429 })
  }

  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parametres invalides' }, { status: 400 })
  }

  // Read fresh user from DB
  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
  })

  // Must not already belong to a groupe
  if (freshUser.groupe) {
    return NextResponse.json(
      { error: 'Vous appartenez deja a un groupe' },
      { status: 400 },
    )
  }

  // Fonctionnalite groupes/affiliation DORMANTE (ADR-0009) : aucun point
  // d'entree UI expose au grand public, conservee pour l'exploitation/support
  // admin (ADR-0009 §5). L'ancien gate "plan Infinite" n'existe plus dans le
  // modele 3-entites (ADR-0011) et rendait la route structurellement
  // inaccessible (403 pour tout le monde, y compris l'admin) : on la
  // realigne sur un gate admin, coherent avec l'intention "reservee a
  // l'exploitation" sans reactiver la feature au public.
  if (freshUser.role !== 'admin') {
    return NextResponse.json(
      { error: 'L\'adhesion a un groupe est reservee a l\'administration' },
      { status: 403 },
    )
  }

  // Find the groupe by code (case-insensitive) AND non soft-delete
  const codeNormalized = parsed.data.code.trim().toUpperCase()
  const { docs } = await payload.find({
    collection: 'groupes',
    where: {
      and: [
        { code: { equals: codeNormalized } },
        { deletedAt: { exists: false } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })

  const groupe = docs[0]
  if (!groupe) {
    return NextResponse.json({ error: 'Code de groupe invalide' }, { status: 404 })
  }

  try {
    // Attach the user to the groupe
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { groupe: groupe.id },
      overrideAccess: true,
    })

    // Recalculate the tier (and apply Stripe coupons if it changed)
    await recalculerEtAppliquerPalier(payload, groupe.id)

    // Return the up-to-date groupe (palierActuel may have just been bumped)
    const refreshed = await payload.findByID({
      collection: 'groupes',
      id: groupe.id,
      overrideAccess: true,
    })

    // Audit-log RGPD : trace persistante de l'adhesion (palier avant/apres).
    try {
      await payload.create({
        collection: 'audit-logs',
        data: {
          type: 'groupe_joined',
          userIdHash: hashUserId(user.id),
          metadata: {
            groupeId: String(groupe.id),
            groupeCode: groupe.code,
            palierAfter: String(refreshed.palierActuel ?? '0'),
          },
        },
        overrideAccess: true,
      })
    } catch (err) {
      console.error('[groupes/join] audit-log groupe_joined failed:', err)
    }

    // Notify the owner (skip if the joiner *is* the owner — shouldn't happen
    // in practice since you can't join your own group, but keeps this safe).
    const ownerRel = refreshed.owner
    const ownerId =
      typeof ownerRel === 'object' && ownerRel !== null
        ? (ownerRel as { id: number | string }).id
        : (ownerRel as number | string | null | undefined)
    if (ownerId != null && Number(ownerId) !== Number(user.id)) {
      try {
        const owner = await payload.findByID({
          collection: 'users',
          id: ownerId,
          overrideAccess: true,
        })
        await sendEmail({
          payload,
          kind: 'group-joined-owner',
          to: owner.email,
          subject: `Panorama Pub — ${freshUser.nomSociete} a rejoint votre groupe`,
          html: groupeJoinedOwnerEmail(
            owner.nomSociete,
            freshUser.nomSociete,
            String(refreshed.palierActuel ?? '0'),
          ),
          userId: owner.id,
        })
      } catch (err) {
        console.error('[groupes/join] Failed to notify owner:', err)
      }
    }

    return NextResponse.json({
      id: refreshed.id,
      nom: refreshed.nom,
      palierActuel: refreshed.palierActuel,
    })
  } catch (err) {
    console.error('[groupes/join] Erreur:', err)
    return NextResponse.json(
      { error: 'Erreur lors de l\'adhesion au groupe' },
      { status: 500 },
    )
  }
}

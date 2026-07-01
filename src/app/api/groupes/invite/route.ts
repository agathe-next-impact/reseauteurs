import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod/v4'
import { rateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/client-ip'
import { groupInvitationEmail } from '@/lib/emails'
import { sendEmail } from '@/lib/email-sender'

const bodySchema = z.object({
  emails: z.array(z.email()).min(1).max(10),
})

export async function POST(request: Request) {
  const ip = getClientIp(request.headers)
  const { success: allowedIp } = rateLimit(`groupes-invite:${ip}`, { limit: 10, windowMs: 60_000 })
  if (!allowedIp) {
    return NextResponse.json({ error: 'Trop de requetes' }, { status: 429 })
  }

  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  // 2e barriere par user.id : l'IP rate-limit ci-dessus tombe pour un user qui
  // tourne sur plusieurs reseaux (mobile + wifi + VPN). 50 invitations / 24h
  // par compte couvre largement l'usage legitime (groupe de 10 membres x 10
  // invites = 100, mais espacees) et empeche un compromis-de-compte de
  // spammer Resend depuis n'importe ou.
  const { success: allowedUser } = rateLimit(`groupes-invite-user:${user.id}`, {
    limit: 50,
    windowMs: 24 * 60 * 60 * 1000,
  })
  if (!allowedUser) {
    return NextResponse.json(
      { error: 'Limite quotidienne d\'invitations atteinte. Reessayez demain.' },
      { status: 429 },
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parametres invalides' }, { status: 400 })
  }

  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
  })

  const groupeRel = freshUser.groupe
  const groupeId =
    typeof groupeRel === 'object' && groupeRel !== null
      ? (groupeRel as { id: number | string }).id
      : (groupeRel as number | string | null | undefined)

  if (!groupeId) {
    return NextResponse.json(
      { error: 'Vous n\'appartenez a aucun groupe' },
      { status: 400 },
    )
  }

  const groupe = await payload.findByID({
    collection: 'groupes',
    id: groupeId,
    overrideAccess: true,
  })

  // Deduplicate + normalize emails, skip self
  const unique = Array.from(
    new Set(parsed.data.emails.map((e) => e.trim().toLowerCase())),
  ).filter((e) => e !== freshUser.email.toLowerCase())

  let sent = 0
  // Counter only — we deliberately don't expose which specific emails were
  // skipped to avoid leaking which addresses are already members of the group
  // (account-enumeration via the invite endpoint).
  let skipped = 0
  const failed: string[] = []

  for (const email of unique) {
    // Look the email up to (a) skip silently if already in this group and
    // (b) tailor the email CTA (login vs signup). We use overrideAccess so
    // the lookup works even though the inviter has no read access on other
    // users — we never echo back the result.
    const { docs: matchingUsers } = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const existingUser = matchingUsers[0] as
      | { groupe?: number | string | { id: number | string } | null }
      | undefined

    if (existingUser) {
      const existingGroupeId =
        typeof existingUser.groupe === 'object' && existingUser.groupe !== null
          ? (existingUser.groupe as { id: number | string }).id
          : (existingUser.groupe as number | string | null | undefined)
      if (existingGroupeId != null && Number(existingGroupeId) === Number(groupeId)) {
        skipped++
        continue
      }
    }

    const result = await sendEmail({
      payload,
      kind: 'group-invitation',
      to: email,
      subject: `${freshUser.nomSociete} vous invite sur Panorama Pub`,
      html: groupInvitationEmail(
        freshUser.nomSociete,
        groupe.nom,
        groupe.code,
        existingUser != null,
      ),
    })
    if (result.sent) sent++
    else failed.push(email)
  }

  return NextResponse.json({ sent, skipped, failed })
}

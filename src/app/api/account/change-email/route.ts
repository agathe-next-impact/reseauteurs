import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod/v4'
import { rateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/client-ip'
import { SITE_URL } from '@/lib/site'
import { confirmEmailChangeEmail } from '@/lib/emails'
import { sendEmail } from '@/lib/email-sender'

const bodySchema = z.object({
  newEmail: z.string().email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1),
})

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000

function hashToken(raw: string): string {
  const secret = process.env.PAYLOAD_SECRET || ''
  return crypto.createHash('sha256').update(`${raw}:${secret}`).digest('hex')
}

/**
 * POST /api/account/change-email
 *
 * Initie un changement d'email (flow double-confirmation). Verifie le mot de
 * passe actuel puis envoie un lien de confirmation a la NOUVELLE adresse. Le
 * changement n'est applique qu'apres clic sur le lien (confirm-email-change).
 *
 * Le hook afterChange de Users.ts envoie deja une notif finale aux deux
 * adresses quand email est effectivement modifie — rien a faire ici.
 */
export async function POST(request: Request) {
  const hdrs = await headers()
  const ip = getClientIp(hdrs)
  const { success: allowed } = rateLimit(`change-email:${ip}`, { limit: 5, windowMs: 60_000 })
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de requetes' }, { status: 429 })
  }

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
  const { newEmail, password } = parsed.data

  const currentEmail = (user.email as string).toLowerCase()
  if (newEmail === currentEmail) {
    return NextResponse.json(
      { error: 'La nouvelle adresse doit etre differente de l\'actuelle' },
      { status: 400 },
    )
  }

  // Verif mot de passe actuel — reutilise le login natif Payload (bcrypt + lockout).
  // On ne persiste pas le resultat, c'est juste un check credential.
  try {
    await payload.login({
      collection: 'users',
      data: { email: user.email, password },
    })
  } catch {
    return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 })
  }

  // Unicite : refuser si un autre user occupe deja cette adresse.
  const { docs: conflicts } = await payload.find({
    collection: 'users',
    where: { email: { equals: newEmail } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (conflicts.length > 0) {
    return NextResponse.json({ error: 'Cet email est deja utilise' }, { status: 409 })
  }

  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()

  try {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        pendingEmail: newEmail,
        pendingEmailTokenHash: tokenHash,
        pendingEmailExpiresAt: expiresAt,
      },
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[account/change-email] failed to persist pending state:', err)
    return NextResponse.json({ error: 'Erreur lors de la mise a jour' }, { status: 500 })
  }

  const confirmUrl = `${SITE_URL}/api/account/confirm-email-change?token=${rawToken}`

  // Envoi a la nouvelle adresse. skipBlacklistCheck=true : on veut forcer la
  // confirmation meme si l'adresse a ete mise en blacklist pour un autre compte
  // (cas rare mais possible : un ex-utilisateur qui change d'email vers une
  // adresse qu'il possede desormais).
  await sendEmail({
    payload,
    kind: 'email-change-confirm',
    to: newEmail,
    subject: 'RÉSEAUTEURS — Confirmez votre nouvelle adresse email',
    html: confirmEmailChangeEmail(user.nomSociete ?? '', confirmUrl),
    userId: user.id,
    skipBlacklistCheck: true,
  })

  return NextResponse.json({ ok: true })
}

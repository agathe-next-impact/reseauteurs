import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CONTACT_EMAIL, SITE_URL } from '@/lib/site'
import { userRegisteredAdminEmail, verifyEmailTemplate } from '@/lib/emails'
import { sendEmail } from '@/lib/email-sender'
import { rateLimit } from '@/lib/rate-limit'

/**
 * POST /api/auth/register
 *
 * Custom registration endpoint that creates the user even if the
 * verification email fails (Resend down, invalid key, etc.).
 * The user can request a new verification email later.
 */
export async function POST(request: Request) {
  // Anti-abus : endpoint non authentifié qui crée des comptes ET envoie des emails.
  // Rate-limit par IP (défense en profondeur — cf. lib/rate-limit sur les limites serverless).
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const { success: allowed } = rateLimit(`register:${ip}`, { limit: 5, windowMs: 3_600_000 })
  if (!allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives d\'inscription. Réessayez plus tard.' },
      { status: 429 },
    )
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  const { email, password, nomSociete, ville, type, cguAccepted, optInMarketing, pendingGroupeCode } =
    body as {
      email?: string
      password?: string
      nomSociete?: string
      ville?: string
      // 'reseauteur' = compte réseauteur gratuit (ADR-0011 — défaut).
      // 'organisateur' = compte organisateur (réseau B2B).
      // 'partenaire' = compte annonceur (fiche partenaire + abonnement).
      // 'fournisseur' = valeur legacy PanoramaPub ; redirigée vers 'reseauteur'.
      type?: 'reseauteur' | 'organisateur' | 'partenaire' | 'fournisseur'
      cguAccepted?: boolean
      optInMarketing?: boolean
      pendingGroupeCode?: string
    }

  if (!email || !password || !nomSociete || !ville) {
    return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
  }

  if (cguAccepted !== true) {
    return NextResponse.json(
      { error: 'Vous devez accepter les CGU et la politique de confidentialite.' },
      { status: 400 },
    )
  }

  // Rôles ouverts à l'inscription : reseauteur (défaut, gratuit), organisateur, partenaire.
  // 'fournisseur' est un alias legacy redirigé vers 'reseauteur'.
  const role: 'reseauteur' | 'organisateur' | 'partenaire' =
    type === 'organisateur'
      ? 'organisateur'
      : type === 'partenaire'
        ? 'partenaire'
        : 'reseauteur'

  if (password.length < 8) {
    return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caracteres.' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  // Check if user already exists
  const { totalDocs } = await payload.count({
    collection: 'users',
    where: { email: { equals: email.trim().toLowerCase() } },
    overrideAccess: true,
  })
  if (totalDocs > 0) {
    return NextResponse.json({ error: 'Un compte avec cet email existe deja.' }, { status: 409 })
  }

  try {
    // Create user WITHOUT sending verification email (avoids blocking on email failure).
    const nowIso = new Date().toISOString()
    // Persistance du code de groupe : si l'user vient d'un lien d'invitation
    // mais s'inscrit forcement en gratuit (verif email obligatoire avant
    // checkout), on conserve le code pour l'appliquer automatiquement au
    // passage en Infinite (webhook checkout.session.completed). Sans ca,
    // l'user devait re-cliquer le lien email apres paiement.
    const normalizedPendingCode = (pendingGroupeCode ?? '').trim().slice(0, 20).toUpperCase()
    const user = await payload.create({
      collection: 'users',
      data: {
        email: email.trim().toLowerCase(),
        password,
        nomSociete: nomSociete.trim(),
        ville: ville.trim(),
        role,
        // plan est dormant (ADR-0011 : pas de palier payant réseauteur)
        cguAcceptedAt: nowIso,
        confidentialiteAcceptedAt: nowIso,
        optInMarketing: optInMarketing === true,
        ...(optInMarketing === true ? { optInMarketingAt: nowIso } : {}),
        ...(normalizedPendingCode ? { pendingGroupeCode: normalizedPendingCode } : {}),
      },
      context: { webhookTrusted: true },
      disableVerificationEmail: true,
      overrideAccess: true,
    })

    // Send verification email separately — non-blocking
    let emailSent = false
    try {
      const freshUser = await payload.findByID({
        collection: 'users',
        id: user.id,
        overrideAccess: true,
        showHiddenFields: true,
      })
      const token = (freshUser as unknown as { _verificationToken?: string })._verificationToken
      if (token) {
        const url = `${SITE_URL}/verify?token=${token}`
        const result = await sendEmail({
          payload,
          kind: 'verify-email',
          to: user.email,
          subject: 'RÉSEAUTEURS — Verifiez votre email',
          html: verifyEmailTemplate(nomSociete.trim(), url),
          userId: user.id,
        })
        emailSent = result.sent
      }
    } catch (emailErr) {
      console.error('[auth/register] Verification email failed (non-blocking):', emailErr)
    }

    // Notify admin separately - non-blocking.
    try {
      const result = await sendEmail({
        payload,
        kind: 'admin-alert',
        to: CONTACT_EMAIL,
        subject: 'RÉSEAUTEURS - Nouvelle inscription',
        html: userRegisteredAdminEmail({
          userId: user.id,
          email: user.email,
          role,
          nomSociete: nomSociete.trim(),
          ville: ville.trim(),
          optInMarketing: optInMarketing === true,
          pendingGroupeCode: normalizedPendingCode || null,
        }),
        userId: user.id,
        skipBlacklistCheck: true,
      })
      if (!result.sent) {
        console.warn('[auth/register] Admin registration email not sent:', result.skipped ?? result.error)
      }
    } catch (adminEmailErr) {
      console.error('[auth/register] Admin registration email failed (non-blocking):', adminEmailErr)
    }

    return NextResponse.json({
      message: 'Compte cree avec succes.',
      emailSent,
      user: { id: user.id, email: user.email },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur lors de l\'inscription'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

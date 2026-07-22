import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { CONTACT_EMAIL, SITE_URL } from '@/lib/site'
import { userRegisteredAdminEmail, verifyEmailTemplate } from '@/lib/emails'
import { sendEmail } from '@/lib/email-sender'
import { rateLimit } from '@/lib/rate-limit'
import { chargerReseauRevendicable } from '@/lib/revendication-reseau'

/**
 * Jeton de vérification de l'utilisateur, ou un jeton neuf si la colonne est
 * vide (compte importé, seed, flux interrompu…). Payload n'expose pas de
 * régénération native : `_verificationToken` est stocké en clair et comparé tel
 * quel par POST /api/users/verify/:token — le poser nous-mêmes est équivalent.
 * `webhookTrusted` évite le strip des champs protégés du hook beforeChange.
 */
async function ensureVerificationToken(
  payload: Payload,
  user: { id: number | string; _verificationToken?: string | null },
): Promise<string> {
  const current = user._verificationToken
  if (typeof current === 'string' && current.length > 0) return current

  const token = randomBytes(20).toString('hex')
  await payload.update({
    collection: 'users',
    id: user.id,
    data: { _verificationToken: token },
    context: { webhookTrusted: true },
    overrideAccess: true,
  })
  return token
}

/** Envoi (ou renvoi) du lien de vérification — jamais bloquant pour l'appelant. */
async function sendVerificationEmail(
  payload: Payload,
  user: { id: number | string; email: string; nomSociete?: string | null },
  token: string,
): Promise<boolean> {
  try {
    const result = await sendEmail({
      payload,
      kind: 'verify-email',
      to: user.email,
      subject: 'RÉSEAUTEURS — Verifiez votre email',
      html: verifyEmailTemplate(user.nomSociete ?? '', `${SITE_URL}/verify?token=${token}`),
      userId: user.id,
    })
    return result.sent
  } catch (err) {
    console.error('[auth/register] Verification email failed (non-blocking):', err)
    return false
  }
}

/**
 * POST /api/auth/register
 *
 * Custom registration endpoint that creates the user even if the
 * verification email fails (Resend down, invalid key, etc.).
 * Si l'email correspond à un compte existant **non vérifié**, on renvoie le lien
 * de vérification au lieu de renvoyer 409 : sans cela, un utilisateur dont
 * l'email n'est jamais arrivé restait bloqué définitivement (409 à l'inscription,
 * login refusé tant que non vérifié).
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

  const {
    email,
    password,
    nomSociete,
    ville,
    type,
    cguAccepted,
    optInMarketing,
    pendingGroupeCode,
    claimReseauId,
  } = body as {
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
      /**
       * Revendication d'une fiche de tête de réseau orpheline (annuaire seedé).
       * Force le rôle `organisateur` et fait linker la fiche au nouveau compte par
       * le hook afterChange de Users (claim atomique via `req.context.claimReseauId`).
       */
      claimReseauId?: number | string
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

  // Revendication d'une fiche orpheline : normalisée AVANT le calcul du rôle —
  // revendiquer une tête de réseau implique nécessairement un compte organisateur.
  const claimIdRaw = claimReseauId != null ? Number(claimReseauId) : NaN
  const claimId = Number.isInteger(claimIdRaw) && claimIdRaw > 0 ? claimIdRaw : null

  // Rôles ouverts à l'inscription : reseauteur (défaut, gratuit), organisateur, partenaire.
  // 'fournisseur' est un alias legacy redirigé vers 'reseauteur'.
  const role: 'reseauteur' | 'organisateur' | 'partenaire' =
    claimId != null || type === 'organisateur'
      ? 'organisateur'
      : type === 'partenaire'
        ? 'partenaire'
        : 'reseauteur'

  if (password.length < 8) {
    return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caracteres.' }, { status: 400 })
  }

  const payload = await getPayload({ config })
  const normalizedEmail = email.trim().toLowerCase()

  // Revendication : on vérifie que la fiche est toujours revendicable AVANT de créer
  // le compte. Le hook de claim est silencieux en cas d'échec (il se contente de
  // créer un national neuf) — sans ce contrôle, l'utilisateur croirait avoir
  // revendiqué la fiche alors qu'il aurait juste un réseau vide de plus.
  if (claimId != null) {
    const fiche = await chargerReseauRevendicable(payload, claimId)
    if (!fiche.ok) {
      return NextResponse.json({ error: fiche.error }, { status: 400 })
    }
  }

  // Compte existant : deux situations très différentes.
  //  • connexion possible → 409, il faut se connecter (ou réinitialiser le mot de passe) ;
  //  • connexion bloquée faute de vérification → le compte est créé AVANT l'envoi de
  //    l'email (non bloquant), donc un premier essai a pu laisser un compte orphelin
  //    sans email reçu. On renvoie le lien. Aucune donnée du compte existant n'est
  //    touchée : mot de passe, rôle et nom saisis ici sont ignorés (pas de prise de
  //    contrôle). Le test porte sur `_verified === false` — même sémantique exacte que
  //    le gate de Payload (auth/operations/login) : un `_verified` null (ligne legacy,
  //    colonne ajoutée par migration) autorise le login et ne doit donc PAS être
  //    traité comme un compte à vérifier.
  const { docs: existingDocs } = await payload.find({
    collection: 'users',
    where: { email: { equals: normalizedEmail } },
    limit: 1,
    depth: 0,
    showHiddenFields: true,
    overrideAccess: true,
  })
  const existing = existingDocs[0]

  if (existing) {
    if (existing._verified !== false) {
      return NextResponse.json(
        {
          error:
            'Un compte avec cet email existe deja. Connectez-vous, ou réinitialisez votre mot de passe.',
          code: 'account_exists',
        },
        { status: 409 },
      )
    }

    // Plafond par adresse en plus du plafond par IP : empêche d'inonder la boîte
    // d'un tiers en rejouant l'inscription avec son email.
    const { success: resendAllowed } = rateLimit(`register-resend:${normalizedEmail}`, {
      limit: 3,
      windowMs: 3_600_000,
    })
    if (!resendAllowed) {
      return NextResponse.json(
        {
          error:
            "L'email de vérification a déjà été renvoyé plusieurs fois. Réessayez dans une heure.",
        },
        { status: 429 },
      )
    }

    let emailSent = false
    try {
      const token = await ensureVerificationToken(payload, existing)
      emailSent = await sendVerificationEmail(payload, existing, token)
    } catch (err) {
      console.error('[auth/register] Resend of verification email failed:', err)
    }

    return NextResponse.json({
      message: 'Compte déjà existant, non vérifié — lien de vérification renvoyé.',
      alreadyRegistered: true,
      emailSent,
      user: { id: existing.id, email: existing.email },
    })
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
        email: normalizedEmail,
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
        ...(claimId != null ? { pendingClaimReseauId: claimId } : {}),
      },
      // Revendication : elle n'est PAS appliquée ici (une adresse jetable suffirait à
      // immobiliser une fiche de l'annuaire). `skipAutoCreateReseau` évite de créer un
      // réseau vide en attendant ; `pendingClaimReseauId` (posé ci-dessus) est consommé
      // à la vérification de l'email — POST /api/auth/verify → resoudreClaimEnAttente,
      // qui crée le réseau de repli si la fiche a été prise entre-temps.
      context: {
        webhookTrusted: true,
        ...(claimId != null ? { skipAutoCreateReseau: true } : {}),
      },
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
      const token = await ensureVerificationToken(payload, freshUser)
      emailSent = await sendVerificationEmail(
        payload,
        { id: user.id, email: user.email, nomSociete: nomSociete.trim() },
        token,
      )
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

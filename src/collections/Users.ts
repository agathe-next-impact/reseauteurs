import type { CollectionConfig } from 'payload'
import { isAdmin } from './access'
import { SITE_URL } from '../lib/site'
import { verifyEmailTemplate, forgotPasswordEmail } from '../lib/emails'

const MAX_LOGIN_ATTEMPTS = 5
const LOCK_MINUTES = 10

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  access: {
    // Création réservée à l'admin : l'inscription publique passe par la route custom
    // /api/auth/register (overrideAccess) — jamais par l'API REST générique. Ferme
    // l'escalade de privilège anonyme via POST /api/users (C1). Le 1er admin reste
    // créable (cas 0 utilisateur, géré nativement par Payload).
    create: isAdmin,
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return { id: { equals: user.id } }
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return { id: { equals: user.id } }
    },
    delete: ({ req: { user } }) => {
      return user?.role === 'admin' || false
    },
  },
  auth: {
    tokenExpiration: 2592000, // 30 jours
    maxLoginAttempts: MAX_LOGIN_ATTEMPTS,
    lockTime: LOCK_MINUTES * 60 * 1000, // 10 min
    verify: {
      generateEmailHTML: ({ token, user }) => {
        const url = `${SITE_URL}/verify?token=${token}`
        const nomSociete = (user as { nomSociete?: string }).nomSociete || ''
        return verifyEmailTemplate(nomSociete, url)
      },
      generateEmailSubject: () => 'RÉSEAUTEURS — Vérifiez votre email',
    },
    forgotPassword: {
      generateEmailHTML: (args) => {
        const token = args?.token
        const url = `${SITE_URL}/reset-password?token=${token}`
        return forgotPasswordEmail(url)
      },
      generateEmailSubject: () => 'RÉSEAUTEURS — Réinitialisation du mot de passe',
    },
  },
  hooks: {
    beforeChange: [
      ({ data, operation, originalDoc, req }) => {
        // Track optInMarketing transitions to persist consent/revocation dates
        if (operation === 'update' && typeof data.optInMarketing === 'boolean') {
          const previous = originalDoc?.optInMarketing ?? false
          if (data.optInMarketing === true && previous === false) {
            data.optInMarketingAt = new Date().toISOString()
          } else if (data.optInMarketing === false && previous === true) {
            data.optOutMarketingAt = new Date().toISOString()
          }
        }

        // Flag password change for the afterChange security email. Payload
        // strips `password` from afterChange's doc, so we relay via req.context.
        if (operation === 'update' && typeof data.password === 'string' && data.password.length > 0) {
          ;(req.context as Record<string, unknown>).passwordChangedForUser = true
        }

        // Skip protection for trusted system calls. Deux voies acceptees :
        //   - flag explicite req.context.webhookTrusted (webhook Stripe, cron,
        //     scripts migration). Prefere depuis A5 — defensif meme si un
        //     middleware futur injecte un req.user fantome.
        //   - absence de req.user (appels Payload Local API sans contexte user,
        //     conserve pour retrocompatibilite).
        const ctx = req.context as Record<string, unknown> | undefined
        if (ctx?.webhookTrusted === true) return data
        if (!req.user) return data

        if (operation === 'create' && req.user.role !== 'admin') {
          // Rôles valides au signup non-admin : reseauteur (défaut) ou organisateur
          if (data.role !== 'organisateur' && data.role !== 'reseauteur') {
            data.role = 'reseauteur'
          }
          // Le champ plan est dormant (ADR-0011 : pas de freemium réseauteur)
          // accounts-and-billing supprimera ce champ proprement en J2.A
        }
        if (operation === 'update' && req.user.role !== 'admin') {
          delete data.role
          delete data.plan
          delete data.stripeCustomerId
          delete data.stripeSubscriptionId
          delete data.planExpiresAt
          delete data.billingAddress
          delete data.vatNumber
          delete data.raisonSocialeFacturation
          delete data.cguAcceptedAt
          delete data.confidentialiteAcceptedAt
          delete data.optInMarketingAt
          delete data.optOutMarketingAt
          delete data.emailBlacklisted
          delete data.emailBlacklistedReason
          delete data.emailBlacklistedAt
          delete data.excludeFromOnboarding
          // Le flow "change-email" (POST /api/account/change-email) passe via
          // overrideAccess. Un update non-admin direct ne doit jamais pouvoir
          // ecrire l'etat "pending" (sinon il court-circuite la verification
          // du mot de passe actuel et l'envoi du lien de confirmation).
          delete data.pendingEmail
          delete data.pendingEmailTokenHash
          delete data.pendingEmailExpiresAt
        }
        return data
      },
    ],
    beforeValidate: [
      ({ data, operation }) => {
        if ((operation === 'create' || operation === 'update') && data?.password) {
          if (data.password.length < 8) {
            throw new Error('Le mot de passe doit contenir au moins 8 caracteres.')
          }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        // === GROUPE PALIER RESYNC ===
        // Filet de securite : les routes API metier appellent deja
        // recalculerEtAppliquerPalier apres les transitions plan/groupe. Ce
        // hook ne sert qu'aux modifications hors-API : edition admin via
        // /admin Payload, scripts de migration, ou tout chemin futur qui
        // toucherait user.plan ou user.groupe sans passer par les routes.
        // Sans ce filet, le palier groupe DB pouvait diverger des coupons
        // Stripe pendant un cycle complet jusqu'au cron retry-groupe-sync.
        // Skippe les appels webhookTrusted (deja gere) et les operations
        // create (rien a recalculer pour un user qui vient d'etre cree).
        if (operation === 'update') {
          const ctx = req.context as Record<string, unknown> | undefined
          const isWebhookTrusted = ctx?.webhookTrusted === true
          if (!isWebhookTrusted) {
            const prevGroupeRel = previousDoc?.groupe
            const newGroupeRel = doc.groupe
            const extractId = (rel: unknown): number | string | null => {
              if (!rel) return null
              if (typeof rel === 'object' && rel !== null) {
                return (rel as { id?: number | string }).id ?? null
              }
              return rel as number | string
            }
            const prevGroupeId = extractId(prevGroupeRel)
            const newGroupeId = extractId(newGroupeRel)
            const groupeChanged = String(prevGroupeId ?? '') !== String(newGroupeId ?? '')
            const planChanged = previousDoc?.plan !== doc.plan

            if (groupeChanged || planChanged) {
              try {
                const { recalculerEtAppliquerPalier } = await import('@/lib/groupes')
                const groupeIdsToResync = new Set<number | string>()
                if (prevGroupeId != null) groupeIdsToResync.add(prevGroupeId)
                if (newGroupeId != null) groupeIdsToResync.add(newGroupeId)
                for (const gid of groupeIdsToResync) {
                  try {
                    await recalculerEtAppliquerPalier(req.payload, gid)
                  } catch (err) {
                    console.error(
                      `[Users afterChange] recalc palier failed for groupe ${gid}:`,
                      err,
                    )
                  }
                }
              } catch (err) {
                console.error('[Users afterChange] groupe resync import failed:', err)
              }
            }
          }
        }

        // === SECURITY EMAILS ===

        // (a) Password changed — flagged by beforeChange via req.context.
        if (operation === 'update' && (req.context as Record<string, unknown>).passwordChangedForUser) {
          try {
            const { passwordChangedEmail } = await import('@/lib/emails')
            const { sendEmail } = await import('@/lib/email-sender')
            await sendEmail({
              payload: req.payload,
              kind: 'password-changed',
              to: doc.email,
              subject: 'RÉSEAUTEURS — Votre mot de passe a été modifié',
              html: passwordChangedEmail(doc.nomSociete ?? '', 'mailto:contact@reseauteurs.com'),
              userId: doc.id,
              skipBlacklistCheck: true,
            })
          } catch (err) {
            console.error('[Users afterChange] Failed to send password-changed email:', err)
          }
        }

        // (b) Email address changed — notify BOTH old and new addresses.
        if (
          operation === 'update' &&
          previousDoc?.email &&
          doc.email &&
          previousDoc.email !== doc.email
        ) {
          try {
            const { emailChangedEmail } = await import('@/lib/emails')
            const { sendEmail } = await import('@/lib/email-sender')
            const html = emailChangedEmail(
              doc.nomSociete ?? '',
              previousDoc.email,
              doc.email,
              'mailto:contact@reseauteurs.com',
            )
            const subject = 'RÉSEAUTEURS — Votre adresse email a été modifiée'
            // Old inbox first (security: the legitimate owner is likely there if hijacked).
            await sendEmail({
              payload: req.payload,
              kind: 'email-changed',
              to: previousDoc.email,
              subject,
              html,
              userId: doc.id,
              skipBlacklistCheck: true,
            })
            await sendEmail({
              payload: req.payload,
              kind: 'email-changed',
              to: doc.email,
              subject,
              html,
              userId: doc.id,
              skipBlacklistCheck: true,
            })
          } catch (err) {
            console.error('[Users afterChange] Failed to send email-changed email:', err)
          }
        }

        // (c) Account locked — loginAttempts crossed the threshold this update.
        const prevAttempts = (previousDoc as { loginAttempts?: number | null } | null)?.loginAttempts ?? 0
        const nextAttempts = (doc as { loginAttempts?: number | null }).loginAttempts ?? 0
        const lockUntil = (doc as { lockUntil?: string | null }).lockUntil
        if (
          operation === 'update' &&
          prevAttempts < MAX_LOGIN_ATTEMPTS &&
          nextAttempts >= MAX_LOGIN_ATTEMPTS &&
          lockUntil
        ) {
          try {
            const { accountLockedEmail } = await import('@/lib/emails')
            const { sendEmail } = await import('@/lib/email-sender')
            await sendEmail({
              payload: req.payload,
              kind: 'account-locked',
              to: doc.email,
              subject: 'RÉSEAUTEURS — Votre compte a été temporairement verrouillé',
              html: accountLockedEmail(
                doc.nomSociete ?? '',
                LOCK_MINUTES,
                `${SITE_URL}/mot-de-passe-oublie`,
              ),
              userId: doc.id,
              skipBlacklistCheck: true,
            })
          } catch (err) {
            console.error('[Users afterChange] Failed to send account-locked email:', err)
          }
        }

        // === ONBOARDING EMAILS ===

        // Welcome email : triggered when a user becomes verified.
        // The field _verified goes false → true on successful email verification.
        const justVerified =
          operation === 'update' &&
          doc._verified === true &&
          previousDoc?._verified !== true &&
          doc.onboardingEmails?.welcomeSent !== true
        if (justVerified) {
          try {
            const { welcomeEmail } = await import('@/lib/emails')
            const { sendEmail } = await import('@/lib/email-sender')
            const result = await sendEmail({
              payload: req.payload,
              kind: 'welcome',
              to: doc.email,
              subject: 'Bienvenue sur RÉSEAUTEURS',
              html: welcomeEmail(doc.nomSociete ?? ''),
              userId: doc.id,
            })
            // Only flip the welcomeSent flag if the email actually went out;
            // a Resend outage shouldn't silently lose the welcome email forever.
            if (result.sent) {
              await req.payload.update({
                collection: 'users',
                id: doc.id,
                data: { onboardingEmails: { ...doc.onboardingEmails, welcomeSent: true } },
                overrideAccess: true,
                req,
              })
            }
          } catch (err) {
            console.error(
              '[Users afterChange] Failed to send welcome email (stack):',
              err instanceof Error ? err.stack : err,
            )
          }
        }

        // ── Auto-création d'un réseauteur pour les nouveaux inscrits (ADR-0011).
        // Un user reseauteur = 1 profil reseauteur (statut en_attente jusqu'à modération).
        if (operation === 'create' && doc.role === 'reseauteur') {
          try {
            const existingReseauteur = await req.payload.find({
              collection: 'reseauteurs',
              where: { user: { equals: doc.id } },
              limit: 1,
              overrideAccess: true,
            })
            if (existingReseauteur.docs.length === 0) {
              // Prénom/nom initialement vides — le réseauteur complète son profil depuis le dashboard
              await req.payload.create({
                collection: 'reseauteurs',
                data: {
                  user: doc.id,
                  prenom: '',
                  nom: doc.nomSociete || '',
                  ville: doc.ville || '',
                  evenementsParMois: 0,
                  statut: 'en_attente',
                },
                req,
                overrideAccess: true,
              })
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            console.error(`[Users afterChange] Failed to auto-create reseauteur for userId=${doc.id}: ${message}`)
          }
        }

        // ── Auto-création d'une fiche partenaire pour les nouveaux annonceurs (ADR-0011 §3).
        // Squelette 'expire' (invisible) : le partenaire complète sa fiche puis s'abonne
        // → le webhook Stripe pose statut='actif'.
        if (operation === 'create' && doc.role === 'partenaire') {
          try {
            const existing = await req.payload.find({
              collection: 'partenaires',
              where: { user: { equals: doc.id } },
              limit: 1,
              overrideAccess: true,
              req,
            })
            if (existing.docs.length === 0) {
              await req.payload.create({
                collection: 'partenaires',
                data: {
                  user: doc.id,
                  nom: doc.nomSociete || '',
                  statut: 'expire',
                },
                req,
                overrideAccess: true,
              })
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            console.error(`[Users afterChange] Failed to auto-create partenaire for userId=${doc.id}: ${message}`)
          }
        }

        // ── Auto-création d'un réseau NATIONAL pour les nouveaux organisateurs (ADR-0003 ; ADR-0012 E1.5).
        //
        // Roles concernés : 'organisateur' uniquement.
        //
        // ADR-0012 E1.5 — deux cas :
        //   1. Organisateur auto-inscrit (signup normal) → crée un réseau NIVEAU='national'.
        //   2. Organisateur délégué (assigné par l'admin à un local existant) → PAS d'auto-création.
        //      Signal : req.context.skipAutoCreateReseau = true (positionné par l'admin ou
        //      un flow qui réassigne local.user sans vouloir de national).
        //
        // Claim flow (existant, réutilisé pour la délégation) :
        //   req.context.claimReseauId → linke un réseau orphelin EXISTANT (national ou local).
        //   Si le réseau claimé est un local, on ne crée PAS de national supplémentaire.
        if (operation === 'create' && doc.role === 'organisateur') {
          try {
            const ctx = req.context as {
              claimReseauId?: number | string
              skipAutoCreateReseau?: boolean
            } | undefined

            // Cas 2 : Organisateur délégué → pas d'auto-création de national.
            if (ctx?.skipAutoCreateReseau === true) {
              // L'admin assignera local.user = doc.id séparément (back-office Payload).
              return doc
            }

            const existing = await req.payload.find({
              collection: 'reseaux',
              where: { user: { equals: doc.id } },
              limit: 1,
              overrideAccess: true,
            })
            if (existing.docs.length === 0) {
              const claimReseauId = ctx?.claimReseauId

              // Claim flow : si un réseau orphelin a été désigné, on le linke.
              // Race-safe : filtre sur user IS NULL pour éviter les doubles claims.
              let claimed = false
              if (claimReseauId != null) {
                try {
                  const { docs: updated } = await req.payload.update({
                    collection: 'reseaux',
                    where: {
                      and: [
                        { id: { equals: claimReseauId } },
                        { user: { exists: false } },
                      ],
                    },
                    data: { user: doc.id, source: 'revendique' },
                    req,
                    overrideAccess: true,
                  })
                  claimed = updated.length > 0
                  if (!claimed) {
                    console.warn(
                      `[Users afterChange] Claim failed for reseau ${claimReseauId} (already claimed or missing).`,
                    )
                  }
                } catch (claimErr) {
                  console.error('[Users afterChange] Claim failed:', claimErr)
                }
              }

              if (!claimed) {
                // Cas 1 : Organisateur auto-inscrit → crée un réseau NATIONAL (ADR-0012 E1.5).
                // niveau='national' est requis pour que canCreateNational / peutCreerLocal fonctionnent.
                // ADR-0014 : la fiche naît SUSPENDUE — elle n'est publiée que par le webhook
                // Stripe à la souscription d'un palier (fiche/starter/growth/enterprise).
                // Le cast `as any` sur data est transitoire : résolu après `payload generate:types` (E1 livrable).
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (req.payload.create as any)({
                  collection: 'reseaux',
                  data: {
                    user: doc.id,
                    nom: doc.nomSociete,
                    ville: doc.ville,
                    niveau: 'national', // ADR-0012 E1.5
                    statut: 'suspendue', // ADR-0014 : publiée par le webhook Stripe uniquement
                    source: 'revendique',
                  },
                  req,
                  overrideAccess: true,
                })
              }
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            const cause = err instanceof Error && err.cause ? String(err.cause) : null
            const stack = err instanceof Error ? err.stack : null
            console.error(
              `[Users afterChange] Failed to create reseau for userId=${doc.id}: ${message}`,
              cause ? `\nCause: ${cause}` : '',
              stack ? `\nStack: ${stack}` : '',
            )
          }
        }
      },
    ],
    afterDelete: [
      // Symetrique du resync afterChange : si l'admin hard-delete un user
      // depuis /admin (ou si un script supprime un compte), il faut recalculer
      // le palier de son groupe pour purger les coupons Stripe des membres
      // restants. Sans ce hook, supprimer un Infinite d'un groupe a 3 membres
      // laissait les 2 autres avec un coupon 5% jusqu'au prochain trigger
      // metier (changement de plan d'un membre, join/leave...). Best-effort,
      // non bloquant : la suppression du user a deja eu lieu, l'echec ici
      // n'est pas une raison de remonter une erreur a l'admin.
      async ({ doc, req }) => {
        const groupeRel = (doc as { groupe?: unknown }).groupe
        const extractId = (rel: unknown): number | string | null => {
          if (!rel) return null
          if (typeof rel === 'object' && rel !== null) {
            return (rel as { id?: number | string }).id ?? null
          }
          return rel as number | string
        }
        const groupeId = extractId(groupeRel)
        if (groupeId == null) return
        try {
          const { recalculerEtAppliquerPalier } = await import('@/lib/groupes')
          await recalculerEtAppliquerPalier(req.payload, groupeId)
        } catch (err) {
          console.error(
            `[Users afterDelete] recalc palier failed for groupe ${groupeId}:`,
            err,
          )
        }
      },
    ],
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      options: [
        // ADR-0011 : 3 rôles — reseauteur (défaut, gratuit), organisateur, admin.
        // 'fournisseur' retiré de l'enum (migration 20260628_160000_users_roles.ts convertit fournisseur → reseauteur).
        { label: 'Réseauteur (gratuit)', value: 'reseauteur' },
        { label: 'Organisateur', value: 'organisateur' },
        { label: 'Partenaire (annonceur)', value: 'partenaire' },
        { label: 'Admin', value: 'admin' },
      ],
      defaultValue: 'reseauteur',
      required: true,
      saveToJWT: true,
    },
    // Le champ 'plan' est DORMANT (ADR-0011 : la monétisation est B2B via reseaux.partenaire
    // et partenaires.statut — il n'y a pas de palier payant côté réseauteur).
    // accounts-and-billing supprimera proprement ce champ en J2.A.
    // La colonne DB est conservée pour ne pas casser le code existant pendant la transition.
    {
      name: 'plan',
      type: 'text',
      access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
        description: '[DORMANT — ADR-0011] Ancien champ de plan. Sera supprimé par accounts-and-billing (J2.A).',
      },
    },
    // ── Réseauteur Plus (ADR-0013) — statut posé par le webhook Stripe (abonnement)
    //    ou par la route d'activation de licence (P2.A). JAMAIS éditable par le client
    //    (field-access admin ; les écritures serveur passent par overrideAccess).
    //    Source unique de lecture : lib/acces-plus.ts (estPlus).
    {
      name: 'plusActif',
      type: 'checkbox',
      defaultValue: false,
      access: { create: isAdmin, update: isAdmin },
      admin: {
        position: 'sidebar',
        description: '[ADR-0013] Réseauteur Plus actif (droit de créer des événements). Posé par webhook/serveur.',
      },
    },
    {
      name: 'plusExpireAt',
      type: 'date',
      access: { create: isAdmin, update: isAdmin },
      admin: {
        position: 'sidebar',
        description: '[ADR-0013] Expiration du Plus (fin d\'abonnement ou du pack de licences).',
      },
    },
    {
      name: 'plusSource',
      type: 'text',
      access: { create: isAdmin, update: isAdmin },
      admin: {
        position: 'sidebar',
        description:
          '[ADR-0013] Origine du Plus : "abonnement" (Stripe individuel). ' +
          '"licence" = legacy (packs partenaires supprimés — ADR-0015).',
      },
    },
    {
      name: 'plusLicencePack',
      type: 'relationship',
      relationTo: 'licences-packs',
      access: { create: isAdmin, update: isAdmin },
      admin: {
        position: 'sidebar',
        description: '[Dormant — ADR-0015] Pack de licences legacy dont provient le Plus (si plusSource = licence).',
      },
    },
    {
      name: 'groupe',
      type: 'relationship',
      relationTo: 'groupes',
      saveToJWT: false,
      admin: {
        position: 'sidebar',
        description: 'Groupe d\'affiliation (optionnel)',
      },
    },
    {
      name: 'pendingGroupeCode',
      type: 'text',
      maxLength: 20,
      access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
        description: 'Code d\'invitation memorise au signup pour un user gratuit, applique automatiquement au passage en Infinite (webhook checkout.session.completed). Vide une fois consomme.',
      },
    },
    {
      // Revendication d'une fiche de tête de réseau orpheline, MISE EN ATTENTE jusqu'à
      // la vérification de l'email (décision 2026-07-22). Sans ce report, une adresse
      // jetable suffisait à s'approprier une fiche de l'annuaire national et à la
      // rendre définitivement non revendicable (le compte ne pouvant pas se connecter,
      // seul un admin pouvait la libérer). Consommée puis vidée par
      // `resoudreClaimEnAttente` — cf. POST /api/auth/verify.
      name: 'pendingClaimReseauId',
      type: 'number',
      access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
        description:
          'Fiche de réseau à rattacher à ce compte une fois son email vérifié. Vide une fois consommée.',
      },
    },
    {
      name: 'nomSociete',
      type: 'text',
      required: true,
    },
    {
      name: 'ville',
      type: 'text',
      required: true,
    },
    {
      name: 'stripeCustomerId',
      type: 'text',
      index: true,
      access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'stripeSubscriptionId',
      type: 'text',
      access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'planExpiresAt',
      type: 'date',
      access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'onboardingEmails',
      type: 'group',
      access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        description: 'Emails de la sequence d\'onboarding deja envoyes a ce compte.',
      },
      fields: [
        { name: 'welcomeSent', type: 'checkbox', defaultValue: false },
        { name: 'j3Sent', type: 'checkbox', defaultValue: false },
        { name: 'j7Sent', type: 'checkbox', defaultValue: false },
        { name: 'j14Sent', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'expirationAlerts',
      type: 'group',
      access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        description: 'Alertes d\'expiration d\'abonnement deja envoyees (J-30, J-7). Flag remis a false lors du renouvellement.',
      },
      fields: [
        { name: 'j30Sent', type: 'checkbox', defaultValue: false },
        { name: 'j7Sent', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'cguAcceptedAt',
      type: 'date',
      access: {
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
        description: 'Date d\'acceptation des CGU (horodatage du consentement).',
      },
    },
    {
      name: 'confidentialiteAcceptedAt',
      type: 'date',
      access: {
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
        description: 'Date d\'acceptation de la politique de confidentialite.',
      },
    },
    {
      name: 'optInMarketing',
      type: 'checkbox',
      defaultValue: false,
      label: 'Accepte les emails d\'information et conseils',
      admin: {
        description: 'Consentement marketing — filtre l\'envoi des emails J3/J7/J14.',
      },
    },
    {
      name: 'optInMarketingAt',
      type: 'date',
      access: {
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
        description: 'Date du consentement aux emails marketing.',
      },
    },
    {
      name: 'optOutMarketingAt',
      type: 'date',
      access: {
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
        description: 'Date de revocation du consentement marketing (preuve).',
      },
    },
    {
      name: 'billingAddress',
      type: 'json',
      access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        description: 'Adresse de facturation telle que renseignee dans Stripe Checkout.',
      },
    },
    {
      name: 'vatNumber',
      type: 'text',
      access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        description: 'Numero de TVA intracommunautaire (facturation B2B).',
      },
    },
    {
      name: 'raisonSocialeFacturation',
      type: 'text',
      access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        description: 'Raison sociale utilisee pour la facturation Stripe.',
      },
    },
    {
      name: 'emailBlacklisted',
      type: 'checkbox',
      defaultValue: false,
      access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
        description: 'Auto-positionne sur hard bounce / spam complaint (webhook Resend). Bloque tout envoi sortant vers cet email.',
      },
    },
    {
      name: 'emailBlacklistedReason',
      type: 'select',
      options: [
        { label: 'Hard bounce', value: 'hard-bounce' },
        { label: 'Spam complaint', value: 'complaint' },
      ],
      access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        description: 'Raison du blacklist (positionnee par le webhook Resend).',
      },
    },
    {
      name: 'emailBlacklistedAt',
      type: 'date',
      access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        description: 'Date du blacklist.',
      },
    },
    {
      name: 'excludeFromOnboarding',
      type: 'checkbox',
      defaultValue: false,
      access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        position: 'sidebar',
        description: 'Cocher pour exclure ce compte de la sequence d\'onboarding (welcome rattrapage + J+3/J+7/J+14). Usage : comptes de test internes, demos, ou comptes admin qui ne doivent pas recevoir le parcours nudge.',
      },
    },
    {
      name: 'pendingEmail',
      type: 'text',
      access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        description: 'Nouvelle adresse en attente de confirmation via le lien envoye par /api/account/change-email.',
      },
    },
    {
      name: 'pendingEmailTokenHash',
      type: 'text',
      access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        description: 'SHA-256(token + PAYLOAD_SECRET) du lien de confirmation — jamais le token brut.',
      },
    },
    {
      name: 'pendingEmailExpiresAt',
      type: 'date',
      access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        description: 'Expiration du lien de confirmation de changement d\'email (24h).',
      },
    },
  ],
}

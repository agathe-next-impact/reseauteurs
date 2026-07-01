import dotenv from 'dotenv'
import path from 'path'
import type { Payload } from 'payload'
import type { PaidPlan } from '../lib/stripe'
import type Stripe from 'stripe'

// Charger l'env AVANT d'importer payload/stripe : ces modules valident leurs
// vars d'env au top-level et plantent l'init du script sinon. ESM hoiste les
// `import` statiques au-dessus de tout code top-level, donc on resout
// payload, stripe et lib/* dans des `await import(...)` a l'execution.
dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

// Modules charges dynamiquement dans seed() apres dotenv.
let stripe: Stripe
let PLANS: typeof import('../lib/stripe').PLANS
let getSubscriptionPeriodEnd: typeof import('../lib/stripe').getSubscriptionPeriodEnd
let calculerPalierGroupe: typeof import('../lib/groupes').calculerPalierGroupe
let recalculerEtAppliquerPalier: typeof import('../lib/groupes').recalculerEtAppliquerPalier

/**
 * Demo users:
 *   3 individual accounts (gratuit, premium, infinite) — no group
 *   3 group members (2 premium + 1 infinite) — triggers palier 5%
 *
 * Crée de vraies subscriptions Stripe en mode test via tok_visa, de sorte que
 * /api/stripe/change-plan, /api/stripe/cancel, /api/stripe/portal et
 * /api/account/delete (qui appelle subscriptions.cancel) fonctionnent sur les
 * comptes seedes — pas seulement sur ceux ayant traverse un vrai Checkout.
 *
 * Nécessite STRIPE_SECRET_KEY commencant par sk_test_ : la creation de
 * PaymentMethod a partir d'un token Stripe-test (`tok_visa`) est refusee en
 * mode live. Le script abort si la cle n'est pas en mode test.
 */

interface DemoUser {
  email: string
  nomSociete: string
  ville: string
  adresse: string
  codePostal: string
  plan: 'gratuit' | 'premium' | 'infinite'
  groupe?: true
  /**
   * Bascule la fiche en `statut: 'suspendue'` apres seed. Sert a tester
   * l'affichage "fiche suspendue" + le mail `notifyOnSuspension`.
   */
  ficheSuspendue?: true
  /**
   * planExpiresAt anterieur a aujourd'hui. Le user reste `plan: 'gratuit'`
   * cote DB mais la presence d'une date passee permet de tester le rendu
   * "votre plan a expire" et le cron downgrade-expires (qui ne touchera plus
   * a un user deja gratuit, donc inoffensif).
   */
  planExpire?: true
}

const INDIVIDUAL_USERS: DemoUser[] = [
  {
    email: 'demo-gratuit@panorama-pub.com',
    nomSociete: 'Demo Gratuit SARL',
    ville: 'Lyon',
    adresse: '10 rue de la Republique',
    codePostal: '69002',
    plan: 'gratuit',
  },
  {
    email: 'demo-gratuit2@panorama-pub.com',
    nomSociete: 'StartPub',
    ville: 'Marseille',
    adresse: '15 rue Paradis',
    codePostal: '13001',
    plan: 'gratuit',
  },
  {
    email: 'demo-premium@panorama-pub.com',
    nomSociete: 'TextilePro SAS',
    ville: 'Paris',
    adresse: '25 avenue des Champs-Elysees',
    codePostal: '75008',
    plan: 'premium',
  },
  {
    email: 'demo-premium2@panorama-pub.com',
    nomSociete: 'GoodiesPlus',
    ville: 'Toulouse',
    adresse: '20 rue Alsace-Lorraine',
    codePostal: '31000',
    plan: 'premium',
  },
  {
    email: 'demo-infinite@panorama-pub.com',
    nomSociete: 'MegaPub International',
    ville: 'Bordeaux',
    adresse: '5 place de la Bourse',
    codePostal: '33000',
    plan: 'infinite',
  },
  {
    email: 'demo-infinite2@panorama-pub.com',
    nomSociete: 'LuxePromo SA',
    ville: 'Nice',
    adresse: '3 promenade des Anglais',
    codePostal: '06000',
    plan: 'infinite',
  },
  {
    email: 'demo-suspendu@panorama-pub.com',
    nomSociete: 'FicheSuspendue SAS',
    ville: 'Rennes',
    adresse: '10 rue Saint-Georges',
    codePostal: '35000',
    plan: 'premium',
    ficheSuspendue: true,
  },
  {
    email: 'demo-expire@panorama-pub.com',
    nomSociete: 'PlanExpire SARL',
    ville: 'Montpellier',
    adresse: '7 place de la Comedie',
    codePostal: '34000',
    plan: 'gratuit',
    planExpire: true,
  },
]

// Groupe Tricolore : 3 membres Infinite → palier 5% (3-4 membres infinite).
// Permet de demontrer la mecanique coupon Stripe automatique sur les membres.
const GROUP_USERS: DemoUser[] = [
  {
    email: 'demo-groupe1@panorama-pub.com',
    nomSociete: 'Groupe Tricolore Paris',
    ville: 'Paris',
    adresse: '40 rue du Faubourg Saint-Honore',
    codePostal: '75008',
    plan: 'infinite',
    groupe: true,
  },
  {
    email: 'demo-groupe2@panorama-pub.com',
    nomSociete: 'Groupe Tricolore Lyon',
    ville: 'Lyon',
    adresse: '12 rue de la Republique',
    codePostal: '69002',
    plan: 'infinite',
    groupe: true,
  },
  {
    email: 'demo-groupe3@panorama-pub.com',
    nomSociete: 'Groupe Tricolore Marseille',
    ville: 'Marseille',
    adresse: '5 La Canebiere',
    codePostal: '13001',
    plan: 'infinite',
    groupe: true,
  },
]

const ALL_USERS = [...INDIVIDUAL_USERS, ...GROUP_USERS]

/**
 * Cree un Customer + PaymentMethod (tok_visa) + Subscription Stripe en mode
 * test. Renvoie les IDs et la fin de periode pour persister sur le user.
 *
 * Mode test uniquement : `tok_visa` est un token de carte cree par Stripe pour
 * les sk_test_*. Une cle live refuse paymentMethods.create depuis un token,
 * d'ou le guard d'init du script.
 */
async function createStripeSubscription(
  email: string,
  nomSociete: string,
  plan: PaidPlan,
): Promise<{ customerId: string; subscriptionId: string; periodEnd: Date }> {
  const customer = await stripe.customers.create({
    email,
    name: nomSociete,
    metadata: { seed: 'demo' },
  })

  const pm = await stripe.paymentMethods.create({
    type: 'card',
    card: { token: 'tok_visa' },
  })
  await stripe.paymentMethods.attach(pm.id, { customer: customer.id })
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: pm.id },
  })

  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: PLANS[plan].priceId }],
    default_payment_method: pm.id,
    description: `Seed demo — ${PLANS[plan].label}`,
    metadata: { seed: 'demo', plan },
  })

  if (sub.status !== 'active' && sub.status !== 'trialing') {
    throw new Error(
      `Subscription Stripe creee avec un statut inattendu pour ${email} : ${sub.status}`,
    )
  }

  const periodEndEpoch = getSubscriptionPeriodEnd(sub)
  if (!periodEndEpoch) {
    throw new Error(`Impossible de lire current_period_end pour ${email}`)
  }
  return {
    customerId: customer.id,
    subscriptionId: sub.id,
    periodEnd: new Date(periodEndEpoch * 1000),
  }
}

/**
 * Annule + supprime les ressources Stripe d'un user existant avant son re-seed.
 * Best-effort : un user peut avoir un customerId orphelin sans sub, ou un
 * customer dont le sub a deja ete cancel — on swallow les "resource_missing".
 */
async function cleanupStripeForUser(payload: Payload, userId: number): Promise<void> {
  const user = await payload
    .findByID({ collection: 'users', id: userId, overrideAccess: true })
    .catch(() => null)
  if (!user) return

  const subId = user.stripeSubscriptionId as string | null | undefined
  if (subId) {
    try {
      await stripe.subscriptions.cancel(subId)
    } catch {
      // already canceled / missing — ignore
    }
  }

  const customerId = user.stripeCustomerId as string | null | undefined
  if (customerId) {
    try {
      await stripe.customers.del(customerId)
    } catch {
      // already deleted / missing — ignore
    }
  }
}

async function seed() {
  if (!(process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test_')) {
    throw new Error(
      'seed-demo cree des subs Stripe via tok_visa : STRIPE_SECRET_KEY doit etre une cle test (sk_test_...)',
    )
  }

  const stripeMod = await import('../lib/stripe')
  stripe = stripeMod.stripe
  PLANS = stripeMod.PLANS
  getSubscriptionPeriodEnd = stripeMod.getSubscriptionPeriodEnd
  const groupesMod = await import('../lib/groupes')
  calculerPalierGroupe = groupesMod.calculerPalierGroupe
  recalculerEtAppliquerPalier = groupesMod.recalculerEtAppliquerPalier

  const { getPayload } = await import('payload')
  const config = (await import('@payload-config')).default
  const payload = await getPayload({ config })

  const { docs: cats } = await payload.find({
    collection: 'categories-activite',
    sort: 'ordre',
    limit: 10,
    overrideAccess: true,
  })
  const { docs: types } = await payload.find({
    collection: 'types-evenement',
    sort: 'ordre',
    limit: 10,
    overrideAccess: true,
  })
  if (cats.length === 0 || types.length === 0) {
    throw new Error('Categories or types missing — run migrations first')
  }

  // ── Cleanup existing demo data ──────────────────────────────────

  // Delete demo groups FIRST (owner_id NOT NULL constraint).
  // On cible TOUT groupe dont l'owner appartient a la liste demo (ALL_USERS) :
  // un seed precedent pouvait avoir nomme le groupe "Groupe Demo" ou
  // "Groupe Tricolore", donc filtrer par nom est fragile a chaque renommage.
  const demoEmails = ALL_USERS.map((u) => u.email)
  const { docs: demoOwnerUsers } = await payload.find({
    collection: 'users',
    where: { email: { in: demoEmails } },
    limit: demoEmails.length,
    overrideAccess: true,
  })
  const demoOwnerIds = demoOwnerUsers.map((u) => u.id)
  const { docs: oldGroupes } =
    demoOwnerIds.length > 0
      ? await payload.find({
          collection: 'groupes',
          where: { owner: { in: demoOwnerIds } },
          limit: 50,
          overrideAccess: true,
        })
      : { docs: [] as Awaited<ReturnType<typeof payload.find>>['docs'] }
  for (const g of oldGroupes) {
    // Unlink members from group before deleting
    const { docs: groupMembers } = await payload.find({
      collection: 'users',
      where: { groupe: { equals: g.id } },
      limit: 100,
      overrideAccess: true,
    })
    for (const m of groupMembers) {
      await payload.update({
        collection: 'users',
        id: m.id,
        data: { groupe: null as unknown as number },
        overrideAccess: true,
      })
    }
    await payload.delete({ collection: 'groupes', id: g.id, overrideAccess: true })
  }

  for (const p of ALL_USERS) {
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: p.email } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      const userId = existing.docs[0].id
      // Annuler la sub Stripe + supprimer le customer AVANT la suppression du
      // user : sinon on laisse derriere des objets Stripe orphelins facturables.
      await cleanupStripeForUser(payload, userId)
      const { docs: oldFournisseurs } = await payload.find({
        collection: 'fournisseurs',
        where: { user: { equals: userId } },
        limit: 100,
        overrideAccess: true,
      })
      for (const f of oldFournisseurs) {
        await payload.delete({
          collection: 'evenements',
          where: { fournisseur: { equals: f.id } },
          overrideAccess: true,
        })
        await payload.delete({
          collection: 'fournisseurs',
          id: f.id,
          overrideAccess: true,
        })
      }
      await payload.delete({
        collection: 'users',
        id: userId,
        overrideAccess: true,
      })
    }
  }

  // ── Create users + fournisseurs ─────────────────────────────────

  const createdUsers: { id: number; email: string; plan: DemoUser['plan']; fournisseurId: number; groupe?: true }[] = []

  for (const p of ALL_USERS) {
    const user = await payload.create({
      collection: 'users',
      data: {
        email: p.email,
        password: 'demo1234',
        role: 'fournisseur',
        nomSociete: p.nomSociete,
        ville: p.ville,
        plan: p.plan,
        _verified: true,
      },
      overrideAccess: true,
      disableVerificationEmail: true,
    })

    // Hook auto-creates a fournisseur — find and enrich it
    const { docs: fdocs } = await payload.find({
      collection: 'fournisseurs',
      where: { user: { equals: user.id } },
      limit: 1,
      overrideAccess: true,
    })

    let fournisseurId: number
    if (fdocs.length > 0) {
      const updated = await payload.update({
        collection: 'fournisseurs',
        id: fdocs[0].id,
        data: {
          raisonSociale: p.nomSociete,
          ville: p.ville,
          adresse: p.adresse,
          codePostal: p.codePostal,
          telephone: '01 23 45 67 89',
          emailContact: p.email,
          siteWeb: 'https://example.com',
          activitePrincipale: cats[0].id,
          description:
            p.plan === 'infinite'
              ? 'Fournisseur Infinite de demonstration. Specialise dans les objets publicitaires et le textile promotionnel haut de gamme.'
              : undefined,
          statut: 'publiee',
        },
        overrideAccess: true,
      })
      fournisseurId = updated.id
    } else {
      const created = await payload.create({
        collection: 'fournisseurs',
        data: {
          user: user.id,
          raisonSociale: p.nomSociete,
          ville: p.ville,
          adresse: p.adresse,
          codePostal: p.codePostal,
          telephone: '01 23 45 67 89',
          emailContact: p.email,
          siteWeb: 'https://example.com',
          activitePrincipale: cats[0].id,
          statut: 'publiee',
        },
        overrideAccess: true,
      })
      fournisseurId = created.id
    }

    // Cree une vraie subscription Stripe pour les comptes payants (premium /
    // infinite). Sans ca, le user a `plan='premium'` cote DB mais aucun
    // stripeSubscriptionId — `/api/stripe/change-plan` retourne alors 400
    // `no_subscription` et `/api/stripe/cancel` ne peut rien annuler.
    if (p.plan !== 'gratuit') {
      const { customerId, subscriptionId, periodEnd } = await createStripeSubscription(
        p.email,
        p.nomSociete,
        p.plan,
      )
      await payload.update({
        collection: 'users',
        id: user.id,
        data: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          planExpiresAt: periodEnd.toISOString(),
        },
        overrideAccess: true,
      })
      console.log(
        `Created ${p.email} (fournisseur #${fournisseurId}, sub ${subscriptionId})`,
      )
    } else if (p.planExpire) {
      // Compte gratuit dont le plan a expire il y a 60 jours : pas de sub
      // Stripe (deja cancel par le cron simule), mais planExpiresAt rempli
      // pour visualiser l'etat "Votre plan a expire".
      const expiredAt = new Date()
      expiredAt.setDate(expiredAt.getDate() - 60)
      await payload.update({
        collection: 'users',
        id: user.id,
        data: { planExpiresAt: expiredAt.toISOString() },
        overrideAccess: true,
      })
      console.log(`Created ${p.email} (fournisseur #${fournisseurId}, plan expire)`)
    } else {
      console.log(`Created ${p.email} (fournisseur #${fournisseurId})`)
    }

    if (p.ficheSuspendue) {
      // Bascule la fiche en suspendue APRES la creation/sub : si on le faisait
      // avant le sub, le hook notifyOnSuspension partirait sur une fiche sans
      // contexte. Suspension en bout de chaine = email "fiche suspendue"
      // envoye correctement (utile pour tester le template).
      await payload.update({
        collection: 'fournisseurs',
        id: fournisseurId,
        data: { statut: 'suspendue' },
        overrideAccess: true,
      })
    }

    createdUsers.push({ id: user.id, email: p.email, plan: p.plan, fournisseurId, groupe: p.groupe })
  }

  // ── Create demo group (3 Infinite members → palier 5%) ──────────

  const groupeMembers = createdUsers.filter((u) => u.groupe)
  const owner = groupeMembers[0]

  const groupe = await payload.create({
    collection: 'groupes',
    data: {
      nom: 'Groupe Tricolore',
      owner: owner.id,
      code: '', // auto-generated by hook
      palierActuel: '0',
    },
    overrideAccess: true,
  })

  for (const member of groupeMembers) {
    await payload.update({
      collection: 'users',
      id: member.id,
      data: { groupe: groupe.id },
      overrideAccess: true,
    })
  }

  // Recalc + applique le palier sur Stripe (coupon discount). Comme les subs
  // sont desormais reelles, on passe par `recalculerEtAppliquerPalier` qui
  // applique le bon coupon a chaque member sub avant de persister le palier.
  await recalculerEtAppliquerPalier(payload, groupe.id)
  const { palier } = await calculerPalierGroupe(payload, groupe.id)

  console.log(`\nCreated group "${groupe.nom}" (code: ${groupe.code}, palier: ${palier}%)`)
  console.log(`  Members: ${groupeMembers.map((m) => m.email).join(', ')}`)

  // ── Seed events for Infinite users ──────────────────────────────

  const infiniteUsers = createdUsers.filter((u) => u.plan === 'infinite')

  const villes = [
    { ville: 'Paris', cp: '75001', adresse: '1 rue de Rivoli' },
    { ville: 'Lyon', cp: '69001', adresse: '1 place Bellecour' },
    { ville: 'Marseille', cp: '13001', adresse: '1 quai du Port' },
    { ville: 'Toulouse', cp: '31000', adresse: '1 place du Capitole' },
    { ville: 'Nice', cp: '06000', adresse: '1 promenade des Anglais' },
    { ville: 'Bordeaux', cp: '33000', adresse: '1 place de la Bourse' },
  ]

  const baseDate = new Date()
  baseDate.setDate(baseDate.getDate() + 7)

  let villeIdx = 0
  for (const inf of infiniteUsers) {
    const count = Math.min(3, villes.length - villeIdx)
    for (let i = 0; i < count; i++) {
      const v = villes[villeIdx]
      const date = new Date(baseDate)
      date.setDate(date.getDate() + villeIdx * 14)

      const evt = await payload.create({
        collection: 'evenements',
        data: {
          fournisseur: inf.fournisseurId,
          titre: `Evenement demo — ${v.ville}`,
          type: types[villeIdx % types.length].id,
          dateDebut: date.toISOString(),
          lieuNom: `Centre des Congres ${v.ville}`,
          lieuAdresse: v.adresse,
          lieuCodePostal: v.cp,
          lieuVille: v.ville,
          descriptionCourte: `Demo evenement organise a ${v.ville}. Venez decouvrir nos produits.`,
          statut: 'publie',
        },
        overrideAccess: true,
      })
      console.log(`Created event #${evt.id} — ${v.ville} (fournisseur ${inf.fournisseurId})`)
      villeIdx++
    }
  }

  // ── Seed organisateur account ───────────────────────────────────

  const orgEmail = 'demo-organisateur@panorama-pub.com'
  const existingOrg = await payload.find({
    collection: 'users',
    where: { email: { equals: orgEmail } },
    limit: 1,
    overrideAccess: true,
  })
  if (existingOrg.docs.length > 0) {
    // Cleanup existing organisateur
    const orgUserId = existingOrg.docs[0].id
    await cleanupStripeForUser(payload, orgUserId)
    const { docs: oldOrgFiches } = await payload.find({
      collection: 'organisateurs-evenements',
      where: { user: { equals: orgUserId } },
      limit: 10,
      overrideAccess: true,
    })
    for (const f of oldOrgFiches) {
      await payload.delete({
        collection: 'evenements',
        where: { organisateurExterne: { equals: f.id } },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'organisateurs-evenements',
        id: f.id,
        overrideAccess: true,
      })
    }
    await payload.delete({ collection: 'users', id: orgUserId, overrideAccess: true })
  }

  const orgUser = await payload.create({
    collection: 'users',
    data: {
      email: orgEmail,
      password: 'demo1234',
      role: 'organisateur',
      nomSociete: 'SalonPub Events',
      ville: 'Paris',
      plan: 'infinite',
      _verified: true,
    },
    overrideAccess: true,
    disableVerificationEmail: true,
  })

  // Cree la sub Stripe pour l'organisateur Infinite (meme raison que les
  // fournisseurs payants ci-dessus).
  {
    const { customerId, subscriptionId, periodEnd } = await createStripeSubscription(
      orgEmail,
      'SalonPub Events',
      'infinite',
    )
    await payload.update({
      collection: 'users',
      id: orgUser.id,
      data: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        planExpiresAt: periodEnd.toISOString(),
      },
      overrideAccess: true,
    })
  }

  // The afterChange hook auto-creates the organisateur fiche — find and enrich it
  const { docs: orgFicheDocs } = await payload.find({
    collection: 'organisateurs-evenements',
    where: { user: { equals: orgUser.id } },
    limit: 1,
    overrideAccess: true,
  })

  let orgFicheId: number
  if (orgFicheDocs.length > 0) {
    const updated = await payload.update({
      collection: 'organisateurs-evenements',
      id: orgFicheDocs[0].id,
      data: {
        nom: 'SalonPub Events',
        ville: 'Paris',
        adresse: '50 avenue des Champs-Elysees',
        codePostal: '75008',
        telephone: '01 44 55 66 77',
        emailContact: orgEmail,
        siteWeb: 'https://salonpub-events.fr',
        description: 'Organisateur de salons professionnels et evenements B2B dans le secteur de la publicite par l\'objet, du textile promotionnel et des cadeaux d\'entreprise. Nous organisons chaque annee plusieurs evenements a travers la France.',
        statut: 'publiee',
      },
      overrideAccess: true,
    })
    orgFicheId = updated.id
  } else {
    const created = await payload.create({
      collection: 'organisateurs-evenements',
      data: {
        user: orgUser.id,
        nom: 'SalonPub Events',
        ville: 'Paris',
        adresse: '50 avenue des Champs-Elysees',
        codePostal: '75008',
        telephone: '01 44 55 66 77',
        emailContact: orgEmail,
        siteWeb: 'https://salonpub-events.fr',
        description: 'Organisateur de salons professionnels et evenements B2B dans le secteur de la publicite par l\'objet, du textile promotionnel et des cadeaux d\'entreprise.',
        statut: 'publiee',
      },
      overrideAccess: true,
    })
    orgFicheId = created.id
  }

  // Create 2 demo events for the organisateur
  const orgEventDates = [
    { days: 30, ville: 'Paris', nom: 'Salon Objets Pub Paris 2026' },
    { days: 60, ville: 'Lyon', nom: 'Forum Textile Promo Lyon 2026' },
  ]
  for (const evData of orgEventDates) {
    const evDate = new Date()
    evDate.setDate(evDate.getDate() + evData.days)
    await payload.create({
      collection: 'evenements',
      data: {
        organisateurExterne: orgFicheId,
        titre: evData.nom,
        type: types[0].id,
        dateDebut: evDate.toISOString(),
        lieuNom: `Centre d'exposition ${evData.ville}`,
        lieuAdresse: '1 place de la Convention',
        lieuCodePostal: evData.ville === 'Paris' ? '75015' : '69002',
        lieuVille: evData.ville,
        descriptionCourte: `Evenement professionnel organise par SalonPub Events a ${evData.ville}.`,
        statut: 'publie',
      },
      overrideAccess: true,
    })
  }

  console.log(`Created organisateur: ${orgEmail} (fiche #${orgFicheId}, 2 events)`)

  // ── Seed testimonials ──────────────────────────────────────────

  // Cleanup existing demo testimonials
  const { docs: oldTestimonials } = await payload.find({
    collection: 'testimonials',
    limit: 0,
    overrideAccess: true,
  })
  for (const t of oldTestimonials) {
    await payload.delete({ collection: 'testimonials', id: t.id, overrideAccess: true })
  }

  const testimonials = [
    {
      quote: 'Depuis notre inscription sur Panorama Pub, nous avons triple nos demandes de devis en 6 mois. La visibilite sur la carte est un vrai plus pour toucher les entreprises locales.',
      author: 'Sophie Martin',
      company: 'Pub Express Lyon',
      rating: 5,
    },
    {
      quote: 'L\'annuaire nous a permis de nous positionner face a la concurrence nationale. Le pack Infinite avec les evenements est parfait pour notre strategie de visibilite.',
      author: 'Jean-Pierre Durand',
      company: 'Goodies & Co',
      rating: 5,
    },
    {
      quote: 'Simple, efficace et bien pense. On a pu completer notre fiche en quelques minutes et les premiers contacts sont arrives dans la semaine.',
      author: 'Marie Lefebvre',
      company: 'TextilePro Nantes',
      rating: 4,
    },
    {
      quote: 'Le systeme de groupe nous a fait economiser 10% sur nos abonnements. Avec 6 agences, c\'est un avantage non negligeable sur l\'annee.',
      author: 'Thomas Bernard',
      company: 'Reseau ProGifts',
      rating: 5,
    },
    {
      quote: 'Tres bonne plateforme pour les professionnels du textile promotionnel. La carte interactive est intuitive et les filtres par activite sont pertinents.',
      author: 'Isabelle Moreau',
      company: 'Creative Textile',
      rating: 4,
    },
    {
      quote: 'Nous utilisons Panorama Pub pour organiser nos salons regionaux. La section evenements nous donne une belle visibilite aupres des professionnels du secteur.',
      author: 'Laurent Petit',
      company: 'SalonPub Events',
      rating: 5,
    },
  ]

  for (const t of testimonials) {
    await payload.create({
      collection: 'testimonials',
      data: { ...t, isPublished: true },
      overrideAccess: true,
    })
  }
  console.log(`Created ${testimonials.length} demo testimonials`)

  // ── Summary ─────────────────────────────────────────────────────

  console.log('\n── Demo accounts (password: demo1234) ──')
  console.log('\nIndividuels:')
  for (const u of createdUsers.filter((u) => !u.groupe)) {
    console.log(`  ${u.email} (${u.plan})`)
  }
  console.log(`\nGroupe "${groupe.nom}" (code: ${groupe.code}, palier: -${palier}%):`)
  for (const u of groupeMembers) {
    console.log(`  ${u.email} (${u.plan})`)
  }
  console.log(`\nOrganisateur:`)
  console.log(`  ${orgEmail} (infinite, organisateur)`)

  process.exit(0)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})

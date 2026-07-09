import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { stripe } from '@/lib/stripe'
import { SITE_URL } from '@/lib/site'
import { rateLimit } from '@/lib/rate-limit'

/**
 * POST /api/stripe/portal
 *
 * Ouvre une session Stripe Billing Portal pour permettre a l'utilisateur de :
 *   - mettre a jour son moyen de paiement (CB expiree, changement de carte)
 *   - consulter et telecharger ses factures
 *   - voir l'etat de sa subscription
 *
 * Repond { url } → le front redirige vers stripe.com.
 */
export async function POST() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  const { success: allowed } = rateLimit(`stripe-portal:${user.id}`, {
    limit: 10,
    windowMs: 60_000,
  })
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de requetes' }, { status: 429 })
  }

  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
  })

  if (!freshUser.stripeCustomerId) {
    return NextResponse.json(
      { error: 'Aucun client Stripe associe a ce compte.' },
      { status: 400 },
    )
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: freshUser.stripeCustomerId as string,
      // Retour vers le bon dashboard selon le rôle (partenaire → sa fiche ; sinon réseau).
      return_url: `${SITE_URL}/dashboard/${freshUser.role === 'partenaire' ? 'partenaire' : 'reseau'}`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/portal] session create failed:', err)
    return NextResponse.json(
      { error: 'Impossible de generer le lien vers le portail.' },
      { status: 500 },
    )
  }
}

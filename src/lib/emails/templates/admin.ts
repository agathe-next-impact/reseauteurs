import { renderEmail } from '../layout'
import { SITE_URL } from '../../site'
import { button, card, paragraph, table } from '../components'

/**
 * Alerte envoyée a l'équipe (CONTACT_EMAIL) quand le webhook Stripe recoit un
 * priceId inconnu — l'utilisateur a payé mais n'a pas reçu son plan. Remediation
 * manuelle (vérifier STRIPE_*_PRICE_ID + forcer plan en base).
 */
export function stripeMisconfigAlertEmail(ctx: {
  userId: string
  stripeCustomerId: string
  subscriptionId: string
  priceId: string
}): string {
  const content = `
    ${card({
      variant: 'danger',
      title: 'Action requise',
      body: `<p style="margin:0">Un checkout vient d'aboutir mais le priceId ne correspond a aucun plan configure. L'utilisateur est facture mais reste sur le plan gratuit.</p>`,
    })}
    ${table([
      { label: 'User ID', value: ctx.userId },
      { label: 'Stripe customer', value: ctx.stripeCustomerId },
      { label: 'Subscription', value: ctx.subscriptionId },
      { label: 'priceId reçu', value: ctx.priceId },
    ])}
    ${paragraph(`Verifiez que <code>STRIPE_PREMIUM_PRICE_ID</code> et <code>STRIPE_INFINITE_PRICE_ID</code> sont a jour dans l'environnement, puis forcez le plan dans l'admin Payload.`)}
  `
  return renderEmail({
    preheader: `priceId Stripe inconnu — user ${ctx.userId}, priceId ${ctx.priceId}.`,
    heading: 'Action requise : priceId Stripe inconnu',
    content,
    footer: 'transactional',
    accent: 'danger',
  })
}

export function userRegisteredAdminEmail(ctx: {
  userId: number | string
  email: string
  // Rôles ouverts à l'inscription. 'fournisseur' conservé pour rétrocompat (alias → reseauteur).
  role: 'reseauteur' | 'organisateur' | 'partenaire' | 'fournisseur'
  nomSociete: string
  ville: string
  optInMarketing: boolean
  claimFicheId?: number | null
  pendingGroupeCode?: string | null
}): string {
  const adminUrl = `${SITE_URL}/admin/collections/users/${ctx.userId}`
  const roleLabel =
    ctx.role === 'organisateur' ? 'Organisateur'
    : ctx.role === 'reseauteur' ? 'Réseauteur'
    : 'Réseauteur (legacy)'
  const rows = [
    { label: 'User ID', value: String(ctx.userId) },
    { label: 'Email', value: ctx.email },
    { label: 'Type de compte', value: roleLabel },
    { label: 'Nom', value: ctx.nomSociete },
    { label: 'Ville', value: ctx.ville },
    { label: 'Opt-in marketing', value: ctx.optInMarketing ? 'Oui' : 'Non' },
  ]

  if (ctx.claimFicheId != null) {
    rows.push({ label: 'Fiche revendiquee', value: String(ctx.claimFicheId) })
  }

  if (ctx.pendingGroupeCode) {
    rows.push({ label: 'Code groupe', value: ctx.pendingGroupeCode })
  }

  const content = `
    ${card({
      variant: 'info',
      title: 'Nouvelle inscription',
      body: `<p style="margin:0">Un nouveau compte vient d'etre cree sur RÉSEAUTEURS.</p>`,
    })}
    ${table(rows)}
    ${button({ href: adminUrl, label: "Ouvrir dans l'admin", variant: 'primary' })}
    ${paragraph(`L'email de verification est envoye separement au nouvel utilisateur.`)}
  `

  return renderEmail({
    preheader: `Nouvelle inscription ${roleLabel.toLowerCase()} : ${ctx.email}.`,
    heading: 'Nouvelle inscription',
    content,
    footer: 'transactional',
    accent: 'primary',
  })
}

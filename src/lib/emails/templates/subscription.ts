import { SITE_URL } from '../../site'
import { renderEmail } from '../layout'
import { button, card, list, paragraph, table } from '../components'
import { esc } from '../esc'

// Formate un montant en centimes (TTC) en libelle FR "32,00 EUR". Rounding
// bancaire laisse a JS — les centimes proviennent directement de Stripe donc
// pas de derive d'arrondi supplementaire.
function formatAmountCents(cents: number): string {
  const euros = (cents / 100).toFixed(2).replace('.', ',')
  return `${euros} EUR`
}

// ISO string → "15 mars 2026" en FR. Fallback silencieux sur la chaîne brute
// si le parse echoue (ne doit pas arriver — les ISO viennent de Stripe).
function formatDateISO(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Email de confirmation d'activation d'abonnement.
 *
 * ADR-0012 : recalibré pour les abonnements B2B (réseau national partenaire, partenaire annonceur).
 * La signature accepte désormais un libellé libre (plus de contrainte 'premium'|'infinite').
 *
 * @param planLabel Libellé de l'abonnement (ex. 'Réseau national partenaire', 'Partenaire annonceur')
 * @param nomSociete Nom de la société / réseau
 */
export function subscriptionConfirmationEmail(
  planLabel: string,
  nomSociete: string,
): string {
  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${card({
      variant: 'success',
      title: `Abonnement ${esc(planLabel)} actif`,
      body: `<p style="margin:0">Merci pour votre confiance. Votre abonnement est en place et votre fiche bénéficie désormais de toutes les fonctionnalités associées.</p>`,
    })}
    ${paragraph(`Vous pouvez dès maintenant publier vos événements, gérer vos chapitres locaux et accéder à votre tableau de bord organisateur.`)}
    ${button({ href: `${SITE_URL}/dashboard/reseau`, label: 'Accéder à mon espace', variant: 'primary' })}
  `
  return renderEmail({
    preheader: `Abonnement ${planLabel} activé — bienvenue sur RÉSEAUTEURS.`,
    heading: `Votre abonnement ${planLabel} est actif`,
    content,
    footer: 'transactional',
    accent: 'primary',
  })
}

export function expirationWarningEmail(
  nomSociete: string,
  daysLeft: number,
  planLabel?: string,
): string {
  const planSuffix = planLabel ? ` <strong>${esc(planLabel)}</strong>` : ''
  const jourOuJours = daysLeft > 1 ? 'jours' : 'jour'

  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${card({
      variant: 'warning',
      title: `Expiration dans ${daysLeft} ${jourOuJours}`,
      body: `<p style="margin:0">Votre abonnement${planSuffix} RÉSEAUTEURS arrive a échéance dans <strong>${daysLeft} ${jourOuJours}</strong>. Sans renouvellement, votre fiche repassera en version gratuite (nom et ville uniquement).</p>`,
    })}
    ${paragraph(`Renouvelez en quelques clics depuis votre espace pour conserver vos coordonnees, votre description et vos illustrations.`)}
    ${button({ href: `${SITE_URL}/dashboard/abonnement`, label: 'Renouveler mon abonnement', variant: 'primary' })}
  `
  return renderEmail({
    preheader: `Votre abonnement expire dans ${daysLeft} ${jourOuJours} — renouvelez pour conserver vos fonctionnalités.`,
    heading: 'Votre abonnement expire bientôt',
    content,
    footer: 'transactional',
    accent: 'primary',
  })
}

export function paymentFailedEmail(nomSociete: string): string {
  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${card({
      variant: 'danger',
      title: 'Le renouvellement automatique a echoue',
      body: `<p style="margin:0">Le renouvellement automatique de votre abonnement RÉSEAUTEURS a echoue. Votre fiche reste active pour le moment, mais elle sera retrogradee si le paiement n'aboutit pas.</p>`,
    })}
    ${paragraph(`Mettez a jour vos informations de paiement depuis votre espace pour maintenir votre abonnement actif.`)}
    ${button({ href: `${SITE_URL}/dashboard/abonnement`, label: 'Mettre a jour le paiement', variant: 'danger' })}
  `
  return renderEmail({
    preheader: 'Le renouvellement automatique de votre abonnement a echoue — action requise.',
    heading: 'Échec de paiement',
    content,
    footer: 'transactional',
    accent: 'danger',
  })
}

export function subscriptionCanceledEmail(nomSociete: string, endDate: string): string {
  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${card({
      variant: 'default',
      body: `<p style="margin:0">Votre abonnement RÉSEAUTEURS a bien été annule. Votre fiche reste active jusqu'au <strong>${esc(endDate)}</strong>, après quoi elle repassera en version gratuite (nom et ville uniquement).</p>`,
    })}
    ${paragraph(`Vous pouvez reactiver votre abonnement à tout moment depuis votre espace, sans reimporter vos données.`)}
    ${button({ href: `${SITE_URL}/dashboard/abonnement`, label: 'Gérer mon abonnement', variant: 'primary' })}
  `
  return renderEmail({
    preheader: `Abonnement annule — votre fiche reste active jusqu'au ${endDate}.`,
    heading: 'Votre abonnement a été annule',
    content,
    footer: 'transactional',
    accent: 'neutral',
  })
}

/**
 * Upgrade premium → infinite (ou toute transition avec paiement immediat par
 * proration Stripe always_invoice). Recap du montant preleve + prochaine échéance.
 */
export function planUpgradedEmail(
  nomSociete: string,
  opts: {
    oldPlanLabel: string
    newPlanLabel: string
    amountChargedCents: number
    nextRenewalDateISO: string
    nextRenewalAmountCents: number
  },
): string {
  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${card({
      variant: 'success',
      title: `Passage en ${opts.newPlanLabel} confirme`,
      body: `<p style="margin:0">Votre abonnement <strong>${esc(opts.oldPlanLabel)}</strong> est désormais <strong>${esc(opts.newPlanLabel)}</strong>. Les nouvelles fonctionnalités sont immediatement disponibles sur votre fiche.</p>`,
    })}
    ${table([
      { label: 'Ancienne formule', value: opts.oldPlanLabel },
      { label: 'Nouvelle formule', value: opts.newPlanLabel },
      { label: 'Montant preleve (prorata)', value: formatAmountCents(opts.amountChargedCents) },
      { label: 'Prochain renouvellement', value: formatDateISO(opts.nextRenewalDateISO) },
      { label: 'Montant du renouvellement', value: formatAmountCents(opts.nextRenewalAmountCents) },
    ])}
    ${paragraph(`Le montant prorata a été preleve sur votre moyen de paiement enregistré. Vous pouvez retrouver votre facture dans votre espace de facturation Stripe.`)}
    ${button({ href: `${SITE_URL}/dashboard/abonnement`, label: 'Gérer mon abonnement', variant: 'primary' })}
  `
  return renderEmail({
    preheader: `Passage en ${opts.newPlanLabel} confirme — ${formatAmountCents(opts.amountChargedCents)} preleve au prorata.`,
    heading: `Votre abonnement ${opts.newPlanLabel} est actif`,
    content,
    footer: 'transactional',
    accent: 'premium',
  })
}

/**
 * Downgrade infinite → premium. Crédit appliqué sur la prochaine facture
 * (proration create_prorations) + liste des champs Infinite-only qui ont été
 * nettoyes (evenements archives, vidéo YouTube, illustrations tronquees).
 */
export function planDowngradedScheduledEmail(
  nomSociete: string,
  opts: {
    oldPlanLabel: string
    newPlanLabel: string
    creditCents: number
    nextRenewalDateISO: string
    nextRenewalAmountCents: number
    wipedFields: string[]
  },
): string {
  const wipedBlock =
    opts.wipedFields.length > 0
      ? `${paragraph(`Les elements suivants ont été retires ou masques suite au passage en ${esc(opts.newPlanLabel)} :`)}${list(opts.wipedFields.map((f) => esc(f)))}`
      : ''

  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${card({
      variant: 'warning',
      title: `Passage en ${opts.newPlanLabel} enregistré`,
      body: `<p style="margin:0">Votre abonnement <strong>${esc(opts.oldPlanLabel)}</strong> a été retrograde en <strong>${esc(opts.newPlanLabel)}</strong>. Un crédit sera appliqué sur votre prochaine facture pour la période non consommee.</p>`,
    })}
    ${table([
      { label: 'Ancienne formule', value: opts.oldPlanLabel },
      { label: 'Nouvelle formule', value: opts.newPlanLabel },
      { label: 'Crédit sur prochaine facture', value: formatAmountCents(opts.creditCents) },
      { label: 'Prochain renouvellement', value: formatDateISO(opts.nextRenewalDateISO) },
      { label: 'Montant du renouvellement', value: formatAmountCents(opts.nextRenewalAmountCents) },
    ])}
    ${wipedBlock}
    ${button({ href: `${SITE_URL}/dashboard/abonnement`, label: 'Gérer mon abonnement', variant: 'primary' })}
  `
  return renderEmail({
    preheader: `Passage en ${opts.newPlanLabel} — crédit de ${formatAmountCents(opts.creditCents)} sur la prochaine facture.`,
    heading: `Votre abonnement est désormais ${opts.newPlanLabel}`,
    content,
    footer: 'transactional',
    accent: 'primary',
  })
}

/**
 * Annulation programmee (cancel_at_period_end = true). L'utilisateur conserve
 * l'accès jusqu'à endDate puis la fiche repasse en gratuit. Il peut encore
 * reactiver d'ici la.
 */
export function subscriptionCancelScheduledEmail(
  nomSociete: string,
  opts: { planLabel: string; endDateISO: string },
): string {
  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${card({
      variant: 'default',
      title: 'Annulation enregistrée',
      body: `<p style="margin:0">Votre demande d'annulation est enregistrée. Votre abonnement <strong>${esc(opts.planLabel)}</strong> reste actif jusqu'au <strong>${esc(formatDateISO(opts.endDateISO))}</strong>, puis votre fiche repassera en version gratuite (nom et ville uniquement).</p>`,
    })}
    ${paragraph(`Vous pouvez reactiver votre abonnement à tout moment avant cette date — aucun nouveau prelevement ne sera effectue tant que l'annulation est programmee.`)}
    ${button({ href: `${SITE_URL}/dashboard/abonnement`, label: 'Reactiver mon abonnement', variant: 'primary' })}
  `
  return renderEmail({
    preheader: `Annulation enregistrée — fiche active jusqu'au ${formatDateISO(opts.endDateISO)}.`,
    heading: 'Annulation programmee',
    content,
    footer: 'transactional',
    accent: 'neutral',
  })
}

/**
 * Reactivation d'un abonnement qui etait en cancel_at_period_end. Rassure
 * l'utilisateur sur le fait que le renouvellement reprend normalement.
 */
export function subscriptionReactivatedEmail(
  nomSociete: string,
  opts: {
    planLabel: string
    nextRenewalDateISO: string
    nextRenewalAmountCents: number
  },
): string {
  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${card({
      variant: 'success',
      title: 'Abonnement reactive',
      body: `<p style="margin:0">Votre abonnement <strong>${esc(opts.planLabel)}</strong> reprend normalement. Le renouvellement automatique est retabli — aucune action n'est requise de votre part.</p>`,
    })}
    ${table([
      { label: 'Formule', value: opts.planLabel },
      { label: 'Prochain renouvellement', value: formatDateISO(opts.nextRenewalDateISO) },
      { label: 'Montant du renouvellement', value: formatAmountCents(opts.nextRenewalAmountCents) },
    ])}
    ${button({ href: `${SITE_URL}/dashboard/abonnement`, label: 'Gérer mon abonnement', variant: 'primary' })}
  `
  return renderEmail({
    preheader: `Abonnement ${opts.planLabel} reactive — prochain renouvellement le ${formatDateISO(opts.nextRenewalDateISO)}.`,
    heading: 'Votre abonnement a été reactive',
    content,
    footer: 'transactional',
    accent: 'primary',
  })
}

export function planDowngradedEmail(nomSociete: string, oldPlanLabel: string): string {
  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${card({
      variant: 'warning',
      title: `Abonnement ${oldPlanLabel} arrive a échéance`,
      body: `<p style="margin:0">Votre fiche reste publiee, mais elle repasse en affichage gratuit (nom et ville uniquement). Vos coordonnees, description et illustrations sont masquees jusqu'au renouvellement.</p>`,
    })}
    ${paragraph(`Pour restaurer l'intégralité de votre fiche, renouvelez votre abonnement :`)}
    ${button({ href: `${SITE_URL}/dashboard/abonnement`, label: 'Renouveler mon abonnement', variant: 'primary' })}
  `
  return renderEmail({
    preheader: `Votre abonnement ${oldPlanLabel} a expire — renouvelez pour restaurer votre fiche.`,
    heading: `Votre abonnement ${oldPlanLabel} a expire`,
    title: `Votre abonnement a expire`,
    content,
    footer: 'transactional',
    accent: 'primary',
  })
}

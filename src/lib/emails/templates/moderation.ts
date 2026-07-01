import { CONTACT_EMAIL, SITE_URL } from '../../site'
import { renderEmail } from '../layout'
import { button, card, paragraph } from '../components'
import { esc } from '../esc'

export function ficheRejectedEmail(nomSociete: string, raison?: string): string {
  const motifBlock = raison
    ? card({ variant: 'warning', title: 'Motif', body: `<p style="margin:0">${esc(raison)}</p>` })
    : ''
  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${card({
      variant: 'danger',
      title: 'Fiche suspendue',
      body: `<p style="margin:0">Un administrateur a suspendu votre fiche sur RÉSEAUTEURS. Elle n'est actuellement plus visible sur la carte ni dans l'annuaire.</p>`,
    })}
    ${motifBlock}
    ${paragraph(`Si vous pensez qu'il s'agit d'une erreur ou souhaitez contester cette décision, répondez directement à cet email ou ecrivez a <a href="mailto:${CONTACT_EMAIL}" style="color:#6b7280">${CONTACT_EMAIL}</a>.`)}
    ${button({ href: `${SITE_URL}/dashboard/fiche`, label: 'Voir ma fiche', variant: 'secondary' })}
  `
  return renderEmail({
    preheader: 'Votre fiche a été suspendue — elle n\'est plus visible publiquement.',
    heading: 'Votre fiche a été suspendue',
    content,
    footer: 'transactional',
    accent: 'danger',
  })
}

export function evenementRejectedEmail(
  nomSociete: string,
  titre: string,
  raison?: string,
): string {
  const motifBlock = raison
    ? card({ variant: 'warning', title: 'Motif', body: `<p style="margin:0">${esc(raison)}</p>` })
    : ''
  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${card({
      variant: 'danger',
      body: `<p style="margin:0">L'événement <strong>${esc(titre)}</strong> a été archive par un administrateur. Il n'apparait plus sur la carte des événements.</p>`,
    })}
    ${motifBlock}
    ${paragraph(`Pour toute question, répondez directement à cet email ou ecrivez a <a href="mailto:${CONTACT_EMAIL}" style="color:#6b7280">${CONTACT_EMAIL}</a>.`)}
    ${button({ href: `${SITE_URL}/dashboard/evenements`, label: 'Voir mes événements', variant: 'secondary' })}
  `
  return renderEmail({
    preheader: `L'événement ${titre} a été archive par un administrateur.`,
    heading: 'Votre événement a été retire',
    content,
    footer: 'transactional',
    accent: 'danger',
  })
}

export function accountDeletedEmail(
  nomSociete: string,
  options: { hadSubscription?: boolean } = {},
): string {
  const subscriptionBlock = options.hadSubscription
    ? card({
        variant: 'default',
        title: 'Abonnement cloture',
        body: `<p style="margin:0">Votre abonnement RÉSEAUTEURS a été annule immediatement et ne fera l'objet d'aucun renouvellement. Aucun nouveau prelevement ne sera effectue. Les factures déjà émises restent disponibles cote Stripe pour vos obligations comptables.</p>`,
      })
    : ''
  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${card({
      variant: 'default',
      title: 'Suppression effective',
      body: `<p style="margin:0">Nous confirmons la suppression definitive de votre compte RÉSEAUTEURS. Conformément au RGPD, vos données personnelles (fiche, abonnement, groupe) ont été effacees de nos systèmes.</p>`,
    })}
    ${subscriptionBlock}
    ${paragraph(`Nous conservons uniquement un journal anonymise de la suppression (obligation legale) et les factures émises, sans lien avec votre identité.`)}
    ${paragraph(`Merci d'avoir utilise RÉSEAUTEURS. Si vous changez d'avis, vous pourrez recreer un compte à tout moment.`)}
    ${button({ href: SITE_URL, label: 'Retourner sur RÉSEAUTEURS', variant: 'secondary' })}
  `
  return renderEmail({
    preheader: 'Confirmation de la suppression de votre compte RÉSEAUTEURS.',
    heading: 'Votre compte a été supprimé',
    content,
    footer: 'transactional',
    accent: 'neutral',
  })
}

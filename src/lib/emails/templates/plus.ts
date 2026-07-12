/**
 * templates/plus.ts — Emails du palier Réseauteur Plus + packs de licences (ADR-0013 P2.A).
 */
import { SITE_URL } from '../../site'
import { renderEmail } from '../layout'
import { button, paragraph, codeBlock, card } from '../components'
import { esc } from '../esc'

/** Confirmation d'activation du Plus (abonnement Stripe). */
export function plusActiveEmail(nom: string): string {
  return renderEmail({
    preheader: 'Votre compte est désormais Réseauteur Plus.',
    heading: 'Bienvenue en Réseauteur Plus',
    intro: `Bonjour${nom ? ` ${nom}` : ''},`,
    content: `
      ${paragraph('Votre abonnement <strong>Réseauteur Plus</strong> est actif. Vous pouvez désormais <strong>créer et publier vos propres événements</strong> de networking, visibles sur la carte et référencés sur la plateforme.')}
      ${button({ href: `${SITE_URL}/dashboard/mes-evenements`, label: 'Créer mon premier événement' })}
      ${paragraph('Vous pouvez gérer votre abonnement (facture, moyen de paiement, résiliation) à tout moment depuis votre tableau de bord.')}
    `,
    footer: 'transactional',
    accent: 'success',
  })
}

/** Fin du Plus (annulation, impayé ou expiration). */
export function plusExpireEmail(nom: string): string {
  return renderEmail({
    preheader: 'Votre accès Réseauteur Plus a pris fin.',
    heading: 'Votre Réseauteur Plus a pris fin',
    intro: `Bonjour${nom ? ` ${nom}` : ''},`,
    content: `
      ${paragraph('Votre accès <strong>Réseauteur Plus</strong> est arrivé à échéance. Vos événements déjà publiés restent en ligne, mais la création de nouveaux événements est suspendue.')}
      ${paragraph('Vous pouvez réactiver le Plus à tout moment :')}
      ${button({ href: `${SITE_URL}/dashboard/plus`, label: 'Réactiver Réseauteur Plus' })}
    `,
    footer: 'transactional',
    accent: 'neutral',
  })
}

/** Pack de licences acheté — code à diffuser (email au partenaire). */
export function packAcheteEmail(nomPartenaire: string, code: string, quota: number): string {
  return renderEmail({
    preheader: 'Votre pack de licences Réseauteur Plus est actif.',
    heading: 'Votre pack de licences est actif',
    intro: `Bonjour${nomPartenaire ? ` ${nomPartenaire}` : ''},`,
    content: `
      ${paragraph(`Votre pack de <strong>${quota} licence${quota > 1 ? 's' : ''} Réseauteur Plus</strong> est activé. Diffusez ce code à vos réseauteurs — chacun l'active depuis son espace personnel, dans la limite du quota :`)}
      ${codeBlock(esc(code))}
      ${paragraph('Suivez les activations (quota restant, réseauteurs activés) depuis votre espace partenaire.')}
      ${button({ href: `${SITE_URL}/dashboard/partenaire`, label: 'Voir mon espace partenaire', variant: 'premium' })}
    `,
    footer: 'transactional',
    accent: 'premium',
  })
}

/** Licence activée par un réseauteur (email au réseauteur). */
export function licenceActiveeEmail(
  nom: string,
  partenaireNom: string | null,
  expireAt: string | null,
): string {
  const finTxt = expireAt
    ? ` Votre accès est valable jusqu'au <strong>${new Date(expireAt).toLocaleDateString('fr-FR')}</strong>.`
    : ''
  return renderEmail({
    preheader: 'Votre licence Réseauteur Plus est activée.',
    heading: 'Votre licence Plus est activée',
    intro: `Bonjour${nom ? ` ${nom}` : ''},`,
    content: `
      ${card({
        body: paragraph(
          `Licence <strong>Réseauteur Plus</strong> offerte${partenaireNom ? ` par <strong>${esc(partenaireNom)}</strong>` : ' par un partenaire'}.${finTxt}`,
        ),
        variant: 'success',
      })}
      ${paragraph('Vous pouvez désormais <strong>créer et publier vos propres événements</strong> de networking.')}
      ${button({ href: `${SITE_URL}/dashboard/mes-evenements`, label: 'Créer mon premier événement' })}
    `,
    footer: 'transactional',
    accent: 'success',
  })
}

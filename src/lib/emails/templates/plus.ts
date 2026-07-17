/**
 * templates/plus.ts — Emails du palier Réseauteur Plus (ADR-0013 P2.A).
 * ADR-0015 : les emails des packs de licences (pack-achete, licence-activee) sont supprimés.
 */
import { SITE_URL } from '../../site'
import { renderEmail } from '../layout'
import { button, paragraph } from '../components'

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

// ADR-0015 : packAcheteEmail et licenceActiveeEmail supprimés (packs de licences retirés).

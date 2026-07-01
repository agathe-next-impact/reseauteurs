import { CONTACT_EMAIL, SITE_URL } from '../../site'
import { renderEmail } from '../layout'
import { button, card, fallbackUrl, paragraph, table } from '../components'
import { esc } from '../esc'

/**
 * Sent when a user hits maxLoginAttempts (5) and the account gets locked for lockTime (10 min).
 * CTA points to the forgot-password flow so the user can recover without waiting.
 */
export function accountLockedEmail(
  nomSociete: string,
  unlockMinutes: number,
  resetUrl: string,
): string {
  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${card({
      variant: 'danger',
      title: 'Compte temporairement verrouille',
      body: `<p style="margin:0">Nous avons détecté plusieurs tentatives de connexion echouees sur votre compte RÉSEAUTEURS. Par sécurité, il est verrouille pendant <strong>${unlockMinutes} minutes</strong>.</p>`,
    })}
    ${paragraph(`Si vous avez oublié votre mot de passe, reinitialisez-le immediatement sans attendre le deverrouillage automatique.`)}
    ${button({ href: resetUrl, label: 'Réinitialiser mon mot de passe', variant: 'primary' })}
    ${fallbackUrl(resetUrl)}
    ${paragraph(`Si ce n'etait pas vous, quelqu'un a peut-être essaye d'acceder à votre compte. Contactez notre support a <a href="mailto:${CONTACT_EMAIL}" style="color:#6b7280">${CONTACT_EMAIL}</a> et changez votre mot de passe dès que possible.`)}
  `
  return renderEmail({
    preheader: `Compte verrouille ${unlockMinutes} minutes après plusieurs tentatives echouees.`,
    heading: 'Votre compte a été temporairement verrouille',
    content,
    footer: 'transactional',
    accent: 'danger',
  })
}

/**
 * Sent right after a user's password is changed (self-service or admin-reset flow).
 */
export function passwordChangedEmail(nomSociete: string, contactUrl: string): string {
  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${paragraph(`Le mot de passe de votre compte RÉSEAUTEURS vient d'être modifie.`)}
    ${card({
      variant: 'success',
      body: `<p style="margin:0"><strong>Si vous êtes à l'origine de cette modification</strong>, aucune action n'est necessaire.</p>`,
    })}
    ${card({
      variant: 'danger',
      body: `<p style="margin:0"><strong>Si ce n'etait pas vous</strong>, votre compte est peut-être compromis. Contactez-nous immediatement et reinitialisez votre mot de passe.</p>`,
    })}
    ${button({ href: contactUrl, label: 'Contacter le support', variant: 'secondary' })}
    ${button({ href: `${SITE_URL}/mot-de-passe-oublie`, label: 'Réinitialiser mon mot de passe', variant: 'primary' })}
  `
  return renderEmail({
    preheader: 'Confirmation du changement de mot de passe sur votre compte RÉSEAUTEURS.',
    heading: 'Votre mot de passe a été modifie',
    content,
    footer: 'transactional',
    accent: 'neutral',
  })
}

/**
 * Sent to the NEW address requested via POST /api/account/change-email. The
 * actual switch only happens once the recipient clicks confirmUrl — which
 * proves they control the mailbox. Old address gets the final "email-changed"
 * notification separately, after the switch lands.
 */
export function confirmEmailChangeEmail(nomSociete: string, confirmUrl: string): string {
  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${paragraph(`Une demande de changement d'adresse email a été faite sur votre compte RÉSEAUTEURS vers cette adresse.`)}
    ${card({
      variant: 'info',
      title: 'Confirmez pour finaliser',
      body: `<p style="margin:0">Cliquez sur le bouton ci-dessous pour valider cette nouvelle adresse. Sans confirmation, aucune modification ne sera appliquée.</p>`,
    })}
    ${button({ href: confirmUrl, label: 'Confirmer mon nouvel email', variant: 'primary' })}
    ${fallbackUrl(confirmUrl)}
    ${paragraph(`Ce lien est valable <strong>24 heures</strong>. Passe ce délai, vous devrez relancer la demande depuis votre espace compte.`)}
    ${paragraph(`Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email — aucune action ne sera prise.`)}
  `
  return renderEmail({
    preheader: 'Confirmez votre nouvelle adresse email pour finaliser le changement.',
    heading: 'Confirmez votre nouvelle adresse email',
    content,
    footer: 'transactional',
    accent: 'primary',
  })
}

/**
 * Sent when a user's email address changes. Delivered to BOTH old and new addresses.
 */
export function emailChangedEmail(
  nomSociete: string,
  oldEmail: string,
  newEmail: string,
  contactUrl: string,
): string {
  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${paragraph(`L'adresse email associee à votre compte RÉSEAUTEURS vient d'être modifiee :`)}
    ${table([
      { label: 'Ancienne adresse', value: oldEmail },
      { label: 'Nouvelle adresse', value: newEmail },
    ])}
    ${card({
      variant: 'success',
      body: `<p style="margin:0"><strong>Si vous êtes à l'origine de cette modification</strong>, aucune action n'est necessaire.</p>`,
    })}
    ${card({
      variant: 'danger',
      body: `<p style="margin:0"><strong>Si ce n'etait pas vous</strong>, contactez-nous immediatement. Nous pourrons bloquer le compte et restaurer votre adresse initiale.</p>`,
    })}
    ${button({ href: contactUrl, label: 'Contacter le support', variant: 'danger' })}
  `
  return renderEmail({
    preheader: "Confirmation du changement d'adresse email sur votre compte RÉSEAUTEURS.",
    heading: 'Votre adresse email a été modifiee',
    content,
    footer: 'transactional',
    accent: 'neutral',
  })
}

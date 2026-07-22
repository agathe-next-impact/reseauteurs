import { SITE_URL } from '../../site'
import { renderEmail } from '../layout'
import { button, card, codeBlock, list, paragraph } from '../components'
import { esc } from '../esc'

/**
 * Direct invitation from an existing member to a confrere. CTA tailored to whether
 * the recipient already has an account.
 *
 * userExists=true  -> /login?redirect=/dashboard/groupe?code=XXX
 * userExists=false -> /inscription?code=XXX
 */
export function groupInvitationEmail(
  senderNomSociete: string,
  groupeNom: string,
  code: string,
  userExists: boolean,
): string {
  const dashboardJoinPath = `/dashboard/groupe?code=${encodeURIComponent(code)}`
  const ctaUrl = userExists
    ? `${SITE_URL}/login?redirect=${encodeURIComponent(dashboardJoinPath)}`
    : `${SITE_URL}/inscription?code=${encodeURIComponent(code)}`
  const ctaLabel = userExists ? 'Se connecter et rejoindre' : 'Créer mon compte et rejoindre'
  const helperText = userExists
    ? 'Une fois connecte, le code sera pre-rempli sur la page Mon groupe — il vous suffira de valider.'
    : 'A la fin de votre inscription, le code sera disponible pour rejoindre le groupe depuis votre tableau de bord.'

  const content = `
    ${paragraph(`Bonjour,`)}
    ${paragraph(`<strong>${esc(senderNomSociete)}</strong> vous invite à rejoindre le groupe <strong>${esc(groupeNom)}</strong> sur RÉSEAUTEURS — la plateforme nationale du networking.`)}
    ${card({
      variant: 'highlight',
      title: 'Reductions mutualisees sur les abonnements Infinite',
      body: list([
        'A partir de 3 membres Infinite : <strong>-5%</strong> pour tous',
        'A partir de 5 membres Infinite : <strong>-10%</strong>',
        'A partir de 10 membres Infinite : <strong>-15%</strong>',
      ]),
    })}
    ${paragraph(`Votre code d'affiliation :`)}
    ${codeBlock(code)}
    ${button({ href: ctaUrl, label: ctaLabel, variant: 'primary' })}
    ${paragraph(`<span style="color:#6E7175">${esc(helperText)}</span>`)}
  `
  return renderEmail({
    preheader: `${senderNomSociete} vous invité dans le groupe ${groupeNom} — code ${code}.`,
    heading: `${senderNomSociete} vous invité dans son groupe RÉSEAUTEURS`,
    content,
    footer: 'transactional',
    accent: 'primary',
  })
}

function palierLine(palier: string): string {
  return palier === '0'
    ? 'Aucune réduction active'
    : `-${esc(palier)}% appliqué à tous les membres Infinite`
}

/**
 * Confirms group création to the owner + shares the affiliation code to forward.
 */
export function groupeCreatedEmail(
  ownerNomSociete: string,
  groupeNom: string,
  code: string,
): string {
  const content = `
    ${paragraph(`Bonjour ${esc(ownerNomSociete)},`)}
    ${paragraph(`Le groupe <strong>${esc(groupeNom)}</strong> est maintenant actif sur RÉSEAUTEURS. Partagez le code ci-dessous à vos confreres pour qu'ils rejoignent le groupe :`)}
    ${codeBlock(code)}
    ${card({
      variant: 'highlight',
      title: 'Paliers de réduction mutualisee (abonnements Infinite uniquement)',
      body: list([
        '3 membres Infinite : <strong>-5%</strong>',
        '5 membres Infinite : <strong>-10%</strong>',
        '10 membres Infinite ou plus : <strong>-15%</strong>',
      ]),
    })}
    ${button({ href: `${SITE_URL}/dashboard/groupe`, label: 'Gérer mon groupe', variant: 'primary' })}
  `
  return renderEmail({
    preheader: `Groupe ${groupeNom} cree — partagez le code ${code} à vos confreres.`,
    heading: 'Votre groupe est cree',
    content,
    footer: 'transactional',
    accent: 'primary',
  })
}

export function groupeJoinedOwnerEmail(
  ownerNomSociete: string,
  newMemberNomSociete: string,
  palier: string,
): string {
  const content = `
    ${paragraph(`Bonjour ${esc(ownerNomSociete)},`)}
    ${card({
      variant: 'success',
      body: `<p style="margin:0"><strong>${esc(newMemberNomSociete)}</strong> vient de rejoindre votre groupe sur RÉSEAUTEURS.</p>`,
    })}
    ${paragraph(`Palier de réduction actuel : <strong>${palierLine(palier)}</strong>.`)}
    ${button({ href: `${SITE_URL}/dashboard/groupe`, label: 'Voir mon groupe', variant: 'primary' })}
  `
  return renderEmail({
    preheader: `${newMemberNomSociete} a rejoint votre groupe — palier ${palier === '0' ? 'inchange' : '-' + palier + '%'}.`,
    heading: 'Un nouveau membre a rejoint votre groupe',
    content,
    footer: 'transactional',
    accent: 'success',
  })
}

export function groupeOwnershipTransferredEmail(
  newOwnerNomSociete: string,
  previousOwnerNomSociete: string,
  groupeNom: string,
  code: string,
  palier: string,
): string {
  const content = `
    ${paragraph(`Bonjour ${esc(newOwnerNomSociete)},`)}
    ${paragraph(`<strong>${esc(previousOwnerNomSociete)}</strong> a quitte le groupe. En tant que membre le plus ancien, vous en êtes automatiquement le nouveau proprietaire.`)}
    ${card({
      variant: 'highlight',
      title: 'Ce que cela implique',
      body: list([
        `Vous pouvez continuer à partager le code <strong>${esc(code)}</strong> pour inviter de nouveaux membres.`,
        'Si vous quittez à votre tour le groupe, l\'ownership sera transféré au membre le plus ancien suivant (ou le groupe sera supprimé si vous êtes le dernier).',
        `Palier de réduction actuel : <strong>${palierLine(palier)}</strong>.`,
      ]),
    })}
    ${paragraph(`Si vous ne souhaitez pas assumer ce role, vous pouvez quitter le groupe depuis votre espace.`)}
    ${button({ href: `${SITE_URL}/dashboard/groupe`, label: 'Gérer mon groupe', variant: 'primary' })}
  `
  return renderEmail({
    preheader: `Vous êtes désormais proprietaire du groupe ${groupeNom}.`,
    heading: `Vous êtes désormais proprietaire du groupe ${groupeNom}`,
    content,
    footer: 'transactional',
    accent: 'primary',
  })
}

export function groupeLeftOwnerEmail(
  ownerNomSociete: string,
  leaverNomSociete: string,
  palier: string,
): string {
  const content = `
    ${paragraph(`Bonjour ${esc(ownerNomSociete)},`)}
    ${card({
      variant: 'default',
      body: `<p style="margin:0"><strong>${esc(leaverNomSociete)}</strong> a quitte votre groupe sur RÉSEAUTEURS.</p>`,
    })}
    ${paragraph(`Palier de réduction actuel : <strong>${palierLine(palier)}</strong>.`)}
    ${button({ href: `${SITE_URL}/dashboard/groupe`, label: 'Voir mon groupe', variant: 'primary' })}
  `
  return renderEmail({
    preheader: `${leaverNomSociete} a quitte votre groupe — palier ${palier === '0' ? 'inchange' : '-' + palier + '%'}.`,
    heading: 'Un membre a quitte votre groupe',
    content,
    footer: 'transactional',
    accent: 'neutral',
  })
}

function palierLabel(palier: string): string {
  return palier === '0' ? 'aucune réduction' : `-${palier}%`
}

/**
 * Owner notification: groupe palier transition upward (0->5, 5->10, 10->15).
 * Sent after the new coupon has been successfully applied to all paying members.
 */
export function groupePalierUpgradeOwnerEmail(
  ownerNomSociete: string,
  groupeNom: string,
  ancienPalier: string,
  nouveauPalier: string,
  nbMembresPayants: number,
): string {
  const content = `
    ${paragraph(`Bonjour ${esc(ownerNomSociete)},`)}
    ${card({
      variant: 'success',
      title: `Votre groupe atteint le palier ${palierLabel(nouveauPalier)}`,
      body: `<p style="margin:0">Avec <strong>${nbMembresPayants}</strong> membres Infinite, le groupe <strong>${esc(groupeNom)}</strong> bénéficie désormais de <strong>${palierLabel(nouveauPalier)}</strong> sur les abonnements Infinite (palier precedent : ${palierLabel(ancienPalier)}).</p>`,
    })}
    ${paragraph(`La réduction s'appliqué automatiquement à la prochaine facture annuelle de chaque membre payant. Aucune action n'est requise de votre part.`)}
    ${button({ href: `${SITE_URL}/dashboard/groupe`, label: 'Voir mon groupe', variant: 'primary' })}
  `
  return renderEmail({
    preheader: `Votre groupe ${groupeNom} passe au palier ${palierLabel(nouveauPalier)}.`,
    heading: `Votre groupe atteint le palier ${palierLabel(nouveauPalier)}`,
    content,
    footer: 'transactional',
    accent: 'success',
  })
}

/**
 * Paying member notification: groupe palier transition upward.
 * Short variant, no group management context — just the impact on their next bill.
 */
export function groupePalierUpgradeMemberEmail(
  memberNomSociete: string,
  groupeNom: string,
  ancienPalier: string,
  nouveauPalier: string,
): string {
  const content = `
    ${paragraph(`Bonjour ${esc(memberNomSociete)},`)}
    ${card({
      variant: 'success',
      body: `<p style="margin:0">Votre groupe <strong>${esc(groupeNom)}</strong> a atteint le palier <strong>${palierLabel(nouveauPalier)}</strong> de réduction sur RÉSEAUTEURS (palier precedent : ${palierLabel(ancienPalier)}).</p>`,
    })}
    ${paragraph(`La réduction <strong>${palierLabel(nouveauPalier)}</strong> s'appliqué automatiquement à votre prochaine facture annuelle. Aucune action n'est requise.`)}
    ${button({ href: `${SITE_URL}/dashboard/abonnement`, label: 'Voir mon abonnement', variant: 'primary' })}
  `
  return renderEmail({
    preheader: `Votre groupe ${groupeNom} passe au palier ${palierLabel(nouveauPalier)}.`,
    heading: `Nouvelle réduction sur votre abonnement : ${palierLabel(nouveauPalier)}`,
    content,
    footer: 'transactional',
    accent: 'success',
  })
}

/**
 * Owner notification: groupe palier transition downward (15->10, 10->5, 5->0).
 * Informative tone, not alarming — the discount changed because membership changed.
 */
export function groupePalierDowngradeOwnerEmail(
  ownerNomSociete: string,
  groupeNom: string,
  ancienPalier: string,
  nouveauPalier: string,
  nbMembresPayants: number,
): string {
  const headingNouveau = nouveauPalier === '0' ? 'Aucune réduction active' : `Palier ${palierLabel(nouveauPalier)}`
  const content = `
    ${paragraph(`Bonjour ${esc(ownerNomSociete)},`)}
    ${card({
      variant: 'default',
      title: `Le palier de votre groupe a évolué`,
      body: `<p style="margin:0">Le groupe <strong>${esc(groupeNom)}</strong> compte désormais <strong>${nbMembresPayants}</strong> membres Infinite. Le palier passe de <strong>${palierLabel(ancienPalier)}</strong> a <strong>${palierLabel(nouveauPalier)}</strong>.</p>`,
    })}
    ${paragraph(`Le nouveau taux s'appliqué automatiquement à la prochaine facture annuelle de chaque membre. Pour retrouver un palier plus avantageux, invitez de nouveaux confreres avec votre code d'affiliation.`)}
    ${button({ href: `${SITE_URL}/dashboard/groupe`, label: 'Gérer mon groupe', variant: 'primary' })}
  `
  return renderEmail({
    preheader: `Palier du groupe ${groupeNom} : ${palierLabel(ancienPalier)} -> ${palierLabel(nouveauPalier)}.`,
    heading: headingNouveau,
    content,
    footer: 'transactional',
    accent: 'neutral',
  })
}

/**
 * Notifie un user qui vient d'être detache automatiquement de son groupe suite
 * à la fin de son abonnement Infinite (cron downgrade-expires ou
 * subscription.canceled/deleted). Le palier du groupe a déjà été recalculé
 * sans lui — cet email l'informé du detach pour eviter qu'il découvre dans
 * son dashboard "vous n'êtes plus dans aucun groupe" sans contexte.
 */
export function groupeAutoLeftDowngradeEmail(
  userNomSociete: string,
  groupeNom: string,
): string {
  const content = `
    ${paragraph(`Bonjour ${esc(userNomSociete)},`)}
    ${card({
      variant: 'default',
      title: `Vous avez quitte le groupe ${esc(groupeNom)}`,
      body: `<p style="margin:0">Suite à la fin de votre abonnement Infinite, vous avez été automatiquement detache du groupe <strong>${esc(groupeNom)}</strong>. Seuls les comptes Infinite peuvent contribuer au palier de réduction d'un groupe.</p>`,
    })}
    ${paragraph(`Vous pourrez rejoindre a nouveau ce groupe (ou un autre) en reprenant un abonnement Infinite : il vous suffira de renseigner le code d'affiliation depuis votre espace.`)}
    ${button({ href: `${SITE_URL}/dashboard/abonnement`, label: 'Voir les abonnements', variant: 'primary' })}
  `
  return renderEmail({
    preheader: `Vous avez quitte le groupe ${groupeNom} suite à la fin de votre Infinite.`,
    heading: `Vous avez quitte le groupe ${groupeNom}`,
    content,
    footer: 'transactional',
    accent: 'neutral',
  })
}

/**
 * Paying member notification: groupe palier transition downward.
 * Short, informative — flag the change so the next bill is not a surprise.
 */
export function groupePalierDowngradeMemberEmail(
  memberNomSociete: string,
  groupeNom: string,
  ancienPalier: string,
  nouveauPalier: string,
): string {
  const content = `
    ${paragraph(`Bonjour ${esc(memberNomSociete)},`)}
    ${card({
      variant: 'default',
      body: `<p style="margin:0">La réduction de votre groupe <strong>${esc(groupeNom)}</strong> évolué : palier <strong>${palierLabel(ancienPalier)}</strong> -> <strong>${palierLabel(nouveauPalier)}</strong>.</p>`,
    })}
    ${paragraph(`Le nouveau taux s'appliquera à votre prochaine facture annuelle. Aucune action n'est requise de votre part.`)}
    ${button({ href: `${SITE_URL}/dashboard/abonnement`, label: 'Voir mon abonnement', variant: 'primary' })}
  `
  return renderEmail({
    preheader: `Palier du groupe ${groupeNom} : ${palierLabel(ancienPalier)} -> ${palierLabel(nouveauPalier)}.`,
    heading: `La réduction de votre groupe a évolué`,
    content,
    footer: 'transactional',
    accent: 'neutral',
  })
}

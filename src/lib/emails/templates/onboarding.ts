import { SITE_URL } from '../../site'
import { renderEmail } from '../layout'
import { button, card, fallbackUrl, paragraph, list, table } from '../components'
import { esc } from '../esc'

/**
 * Sent immediately after email vérification. CTA to dashboard to complète the fiche.
 */
export function welcomeEmail(nomSociete: string): string {
  const content = `
    ${paragraph(`Votre compte est actif. Votre profil est désormais visible sur RÉSEAUTEURS — la plateforme nationale du networking.`)}
    ${card({
      variant: 'highlight',
      title: 'Prochaine étape',
      body: `<p style="margin:0">Completez votre fiche pour être visible auprès des acheteurs qui consultent la carte chaque jour.</p>`,
    })}
    ${button({ href: `${SITE_URL}/dashboard/fiche`, label: 'Compléter ma fiche', variant: 'primary' })}
    ${paragraph(`<span style="color:#6E7175">Besoin d'aide ? Répondez simplement à cet email, notre équipe vous accompagné.</span>`)}
  `
  return renderEmail({
    preheader: 'Votre compte est actif — completez votre fiche en 2 minutes pour être visible.',
    heading: `Bienvenue sur RÉSEAUTEURS, ${nomSociete}`,
    content,
    footer: 'transactional',
    accent: 'primary',
  })
}

/**
 * Email vérification template shared by Users.ts auth.verify and /api/auth/register.
 */
export function verifyEmailTemplate(nomSociete: string, verifyUrl: string): string {
  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${paragraph(`Pour activer votre compte RÉSEAUTEURS, confirmez votre adresse email en cliquant sur le bouton ci-dessous.`)}
    ${button({ href: verifyUrl, label: 'Vérifier mon email', variant: 'primary' })}
    ${fallbackUrl(verifyUrl)}
    ${paragraph(`<span style="color:#6E7175">Ce lien est valable 24 heures. Si vous n'avez pas cree de compte, ignorez cet email.</span>`)}
  `
  return renderEmail({
    preheader: 'Confirmez votre adresse email pour activer votre compte RÉSEAUTEURS.',
    heading: 'Bienvenue sur RÉSEAUTEURS',
    content,
    footer: 'transactional',
    accent: 'primary',
  })
}

/**
 * Password reset template used by Users.ts auth.forgotPassword.
 */
export function forgotPasswordEmail(resetUrl: string): string {
  const content = `
    ${paragraph(`Vous avez demande la réinitialisation de votre mot de passe sur RÉSEAUTEURS.`)}
    ${paragraph(`Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.`)}
    ${button({ href: resetUrl, label: 'Réinitialiser mon mot de passe', variant: 'primary' })}
    ${fallbackUrl(resetUrl)}
    ${paragraph(`<span style="color:#6E7175">Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe actuel reste valide.</span>`)}
  `
  return renderEmail({
    preheader: 'Reinitialisez votre mot de passe RÉSEAUTEURS — lien valable 1 heure.',
    heading: 'Réinitialisation du mot de passe',
    content,
    footer: 'transactional',
    accent: 'primary',
  })
}

export function csvInvitationEmail(nomSociete: string, email: string, tempPassword: string): string {
  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${paragraph(`Un compte a été créé pour vous sur RÉSEAUTEURS — la plateforme nationale du networking.`)}
    ${paragraph(`Vos identifiants de connexion :`)}
    ${table([
      { label: 'Email', value: email },
      { label: 'Mot de passe temporaire', value: tempPassword },
    ])}
    ${button({ href: `${SITE_URL}/login`, label: 'Me connecter', variant: 'primary' })}
    ${paragraph(`<span style="color:#6E7175">Nous vous recommandons de modifier ce mot de passe temporaire des votre première connexion, depuis votre espace personnel.</span>`)}
  `
  return renderEmail({
    preheader: 'Votre compte RÉSEAUTEURS a été cree — identifiants et mot de passe temporaire ci-dessous.',
    heading: 'Bienvenue sur RÉSEAUTEURS',
    content,
    footer: 'transactional',
    accent: 'primary',
  })
}

/**
 * Invitation d'un réseau national à créer son compte organisateur, envoyée à la
 * demande d'un réseauteur Plus qui crée un réseau local (ADR-0014). Le nom du
 * réseauteur invitant est cité (transparence anti-abus, précédent csv-invitation).
 */
export function invitationNationalEmail(nomReseau: string, inviteurNom: string): string {
  const inscriptionUrl = `${SITE_URL}/inscription?type=organisateur`
  const content = `
    ${paragraph(`Bonjour,`)}
    ${paragraph(`${esc(inviteurNom)}, réseauteur sur RÉSEAUTEURS — la plateforme nationale du networking —, souhaite rattacher son groupe local au réseau <strong>${esc(nomReseau)}</strong>.`)}
    ${card({
      variant: 'highlight',
      title: 'Votre réseau n\'a pas encore sa fiche',
      body: `<p style="margin:0">Créez votre compte organisateur pour publier la fiche de ${esc(nomReseau)}, fédérer vos groupes locaux et publier vos événements sur la carte nationale.</p>`,
    })}
    ${button({ href: inscriptionUrl, label: 'Créer le compte de mon réseau', variant: 'primary' })}
    ${fallbackUrl(inscriptionUrl)}
    ${paragraph(`<span style="color:#6E7175">Vous recevez cet email car un réseauteur a indiqué votre adresse comme contact du réseau ${esc(nomReseau)}. Si vous n'êtes pas concerné, ignorez simplement ce message.</span>`)}
  `
  return renderEmail({
    preheader: `${nomReseau} est attendu sur RÉSEAUTEURS — créez la fiche de votre réseau.`,
    heading: `${nomReseau} sur RÉSEAUTEURS`,
    content,
    footer: 'transactional',
    accent: 'primary',
  })
}

/**
 * Notification au réseau national qu'un groupe local vient de lui être AFFILIÉ
 * (décision 2026-07-22). Déclenchée à la création d'un local avec un `parent`,
 * par un tiers — réseauteur Plus (ADR-0014) ou admin. Jamais quand la tête crée
 * elle-même le groupe : elle n'a pas à s'auto-notifier.
 *
 * Le national garde la main : depuis « Mes groupes » il peut modifier la fiche
 * de ce groupe ou le supprimer s'il ne correspond pas à son réseau.
 */
export function nouveauLocalAffilieEmail(params: {
  nomNational: string
  nomLocal: string
  villeLocal?: string | null
  createurNom: string
}): string {
  const { nomNational, nomLocal, villeLocal, createurNom } = params
  const gestionUrl = `${SITE_URL}/dashboard/locaux`
  // `table` échappe ses valeurs (infoRow) : on lui passe le texte brut.
  const lignes = [
    { label: 'Groupe local', value: nomLocal },
    ...(villeLocal ? [{ label: 'Ville', value: villeLocal }] : []),
    { label: 'Créé par', value: createurNom },
  ]
  const content = `
    ${paragraph(`Bonjour,`)}
    ${paragraph(`Un nouveau groupe local vient d'être rattaché à votre réseau <strong>${esc(nomNational)}</strong> sur RÉSEAUTEURS.`)}
    ${table(lignes)}
    ${card({
      variant: 'highlight',
      title: 'Vous gardez la main',
      body: `<p style="margin:0">Depuis « Mes groupes », vous pouvez modifier la fiche de ce groupe ou le supprimer s'il ne correspond pas à votre réseau.</p>`,
    })}
    ${button({ href: gestionUrl, label: 'Gérer mes groupes', variant: 'primary' })}
    ${fallbackUrl(gestionUrl)}
    ${paragraph(`<span style="color:#6E7175">Vous recevez cet email car vous gérez la fiche du réseau ${esc(nomNational)} sur RÉSEAUTEURS.</span>`)}
  `
  return renderEmail({
    preheader: `${nomLocal} vient d'être rattaché à ${nomNational} sur RÉSEAUTEURS.`,
    heading: 'Nouveau groupe affilié à votre réseau',
    content,
    footer: 'transactional',
    accent: 'primary',
  })
}

/**
 * Sent ~3 days after signup. Reminds the user to complète the fiche if still sparse.
 * Gated by optInMarketing. Includes unsubscribe footer.
 */
export function completionReminderEmail(
  nomSociete: string,
  percent: number,
  userId: number | string,
): string {
  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${card({
      variant: 'highlight',
      body: `<p style="margin:0">Les fiches complètes recoivent <strong>4x plus de contacts</strong> que les fiches partielles. Il vous reste quelques champs a remplir pour maximiser votre visibilité.</p>`,
    })}
    ${button({ href: `${SITE_URL}/dashboard`, label: 'Voir les champs manquants', variant: 'primary' })}
  `
  return renderEmail({
    preheader: `Votre fiche est a ${percent}% — quelques minutes pour la finir et multiplier vos contacts.`,
    heading: `Votre fiche est a ${percent}% — finissez-la en 2 minutes`,
    content,
    footer: { kind: 'marketing', userId },
    accent: 'primary',
  })
}

/**
 * Sent ~7 days after signup to gratuit users. Pushes the upgrade to Premium (99 EUR/an).
 * Gated by optInMarketing. Includes unsubscribe footer.
 */
export function upgradeNudgeEmail(nomSociete: string, userId: number | string): string {
  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${paragraph(`Sur le plan gratuit, les acheteurs voient votre nom et votre ville — mais pas de quoi vous contacter directement.`)}
    ${card({
      variant: 'highlight',
      title: 'Ce que vous debloquez avec Premium (99 EUR HT / an)',
      body: list([
        'Adresse complète, téléphone, email, site web',
        'Marqueur colore par activité, plus visible sur la carte',
        'Activités secondaires et description détaillée (100 mots)',
        'Bannière et illustration pour valoriser votre savoir-faire',
      ]),
    })}
    ${button({ href: `${SITE_URL}/dashboard/abonnement?plan=premium#plan-premium`, label: 'Passer Premium', variant: 'premium' })}
  `
  return renderEmail({
    preheader: 'Affichez vos coordonnees et gagnez en visibilité auprès des acheteurs.',
    heading: 'Passez Premium pour afficher vos coordonnees',
    content,
    footer: { kind: 'marketing', userId },
    accent: 'premium',
  })
}

/**
 * Sent ~14 days after signup to paying users not in a groupe. Promotes the group discount.
 * Gated by optInMarketing. Includes unsubscribe footer.
 */
export function groupLeverageEmail(nomSociete: string, userId: number | string): string {
  const content = `
    ${paragraph(`Bonjour ${esc(nomSociete)},`)}
    ${paragraph(`Les réseaux partenaires de RÉSEAUTEURS peuvent se regrouper pour mutualiser les avantages de leur partenariat.`)}
    ${card({
      variant: 'highlight',
      title: 'Paliers de réduction',
      body: list([
        '<strong>3 membres payants</strong> : -5% pour tous',
        '<strong>5 membres payants</strong> : -10%',
        '<strong>10 membres payants ou plus</strong> : -15%',
      ]),
    })}
    ${paragraph(`Créez votre propre groupe ou rejoignez-en un avec le code d'un confrere.`)}
    ${button({ href: `${SITE_URL}/dashboard/groupe`, label: 'Gérer mon groupe', variant: 'primary' })}
  `
  return renderEmail({
    preheader: 'Mutualisez une réduction pouvant atteindre -15% avec vos confreres.',
    heading: "Economisez jusqu'à -15% en rejoignant un groupe",
    content,
    footer: { kind: 'marketing', userId },
    accent: 'primary',
  })
}


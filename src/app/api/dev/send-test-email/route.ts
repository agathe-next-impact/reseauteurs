import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  subscriptionConfirmationEmail,
  subscriptionCanceledEmail,
  subscriptionCancelScheduledEmail,
  subscriptionReactivatedEmail,
  planUpgradedEmail,
  planDowngradedScheduledEmail,
  planDowngradedEmail,
  paymentFailedEmail,
  expirationWarningEmail,
  completionReminderEmail,
  upgradeNudgeEmail,
  groupLeverageEmail,
  groupInvitationEmail,
  groupeCreatedEmail,
  groupeJoinedOwnerEmail,
  groupeLeftOwnerEmail,
  groupeAutoLeftDowngradeEmail,
  groupePalierUpgradeOwnerEmail,
  groupePalierUpgradeMemberEmail,
  groupePalierDowngradeOwnerEmail,
  groupePalierDowngradeMemberEmail,
  welcomeEmail,
  csvInvitationEmail,
  accountDeletedEmail,
  ficheRejectedEmail,
  evenementRejectedEmail,
  verifyEmailTemplate,
  forgotPasswordEmail,
  accountLockedEmail,
  passwordChangedEmail,
  emailChangedEmail,
  confirmEmailChangeEmail,
  stripeMisconfigAlertEmail,
  plusActiveEmail,
  plusExpireEmail,
  invitationNationalEmail,
} from '@/lib/emails'
import { sendEmail, type EmailKind } from '@/lib/email-sender'
import { SITE_URL } from '@/lib/site'

/**
 * Dev-only smoke test endpoint. Fires any of the transactional or marketing
 * templates against Resend with placeholder data. Gated by NODE_ENV !== 'production'
 * AND a valid Authorization: Bearer <CRON_SECRET>.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "http://localhost:3000/api/dev/send-test-email?kind=welcome&to=agathe@example.com"
 */

const FIXTURE_NOM = 'Acme SARL'
const FIXTURE_USER_ID = 1

const TEMPLATES: Record<EmailKind, { subject: string; html: string }> = {
  'subscription-confirmation': {
    subject: 'Panorama Pub — Abonnement active',
    html: subscriptionConfirmationEmail('premium', FIXTURE_NOM),
  },
  'subscription-canceled': {
    subject: 'Panorama Pub — Votre abonnement a ete annule',
    html: subscriptionCanceledEmail(FIXTURE_NOM, '31/12/2026'),
  },
  'subscription-cancel-scheduled': {
    subject: 'Panorama Pub — Annulation programmee',
    html: subscriptionCancelScheduledEmail(FIXTURE_NOM, {
      planLabel: 'Premium',
      endDateISO: '2026-12-31T00:00:00.000Z',
    }),
  },
  'subscription-reactivated': {
    subject: 'Panorama Pub — Abonnement reactive',
    html: subscriptionReactivatedEmail(FIXTURE_NOM, {
      planLabel: 'Premium',
      nextRenewalDateISO: '2026-12-31T00:00:00.000Z',
      nextRenewalAmountCents: 9900,
    }),
  },
  'plan-upgraded': {
    subject: 'Panorama Pub — Passage en Infinite',
    html: planUpgradedEmail(FIXTURE_NOM, {
      oldPlanLabel: 'Premium',
      newPlanLabel: 'Infinite',
      amountChargedCents: 7200,
      nextRenewalDateISO: '2026-12-31T00:00:00.000Z',
      nextRenewalAmountCents: 21900,
    }),
  },
  'plan-downgrade-scheduled': {
    subject: 'Panorama Pub — Passage en Premium programme',
    html: planDowngradedScheduledEmail(FIXTURE_NOM, {
      oldPlanLabel: 'Infinite',
      newPlanLabel: 'Premium',
      creditCents: 6500,
      nextRenewalDateISO: '2026-12-31T00:00:00.000Z',
      nextRenewalAmountCents: 9900,
      wipedFields: ['Video YouTube', '5 illustrations supplementaires', '2 evenements archives'],
    }),
  },
  'plan-downgraded': {
    subject: 'Panorama Pub — Votre abonnement a expire',
    html: planDowngradedEmail(FIXTURE_NOM, 'Premium'),
  },
  'payment-failed': {
    subject: 'Panorama Pub — Echec de paiement',
    html: paymentFailedEmail(FIXTURE_NOM),
  },
  'expiration-warning': {
    subject: 'Panorama Pub — Votre abonnement expire dans 7 jours',
    html: expirationWarningEmail(FIXTURE_NOM, 7, 'Premium'),
  },
  'completion-reminder': {
    subject: 'Votre fiche Panorama Pub est a 40% — 2 min pour la finir',
    html: completionReminderEmail(FIXTURE_NOM, 40, FIXTURE_USER_ID),
  },
  'upgrade-nudge': {
    subject: 'Panorama Pub — Debloquez vos coordonnees avec Premium',
    html: upgradeNudgeEmail(FIXTURE_NOM, FIXTURE_USER_ID),
  },
  'group-leverage': {
    subject: 'Panorama Pub — Jusqu\'a -15% en rejoignant un groupe',
    html: groupLeverageEmail(FIXTURE_NOM, FIXTURE_USER_ID),
  },
  'group-invitation': {
    subject: `${FIXTURE_NOM} vous invite sur Panorama Pub`,
    html: groupInvitationEmail(FIXTURE_NOM, 'Groupe Demo', 'GRP-TESTXY', false),
  },
  'group-created': {
    subject: 'Panorama Pub — Votre groupe Groupe Demo est cree',
    html: groupeCreatedEmail(FIXTURE_NOM, 'Groupe Demo', 'GRP-TESTXY'),
  },
  'group-joined-owner': {
    subject: 'Panorama Pub — Confrere Sarl a rejoint votre groupe',
    html: groupeJoinedOwnerEmail(FIXTURE_NOM, 'Confrere Sarl', '5'),
  },
  'group-left-owner': {
    subject: 'Panorama Pub — Confrere Sarl a quitte votre groupe',
    html: groupeLeftOwnerEmail(FIXTURE_NOM, 'Confrere Sarl', '0'),
  },
  'groupe-auto-left-downgrade': {
    subject: 'Panorama Pub — Vous avez quitte le groupe Atelier des Confreres',
    html: groupeAutoLeftDowngradeEmail(FIXTURE_NOM, 'Atelier des Confreres'),
  },
  'groupe-palier-upgrade-owner': {
    subject: 'Panorama Pub — Votre groupe atteint un nouveau palier de reduction',
    html: groupePalierUpgradeOwnerEmail(FIXTURE_NOM, 'Groupe Demo', '0', '5', 3),
  },
  'groupe-palier-upgrade-member': {
    subject: 'Panorama Pub — Nouvelle reduction sur votre abonnement',
    html: groupePalierUpgradeMemberEmail(FIXTURE_NOM, 'Groupe Demo', '0', '5'),
  },
  'groupe-palier-downgrade-owner': {
    subject: 'Panorama Pub — Le palier de votre groupe a evolue',
    html: groupePalierDowngradeOwnerEmail(FIXTURE_NOM, 'Groupe Demo', '5', '0', 2),
  },
  'groupe-palier-downgrade-member': {
    subject: 'Panorama Pub — La reduction de votre groupe a evolue',
    html: groupePalierDowngradeMemberEmail(FIXTURE_NOM, 'Groupe Demo', '5', '0'),
  },
  welcome: {
    subject: 'Bienvenue sur Panorama Pub — completez votre fiche',
    html: welcomeEmail(FIXTURE_NOM),
  },
  'csv-invitation': {
    subject: 'Panorama Pub — Votre compte a ete cree',
    html: csvInvitationEmail(FIXTURE_NOM, 'demo@example.com', 'TempPass123'),
  },
  'account-deleted': {
    subject: 'Panorama Pub — Confirmation de suppression de votre compte',
    html: accountDeletedEmail(FIXTURE_NOM),
  },
  'fiche-rejected': {
    subject: 'Panorama Pub — Votre fiche a ete suspendue',
    html: ficheRejectedEmail(FIXTURE_NOM, 'Contenu incomplet'),
  },
  'evenement-rejected': {
    subject: 'Panorama Pub — Votre evenement a ete retire',
    html: evenementRejectedEmail(FIXTURE_NOM, 'Salon des goodies', 'Doublon signale'),
  },
  'verify-email': {
    subject: 'Panorama Pub — Verifiez votre email',
    html: verifyEmailTemplate(FIXTURE_NOM, `${SITE_URL}/verify?token=fake-token`),
  },
  'forgot-password': {
    subject: 'Panorama Pub — Reinitialisation du mot de passe',
    html: forgotPasswordEmail(`${SITE_URL}/reset-password?token=fake-token`),
  },
  'account-locked': {
    subject: 'Panorama Pub — Votre compte a ete temporairement verrouille',
    html: accountLockedEmail(FIXTURE_NOM, 10, `${SITE_URL}/mot-de-passe-oublie`),
  },
  'password-changed': {
    subject: 'Panorama Pub — Votre mot de passe a ete modifie',
    html: passwordChangedEmail(FIXTURE_NOM, 'mailto:contact@panorama-pub.com'),
  },
  'email-changed': {
    subject: 'Panorama Pub — Votre adresse email a ete modifiee',
    html: emailChangedEmail(
      FIXTURE_NOM,
      'ancien@example.com',
      'nouveau@example.com',
      'mailto:contact@panorama-pub.com',
    ),
  },
  'email-change-confirm': {
    subject: 'Panorama Pub — Confirmez votre nouvelle adresse email',
    html: confirmEmailChangeEmail(
      FIXTURE_NOM,
      `${SITE_URL}/api/account/confirm-email-change?token=fake-token`,
    ),
  },
  'admin-alert': {
    subject: '[Panorama Pub] Stripe priceId inconnu — user 1',
    html: stripeMisconfigAlertEmail({
      userId: String(FIXTURE_USER_ID),
      stripeCustomerId: 'cus_demo',
      subscriptionId: 'sub_demo',
      priceId: 'price_demo',
    }),
  },
  // ── ADR-0013 : Réseauteur Plus
  'plus-active': {
    subject: 'RÉSEAUTEURS — Bienvenue en Réseauteur Plus',
    html: plusActiveEmail(FIXTURE_NOM),
  },
  'plus-expire': {
    subject: 'RÉSEAUTEURS — Votre accès Réseauteur Plus a pris fin',
    html: plusExpireEmail(FIXTURE_NOM),
  },
  'invitation-national': {
    subject: 'RÉSEAUTEURS — BNI est invité à créer la fiche de son réseau',
    html: invitationNationalEmail('BNI', FIXTURE_NOM),
  },
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  }

  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  const url = new URL(request.url)
  const kindParam = url.searchParams.get('kind')
  const to = url.searchParams.get('to')

  if (!kindParam || !to) {
    return NextResponse.json(
      { error: 'Parametres requis : ?kind=<EmailKind>&to=<email>' },
      { status: 400 },
    )
  }

  const tpl = TEMPLATES[kindParam as EmailKind]
  if (!tpl) {
    return NextResponse.json(
      { error: `Kind inconnu. Valeurs acceptees : ${Object.keys(TEMPLATES).join(', ')}` },
      { status: 400 },
    )
  }

  const payload = await getPayload({ config })
  const result = await sendEmail({
    payload,
    kind: kindParam as EmailKind,
    to,
    subject: tpl.subject,
    html: tpl.html,
  })

  return NextResponse.json({ ok: result.sent, kind: kindParam, result })
}

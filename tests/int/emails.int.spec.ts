import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET || 'test-secret'
  process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://panorama-pub.com'
})

import {
  welcomeEmail,
  verifyEmailTemplate,
  forgotPasswordEmail,
  csvInvitationEmail,
  completionReminderEmail,
  upgradeNudgeEmail,
  groupLeverageEmail,
  groupInvitationEmail,
  groupeCreatedEmail,
  groupeJoinedOwnerEmail,
  groupeOwnershipTransferredEmail,
  groupeLeftOwnerEmail,
  accountLockedEmail,
  passwordChangedEmail,
  emailChangedEmail,
  subscriptionConfirmationEmail,
  expirationWarningEmail,
  paymentFailedEmail,
  subscriptionCanceledEmail,
  subscriptionCancelScheduledEmail,
  subscriptionReactivatedEmail,
  planUpgradedEmail,
  planDowngradedScheduledEmail,
  planDowngradedEmail,
  ficheRejectedEmail,
  evenementRejectedEmail,
  accountDeletedEmail,
  stripeMisconfigAlertEmail,
  esc,
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
} from '@/lib/emails'
import { SITE_NAME } from '@/lib/site'

const XSS = '<script>alert(1)</script>'
const XSS_ESCAPED = '&lt;script&gt;alert(1)&lt;/script&gt;'

type TemplateCase = {
  kind: string
  html: string
  marketing: boolean
  shouldContain?: string[]
}

const cases: TemplateCase[] = [
  { kind: 'welcome', html: welcomeEmail('Acme'), marketing: false, shouldContain: ['Bienvenue', '/dashboard/fiche'] },
  { kind: 'verify-email', html: verifyEmailTemplate('Acme', 'https://panorama-pub.com/verify?t=x'), marketing: false, shouldContain: ['verify?t=x', 'Vérifier mon email'] },
  { kind: 'forgot-password', html: forgotPasswordEmail('https://panorama-pub.com/reset?t=abc'), marketing: false, shouldContain: ['reset?t=abc', 'Réinitialiser mon mot de passe'] },
  { kind: 'csv-invitation', html: csvInvitationEmail('Acme', 'demo@example.com', 'Pwd123!'), marketing: false, shouldContain: ['demo@example.com', 'Pwd123!'] },
  { kind: 'completion-reminder', html: completionReminderEmail('Acme', 40, 42), marketing: true, shouldContain: ['40%', '/dashboard'] },
  { kind: 'upgrade-nudge', html: upgradeNudgeEmail('Acme', 42), marketing: true, shouldContain: ['Premium', '/dashboard/abonnement'] },
  { kind: 'group-leverage', html: groupLeverageEmail('Acme', 42), marketing: true, shouldContain: ['-15%', '/dashboard/groupe'] },
  { kind: 'group-invitation-new', html: groupInvitationEmail('Acme', 'Groupe Demo', 'GRP-ABCDEF', false), marketing: false, shouldContain: ['GRP-ABCDEF', '/inscription?code=GRP-ABCDEF'] },
  { kind: 'group-invitation-existing', html: groupInvitationEmail('Acme', 'Groupe Demo', 'GRP-ABCDEF', true), marketing: false, shouldContain: ['/login?redirect='] },
  { kind: 'group-created', html: groupeCreatedEmail('Acme', 'Groupe Demo', 'GRP-XYZ123'), marketing: false, shouldContain: ['GRP-XYZ123', '/dashboard/groupe'] },
  { kind: 'group-joined-owner', html: groupeJoinedOwnerEmail('Acme', 'Confrere', '5'), marketing: false, shouldContain: ['Confrere', '-5%'] },
  { kind: 'group-ownership-transferred', html: groupeOwnershipTransferredEmail('NewOwner', 'OldOwner', 'Groupe Demo', 'GRP-XYZ', '10'), marketing: false, shouldContain: ['GRP-XYZ', 'OldOwner'] },
  { kind: 'group-left-owner', html: groupeLeftOwnerEmail('Owner', 'Leaver', '0'), marketing: false, shouldContain: ['Leaver'] },
  { kind: 'account-locked', html: accountLockedEmail('Acme', 10, 'https://panorama-pub.com/mot-de-passe-oublie'), marketing: false, shouldContain: ['10 minutes', 'mot-de-passe-oublie'] },
  { kind: 'password-changed', html: passwordChangedEmail('Acme', 'mailto:contact@panorama-pub.com'), marketing: false, shouldContain: ['mailto:contact@panorama-pub.com'] },
  { kind: 'email-changed', html: emailChangedEmail('Acme', 'old@example.com', 'new@example.com', 'mailto:contact@panorama-pub.com'), marketing: false, shouldContain: ['old@example.com', 'new@example.com'] },
  // subscriptionConfirmationEmail(planLabel, nomSociete) est générique : il rend le libellé
  // verbatim et n'inclut plus de montant (le prix n'est plus dans ce template).
  { kind: 'subscription-confirmation-premium', html: subscriptionConfirmationEmail('Premium', 'Acme'), marketing: false, shouldContain: ['Premium'] },
  { kind: 'subscription-confirmation-infinite', html: subscriptionConfirmationEmail('Infinite', 'Acme'), marketing: false, shouldContain: ['Infinite'] },
  { kind: 'expiration-warning-30', html: expirationWarningEmail('Acme', 30, 'Premium'), marketing: false, shouldContain: ['30 jours', 'Premium'] },
  { kind: 'expiration-warning-7', html: expirationWarningEmail('Acme', 7, 'Infinite'), marketing: false, shouldContain: ['7 jours'] },
  { kind: 'expiration-warning-1', html: expirationWarningEmail('Acme', 1), marketing: false, shouldContain: ['1 jour</strong>'] },
  { kind: 'payment-failed', html: paymentFailedEmail('Acme'), marketing: false, shouldContain: ['Échec de paiement'] },
  { kind: 'subscription-canceled', html: subscriptionCanceledEmail('Acme', '31/12/2026'), marketing: false, shouldContain: ['31/12/2026'] },
  { kind: 'subscription-cancel-scheduled', html: subscriptionCancelScheduledEmail('Acme', { planLabel: 'Premium', endDateISO: '2026-12-31T00:00:00.000Z' }), marketing: false, shouldContain: ['Premium', '31 décembre 2026'] },
  { kind: 'subscription-reactivated', html: subscriptionReactivatedEmail('Acme', { planLabel: 'Premium', nextRenewalDateISO: '2026-12-31T00:00:00.000Z', nextRenewalAmountCents: 9900 }), marketing: false, shouldContain: ['Premium', '99,00 EUR', '31 décembre 2026'] },
  { kind: 'plan-upgraded', html: planUpgradedEmail('Acme', { oldPlanLabel: 'Premium', newPlanLabel: 'Infinite', amountChargedCents: 7200, nextRenewalDateISO: '2026-12-31T00:00:00.000Z', nextRenewalAmountCents: 21900 }), marketing: false, shouldContain: ['Premium', 'Infinite', '72,00 EUR', '219,00 EUR'] },
  { kind: 'plan-downgrade-scheduled', html: planDowngradedScheduledEmail('Acme', { oldPlanLabel: 'Infinite', newPlanLabel: 'Premium', creditCents: 6500, nextRenewalDateISO: '2026-12-31T00:00:00.000Z', nextRenewalAmountCents: 9900, wipedFields: ['Video YouTube', '2 evenements archives'] }), marketing: false, shouldContain: ['Infinite', 'Premium', '65,00 EUR', 'Video YouTube', '2 evenements archives'] },
  { kind: 'plan-downgraded', html: planDowngradedEmail('Acme', 'Premium'), marketing: false, shouldContain: ['Premium'] },
  { kind: 'fiche-rejected-with-reason', html: ficheRejectedEmail('Acme', 'Contenu incomplet'), marketing: false, shouldContain: ['Contenu incomplet'] },
  { kind: 'fiche-rejected-no-reason', html: ficheRejectedEmail('Acme'), marketing: false, shouldContain: ['suspendue'] },
  { kind: 'evenement-rejected', html: evenementRejectedEmail('Acme', 'Salon', 'Doublon'), marketing: false, shouldContain: ['Salon', 'Doublon'] },
  { kind: 'account-deleted', html: accountDeletedEmail('Acme'), marketing: false, shouldContain: ['supprimé', 'RGPD'] },
  { kind: 'stripe-misconfig', html: stripeMisconfigAlertEmail({ userId: '1', stripeCustomerId: 'cus_1', subscriptionId: 'sub_1', priceId: 'price_x' }), marketing: false, shouldContain: ['price_x', 'cus_1'] },
]

describe('Email templates — structure', () => {
  it.each(cases)('$kind has DOCTYPE, title, brand wordmark, footer', ({ html }) => {
    expect(html).toContain('<!DOCTYPE html')
    expect(html).toContain('<html lang="fr"')
    expect(html).toContain('<title>')
    expect(html).toContain('</title>')
    // Le template rend la marque en wordmark texte (SITE_NAME), plus d'image /img/logo.png.
    expect(html).toContain(SITE_NAME)
    expect(html).toContain('Mentions legales')
  })

  it.each(cases)('$kind uses absolute HTTPS URLs (no relative links)', ({ html }) => {
    // Every href must be absolute (https:// or mailto:) — allow # anchors inside hrefs.
    const hrefs = Array.from(html.matchAll(/href="([^"#][^"]*)"/g)).map((m) => m[1])
    for (const href of hrefs) {
      const ok =
        href.startsWith('https://') ||
        href.startsWith('mailto:')
      expect(ok, `href not absolute: ${href}`).toBe(true)
    }
  })

  it.each(cases)('$kind contains no <script>, no external stylesheet, no emoji', ({ html }) => {
    expect(html).not.toMatch(/<script\b/i)
    expect(html).not.toMatch(/<link\s+[^>]*rel=["']?stylesheet/i)
    // Common emoji ranges
    expect(html).not.toMatch(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F9FF}]/u,
    )
  })
})

describe('Email templates — content assertions', () => {
  it.each(cases)('$kind contains expected fragments', ({ html, shouldContain }) => {
    for (const fragment of shouldContain ?? []) {
      expect(html).toContain(fragment)
    }
  })
})

describe('Email templates — footer kind (marketing vs transactional)', () => {
  it.each(cases)('$kind footer is correct type', ({ html, marketing }) => {
    const hasUnsubLink = html.includes('/api/emails/unsubscribe')
    if (marketing) {
      expect(hasUnsubLink, 'marketing email must contain unsubscribe link').toBe(true)
      expect(html).toContain('Se désabonner en un clic')
    } else {
      expect(hasUnsubLink, 'transactional email must NOT contain unsubscribe link').toBe(false)
    }
  })
})

describe('Email templates — XSS escaping', () => {
  it('escapes nomSociete in welcome email', () => {
    const html = welcomeEmail(XSS)
    expect(html).not.toContain('<script>alert(1)')
    expect(html).toContain(XSS_ESCAPED)
  })

  it('escapes nomSociete in csv invitation', () => {
    const html = csvInvitationEmail(XSS, XSS, XSS)
    expect(html).not.toContain('<script>alert(1)')
    // At least one occurrence of the escaped payload
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes raison in ficheRejectedEmail', () => {
    const html = ficheRejectedEmail('Acme', XSS)
    expect(html).not.toContain('<script>alert(1)')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes titre + raison in evenementRejectedEmail', () => {
    const html = evenementRejectedEmail('Acme', XSS, XSS)
    expect(html).not.toContain('<script>alert(1)')
  })

  it('escapes endDate in subscriptionCanceledEmail', () => {
    const html = subscriptionCanceledEmail('Acme', XSS)
    expect(html).not.toContain('<script>alert(1)')
  })

  it('escapes oldPlanLabel in planDowngradedEmail', () => {
    const html = planDowngradedEmail('Acme', XSS)
    expect(html).not.toContain('<script>alert(1)')
  })

  it('escapes planLabel in subscriptionCancelScheduledEmail', () => {
    const html = subscriptionCancelScheduledEmail(XSS, { planLabel: XSS, endDateISO: '2026-12-31T00:00:00.000Z' })
    expect(html).not.toContain('<script>alert(1)')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes planLabel in subscriptionReactivatedEmail', () => {
    const html = subscriptionReactivatedEmail(XSS, { planLabel: XSS, nextRenewalDateISO: '2026-12-31T00:00:00.000Z', nextRenewalAmountCents: 9900 })
    expect(html).not.toContain('<script>alert(1)')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes plan labels in planUpgradedEmail', () => {
    const html = planUpgradedEmail(XSS, { oldPlanLabel: XSS, newPlanLabel: XSS, amountChargedCents: 1000, nextRenewalDateISO: '2026-12-31T00:00:00.000Z', nextRenewalAmountCents: 21900 })
    expect(html).not.toContain('<script>alert(1)')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes plan labels + wipedFields in planDowngradedScheduledEmail', () => {
    const html = planDowngradedScheduledEmail(XSS, { oldPlanLabel: XSS, newPlanLabel: XSS, creditCents: 500, nextRenewalDateISO: '2026-12-31T00:00:00.000Z', nextRenewalAmountCents: 9900, wipedFields: [XSS, 'autre'] })
    expect(html).not.toContain('<script>alert(1)')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes heading (nomSociete) in groupeOwnershipTransferredEmail', () => {
    const html = groupeOwnershipTransferredEmail('Acme', 'Prev', XSS, 'GRP-X', '5')
    expect(html).not.toContain('<script>alert(1)')
  })
})

describe('Email templates — preheader length', () => {
  it.each(cases)('$kind preheader is <= 110 chars', ({ html }) => {
    const match = html.match(/<div[^>]*display:none[^>]*>\s*([\s\S]*?)\s*<\/div>/i)
    if (!match) return
    // Strip the trailing invisible padding (&zwnj;&nbsp; sequences)
    const visible = match[1].replace(/(&zwnj;|&nbsp;|\s)+$/g, '').trim()
    expect(visible.length).toBeLessThanOrEqual(110)
  })
})

describe('esc()', () => {
  it('escapes the 5 dangerous characters', () => {
    expect(esc('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#039;')
  })
  it('returns empty string for null/undefined', () => {
    expect(esc(null)).toBe('')
    expect(esc(undefined)).toBe('')
  })
})

describe('unsubscribe token (signature preserved)', () => {
  it('generates and verifies a valid token', () => {
    const t = generateUnsubscribeToken(42)
    expect(t.split('.').length).toBe(3)
    expect(verifyUnsubscribeToken(t)).toBe('42')
  })

  it('rejects a tampered token', () => {
    const t = generateUnsubscribeToken(42)
    const tampered = t.slice(0, -3) + 'XYZ'
    expect(verifyUnsubscribeToken(tampered)).toBeNull()
  })

  it('rejects a malformed token', () => {
    expect(verifyUnsubscribeToken('')).toBeNull()
    expect(verifyUnsubscribeToken('only.two')).toBeNull()
    expect(verifyUnsubscribeToken('a.b.c.d')).toBeNull()
  })
})

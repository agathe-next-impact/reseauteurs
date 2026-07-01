// Barrel re-export — preserves the public surface of the historical emails.ts
// file so every `import { ... } from '@/lib/emails'` keeps compiling.

export { esc } from './esc'
export { generateUnsubscribeToken, verifyUnsubscribeToken } from './tokens'

export {
  welcomeEmail,
  verifyEmailTemplate,
  forgotPasswordEmail,
  csvInvitationEmail,
  completionReminderEmail,
  upgradeNudgeEmail,
  groupLeverageEmail,
} from './templates/onboarding'

export {
  accountLockedEmail,
  passwordChangedEmail,
  emailChangedEmail,
  confirmEmailChangeEmail,
} from './templates/security'

export {
  subscriptionConfirmationEmail,
  expirationWarningEmail,
  paymentFailedEmail,
  subscriptionCanceledEmail,
  planDowngradedEmail,
  planUpgradedEmail,
  planDowngradedScheduledEmail,
  subscriptionCancelScheduledEmail,
  subscriptionReactivatedEmail,
} from './templates/subscription'

export {
  groupInvitationEmail,
  groupeCreatedEmail,
  groupeJoinedOwnerEmail,
  groupeOwnershipTransferredEmail,
  groupeLeftOwnerEmail,
  groupePalierUpgradeOwnerEmail,
  groupePalierUpgradeMemberEmail,
  groupePalierDowngradeOwnerEmail,
  groupePalierDowngradeMemberEmail,
  groupeAutoLeftDowngradeEmail,
} from './templates/groupes'

export {
  ficheRejectedEmail,
  evenementRejectedEmail,
  accountDeletedEmail,
} from './templates/moderation'

export { stripeMisconfigAlertEmail, userRegisteredAdminEmail } from './templates/admin'

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds `email_blacklisted` to the audit_logs type enum. Used by the Resend
 * webhook (/api/resend/webhook) to journalize every blacklist write — RGPD
 * traceability for a decision that silences all future mail to that user.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_audit_logs_type" ADD VALUE IF NOT EXISTS 'email_blacklisted';
  `)
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // PostgreSQL ne permet pas DROP VALUE sur un enum — no-op.
}

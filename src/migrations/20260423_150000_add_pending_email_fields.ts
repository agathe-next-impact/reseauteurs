import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Champs "pendingEmail*" sur users + valeur 'email_changed' sur l'enum audit_logs.
 *
 * Flow double-confirmation de changement d'email (POST /api/account/change-email
 * envoie un lien, GET /api/account/confirm-email-change applique). Le token est
 * stocke sous forme hashee (SHA-256 + PAYLOAD_SECRET) pour qu'une fuite DB ne
 * compromette pas les changements en cours.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pending_email" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pending_email_token_hash" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pending_email_expires_at" timestamp(3) with time zone;
    ALTER TYPE "public"."enum_audit_logs_type" ADD VALUE IF NOT EXISTS 'email_changed';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // PostgreSQL ne permet pas DROP VALUE sur un enum — on se contente de lacher
  // les colonnes. La valeur 'email_changed' survit (no-op acceptable).
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN IF EXISTS "pending_email_expires_at";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "pending_email_token_hash";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "pending_email";
  `)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the email blacklist fields on `users`. Set by the Resend webhook
 * (/api/resend/webhook) on hard bounce / spam complaint events so sendEmail()
 * stops firing to dead or complaint-generating addresses.
 *
 * Scoped migration: only includes the 3 new columns + enum type. Any other
 * schema drift (RGPD fields, audit_logs) belongs in its own migration.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_users_email_blacklisted_reason" AS ENUM('hard-bounce', 'complaint');
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_blacklisted" boolean DEFAULT false;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_blacklisted_reason" "enum_users_email_blacklisted_reason";
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_blacklisted_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN IF EXISTS "email_blacklisted_at";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "email_blacklisted_reason";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "email_blacklisted";
    DROP TYPE IF EXISTS "public"."enum_users_email_blacklisted_reason";
  `)
}

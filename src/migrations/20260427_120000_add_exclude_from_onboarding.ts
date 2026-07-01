import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the `excludeFromOnboarding` flag on `users`. Admin-only field used
 * to exclude internal test accounts, demos, or admin staff from the onboarding
 * email sequence (welcome rattrapage + J+3 / J+7 / J+14 nudges).
 *
 * Sourced from the 2026-04-26 09:00 UTC incident where 2 onboarding emails
 * leaked to internal testers because the only existing filter (emailBlacklisted)
 * is semantically "dead/spam-complaining inbox", not "test account".
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "exclude_from_onboarding" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN IF EXISTS "exclude_from_onboarding";
  `)
}

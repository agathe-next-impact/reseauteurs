import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration — `evenements.lieu_departement` (filtre par département — spec 2026-07-13).
 * Additif, nullable, indexé.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "lieu_departement" varchar;
    CREATE INDEX IF NOT EXISTS "evenements_lieu_departement_idx" ON "evenements" USING btree ("lieu_departement");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "evenements_lieu_departement_idx";
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "lieu_departement";
  `)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Décision 2026-07-17 — annuaire des réseaux nationaux « nom seul » :
 * `reseaux.ville` devient nullable (les 200 têtes seedées n'ont aucune autre
 * information que leur nom). Les formulaires self-service exigent toujours la
 * ville via Zod ; un local sans ville n'est simplement pas géocodé (pas de marqueur).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "reseaux" ALTER COLUMN "ville" DROP NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "reseaux" SET "ville" = '' WHERE "ville" IS NULL;
    ALTER TABLE "reseaux" ALTER COLUMN "ville" SET NOT NULL;
  `)
}

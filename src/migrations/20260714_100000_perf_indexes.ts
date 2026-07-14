import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration — index de performance (audit 2026-07-14).
 *
 *  1. `users` : index PARTIEL sur (plus_expire_at) WHERE plus_actif — le cron
 *     `expiration-plus` filtre `plus_actif = true AND plus_expire_at < now` et
 *     scannait toute la table `users`.
 *  2. `evenements.date_fin` : filtré par les cartes / le sitemap (greater_than_equal)
 *     alors que seul `date_debut` était indexé.
 *
 * Additif, sans impact sur les données.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "users_plus_actif_expire_idx"
      ON "users" USING btree ("plus_expire_at")
      WHERE "plus_actif" = true;
    CREATE INDEX IF NOT EXISTS "evenements_date_fin_idx"
      ON "evenements" USING btree ("date_fin");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "users_plus_actif_expire_idx";
    DROP INDEX IF EXISTS "evenements_date_fin_idx";
  `)
}

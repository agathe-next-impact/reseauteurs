import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration : enforce "1 user = 1 fiche fournisseur" at the DB level.
 *
 * Race-condition hardening — canCreateFiche() in collections/access.ts is a
 * read-check that can be raced by two parallel create requests. A UNIQUE
 * constraint on fournisseurs.user_id closes that window.
 *
 * Before applying in prod, confirm no duplicates exist:
 *   SELECT user_id, COUNT(*) FROM fournisseurs GROUP BY user_id HAVING COUNT(*) > 1;
 * If any row returns, resolve manually (keep the oldest, delete the rest)
 * before running this migration.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "fournisseurs"
        ADD CONSTRAINT "fournisseurs_user_id_unique" UNIQUE ("user_id");
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN duplicate_table THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "fournisseurs"
      DROP CONSTRAINT IF EXISTS "fournisseurs_user_id_unique";
  `)
}

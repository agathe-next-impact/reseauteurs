import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration : rend les fiches fournisseur orphelines possibles pour le seed
 * des 213 revendeurs. Les colonnes `user_id` et `activite_principale_id`
 * deviennent optionnelles.
 *
 * L'index UNIQUE sur `user_id` est conserve : Postgres traite les NULL comme
 * distincts, donc plusieurs fiches orphelines peuvent coexister, et la regle
 * "1 user = 1 fiche" est preservee pour les fiches revendiquees.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "fournisseurs" ALTER COLUMN "user_id" DROP NOT NULL;
    ALTER TABLE "fournisseurs" ALTER COLUMN "activite_principale_id" DROP NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "fournisseurs" ALTER COLUMN "user_id" SET NOT NULL;
    ALTER TABLE "fournisseurs" ALTER COLUMN "activite_principale_id" SET NOT NULL;
  `)
}

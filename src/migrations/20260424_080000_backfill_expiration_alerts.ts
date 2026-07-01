import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Normalise les colonnes `expiration_alerts_j{30,7}_sent` :
 *   1. Backfill NULL → false sur les rows anterieures a la migration
 *      20260420_100000_add_expiration_alerts_flags (cree les colonnes en
 *      DEFAULT false mais n'applique PAS le default retroactivement).
 *   2. Ajoute la contrainte NOT NULL pour garantir qu'aucune query Payload
 *      ne rebute sur une valeur inconnue.
 *
 * Contexte : le cron `/api/cron/expiration-alertes` renvoyait 500 avec
 * `Failed query: select...` car un filtre Payload `not_equals: true` sur une
 * colonne boolean nullable produit un SQL qui traite les NULL de facon
 * inattendue (SQL 3-valued logic : `NULL != true` = NULL, pas true). Les
 * rows avec NULL etaient soit exclues a tort, soit le planner generait une
 * requete invalide selon l'ordonnancement des and/or. Route patchee en
 * parallele pour utiliser `or: [equals:false, exists:false]`, cette migration
 * elimine definitivement le risque cote schema.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "users"
      SET "expiration_alerts_j30_sent" = COALESCE("expiration_alerts_j30_sent", false),
          "expiration_alerts_j7_sent" = COALESCE("expiration_alerts_j7_sent", false);
    ALTER TABLE "users" ALTER COLUMN "expiration_alerts_j30_sent" SET NOT NULL;
    ALTER TABLE "users" ALTER COLUMN "expiration_alerts_j7_sent" SET NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ALTER COLUMN "expiration_alerts_j30_sent" DROP NOT NULL;
    ALTER TABLE "users" ALTER COLUMN "expiration_alerts_j7_sent" DROP NOT NULL;
  `)
}

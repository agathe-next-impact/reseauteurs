import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration — `evenements.cree_par_user_id` (décision 2026-07-16).
 *
 * Un réseauteur PLUS peut se déclarer admin d'au plus 3 groupes locaux
 * (`reseauteurs.adminReseaux` — relation hasMany portée par `reseauteurs_rels`,
 * AUCUN DDL nécessaire : la colonne `reseaux_id` y existe déjà, seul le `path` change).
 *
 * En revanche, il peut désormais créer des événements POUR un groupe local
 * (reseau ≠ null, organisateurReseauteur = null — XOR conservé). Pour qu'il gère
 * SES événements de groupe sans pouvoir toucher à ceux du compte organisateur du
 * réseau, on trace le compte créateur : nouvelle colonne `cree_par_user_id`
 * (posée serveur à la création — hook beforeValidate, jamais le client).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "cree_par_user_id" integer;

    DO $$ BEGIN
      ALTER TABLE "evenements"
        ADD CONSTRAINT "evenements_cree_par_user_id_users_id_fk"
        FOREIGN KEY ("cree_par_user_id") REFERENCES "public"."users"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE INDEX IF NOT EXISTS "evenements_cree_par_user_idx"
      ON "evenements" USING btree ("cree_par_user_id");

    DO $$ BEGIN RAISE NOTICE '[migration 20260716_100000] evenements.cree_par_user_id : OK.'; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "evenements_cree_par_user_idx";
    ALTER TABLE "evenements" DROP CONSTRAINT IF EXISTS "evenements_cree_par_user_id_users_id_fk";
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "cree_par_user_id";
  `)
}

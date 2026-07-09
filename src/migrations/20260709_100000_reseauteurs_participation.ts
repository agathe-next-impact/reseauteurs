import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration — Participation réseauteur ↔ événement (M2M).
 *
 * Nouvelle fonctionnalité : un réseauteur signale sa présence aux événements des
 * réseaux qu'il fréquente (champ Payload `evenementsParticipes`, hasMany relationship
 * vers `evenements`).
 *
 * Payload stocke les relationships hasMany d'une collection dans SA table `_rels`
 * (`reseauteurs_rels`), en distinguant les champs par la colonne `path`. La table
 * possédait déjà `reseaux_id` (pour `reseauxFrequentes`) ; on ajoute la colonne
 * `evenements_id` pour le nouveau champ. Aucune nouvelle table.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "reseauteurs_rels" ADD COLUMN IF NOT EXISTS "evenements_id" integer;

    DO $$ BEGIN
      ALTER TABLE "reseauteurs_rels"
        ADD CONSTRAINT "reseauteurs_rels_evenements_fk"
        FOREIGN KEY ("evenements_id") REFERENCES "public"."evenements"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "reseauteurs_rels_evenements_idx"
      ON "reseauteurs_rels" USING btree ("evenements_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "reseauteurs_rels_evenements_idx";
    ALTER TABLE "reseauteurs_rels" DROP CONSTRAINT IF EXISTS "reseauteurs_rels_evenements_fk";
    ALTER TABLE "reseauteurs_rels" DROP COLUMN IF EXISTS "evenements_id";
  `)
}

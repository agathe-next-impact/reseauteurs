import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration — Fiche réseau complète (spec 2026-07-13).
 *
 * Ajoute à `reseaux` les champs de présentation demandés :
 *  - Localisation : departement, region
 *  - Type & portée : type_juridique (enum), portee (enum) — portee est DESCRIPTIVE,
 *    distincte du `niveau` hiérarchique (national/local) qui reste inchangé.
 *  - Responsable local : responsable_nom, responsable_fonction, responsable_photo_id (→ media)
 *  - Présentation : objectif, differenciateur, nombre_membres (déclaré, ≠ nb_reseauteurs dérivé)
 *  - Fonctionnement : public_concerne, ouvert_a_tous (enum oui/non), participation_invite,
 *    adhesion_obligatoire, une_profession_par_groupe, cotisation
 *  - Médias : plaquette_url (le média interne n'accepte que des images → lien PDF)
 *  - Validation : rempli_par
 *
 * Convention Payload : un champ `select` = enum `enum_reseaux_<field_snake>`.
 * Tout est additif et nullable (aucune donnée existante impactée).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ── Enums (idempotents)
    DO $$ BEGIN CREATE TYPE "public"."enum_reseaux_type_juridique" AS ENUM ('association','prive','franchise','institution','autre');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_reseaux_portee" AS ENUM ('local','regional','national','international');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_reseaux_ouvert_a_tous" AS ENUM ('oui','non');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_reseaux_participation_invite" AS ENUM ('oui','non');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_reseaux_adhesion_obligatoire" AS ENUM ('oui','non');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_reseaux_une_profession_par_groupe" AS ENUM ('oui','non');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- ── Localisation
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "departement" varchar;
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "region" varchar;

    -- ── Type & portée
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "type_juridique" "enum_reseaux_type_juridique";
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "portee" "enum_reseaux_portee";

    -- ── Responsable local
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "responsable_nom" varchar;
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "responsable_fonction" varchar;
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "responsable_photo_id" integer;
    DO $$ BEGIN
      ALTER TABLE "reseaux"
        ADD CONSTRAINT "reseaux_responsable_photo_id_media_id_fk"
        FOREIGN KEY ("responsable_photo_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "reseaux_responsable_photo_idx"
      ON "reseaux" USING btree ("responsable_photo_id");

    -- ── Présentation
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "objectif" varchar;
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "differenciateur" varchar;
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "nombre_membres" numeric;

    -- ── Fonctionnement
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "public_concerne" varchar;
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "ouvert_a_tous" "enum_reseaux_ouvert_a_tous";
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "participation_invite" "enum_reseaux_participation_invite";
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "adhesion_obligatoire" "enum_reseaux_adhesion_obligatoire";
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "une_profession_par_groupe" "enum_reseaux_une_profession_par_groupe";
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "cotisation" varchar;

    -- ── Médias & validation
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "plaquette_url" varchar;
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "rempli_par" varchar;

    -- Index géo secondaires (recherche par département/région)
    CREATE INDEX IF NOT EXISTS "reseaux_departement_idx" ON "reseaux" USING btree ("departement");
    CREATE INDEX IF NOT EXISTS "reseaux_region_idx" ON "reseaux" USING btree ("region");

    DO $$ BEGIN RAISE NOTICE '[migration 20260713_110000] fiche réseau complète : OK.'; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "reseaux" DROP CONSTRAINT IF EXISTS "reseaux_responsable_photo_id_media_id_fk";
    DROP INDEX IF EXISTS "reseaux_responsable_photo_idx";
    DROP INDEX IF EXISTS "reseaux_departement_idx";
    DROP INDEX IF EXISTS "reseaux_region_idx";

    ALTER TABLE "reseaux"
      DROP COLUMN IF EXISTS "departement",
      DROP COLUMN IF EXISTS "region",
      DROP COLUMN IF EXISTS "type_juridique",
      DROP COLUMN IF EXISTS "portee",
      DROP COLUMN IF EXISTS "responsable_nom",
      DROP COLUMN IF EXISTS "responsable_fonction",
      DROP COLUMN IF EXISTS "responsable_photo_id",
      DROP COLUMN IF EXISTS "objectif",
      DROP COLUMN IF EXISTS "differenciateur",
      DROP COLUMN IF EXISTS "nombre_membres",
      DROP COLUMN IF EXISTS "public_concerne",
      DROP COLUMN IF EXISTS "ouvert_a_tous",
      DROP COLUMN IF EXISTS "participation_invite",
      DROP COLUMN IF EXISTS "adhesion_obligatoire",
      DROP COLUMN IF EXISTS "une_profession_par_groupe",
      DROP COLUMN IF EXISTS "cotisation",
      DROP COLUMN IF EXISTS "plaquette_url",
      DROP COLUMN IF EXISTS "rempli_par";

    DROP TYPE IF EXISTS "public"."enum_reseaux_type_juridique";
    DROP TYPE IF EXISTS "public"."enum_reseaux_portee";
    DROP TYPE IF EXISTS "public"."enum_reseaux_ouvert_a_tous";
    DROP TYPE IF EXISTS "public"."enum_reseaux_participation_invite";
    DROP TYPE IF EXISTS "public"."enum_reseaux_adhesion_obligatoire";
    DROP TYPE IF EXISTS "public"."enum_reseaux_une_profession_par_groupe";
  `)
}

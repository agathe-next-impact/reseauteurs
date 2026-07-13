import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration — Fiche événement complète (spec 2026-07-13).
 *
 * Ajoute à `evenements` :
 *  - Présentation : description_courte, intervenants (description existante = détaillée).
 *  - Participation : gratuit (bool), tarif, nombre_places, date_limite_inscription,
 *    ouvert_a_tous / reserve_membres / participation_invite (enum oui/non).
 *  - Contact : contact_nom, contact_email, contact_telephone.
 *  - Catégorisation : public_concerne, secteur_id (→ categories), niveau_public (enum).
 *  - Infos pratiques : parking (bool), acces_pmr (bool), infos_pratiques.
 *  - Validation : cree_par.
 *  - Médias : table array `evenements_galerie` (photos).
 *
 * Tout additif et nullable — aucune donnée existante impactée.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Enums (convention Payload : enum_evenements_<field>)
    DO $$ BEGIN CREATE TYPE "public"."enum_evenements_niveau_public" AS ENUM ('debutant','confirme','tous');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_evenements_ouvert_a_tous" AS ENUM ('oui','non');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_evenements_reserve_membres" AS ENUM ('oui','non');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_evenements_participation_invite" AS ENUM ('oui','non');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- Présentation
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "description_courte" varchar;
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "intervenants" varchar;

    -- Contact
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "contact_nom" varchar;
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "contact_email" varchar;
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "contact_telephone" varchar;

    -- Catégorisation
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "public_concerne" varchar;
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "secteur_id" integer;
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "niveau_public" "enum_evenements_niveau_public";
    DO $$ BEGIN
      ALTER TABLE "evenements"
        ADD CONSTRAINT "evenements_secteur_id_categories_id_fk"
        FOREIGN KEY ("secteur_id") REFERENCES "public"."categories"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "evenements_secteur_idx" ON "evenements" USING btree ("secteur_id");

    -- Participation
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "gratuit" boolean DEFAULT true;
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "tarif" varchar;
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "nombre_places" numeric;
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "date_limite_inscription" timestamp(3) with time zone;
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "ouvert_a_tous" "enum_evenements_ouvert_a_tous";
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "reserve_membres" "enum_evenements_reserve_membres";
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "participation_invite" "enum_evenements_participation_invite";
    CREATE INDEX IF NOT EXISTS "evenements_gratuit_idx" ON "evenements" USING btree ("gratuit");

    -- Infos pratiques & validation
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "parking" boolean DEFAULT false;
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "acces_pmr" boolean DEFAULT false;
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "infos_pratiques" varchar;
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "cree_par" varchar;

    -- Galerie (array Payload)
    CREATE TABLE IF NOT EXISTS "evenements_galerie" (
      "_order"      integer NOT NULL,
      "_parent_id"  integer NOT NULL,
      "id"          varchar PRIMARY KEY NOT NULL,
      "image_id"    integer NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE "evenements_galerie"
        ADD CONSTRAINT "evenements_galerie_image_id_media_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "evenements_galerie"
        ADD CONSTRAINT "evenements_galerie_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."evenements"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "evenements_galerie_order_idx" ON "evenements_galerie" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "evenements_galerie_parent_id_idx" ON "evenements_galerie" USING btree ("_parent_id");

    DO $$ BEGIN RAISE NOTICE '[migration 20260713_130000] fiche événement complète : OK.'; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "evenements_galerie";
    ALTER TABLE "evenements" DROP CONSTRAINT IF EXISTS "evenements_secteur_id_categories_id_fk";
    DROP INDEX IF EXISTS "evenements_secteur_idx";
    DROP INDEX IF EXISTS "evenements_gratuit_idx";

    ALTER TABLE "evenements"
      DROP COLUMN IF EXISTS "description_courte",
      DROP COLUMN IF EXISTS "intervenants",
      DROP COLUMN IF EXISTS "contact_nom",
      DROP COLUMN IF EXISTS "contact_email",
      DROP COLUMN IF EXISTS "contact_telephone",
      DROP COLUMN IF EXISTS "public_concerne",
      DROP COLUMN IF EXISTS "secteur_id",
      DROP COLUMN IF EXISTS "niveau_public",
      DROP COLUMN IF EXISTS "gratuit",
      DROP COLUMN IF EXISTS "tarif",
      DROP COLUMN IF EXISTS "nombre_places",
      DROP COLUMN IF EXISTS "date_limite_inscription",
      DROP COLUMN IF EXISTS "ouvert_a_tous",
      DROP COLUMN IF EXISTS "reserve_membres",
      DROP COLUMN IF EXISTS "participation_invite",
      DROP COLUMN IF EXISTS "parking",
      DROP COLUMN IF EXISTS "acces_pmr",
      DROP COLUMN IF EXISTS "infos_pratiques",
      DROP COLUMN IF EXISTS "cree_par";

    DROP TYPE IF EXISTS "public"."enum_evenements_niveau_public";
    DROP TYPE IF EXISTS "public"."enum_evenements_ouvert_a_tous";
    DROP TYPE IF EXISTS "public"."enum_evenements_reserve_membres";
    DROP TYPE IF EXISTS "public"."enum_evenements_participation_invite";
  `)
}

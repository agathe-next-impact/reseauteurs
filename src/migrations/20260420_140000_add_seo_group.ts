import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the shared `seo` field group to all public-facing collections:
 * Fournisseurs, Evenements, OrganisateursEvenements, CategoriesActivite, TypesEvenement.
 *
 * Columns: seo_title (varchar), seo_description (varchar), seo_keywords (varchar),
 * seo_og_image_id (int FK to media), seo_noindex (boolean).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- fournisseurs
    ALTER TABLE "fournisseurs" ADD COLUMN IF NOT EXISTS "seo_title" varchar;
    ALTER TABLE "fournisseurs" ADD COLUMN IF NOT EXISTS "seo_description" varchar;
    ALTER TABLE "fournisseurs" ADD COLUMN IF NOT EXISTS "seo_keywords" varchar;
    ALTER TABLE "fournisseurs" ADD COLUMN IF NOT EXISTS "seo_og_image_id" integer;
    ALTER TABLE "fournisseurs" ADD COLUMN IF NOT EXISTS "seo_noindex" boolean DEFAULT false;
    DO $$ BEGIN
      ALTER TABLE "fournisseurs" ADD CONSTRAINT "fournisseurs_seo_og_image_id_media_id_fk"
        FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "fournisseurs_seo_seo_og_image_idx" ON "fournisseurs" USING btree ("seo_og_image_id");

    -- evenements
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "seo_title" varchar;
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "seo_description" varchar;
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "seo_keywords" varchar;
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "seo_og_image_id" integer;
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "seo_noindex" boolean DEFAULT false;
    DO $$ BEGIN
      ALTER TABLE "evenements" ADD CONSTRAINT "evenements_seo_og_image_id_media_id_fk"
        FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "evenements_seo_seo_og_image_idx" ON "evenements" USING btree ("seo_og_image_id");

    -- organisateurs_evenements
    ALTER TABLE "organisateurs_evenements" ADD COLUMN IF NOT EXISTS "seo_title" varchar;
    ALTER TABLE "organisateurs_evenements" ADD COLUMN IF NOT EXISTS "seo_description" varchar;
    ALTER TABLE "organisateurs_evenements" ADD COLUMN IF NOT EXISTS "seo_keywords" varchar;
    ALTER TABLE "organisateurs_evenements" ADD COLUMN IF NOT EXISTS "seo_og_image_id" integer;
    ALTER TABLE "organisateurs_evenements" ADD COLUMN IF NOT EXISTS "seo_noindex" boolean DEFAULT false;
    DO $$ BEGIN
      ALTER TABLE "organisateurs_evenements" ADD CONSTRAINT "organisateurs_evenements_seo_og_image_id_media_id_fk"
        FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "organisateurs_evenements_seo_seo_og_image_idx" ON "organisateurs_evenements" USING btree ("seo_og_image_id");

    -- categories_activite
    ALTER TABLE "categories_activite" ADD COLUMN IF NOT EXISTS "seo_title" varchar;
    ALTER TABLE "categories_activite" ADD COLUMN IF NOT EXISTS "seo_description" varchar;
    ALTER TABLE "categories_activite" ADD COLUMN IF NOT EXISTS "seo_keywords" varchar;
    ALTER TABLE "categories_activite" ADD COLUMN IF NOT EXISTS "seo_og_image_id" integer;
    ALTER TABLE "categories_activite" ADD COLUMN IF NOT EXISTS "seo_noindex" boolean DEFAULT false;
    DO $$ BEGIN
      ALTER TABLE "categories_activite" ADD CONSTRAINT "categories_activite_seo_og_image_id_media_id_fk"
        FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "categories_activite_seo_seo_og_image_idx" ON "categories_activite" USING btree ("seo_og_image_id");

    -- types_evenement
    ALTER TABLE "types_evenement" ADD COLUMN IF NOT EXISTS "seo_title" varchar;
    ALTER TABLE "types_evenement" ADD COLUMN IF NOT EXISTS "seo_description" varchar;
    ALTER TABLE "types_evenement" ADD COLUMN IF NOT EXISTS "seo_keywords" varchar;
    ALTER TABLE "types_evenement" ADD COLUMN IF NOT EXISTS "seo_og_image_id" integer;
    ALTER TABLE "types_evenement" ADD COLUMN IF NOT EXISTS "seo_noindex" boolean DEFAULT false;
    DO $$ BEGIN
      ALTER TABLE "types_evenement" ADD CONSTRAINT "types_evenement_seo_og_image_id_media_id_fk"
        FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "types_evenement_seo_seo_og_image_idx" ON "types_evenement" USING btree ("seo_og_image_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- fournisseurs
    DROP INDEX IF EXISTS "fournisseurs_seo_seo_og_image_idx";
    ALTER TABLE "fournisseurs" DROP CONSTRAINT IF EXISTS "fournisseurs_seo_og_image_id_media_id_fk";
    ALTER TABLE "fournisseurs" DROP COLUMN IF EXISTS "seo_title";
    ALTER TABLE "fournisseurs" DROP COLUMN IF EXISTS "seo_description";
    ALTER TABLE "fournisseurs" DROP COLUMN IF EXISTS "seo_keywords";
    ALTER TABLE "fournisseurs" DROP COLUMN IF EXISTS "seo_og_image_id";
    ALTER TABLE "fournisseurs" DROP COLUMN IF EXISTS "seo_noindex";

    -- evenements
    DROP INDEX IF EXISTS "evenements_seo_seo_og_image_idx";
    ALTER TABLE "evenements" DROP CONSTRAINT IF EXISTS "evenements_seo_og_image_id_media_id_fk";
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "seo_title";
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "seo_description";
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "seo_keywords";
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "seo_og_image_id";
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "seo_noindex";

    -- organisateurs_evenements
    DROP INDEX IF EXISTS "organisateurs_evenements_seo_seo_og_image_idx";
    ALTER TABLE "organisateurs_evenements" DROP CONSTRAINT IF EXISTS "organisateurs_evenements_seo_og_image_id_media_id_fk";
    ALTER TABLE "organisateurs_evenements" DROP COLUMN IF EXISTS "seo_title";
    ALTER TABLE "organisateurs_evenements" DROP COLUMN IF EXISTS "seo_description";
    ALTER TABLE "organisateurs_evenements" DROP COLUMN IF EXISTS "seo_keywords";
    ALTER TABLE "organisateurs_evenements" DROP COLUMN IF EXISTS "seo_og_image_id";
    ALTER TABLE "organisateurs_evenements" DROP COLUMN IF EXISTS "seo_noindex";

    -- categories_activite
    DROP INDEX IF EXISTS "categories_activite_seo_seo_og_image_idx";
    ALTER TABLE "categories_activite" DROP CONSTRAINT IF EXISTS "categories_activite_seo_og_image_id_media_id_fk";
    ALTER TABLE "categories_activite" DROP COLUMN IF EXISTS "seo_title";
    ALTER TABLE "categories_activite" DROP COLUMN IF EXISTS "seo_description";
    ALTER TABLE "categories_activite" DROP COLUMN IF EXISTS "seo_keywords";
    ALTER TABLE "categories_activite" DROP COLUMN IF EXISTS "seo_og_image_id";
    ALTER TABLE "categories_activite" DROP COLUMN IF EXISTS "seo_noindex";

    -- types_evenement
    DROP INDEX IF EXISTS "types_evenement_seo_seo_og_image_idx";
    ALTER TABLE "types_evenement" DROP CONSTRAINT IF EXISTS "types_evenement_seo_og_image_id_media_id_fk";
    ALTER TABLE "types_evenement" DROP COLUMN IF EXISTS "seo_title";
    ALTER TABLE "types_evenement" DROP COLUMN IF EXISTS "seo_description";
    ALTER TABLE "types_evenement" DROP COLUMN IF EXISTS "seo_keywords";
    ALTER TABLE "types_evenement" DROP COLUMN IF EXISTS "seo_og_image_id";
    ALTER TABLE "types_evenement" DROP COLUMN IF EXISTS "seo_noindex";
  `)
}

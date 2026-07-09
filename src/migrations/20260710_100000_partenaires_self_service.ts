import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration — Partenaires self-service (rôle partenaire + fiche self-service + offre).
 *
 * 1. Ajoute la valeur 'partenaire' à l'enum users.role (recréation de l'enum —
 *    pattern transaction-safe, cf. 20260628_160000_users_roles).
 * 2. Ajoute sur `partenaires` : user_id (propriétaire 1-1), slug (fiche perso),
 *    offre_{titre,description,lien} (offre réservée aux réseauteurs), et rend
 *    logo_id nullable (fiche squelette au signup, logo ajouté ensuite).
 * 3. Backfill des slugs pour les partenaires existants (unicité via suffixe id).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1. Rôle 'partenaire' — recréation de l'enum (transaction-safe)
    ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
    DROP TYPE IF EXISTS "public"."enum_users_role";
    CREATE TYPE "public"."enum_users_role" AS ENUM ('reseauteur', 'organisateur', 'partenaire', 'admin');
    ALTER TABLE "users"
      ALTER COLUMN "role" SET DEFAULT 'reseauteur'::"public"."enum_users_role",
      ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";

    -- 2. Colonnes self-service sur partenaires
    ALTER TABLE "partenaires" ADD COLUMN IF NOT EXISTS "user_id" integer;
    ALTER TABLE "partenaires" ADD COLUMN IF NOT EXISTS "slug" varchar;
    ALTER TABLE "partenaires" ADD COLUMN IF NOT EXISTS "offre_titre" varchar;
    ALTER TABLE "partenaires" ADD COLUMN IF NOT EXISTS "offre_description" varchar;
    ALTER TABLE "partenaires" ADD COLUMN IF NOT EXISTS "offre_lien" varchar;

    -- Logo désormais optionnel (squelette au signup)
    ALTER TABLE "partenaires" ALTER COLUMN "logo_id" DROP NOT NULL;

    -- FK propriétaire (1 user = 1 partenaire)
    DO $$ BEGIN
      ALTER TABLE "partenaires"
        ADD CONSTRAINT "partenaires_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    -- Index uniques partiels (plusieurs NULL autorisés pour les fiches admin sans compte)
    CREATE UNIQUE INDEX IF NOT EXISTS "partenaires_user_idx"
      ON "partenaires" ("user_id") WHERE "user_id" IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS "partenaires_slug_idx"
      ON "partenaires" ("slug") WHERE "slug" IS NOT NULL;

    -- Backfill slug des partenaires existants (unicité garantie par le suffixe id)
    UPDATE "partenaires"
      SET "slug" = COALESCE(
        NULLIF(trim(both '-' from regexp_replace(lower("nom"), '[^a-z0-9]+', '-', 'g')), ''),
        'partenaire'
      ) || '-' || "id"
      WHERE "slug" IS NULL AND "nom" IS NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "partenaires_slug_idx";
    DROP INDEX IF EXISTS "partenaires_user_idx";
    ALTER TABLE "partenaires" DROP CONSTRAINT IF EXISTS "partenaires_user_id_users_id_fk";
    ALTER TABLE "partenaires" DROP COLUMN IF EXISTS "offre_lien";
    ALTER TABLE "partenaires" DROP COLUMN IF EXISTS "offre_description";
    ALTER TABLE "partenaires" DROP COLUMN IF EXISTS "offre_titre";
    ALTER TABLE "partenaires" DROP COLUMN IF EXISTS "slug";
    ALTER TABLE "partenaires" DROP COLUMN IF EXISTS "user_id";

    -- Rôle : reconvertir les partenaires en réseauteurs puis retirer la valeur de l'enum
    ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
    UPDATE "users" SET "role" = 'reseauteur' WHERE "role" = 'partenaire';
    DROP TYPE IF EXISTS "public"."enum_users_role";
    CREATE TYPE "public"."enum_users_role" AS ENUM ('reseauteur', 'organisateur', 'admin');
    ALTER TABLE "users"
      ALTER COLUMN "role" SET DEFAULT 'reseauteur'::"public"."enum_users_role",
      ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";
  `)
}

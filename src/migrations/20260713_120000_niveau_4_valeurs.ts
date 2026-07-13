import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration — `niveau` réseau à 4 valeurs, fusion de `portee` (réconciliation 2026-07-13).
 *
 * Décision produit : « portée » et « niveau » = une SEULE caractéristique à 4 valeurs
 * (local / régional / national / international). La hiérarchie umbrella reste à 2 étages :
 *   - TÊTE de réseau = régional / national / international (parent NULL, porte l'abonnement) ;
 *   - CHAPITRE = local (parent = une tête).
 *
 * Opérations :
 *   1. enum_reseaux_niveau : {national, local} → {local, regional, national, international}
 *      (swap sûr cast→text / DROP / CREATE / cast→enum — jamais ALTER TYPE ADD VALUE,
 *      transaction-unsafe). Données existantes conservées (national/local inchangés).
 *   2. Index unique partiel : « 1 national par compte » → « 1 TÊTE (non-local) par compte ».
 *   3. Suppression de la colonne/enum `portee` (créés par 20260713_110000, désormais fusionnés).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1. Libère les index dépendant de la colonne niveau
    DROP INDEX IF EXISTS "reseaux_user_national_unique_idx";
    DROP INDEX IF EXISTS "reseaux_niveau_idx";

    -- 2. Swap de l'enum niveau (cast→text / recreate / cast→enum)
    ALTER TABLE "reseaux" ALTER COLUMN "niveau" DROP DEFAULT;
    ALTER TABLE "reseaux" ALTER COLUMN "niveau" TYPE text USING "niveau"::text;
    DROP TYPE IF EXISTS "enum_reseaux_niveau";
    CREATE TYPE "enum_reseaux_niveau" AS ENUM ('local', 'regional', 'national', 'international');
    ALTER TABLE "reseaux" ALTER COLUMN "niveau" TYPE "enum_reseaux_niveau" USING "niveau"::"enum_reseaux_niveau";
    ALTER TABLE "reseaux" ALTER COLUMN "niveau" SET DEFAULT 'national';

    -- 3. Recrée les index (unicité désormais sur les TÊTES = non-local)
    CREATE INDEX IF NOT EXISTS "reseaux_niveau_idx" ON "reseaux" USING btree ("niveau");
    CREATE UNIQUE INDEX IF NOT EXISTS "reseaux_user_tete_unique_idx"
      ON "reseaux" ("user_id")
      WHERE "niveau" <> 'local' AND "user_id" IS NOT NULL;

    -- 4. Fusion : suppression de la colonne portee (remplacee par niveau a 4 valeurs)
    ALTER TABLE "reseaux" DROP COLUMN IF EXISTS "portee";
    DROP TYPE IF EXISTS "enum_reseaux_portee";

    DO $$ BEGIN RAISE NOTICE '[migration 20260713_120000] niveau 4 valeurs + fusion portee : OK.'; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "reseaux_user_tete_unique_idx";
    DROP INDEX IF EXISTS "reseaux_niveau_idx";

    -- Rétablit niveau à 2 valeurs (régional/international rabattus sur national)
    ALTER TABLE "reseaux" ALTER COLUMN "niveau" DROP DEFAULT;
    ALTER TABLE "reseaux" ALTER COLUMN "niveau" TYPE text USING "niveau"::text;
    UPDATE "reseaux" SET "niveau" = 'national' WHERE "niveau" IN ('regional', 'international');
    DROP TYPE IF EXISTS "enum_reseaux_niveau";
    CREATE TYPE "enum_reseaux_niveau" AS ENUM ('national', 'local');
    ALTER TABLE "reseaux" ALTER COLUMN "niveau" TYPE "enum_reseaux_niveau" USING "niveau"::"enum_reseaux_niveau";
    ALTER TABLE "reseaux" ALTER COLUMN "niveau" SET DEFAULT 'national';

    CREATE INDEX IF NOT EXISTS "reseaux_niveau_idx" ON "reseaux" USING btree ("niveau");
    CREATE UNIQUE INDEX IF NOT EXISTS "reseaux_user_national_unique_idx"
      ON "reseaux" ("user_id")
      WHERE "niveau" = 'national' AND "user_id" IS NOT NULL;

    -- Restaure la colonne/enum portee
    DO $$ BEGIN CREATE TYPE "enum_reseaux_portee" AS ENUM ('local', 'regional', 'national', 'international');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "portee" "enum_reseaux_portee";
  `)
}

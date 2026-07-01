import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Introduit un slug parlant pour les evenements (base sur `titre`),
 * remplace la pratique actuelle d'URL `/evenements/{id}` par `/evenements/{slug}`.
 *
 * Strategie :
 *   1. ADD COLUMN `slug` nullable.
 *   2. Backfill SQL : slug = unaccent + lowercase + non-alnum => '-' a partir du titre.
 *   3. Deduplication par ROW_NUMBER : les occurrences >= 2 d'un meme slug sont
 *      suffixees par `-${id}` (deterministe, stable, reversible).
 *   4. CREATE UNIQUE INDEX.
 *   5. SET NOT NULL (toutes les lignes sont desormais alimentees).
 *
 * Le hook `beforeValidate` de la collection `evenements` regenere le slug uniquement
 * a la CREATION — les docs existants backfillees conservent leur slug meme si le
 * titre change ensuite, pour ne pas casser les URLs partagees / sitemap.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Requis pour la generation d'un slug sans accents — disponible sur Neon.
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS unaccent;`)

  await db.execute(sql`
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "slug" varchar;
  `)

  // Backfill initial — slugification naive sur titre.
  await db.execute(sql`
    UPDATE "evenements"
    SET "slug" = NULLIF(
      trim(BOTH '-' FROM regexp_replace(lower(unaccent(coalesce("titre", ''))), '[^a-z0-9]+', '-', 'g')),
      ''
    )
    WHERE "slug" IS NULL;
  `)

  // Fallback pour les docs dont le titre ne produit aucun slug exploitable
  // (vide, que des caracteres speciaux...). Doit rester unique.
  await db.execute(sql`
    UPDATE "evenements"
    SET "slug" = 'evenement-' || id::text
    WHERE "slug" IS NULL OR "slug" = '';
  `)

  // Deduplication : conserve le slug brut pour le plus petit id, suffixe les autres.
  await db.execute(sql`
    WITH dups AS (
      SELECT id, slug,
             ROW_NUMBER() OVER (PARTITION BY slug ORDER BY id) AS rn
      FROM "evenements"
    )
    UPDATE "evenements" e
    SET "slug" = dups.slug || '-' || e.id::text
    FROM dups
    WHERE e.id = dups.id AND dups.rn > 1;
  `)

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "evenements_slug_idx"
      ON "evenements" USING btree ("slug");
  `)

  await db.execute(sql`
    ALTER TABLE "evenements" ALTER COLUMN "slug" SET NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "evenements_slug_idx";
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "slug";
  `)
}

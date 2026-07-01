import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration E1.1 / E1.2 — Hiérarchie réseaux national↔local (ADR-0012).
 *
 * ADDITIF (safe) — aucune donnée supprimée par up().
 *
 * Opérations :
 *   1. Ajout enum `niveau` {national, local} sur `reseaux` (défaut 'national').
 *   2. Ajout colonne `parent_id` FK self-référentielle (nullable).
 *   3. Ajout colonne `palier` varchar (valeur de palier Stripe — null par défaut).
 *   4. Index sur niveau, parent_id, palier.
 *   5. Remplacement de l'index partiel unique `reseaux.user WHERE user_id IS NOT NULL`
 *      par `WHERE niveau = 'national'` (« 1 user = au plus 1 réseau national »).
 *
 * Rollback (down) :
 *   - Supprime le nouvel index unique partiel (WHERE niveau = 'national')
 *   - Recrée l'ancien index unique partiel (WHERE user_id IS NOT NULL)
 *   - Supprime les colonnes niveau, parent_id, palier
 *   - Supprime l'enum enum_reseaux_niveau
 *   ⚠️ DESTRUCTIF si des locaux ont été créés (parent_id perd ces données).
 *      Dry-run obligatoire — voir MIGRATION.md §E1.
 *
 * Note sur l'index partiel :
 *   Le nom exact de l'index existant peut varier selon les migrations précédentes.
 *   On utilise DROP INDEX IF EXISTS avec les noms candidats et CREATE INDEX IF NOT EXISTS.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ================================================================
    -- 1. Enum niveau (national | local)
    -- ================================================================
    DO $$ BEGIN
      CREATE TYPE "public"."enum_reseaux_niveau" AS ENUM ('national', 'local');
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'Type enum_reseaux_niveau existe déjà — ignoré.';
    END $$;

    -- ================================================================
    -- 2. Colonne niveau (défaut 'national' pour les lignes existantes)
    -- ================================================================
    ALTER TABLE "reseaux"
      ADD COLUMN IF NOT EXISTS "niveau"
        "public"."enum_reseaux_niveau"
        NOT NULL
        DEFAULT 'national';

    -- ================================================================
    -- 3. Colonne parent_id (FK self-référentielle nullable)
    -- ================================================================
    ALTER TABLE "reseaux"
      ADD COLUMN IF NOT EXISTS "parent_id" integer;

    -- Contrainte FK sur parent_id (best-effort : ignore si déjà présente)
    DO $$ BEGIN
      ALTER TABLE "reseaux"
        ADD CONSTRAINT "reseaux_parent_id_fk"
        FOREIGN KEY ("parent_id")
        REFERENCES "reseaux"("id")
        ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'Contrainte reseaux_parent_id_fk existe déjà — ignorée.';
    END $$;

    -- ================================================================
    -- 4. Colonne palier (valeur de palier abonnement, null par défaut)
    -- ⚠️ TODO : valeurs réelles à définir avant E2.A (accounts-and-billing)
    -- ================================================================
    ALTER TABLE "reseaux"
      ADD COLUMN IF NOT EXISTS "palier" varchar;

    -- ================================================================
    -- 5. Index additifs
    -- ================================================================

    -- Index sur niveau (filtrage annuaire/carte — requête très fréquente)
    CREATE INDEX IF NOT EXISTS "reseaux_niveau_idx"
      ON "reseaux" USING btree ("niveau");

    -- Index sur parent_id (résolution de la hiérarchie, comptage des locaux)
    CREATE INDEX IF NOT EXISTS "reseaux_parent_id_idx"
      ON "reseaux" USING btree ("parent_id");

    -- Index sur palier (gate de capacité peutCreerLocal)
    CREATE INDEX IF NOT EXISTS "reseaux_palier_idx"
      ON "reseaux" USING btree ("palier")
      WHERE "palier" IS NOT NULL;

    -- Index composite niveau + statut (filtrage carte des locaux publiés)
    CREATE INDEX IF NOT EXISTS "reseaux_niveau_statut_idx"
      ON "reseaux" USING btree ("niveau", "statut");

    -- ================================================================
    -- 6. Remplacement de l'index partiel unique user (ADR-0012 E1.2)
    --
    -- Ancienne règle : 1 user = 1 réseau  (WHERE user_id IS NOT NULL)
    -- Nouvelle règle : 1 user = au plus 1 réseau NATIONAL  (WHERE niveau = 'national')
    --
    -- On tente de dropper les noms candidats connus (nom généré par Payload ou
    -- par la migration 20260623_110000_create_reseaux). Si aucun ne correspond,
    -- le RAISE NOTICE l'indique (l'humain devra le dropper manuellement — cf. MIGRATION.md).
    -- ================================================================
    DO $$ BEGIN
      DROP INDEX IF EXISTS "reseaux_user_id_unique";
    END $$;
    DO $$ BEGIN
      DROP INDEX IF EXISTS "reseaux_user_unique";
    END $$;
    DO $$ BEGIN
      DROP INDEX IF EXISTS "reseaux_user_idx_unique";
    END $$;

    -- Nouvel index unique partiel : 1 national par user
    CREATE UNIQUE INDEX IF NOT EXISTS "reseaux_user_national_unique_idx"
      ON "reseaux" ("user_id")
      WHERE "niveau" = 'national' AND "user_id" IS NOT NULL;

    -- ================================================================
    -- 7. Rapport
    -- ================================================================
    DO $$
    DECLARE
      nb_total  integer;
      nb_nat    integer;
    BEGIN
      SELECT COUNT(*) INTO nb_total FROM reseaux;
      SELECT COUNT(*) INTO nb_nat FROM reseaux WHERE niveau = 'national';
      RAISE NOTICE
        '[migration 20260630_100000] reseaux : % total, % national (défaut appliqué). Colonnes niveau/parent_id/palier ajoutées. Index partiel unique user→national créé.',
        nb_total, nb_nat;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- ⚠️ DESTRUCTIF si des réseaux locaux ont été créés (parent_id perd ces données).
    -- ⚠️ Dry-run obligatoire — voir MIGRATION.md §E1.

    -- Supprimer le nouvel index unique partiel national
    DROP INDEX IF EXISTS "reseaux_user_national_unique_idx";

    -- Recréer l'ancien index unique partiel (WHERE user_id IS NOT NULL)
    CREATE UNIQUE INDEX IF NOT EXISTS "reseaux_user_id_unique"
      ON "reseaux" ("user_id")
      WHERE "user_id" IS NOT NULL;

    -- Supprimer les index additifs
    DROP INDEX IF EXISTS "reseaux_niveau_statut_idx";
    DROP INDEX IF EXISTS "reseaux_palier_idx";
    DROP INDEX IF EXISTS "reseaux_parent_id_idx";
    DROP INDEX IF EXISTS "reseaux_niveau_idx";

    -- Supprimer la contrainte FK parent
    ALTER TABLE "reseaux" DROP CONSTRAINT IF EXISTS "reseaux_parent_id_fk";

    -- Supprimer les colonnes
    ALTER TABLE "reseaux" DROP COLUMN IF EXISTS "palier";
    ALTER TABLE "reseaux" DROP COLUMN IF EXISTS "parent_id";
    ALTER TABLE "reseaux" DROP COLUMN IF EXISTS "niveau";

    -- Supprimer l'enum
    DROP TYPE IF EXISTS "public"."enum_reseaux_niveau";

    DO $$
    BEGIN
      RAISE NOTICE '[migration 20260630_100000 DOWN] Hiérarchie réseaux annulée. Ancien index unique user restauré.';
    END $$;
  `)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration — Recalibrage de l'enum users.role (ADR-0011 §2).
 *
 * AVANT : admin / fournisseur / organisateur
 * APRÈS : reseauteur / organisateur / admin
 *
 * Règle de conversion :
 *   fournisseur → reseauteur  (dans le nouveau modèle, tout non-organisateur = réseauteur)
 *   organisateur → organisateur (inchangé)
 *   admin → admin (inchangé)
 *
 * Champ `plan` :
 *   L'enum plan (acces/developpement/premium) est converti en text simple.
 *   Le champ devient DORMANT (ADR-0011 : pas de plan côté réseauteur).
 *   accounts-and-billing supprimera proprement la colonne en J2.A.
 *
 * Idempotente : utilise des UPDATE conditionnels et DO NOTHING.
 *
 * ⚠️ GATE HUMAIN : exécuter après dry-run sur copie Neon (voir MIGRATION.md §Dry-run).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ================================================================
    -- ETAPE 1 : Rapport initial
    -- ================================================================
    DO $$
    DECLARE
      nb_admin        integer;
      nb_fournisseur  integer;
      nb_organisateur integer;
    BEGIN
      SELECT COUNT(*) INTO nb_admin        FROM users WHERE role = 'admin';
      SELECT COUNT(*) INTO nb_fournisseur  FROM users WHERE role = 'fournisseur';
      SELECT COUNT(*) INTO nb_organisateur FROM users WHERE role = 'organisateur';
      RAISE NOTICE '[migration 20260628_160000] Avant migration — admin: %, fournisseur: %, organisateur: %',
        nb_admin, nb_fournisseur, nb_organisateur;
    END $$;

    -- ================================================================
    -- ETAPE 2 : Conversion de l'enum users.role
    -- ================================================================

    -- 2a. Supprimer le default typé, puis passer en text pour permettre la transition
    ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;

    -- 2b. Conversion des valeurs
    UPDATE "users" SET "role" = 'reseauteur' WHERE "role" = 'fournisseur';
    -- 'organisateur' et 'admin' restent inchangés

    -- 2c. Supprimer l'ancien enum et créer le nouveau
    DROP TYPE IF EXISTS "public"."enum_users_role";
    CREATE TYPE "public"."enum_users_role" AS ENUM ('reseauteur', 'organisateur', 'admin');

    -- 2d. Rebasculer sur le nouveau type
    ALTER TABLE "users"
      ALTER COLUMN "role" SET DEFAULT 'reseauteur'::"public"."enum_users_role",
      ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role"
        USING "role"::"public"."enum_users_role";

    -- ================================================================
    -- ETAPE 3 : Champ plan → dormant (conservé comme text simple)
    -- ================================================================
    -- Conversion en text pour sortir du système d'enum (le champ devient dormant)
    ALTER TABLE "users" ALTER COLUMN "plan" DROP DEFAULT;
    ALTER TABLE "users" ALTER COLUMN "plan" SET DATA TYPE text;
    -- Mise à NULL pour les comptes réseauteurs (plan n'a plus de sens)
    UPDATE "users" SET "plan" = NULL WHERE "role" = 'reseauteur';

    -- ================================================================
    -- ETAPE 4 : defaultValue
    -- ================================================================
    ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'reseauteur'::"public"."enum_users_role";

    -- ================================================================
    -- ETAPE 5 : Rapport final
    -- ================================================================
    DO $$
    DECLARE
      nb_reseauteur   integer;
      nb_organisateur integer;
      nb_admin        integer;
    BEGIN
      SELECT COUNT(*) INTO nb_reseauteur   FROM users WHERE role = 'reseauteur';
      SELECT COUNT(*) INTO nb_organisateur FROM users WHERE role = 'organisateur';
      SELECT COUNT(*) INTO nb_admin        FROM users WHERE role = 'admin';
      RAISE NOTICE '[migration 20260628_160000] Après migration — reseauteur: %, organisateur: %, admin: %',
        nb_reseauteur, nb_organisateur, nb_admin;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- ── Retour à l'ancien enum (approximatif — sans mapping exact possible)

    -- Passage en text
    ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;

    -- Conversion inverse : reseauteur → fournisseur (approximation)
    UPDATE "users" SET "role" = 'fournisseur' WHERE "role" = 'reseauteur';
    -- organisateur et admin inchangés

    -- Recréer l'ancien enum
    DROP TYPE IF EXISTS "public"."enum_users_role";
    CREATE TYPE "public"."enum_users_role" AS ENUM ('admin', 'fournisseur', 'organisateur');

    -- Rebasculer
    ALTER TABLE "users"
      ALTER COLUMN "role" SET DEFAULT 'fournisseur'::"public"."enum_users_role",
      ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role"
        USING "role"::"public"."enum_users_role";

    DO $$
    BEGIN
      RAISE NOTICE '[migration 20260628_160000 DOWN] Rôles revertés (fournisseur restauré pour les ex-reseauteurs).';
    END $$;
  `)
}

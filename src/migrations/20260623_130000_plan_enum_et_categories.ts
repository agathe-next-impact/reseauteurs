import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration J1.3 + J1.4 — Recalibrage de l'enum users.plan + reseed des catégories.
 *
 * J1.3 — enum users.plan (ADR-0004) :
 *   Valeurs actuelles : gratuit / premium / infinite
 *   Nouvelles valeurs  : acces / developpement / premium
 *   Règle de conversion (aucun client payant à reprendre — Q1) :
 *     - gratuit  → acces (palier d'entrée, abonnement non encore souscrit)
 *     - premium  → acces (idem — pas de reprise d'abonnés)
 *     - infinite → premium (idem)
 *   Les comptes admin conservent leur rôle admin ; leur plan n'a pas d'effet.
 *   La colonne saveToJWT = true reste (Payload relit le JWT au refresh).
 *
 * J1.4 — Reseed types-evenement (CLAUDE.md §8) :
 *   7 catégories cibles. On ne supprime pas les anciennes catégories : on les
 *   met à jour si elles existent (par value/slug unique), on insère sinon.
 *   Raison : les événements existants peuvent y être rattachés ; un DELETE
 *   serait bloqué par la FK types_evenement.id dans evenements.type_id et
 *   déclencherait une erreur (beforeDelete hook + FK cascade).
 *
 * Rollback :
 *   - Remet l'enum plan à l'ancien jeu de valeurs (gratuit/premium/infinite).
 *   - NE supprime PAS les catégories (elles peuvent être référencées).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ================================================================
    -- ETAPE 1 : Recalibrage de l'enum users.plan (ADR-0004)
    -- ================================================================

    -- 1a. Supprimer le default typé, puis passer la colonne en text pour permettre la transition d'enum
    ALTER TABLE "users" ALTER COLUMN "plan" DROP DEFAULT;
    ALTER TABLE "users" ALTER COLUMN "plan" SET DATA TYPE text;

    -- 1b. Conversion des données
    --     gratuit  → acces  (pas de reprise d'abonnés — Q1)
    --     premium  → acces  (idem)
    --     infinite → premium (idem)
    UPDATE "users" SET "plan" = 'acces'    WHERE "plan" IN ('gratuit', 'premium');
    UPDATE "users" SET "plan" = 'premium'  WHERE "plan" = 'infinite';

    -- 1c. Supprimer l'ancien enum et créer le nouveau
    DROP TYPE IF EXISTS "public"."enum_users_plan";
    CREATE TYPE "public"."enum_users_plan" AS ENUM ('acces', 'developpement', 'premium');

    -- 1d. Rebasculer la colonne sur le nouveau type
    ALTER TABLE "users"
      ALTER COLUMN "plan" SET DEFAULT 'acces'::"public"."enum_users_plan",
      ALTER COLUMN "plan" SET DATA TYPE "public"."enum_users_plan"
        USING "plan"::"public"."enum_users_plan";

    DO $$
    DECLARE
      nb_acces integer;
      nb_dev integer;
      nb_premium integer;
    BEGIN
      SELECT COUNT(*) INTO nb_acces       FROM users WHERE plan = 'acces';
      SELECT COUNT(*) INTO nb_dev         FROM users WHERE plan = 'developpement';
      SELECT COUNT(*) INTO nb_premium     FROM users WHERE plan = 'premium';
      RAISE NOTICE '[migration 20260623_130000] users.plan après migration : acces=%, developpement=%, premium=%',
        nb_acces, nb_dev, nb_premium;
    END $$;

    -- ================================================================
    -- ETAPE 2 : Reseed types_evenement avec les 7 catégories cibles
    --           (CLAUDE.md §8, ADR-0003)
    --
    -- ON CONFLICT sur "value" (colonne unique) — si la catégorie existe
    -- déjà, on met à jour le label et la couleur.
    -- ================================================================
    INSERT INTO "types_evenement" ("label", "value", "couleur", "ordre", "updated_at", "created_at")
    VALUES
      ('Réseaux d''affaires',           'reseaux-affaires',           '#2563EB', 1, now(), now()),
      ('Salons professionnels',          'salons',                     '#7C3AED', 2, now(), now()),
      ('Congrès',                        'congres',                    '#0891B2', 3, now(), now()),
      ('Conférences',                    'conferences',                '#059669', 4, now(), now()),
      ('Afterworks',                     'afterworks',                 '#F59E0B', 5, now(), now()),
      ('Rencontres inter-entreprises',   'rencontres-inter-entreprises','#EF4444', 6, now(), now()),
      ('Autres événements professionnels','autres',                     '#6B7280', 7, now(), now())
    ON CONFLICT ("value") DO UPDATE
      SET "label"  = EXCLUDED."label",
          "couleur" = EXCLUDED."couleur",
          "ordre"   = EXCLUDED."ordre",
          "updated_at" = now();

    DO $$
    DECLARE
      nb integer;
    BEGIN
      SELECT COUNT(*) INTO nb FROM types_evenement;
      RAISE NOTICE '[migration 20260623_130000] types_evenement : % catégorie(s) en base', nb;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- ================================================================
    -- ROLLBACK J1.3 : Retour à l'ancien enum users.plan
    -- ================================================================

    -- Supprimer le default typé, puis passer en text
    ALTER TABLE "users" ALTER COLUMN "plan" DROP DEFAULT;
    ALTER TABLE "users" ALTER COLUMN "plan" SET DATA TYPE text;

    -- Conversion inverse (approximation — pas de mapping exact possible
    -- car aucune table d'historique n'a été créée, Q1)
    UPDATE "users" SET "plan" = 'gratuit' WHERE "plan" = 'acces';
    UPDATE "users" SET "plan" = 'infinite' WHERE "plan" = 'premium';
    -- developpement n'existait pas avant → gratuit
    UPDATE "users" SET "plan" = 'gratuit' WHERE "plan" = 'developpement';

    -- Recréer l'ancien enum
    DROP TYPE IF EXISTS "public"."enum_users_plan";
    CREATE TYPE "public"."enum_users_plan" AS ENUM ('gratuit', 'premium', 'infinite');

    -- Rebasculer
    ALTER TABLE "users"
      ALTER COLUMN "plan" SET DEFAULT 'gratuit'::"public"."enum_users_plan",
      ALTER COLUMN "plan" SET DATA TYPE "public"."enum_users_plan"
        USING "plan"::"public"."enum_users_plan";

    -- ================================================================
    -- ROLLBACK J1.4 : On ne supprime PAS les catégories (FK potentielles).
    -- Le DBA peut nettoyer manuellement si nécessaire après vérification.
    -- ================================================================
  `)
}

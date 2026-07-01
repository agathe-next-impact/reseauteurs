import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration — Simplification de la table `evenements` (ADR-0011).
 *
 * Approche additive + retrait de ce qui est sans risque.
 *
 * AJOUTS :
 *   - premium               : boolean (mise en avant payante, posé par webhook Stripe)
 *   - stripe_checkout_session_id : varchar (ID session Checkout Premium)
 *
 * MODIFICATIONS (enum statut) :
 *   L'existant a `publie` et `archive`. On ajoute `suspendu`.
 *   Les enregistrements existants ne sont PAS modifiés (publie/archive restent valides).
 *   Note : la valeur `archive` reste dans l'enum pour compatibilité des données existantes.
 *
 * DORMANTS (colonnes conservées en DB, retirées de la collection Payload) :
 *   - serie_id    : placeholder récurrence hors V1 (ADR-0008) — laissé en DB
 *   - visible     : remplacé par statut — laissé en DB pour rollback
 *   La collection Evenements.ts ne les gère plus ; les données existantes sont préservées.
 *
 * Rollback SAFE : ajouts uniquement (sauf enum extension).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ── Drapeau Premium
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "premium" boolean DEFAULT false NOT NULL;

    -- ── Stripe Checkout session ID (pour accounts-and-billing)
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" varchar;

    -- ── Extension de l'enum statut : ajout de 'suspendu'
    --    PostgreSQL ne supporte pas ALTER TYPE ADD VALUE dans une transaction,
    --    mais supporte dans une migration Payload (exécutée hors transaction explicite).
    DO $$ BEGIN
      ALTER TYPE "public"."enum_evenements_statut" ADD VALUE IF NOT EXISTS 'suspendu';
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Enum enum_evenements_statut : valeur suspendu déjà présente ou erreur ignorée.';
    END $$;

    -- ── Index premium (requête carte + mise en avant)
    CREATE INDEX IF NOT EXISTS "evenements_premium_idx"
      ON "evenements" USING btree ("premium");

    -- ── Index partiel Premium publié (optimise la route carte Premium)
    CREATE INDEX IF NOT EXISTS "evenements_premium_publie_gist_idx"
      ON "evenements" USING gist ("geom")
      WHERE "premium" = true AND "statut" = 'publie' AND "geom" IS NOT NULL;

    -- ── Index Stripe
    CREATE INDEX IF NOT EXISTS "evenements_stripe_checkout_idx"
      ON "evenements" USING btree ("stripe_checkout_session_id");

    -- ── Rapport
    DO $$
    DECLARE
      nb_publie   integer;
      nb_archive  integer;
    BEGIN
      SELECT COUNT(*) INTO nb_publie  FROM evenements WHERE statut = 'publie';
      SELECT COUNT(*) INTO nb_archive FROM evenements WHERE statut = 'archive';
      RAISE NOTICE '[migration 20260628_150000] evenements : publie=%, archive=%. Colonne premium ajoutée.', nb_publie, nb_archive;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "evenements_stripe_checkout_idx";
    DROP INDEX IF EXISTS "evenements_premium_publie_gist_idx";
    DROP INDEX IF EXISTS "evenements_premium_idx";
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "stripe_checkout_session_id";
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "premium";
    -- Note : la valeur 'suspendu' de l'enum ne peut pas être retirée facilement.
    -- Les lignes avec statut='suspendu' doivent être traitées manuellement avant rollback.
    DO $$
    BEGIN
      RAISE NOTICE '[migration 20260628_150000 DOWN] premium supprimé. Valeur suspendu dans enum conservée.';
    END $$;
  `)
}

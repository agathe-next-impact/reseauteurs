import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration E1.3 — Suppression du drapeau Premium sur les événements (ADR-0012).
 *
 * ⚠️ DESTRUCTIF — up() SUPPRIME des colonnes et un index.
 *    Ces données ne peuvent pas être récupérées après application.
 *    Dry-run obligatoire + gate humain avant exécution (voir MIGRATION.md §E1.3).
 *
 * ÉVALUATION DU RISQUE (à confirmer au dry-run) :
 *   - Colonne `premium` : défaut false, fonctionnalité non lancée → risque de perte : FAIBLE.
 *   - Colonne `stripe_checkout_session_id` : sessions one-shot non utilisées en production
 *     (l'abonnement Premium ponctuel n'a pas été commercialisé) → risque de perte : FAIBLE.
 *   - Index `evenements_premium_idx` et `evenements_premium_publie_gist_idx` : supprimés.
 *   - Index `evenements_stripe_checkout_idx` : supprimé.
 *
 * Vérification avant exécution :
 *   SELECT COUNT(*) FROM evenements WHERE premium = true;
 *   -- Si > 0 : des événements étaient flaggés Premium → alerter l'humain avant DROP.
 *
 * Rollback (down) :
 *   Recrée les colonnes avec leurs valeurs par défaut (données perdues en up() non récupérables).
 *   Documente explicitement l'impossibilité de restaurer les données antérieures.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ================================================================
    -- VÉRIFICATION PRÉALABLE (loggée, non bloquante)
    -- ================================================================
    DO $$
    DECLARE
      nb_premium integer;
      nb_session integer;
    BEGIN
      SELECT COUNT(*) INTO nb_premium FROM evenements WHERE premium = true;
      SELECT COUNT(*) INTO nb_session FROM evenements WHERE stripe_checkout_session_id IS NOT NULL;
      IF nb_premium > 0 THEN
        RAISE WARNING '[migration 20260630_110000] ATTENTION : % événement(s) avec premium=true vont perdre ce flag. Confirmer avec le product owner.', nb_premium;
      END IF;
      IF nb_session > 0 THEN
        RAISE WARNING '[migration 20260630_110000] ATTENTION : % événement(s) avec stripe_checkout_session_id non null vont perdre cet ID.', nb_session;
      END IF;
      RAISE NOTICE '[migration 20260630_110000] Vérification : % premium, % sessions. DROP en cours...', nb_premium, nb_session;
    END $$;

    -- ================================================================
    -- SUPPRESSION DES INDEX LIÉS AU PREMIUM
    -- (doivent être droppés AVANT les colonnes)
    -- ================================================================
    DROP INDEX IF EXISTS "evenements_premium_publie_gist_idx";
    DROP INDEX IF EXISTS "evenements_premium_idx";
    DROP INDEX IF EXISTS "evenements_stripe_checkout_idx";

    -- ================================================================
    -- SUPPRESSION DES COLONNES PREMIUM (⚠️ IRRÉVERSIBLE)
    -- ================================================================
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "stripe_checkout_session_id";
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "premium";

    -- ================================================================
    -- RAPPORT FINAL
    -- ================================================================
    DO $$
    DECLARE nb_events integer;
    BEGIN
      SELECT COUNT(*) INTO nb_events FROM evenements;
      RAISE NOTICE '[migration 20260630_110000] DONE : colonnes premium et stripe_checkout_session_id supprimées. % événements en base. Plus de Checkout one-shot Premium.', nb_events;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- ================================================================
    -- ROLLBACK — RECRÉE LES COLONNES (sans données — elles ont été perdues en up())
    -- ================================================================

    -- ⚠️ Les données originales des colonnes premium et stripe_checkout_session_id
    -- NE SONT PAS RESTAURÉES — ce rollback recrée uniquement la structure.
    -- Si des données existaient, elles sont définitivement perdues.

    ALTER TABLE "evenements"
      ADD COLUMN IF NOT EXISTS "premium" boolean DEFAULT false NOT NULL;

    ALTER TABLE "evenements"
      ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" varchar;

    -- Recrée les index (les index partiels sur geom nécessitent que geom existe)
    CREATE INDEX IF NOT EXISTS "evenements_premium_idx"
      ON "evenements" USING btree ("premium");

    CREATE INDEX IF NOT EXISTS "evenements_stripe_checkout_idx"
      ON "evenements" USING btree ("stripe_checkout_session_id");

    -- Index GiST partiel premium+statut (recrée seulement si la colonne geom existe)
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'evenements' AND column_name = 'geom'
      ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS "evenements_premium_publie_gist_idx"
          ON "evenements" USING gist ("geom")
          WHERE "premium" = true AND "statut" = ''publie'' AND "geom" IS NOT NULL';
      END IF;
    END $$;

    DO $$
    BEGIN
      RAISE NOTICE '[migration 20260630_110000 DOWN] Colonnes premium/stripe_checkout_session_id recréées (sans données). Rollback partiel.';
    END $$;
  `)
}

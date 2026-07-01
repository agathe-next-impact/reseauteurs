import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration — Index de recherche simple (ADR-0011 §6).
 *
 * Installe :
 *   1. Extension pg_trgm (tolérance de frappe sur noms/entreprises)
 *   2. Index GIN trigram sur reseauteurs (nom, prenom, entreprise)
 *   3. Index B-tree supplémentaires sur colonnes de filtres
 *   4. Index composite date/reseau pour les événements (recherche par date)
 *
 * Pas de moteur FTS à facettes, pas de moteur externe (ADR-0011 §6).
 * Idempotente : CREATE EXTENSION IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ================================================================
    -- 1. Extension pg_trgm (tolérance de frappe)
    -- ================================================================
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    -- ================================================================
    -- 2. Index GIN trigram — recherche par nom/entreprise (reseauteurs)
    -- ================================================================
    CREATE INDEX IF NOT EXISTS "reseauteurs_nom_trgm_idx"
      ON "reseauteurs" USING gin ("nom" gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS "reseauteurs_prenom_trgm_idx"
      ON "reseauteurs" USING gin ("prenom" gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS "reseauteurs_entreprise_trgm_idx"
      ON "reseauteurs" USING gin ("entreprise" gin_trgm_ops);

    -- ================================================================
    -- 3. Index trigram sur reseaux.nom (recherche par nom de réseau)
    -- ================================================================
    CREATE INDEX IF NOT EXISTS "reseaux_nom_trgm_idx"
      ON "reseaux" USING gin ("nom" gin_trgm_ops);

    -- ================================================================
    -- 4. Index composite sur evenements (filtres fréquents)
    -- ================================================================

    -- Réseau + date (requête la plus fréquente : événements d'un réseau à venir)
    CREATE INDEX IF NOT EXISTS "evenements_reseau_date_idx"
      ON "evenements" USING btree ("reseau_id", "date_debut");

    -- Ville + date (carte : événements dans une ville)
    CREATE INDEX IF NOT EXISTS "evenements_ville_date_idx"
      ON "evenements" USING btree ("lieu_ville", "date_debut");

    -- Type + date (filtrage par catégorie)
    CREATE INDEX IF NOT EXISTS "evenements_type_date_idx"
      ON "evenements" USING btree ("type_id", "date_debut");

    -- Index date_debut seul (tri chronologique global)
    CREATE INDEX IF NOT EXISTS "evenements_date_debut_idx"
      ON "evenements" USING btree ("date_debut");

    -- ================================================================
    -- 5. Index composite sur reseauteurs (filtres combinés)
    -- ================================================================

    -- Statut + ville (carte par ville)
    CREATE INDEX IF NOT EXISTS "reseauteurs_statut_ville_idx"
      ON "reseauteurs" USING btree ("statut", "ville");

    -- Statut + badge (filtrage par badge dans la liste)
    CREATE INDEX IF NOT EXISTS "reseauteurs_statut_badge_idx"
      ON "reseauteurs" USING btree ("statut", "badge");

    -- Statut + secteur (filtrage par métier)
    CREATE INDEX IF NOT EXISTS "reseauteurs_statut_secteur_idx"
      ON "reseauteurs" USING btree ("statut", "secteur_id");

    -- ================================================================
    -- 6. Rapport
    -- ================================================================
    DO $$
    BEGIN
      RAISE NOTICE '[migration 20260628_170000] Extension pg_trgm + index de recherche installés.';
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "reseauteurs_statut_secteur_idx";
    DROP INDEX IF EXISTS "reseauteurs_statut_badge_idx";
    DROP INDEX IF EXISTS "reseauteurs_statut_ville_idx";
    DROP INDEX IF EXISTS "evenements_date_debut_idx";
    DROP INDEX IF EXISTS "evenements_type_date_idx";
    DROP INDEX IF EXISTS "evenements_ville_date_idx";
    DROP INDEX IF EXISTS "evenements_reseau_date_idx";
    DROP INDEX IF EXISTS "reseaux_nom_trgm_idx";
    DROP INDEX IF EXISTS "reseauteurs_entreprise_trgm_idx";
    DROP INDEX IF EXISTS "reseauteurs_prenom_trgm_idx";
    DROP INDEX IF EXISTS "reseauteurs_nom_trgm_idx";
    -- NB : on ne supprime PAS l'extension pg_trgm (peut être utilisée ailleurs).
    DO $$
    BEGIN
      RAISE NOTICE '[migration 20260628_170000 DOWN] Index de recherche supprimés.';
    END $$;
  `)
}

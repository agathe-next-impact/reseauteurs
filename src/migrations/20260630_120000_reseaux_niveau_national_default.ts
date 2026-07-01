import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration E1.6 — Backfill niveau='national' sur les réseaux existants (ADR-0012 Q4).
 *
 * ADDITIF (safe) — ne supprime aucune donnée.
 *
 * Contexte :
 *   La migration 20260630_100000_reseaux_hierarchie.ts a ajouté la colonne `niveau`
 *   avec un DEFAULT 'national'. Ce DEFAULT s'applique aux nouvelles lignes insertées
 *   APRÈS la migration DDL, mais les lignes existantes auront déjà la valeur 'national'
 *   si la migration a été appliquée sur une DB vide.
 *
 *   Si la DB contenait des lignes avant 20260630_100000 (peu probable pour reseauteurs,
 *   possible pour reseaux via 20260623_110000), ce backfill assure que toutes les
 *   lignes sans niveau explicite passent à 'national'.
 *
 * Décision Q4 (PLAN.md §Partie C, 2026-06-30 — tranchée) :
 *   Réseaux existants → niveau = 'national' par défaut (les réseaux importés/historiques
 *   sont tous des têtes nationales à ce stade — pas de locaux créés avant E1).
 *
 * Impact sur les affiliations reseauxFrequentes :
 *   Si des affiliations (reseauxFrequentes) existent et pointent vers des réseaux qui
 *   deviennent 'national' par ce backfill, elles violent la règle "locaux-only" (E1.4).
 *   Dans l'état actuel (reseauteurs est une collection neuve, aucun profil existant),
 *   l'impact est NUL. Cette migration documente la stratégie de remap pour le futur.
 *
 * Stratégie de remap/purge des affiliations (si nécessaire) :
 *   1. SELECT COUNT(*) FROM reseauteurs_rels WHERE path = 'reseaux_frequentes'
 *      AND ... -- vérifier si des affiliations pointent vers des nationaux.
 *   2. Si 0 (attendu) : rien à faire.
 *   3. Si > 0 (inattendu) : logguer les IDs concernés, informer l'humain, ne pas supprimer
 *      silencieusement (invariant MIGRATION.md §2 : "aucune donnée perdue silencieusement").
 *
 * Rollback (down) :
 *   No-op effectif — on ne peut pas distinguer les lignes "rétroactivement national"
 *   de celles qui l'ont toujours été. Documenté comme tel.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ================================================================
    -- BACKFILL niveau = 'national' (idempotent via WHERE niveau IS NULL)
    -- ================================================================
    -- Normalement no-op si 20260630_100000 a été appliqué sur DB vide
    -- (le DEFAULT 'national' a déjà initialisé toutes les lignes).
    -- Sécurité : s'assure qu'aucune ligne n'a niveau NULL.
    UPDATE "reseaux"
      SET "niveau" = 'national'
      WHERE "niveau" IS NULL;

    -- ================================================================
    -- VÉRIFICATION affiliations reseauxFrequentes (ADR-0012 E1.4)
    -- ================================================================
    DO $$
    DECLARE
      nb_affil_nat integer := 0;
    BEGIN
      -- Cherche des affiliations pointant vers des nationaux (doit être 0 car reseauteurs est neuf)
      -- La table de relation Payload pour hasMany est typiquement <slug>_rels
      -- Nom exact déterminé à l'exécution — on inspecte information_schema
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'reseauteurs_rels'
      ) THEN
        SELECT COUNT(*) INTO nb_affil_nat
        FROM "reseauteurs_rels" rel
        JOIN "reseaux" r ON rel."reseaux_id" = r."id"
        WHERE rel."path" = 'reseauxFrequentes'
          AND r."niveau" = 'national';

        IF nb_affil_nat > 0 THEN
          RAISE WARNING
            '[migration 20260630_120000] ATTENTION : % affiliation(s) reseauxFrequentes pointent vers des réseaux nationaux. Ces affiliations violent la règle "locaux-only" (ADR-0012 E1.4). Traitement manuel requis avant de passer en production. IDs à purger ou réaffecter.',
            nb_affil_nat;
        ELSE
          RAISE NOTICE '[migration 20260630_120000] OK : 0 affiliation reseauxFrequentes vers des nationaux. Invariant locaux-only respecté.';
        END IF;
      ELSE
        RAISE NOTICE '[migration 20260630_120000] Table reseauteurs_rels absente (collection reseauteurs vide ou non créée) — aucune affiliation à vérifier.';
      END IF;
    END $$;

    -- ================================================================
    -- RAPPORT
    -- ================================================================
    DO $$
    DECLARE
      nb_national integer;
      nb_local    integer;
    BEGIN
      SELECT COUNT(*) INTO nb_national FROM reseaux WHERE niveau = 'national';
      SELECT COUNT(*) INTO nb_local    FROM reseaux WHERE niveau = 'local';
      RAISE NOTICE '[migration 20260630_120000] Backfill terminé : % national(aux), % local/locaux.', nb_national, nb_local;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- ================================================================
    -- ROLLBACK — NO-OP EFFECTIF
    -- ================================================================
    -- On ne peut pas distinguer les lignes "rétroactivement national" après backfill.
    -- Ce rollback ne remet PAS niveau à NULL (cela violerait NOT NULL + DEFAULT).
    -- Pour annuler complètement la hiérarchie, jouer 20260630_100000 down() AVANT ce down().
    DO $$
    BEGIN
      RAISE NOTICE '[migration 20260630_120000 DOWN] No-op — le backfill niveau=national ne peut pas être annulé sans 20260630_100000 down(). Rollback global via 20260630_100000 down().';
    END $$;
  `)
}

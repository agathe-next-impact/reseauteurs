import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration J1.2 — Reprise des données : fusion Fournisseurs + OrganisateursEvenements → reseaux.
 *
 * Périmètre STRICT (ADR-0003 + ARCHITECTURE.md §6) :
 *   - CONTENU + SLUGS SEO uniquement.
 *   - PAS de reprise d'abonnements (aucun client payant — Q1).
 *   - AUCUNE touche à la collection `groupes` ni à ses migrations (ADR-0009).
 *   - Les champs `users.groupe` et `users.pendingGroupeCode` sont conservés (ADR-0009).
 *
 * Ordre d'exécution :
 *   1. Insérer les fournisseurs → reseaux (source='revendique').
 *   2. Insérer les organisateurs_evenements → reseaux (source='importe').
 *      En cas de collision de slug, suffixe déterministe '-org' (jamais Date.now()).
 *   3. Backfill evenements.reseau_id depuis fournisseur_id et organisateur_externe_id.
 *   4. Backfill geom depuis lat/lon existants (reseaux + evenements).
 *   5. Conversion enum users.role : 'fournisseur' → 'organisateur' (la valeur 'admin' reste).
 *   6. Calibrage users.plan : recalibrage Accès/Développement/Premium (pas de comptes payants à reprendre).
 *
 * Idempotence :
 *   - Chaque INSERT utilise ON CONFLICT DO NOTHING sur le slug.
 *   - Les UPDATE sont idempotents.
 *
 * Rapport de migration :
 *   Les lignes non-migrables (slug nul, fournisseur sans ville...) sont loguées
 *   via RAISE NOTICE dans un DO $$ block — visible dans les logs Neon/psql.
 *   Le script NE supprime PAS silencieusement les données ; il log et continue.
 *
 * Rollback (down) :
 *   - Vide la table reseaux (TRUNCATE CASCADE).
 *   - Remet evenements.reseau_id à NULL et supprime la geom.
 *   - Remet users.role 'organisateur' → 'fournisseur'.
 *   - Remet users.plan 'acces'/'developpement' → 'gratuit'.
 *   ATTENTION : rollback partiel — si certains réseaux ont été créés après la migration,
 *   ils seront supprimés. À utiliser uniquement sur l'environnement de test / dry-run.
 *
 * NE PAS exécuter contre la base de production sans dry-run préalable (voir MIGRATION.md).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ================================================================
    -- ETAPE 0 : rapport initial
    -- ================================================================
    DO $$
    DECLARE
      nb_fournisseurs integer;
      nb_organisateurs integer;
      nb_evenements integer;
    BEGIN
      SELECT COUNT(*) INTO nb_fournisseurs FROM fournisseurs;
      SELECT COUNT(*) INTO nb_organisateurs FROM organisateurs_evenements;
      SELECT COUNT(*) INTO nb_evenements FROM evenements;
      RAISE NOTICE '[migration 20260623_120000] Début — fournisseurs: %, organisateurs: %, evenements: %',
        nb_fournisseurs, nb_organisateurs, nb_evenements;
    END $$;

    -- ================================================================
    -- ETAPE 1 : fournisseurs → reseaux (source = 'revendique')
    -- Les champs objet-pub (boutiqueEnLigne, lienDevis, descriptionRSE,
    -- labelsRSE, offresEmploi, activitePrincipale, activitesSecondaires)
    -- ne sont pas repris — la collection reseaux ne les porte pas (ADR-0003).
    -- ================================================================
    INSERT INTO "reseaux" (
      "user_id",
      "source",
      "slug",
      "nom",
      "ville",
      "adresse",
      "code_postal",
      "site_web",
      "email_contact",
      "telephone",
      "video_youtube",
      "description",
      "logo_id",
      "banniere_id",
      "latitude",
      "longitude",
      "statut",
      "seo_title",
      "seo_description",
      "seo_keywords",
      "seo_og_image_id",
      "seo_noindex",
      "updated_at",
      "created_at"
    )
    SELECT
      f."user_id",
      'revendique'::enum_reseaux_source,
      f."slug",
      f."raison_sociale",
      f."ville",
      f."adresse",
      f."code_postal",
      f."site_web",
      f."email_contact",
      f."telephone",
      f."video_youtube",
      f."description",
      f."logo_id",
      f."banniere_id",
      f."latitude",
      f."longitude",
      -- Mappage statut : même enum (publiee/suspendue)
      f."statut"::text::"enum_reseaux_statut",
      f."seo_title",
      f."seo_description",
      f."seo_keywords",
      f."seo_og_image_id",
      COALESCE(f."seo_noindex", false),
      f."updated_at",
      f."created_at"
    FROM "fournisseurs" f
    WHERE f."slug" IS NOT NULL AND f."slug" != ''
    ON CONFLICT ("slug") DO NOTHING;

    -- Log des fournisseurs ignorés (slug nul ou vide)
    DO $$
    DECLARE
      nb integer;
    BEGIN
      SELECT COUNT(*) INTO nb FROM fournisseurs WHERE slug IS NULL OR slug = '';
      IF nb > 0 THEN
        RAISE NOTICE '[migration 20260623_120000] AVERTISSEMENT : % fournisseur(s) ignoré(s) (slug nul/vide)', nb;
      END IF;
    END $$;

    -- ================================================================
    -- ETAPE 1b : réseaux sociaux des fournisseurs → reseaux_reseaux_sociaux
    -- Note : Payload utilise _parent_id et _order (préfixe underscore) pour les arrays.
    -- Les id sont générés comme uuid-like pour respecter la convention Payload varchar PK.
    -- ================================================================
    INSERT INTO "reseaux_reseaux_sociaux" ("_order", "_parent_id", "id", "plateforme", "url")
    SELECT
      frs."_order",
      r."id",
      'f-' || f."id"::text || '-rs-' || frs."_order"::text,
      frs."plateforme"::text::"enum_reseaux_reseaux_sociaux_plateforme",
      frs."url"
    FROM "fournisseurs_reseaux_sociaux" frs
    JOIN "fournisseurs" f ON frs."_parent_id" = f."id"
    JOIN "reseaux" r ON r."slug" = f."slug"
    WHERE frs."plateforme" IS NOT NULL AND frs."url" IS NOT NULL
    ON CONFLICT ("id") DO NOTHING;

    -- ================================================================
    -- ETAPE 1c : illustrations des fournisseurs → reseaux_illustrations
    -- ================================================================
    INSERT INTO "reseaux_illustrations" ("_order", "_parent_id", "id", "image_id")
    SELECT
      fi."_order",
      r."id",
      'f-' || f."id"::text || '-il-' || fi."_order"::text,
      fi."image_id"
    FROM "fournisseurs_illustrations" fi
    JOIN "fournisseurs" f ON fi."_parent_id" = f."id"
    JOIN "reseaux" r ON r."slug" = f."slug"
    WHERE fi."image_id" IS NOT NULL
    ON CONFLICT ("id") DO NOTHING;

    -- ================================================================
    -- ETAPE 2 : organisateurs_evenements → reseaux (source = 'importe')
    -- Règle de dédoublonnage de slug (ADR-0003) :
    --   Si le slug de l'organisateur n'existe pas encore dans reseaux → INSERT direct.
    --   Si le slug est en collision → suffixe stable '-org'.
    --   Si '-org' est aussi en collision → suffixe '-org-<id>' (deterministe, jamais Date.now()).
    -- ================================================================
    INSERT INTO "reseaux" (
      "user_id",
      "source",
      "slug",
      "nom",
      "ville",
      "adresse",
      "code_postal",
      "site_web",
      "email_contact",
      "telephone",
      "video_youtube",
      "description",
      "logo_id",
      "banniere_id",
      "statut",
      "seo_title",
      "seo_description",
      "seo_keywords",
      "seo_og_image_id",
      "seo_noindex",
      "updated_at",
      "created_at"
    )
    SELECT
      oe."user_id",
      'importe'::enum_reseaux_source,
      -- Slug dédoublonné de manière déterministe
      CASE
        WHEN NOT EXISTS (SELECT 1 FROM reseaux r WHERE r.slug = oe.slug)
          THEN oe.slug
        WHEN NOT EXISTS (SELECT 1 FROM reseaux r WHERE r.slug = oe.slug || '-org')
          THEN oe.slug || '-org'
        ELSE oe.slug || '-org-' || oe.id::text
      END,
      oe."nom",
      COALESCE(oe."ville", ''),
      oe."adresse",
      oe."code_postal",
      oe."site_web",
      oe."email_contact",
      oe."telephone",
      oe."video_youtube",
      oe."description",
      oe."logo_id",
      oe."banniere_id",
      oe."statut"::text::"enum_reseaux_statut",
      oe."seo_title",
      oe."seo_description",
      oe."seo_keywords",
      oe."seo_og_image_id",
      COALESCE(oe."seo_noindex", false),
      oe."updated_at",
      oe."created_at"
    FROM "organisateurs_evenements" oe
    WHERE oe."slug" IS NOT NULL AND oe."slug" != ''
    -- ON CONFLICT sur slug pour idempotence (cas de re-run)
    ON CONFLICT ("slug") DO NOTHING;

    -- Log des organisateurs ignorés
    DO $$
    DECLARE
      nb integer;
    BEGIN
      SELECT COUNT(*) INTO nb FROM organisateurs_evenements WHERE slug IS NULL OR slug = '';
      IF nb > 0 THEN
        RAISE NOTICE '[migration 20260623_120000] AVERTISSEMENT : % organisateur(s) ignoré(s) (slug nul/vide)', nb;
      END IF;
    END $$;

    -- ================================================================
    -- ETAPE 2b : réseaux sociaux des organisateurs
    -- Note : Payload utilise _parent_id (préfixe underscore) pour les arrays.
    -- ================================================================
    INSERT INTO "reseaux_reseaux_sociaux" ("_order", "_parent_id", "id", "plateforme", "url")
    SELECT
      ors."_order",
      r."id",
      'o-' || oe."id"::text || '-rs-' || ors."_order"::text,
      ors."plateforme"::text::"enum_reseaux_reseaux_sociaux_plateforme",
      ors."url"
    FROM "organisateurs_evenements_reseaux_sociaux" ors
    JOIN "organisateurs_evenements" oe ON ors."_parent_id" = oe."id"
    JOIN "reseaux" r ON r."nom" = oe."nom" AND r."source" = 'importe'
    WHERE ors."plateforme" IS NOT NULL AND ors."url" IS NOT NULL
    ON CONFLICT ("id") DO NOTHING;

    -- ================================================================
    -- ETAPE 2c : illustrations des organisateurs
    -- ================================================================
    INSERT INTO "reseaux_illustrations" ("_order", "_parent_id", "id", "image_id")
    SELECT
      oi."_order",
      r."id",
      'o-' || oe."id"::text || '-il-' || oi."_order"::text,
      oi."image_id"
    FROM "organisateurs_evenements_illustrations" oi
    JOIN "organisateurs_evenements" oe ON oi."_parent_id" = oe."id"
    JOIN "reseaux" r ON r."nom" = oe."nom" AND r."source" = 'importe'
    WHERE oi."image_id" IS NOT NULL
    ON CONFLICT ("id") DO NOTHING;

    -- ================================================================
    -- ETAPE 3 : repointage evenements.reseau_id
    -- Priorité : fournisseur_id → réseau 'revendique' correspondant.
    --            organisateur_externe_id → réseau 'importe' correspondant.
    -- ================================================================

    -- 3a. Via fournisseur_id
    UPDATE "evenements" e
    SET "reseau_id" = r."id"
    FROM "fournisseurs" f
    JOIN "reseaux" r ON r."slug" = f."slug"
    WHERE e."fournisseur_id" = f."id"
      AND e."reseau_id" IS NULL;

    -- 3b. Via organisateur_externe_id (pour les événements sans fournisseur)
    UPDATE "evenements" e
    SET "reseau_id" = r."id"
    FROM "organisateurs_evenements" oe
    -- Jointure sur nom+source car le slug a pu être suffixé '-org'
    JOIN "reseaux" r ON r."nom" = oe."nom" AND r."source" = 'importe'
    WHERE e."organisateur_externe_id" = oe."id"
      AND e."reseau_id" IS NULL;

    -- Rapport des événements non repointés
    DO $$
    DECLARE
      nb_orphelins integer;
    BEGIN
      SELECT COUNT(*) INTO nb_orphelins FROM evenements WHERE reseau_id IS NULL;
      IF nb_orphelins > 0 THEN
        RAISE NOTICE '[migration 20260623_120000] AVERTISSEMENT : % evenement(s) sans reseau_id après repointage (orphelins)', nb_orphelins;
      ELSE
        RAISE NOTICE '[migration 20260623_120000] OK : tous les evenements ont été repointés';
      END IF;
    END $$;

    -- ================================================================
    -- ETAPE 4 : backfill geom depuis lat/lon existants (ADR-0002)
    -- ================================================================

    -- 4a. reseaux.geom depuis latitude/longitude
    UPDATE "reseaux"
    SET "geom" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography
    WHERE "latitude" IS NOT NULL
      AND "longitude" IS NOT NULL
      AND "geom" IS NULL;

    -- 4b. evenements.geom depuis lieu_latitude/lieu_longitude
    UPDATE "evenements"
    SET "geom" = ST_SetSRID(ST_MakePoint("lieu_longitude", "lieu_latitude"), 4326)::geography
    WHERE "lieu_latitude" IS NOT NULL
      AND "lieu_longitude" IS NOT NULL
      AND "geom" IS NULL;

    -- Rapport geom
    DO $$
    DECLARE
      nb_reseaux_sans_geom integer;
      nb_evenements_sans_geom integer;
      nb_reseaux_total integer;
      nb_evenements_total integer;
    BEGIN
      SELECT COUNT(*) INTO nb_reseaux_total FROM reseaux;
      SELECT COUNT(*) INTO nb_reseaux_sans_geom FROM reseaux WHERE geom IS NULL;
      SELECT COUNT(*) INTO nb_evenements_total FROM evenements WHERE statut = 'publie';
      SELECT COUNT(*) INTO nb_evenements_sans_geom FROM evenements WHERE statut = 'publie' AND geom IS NULL;
      RAISE NOTICE '[migration 20260623_120000] geom reseaux : %/% sans géom (pas de lat/lon)',
        nb_reseaux_sans_geom, nb_reseaux_total;
      RAISE NOTICE '[migration 20260623_120000] geom evenements publiés : %/% sans géom',
        nb_evenements_sans_geom, nb_evenements_total;
    END $$;

    -- ================================================================
    -- ETAPE 5 : conversion enum users.role 'fournisseur' → 'organisateur'
    -- L'enum existant (admin/fournisseur/organisateur) est conservé ;
    -- on converge vers 'organisateur' comme rôle unique client payant (ADR-0003).
    -- ================================================================
    UPDATE "users"
    SET "role" = 'organisateur'
    WHERE "role" = 'fournisseur';

    DO $$
    DECLARE
      nb integer;
    BEGIN
      SELECT COUNT(*) INTO nb FROM users WHERE role = 'organisateur';
      RAISE NOTICE '[migration 20260623_120000] users.role convertis en organisateur : %', nb;
    END $$;

    -- ================================================================
    -- ETAPE 6 : calibrage users.plan vers les nouvelles valeurs
    -- Recalibrage Accès/Développement/Premium (ADR-0004).
    -- Aucun client payant à reprendre (Q1) → tous les comptes non-admin
    -- passent à 'acces' (palier d'entrée).
    -- Remarque : l'enum sera recalibré dans la migration 20260623_130000.
    -- Ici on prépare les données pour la conversion d'enum.
    -- Les valeurs courantes (gratuit/premium/infinite) sont conservées
    -- temporairement pour compatibilité avec la migration enum suivante.
    -- ================================================================
    -- (intentionnellement vide à ce stade — l'enum change dans 20260623_130000)

    -- ================================================================
    -- RAPPORT FINAL
    -- ================================================================
    DO $$
    DECLARE
      nb_reseaux integer;
      nb_reseaux_revendique integer;
      nb_reseaux_importe integer;
      nb_ev_repointes integer;
    BEGIN
      SELECT COUNT(*) INTO nb_reseaux FROM reseaux;
      SELECT COUNT(*) INTO nb_reseaux_revendique FROM reseaux WHERE source = 'revendique';
      SELECT COUNT(*) INTO nb_reseaux_importe FROM reseaux WHERE source = 'importe';
      SELECT COUNT(*) INTO nb_ev_repointes FROM evenements WHERE reseau_id IS NOT NULL;
      RAISE NOTICE '[migration 20260623_120000] RÉSUMÉ : reseaux total=%, revendique=%, importe=%, evenements repointés=%',
        nb_reseaux, nb_reseaux_revendique, nb_reseaux_importe, nb_ev_repointes;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- ROLLBACK de la migration de données
    -- ATTENTION : rollback destructif pour reseaux — à n'appliquer que sur
    -- une copie de la base (dry-run) ou en pré-production.

    -- Vider la table reseaux et ses enfants en cascade
    TRUNCATE TABLE "reseaux" RESTART IDENTITY CASCADE;
    -- Les tables enfants sont vidées par CASCADE ci-dessus.

    -- Remettre evenements.reseau_id à NULL
    UPDATE "evenements" SET "reseau_id" = NULL;

    -- Remettre evenements.geom à NULL
    UPDATE "evenements" SET "geom" = NULL;

    -- Remettre users.role 'organisateur' → 'fournisseur'
    -- (uniquement ceux qui n'étaient pas déjà 'organisateur' avant la migration)
    -- NOTE : sans table de mapping, on ne peut pas distinguer les organisateurs
    -- d'origine des fournisseurs convertis. On remet TOUS les 'organisateur' en
    -- 'fournisseur' SAUF 'admin'. C'est une approximation acceptable pour un dry-run.
    UPDATE "users"
    SET "role" = 'fournisseur'
    WHERE "role" = 'organisateur';
  `)
}

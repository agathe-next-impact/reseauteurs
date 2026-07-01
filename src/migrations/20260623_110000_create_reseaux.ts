import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration J1.1 + J1.2 — Création de la table `reseaux` (fusion Fournisseurs + OrganisateursEvenements).
 *
 * Stratégie :
 *   - On crée la table `reseaux` avec tous les champs consolidés (ADR-0003).
 *   - On y ajoute immédiatement la colonne geom geography(Point,4326) (ADR-0002).
 *   - On ajoute également geom sur la table `evenements` existante.
 *   - Les tables `fournisseurs` et `organisateurs_evenements` sont CONSERVÉES intactes
 *     à ce stade : la migration de données (20260623_120000) les lit pour insérer dans `reseaux`.
 *   - L'ancienne relation evenements.fournisseur_id / organisateur_externe_id est conservée
 *     elle aussi — le repointage vers evenements.reseau_id se fait dans la migration suivante.
 *
 * Champs objet-pub non repris (ADR-0003) :
 *   boutiqueEnLigne, lienDevis, labelsRSE, descriptionRSE, offresEmploi,
 *   activitePrincipale, activitesSecondaires — ces champs n'existent pas dans reseaux.
 *
 * Placeholder récurrence (ADR-0008 hors-MVP) :
 *   - serieId nullable sur evenements, sans relation active.
 *
 * Indexes :
 *   - GiST sur geom (reseaux + evenements) — requêtes bbox/rayon (ADR-0002).
 *   - Index partiel GiST sur evenements.geom pour les lignes publiables.
 *   - B-tree sur slug (unique), user_id (unique), statut.
 *   - B-tree sur evenements.reseau_id (FK préparée) et evenements.date_debut.
 *
 * Requires : extension postgis active (migration 20260623_100000).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ================================================================
    -- 1. ENUM : source du réseau (ADR-0003 drapeau provenance)
    -- ================================================================
    DO $$ BEGIN
      CREATE TYPE "public"."enum_reseaux_source" AS ENUM ('revendique', 'importe');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- ================================================================
    -- 2. ENUM : statut du réseau
    -- ================================================================
    DO $$ BEGIN
      CREATE TYPE "public"."enum_reseaux_statut" AS ENUM ('publiee', 'suspendue');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- ================================================================
    -- 3. TABLE RESEAUX
    -- ================================================================
    CREATE TABLE IF NOT EXISTS "reseaux" (
      "id"             serial PRIMARY KEY NOT NULL,

      -- Propriété et provenance
      "user_id"        integer,
      "source"         "enum_reseaux_source" DEFAULT 'importe' NOT NULL,

      -- Identité
      "slug"           varchar NOT NULL,
      "nom"            varchar NOT NULL,
      "ville"          varchar NOT NULL,
      "adresse"        varchar,
      "code_postal"    varchar,

      -- Contact
      "site_web"       varchar,
      "email_contact"  varchar,
      "telephone"      varchar,
      "video_youtube"  varchar,

      -- Catégorie (relation vers types-evenement — FK ajoutée après)
      "categorie_id"   integer,

      -- Description
      "description"    text,

      -- Médias
      "logo_id"        integer,
      "banniere_id"    integer,

      -- Géo (source de saisie — conservée pour rétrocompat et geocode hook)
      "latitude"       double precision,
      "longitude"      double precision,

      -- Géo PostGIS (ADR-0002) — alimentée par hook afterChange via lat/lon
      "geom"           geography(Point, 4326),

      -- Statut admin
      "statut"         "enum_reseaux_statut" DEFAULT 'publiee' NOT NULL,

      -- SEO (groupe Payload — stocké en colonnes préfixées seo_)
      "seo_title"        varchar(70),
      "seo_description"  varchar(200),
      "seo_keywords"     varchar,
      "seo_og_image_id"  integer,
      "seo_noindex"      boolean DEFAULT false,

      "updated_at"     timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at"     timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- ================================================================
    -- 4. TABLE reseaux_reseaux_sociaux (array Payload)
    -- ================================================================
    DO $$ BEGIN
      CREATE TYPE "public"."enum_reseaux_reseaux_sociaux_plateforme" AS ENUM (
        'facebook', 'instagram', 'linkedin', 'twitter', 'youtube', 'tiktok', 'pinterest'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE TABLE IF NOT EXISTS "reseaux_reseaux_sociaux" (
      "_order"      integer NOT NULL,
      "_parent_id"  integer NOT NULL,
      "id"          varchar PRIMARY KEY NOT NULL,
      "plateforme"  "enum_reseaux_reseaux_sociaux_plateforme" NOT NULL,
      "url"         varchar NOT NULL
    );

    -- ================================================================
    -- 5. TABLE reseaux_illustrations (array Payload)
    -- ================================================================
    CREATE TABLE IF NOT EXISTS "reseaux_illustrations" (
      "_order"      integer NOT NULL,
      "_parent_id"  integer NOT NULL,
      "id"          varchar PRIMARY KEY NOT NULL,
      "image_id"    integer NOT NULL
    );

    -- ================================================================
    -- 6. CONTRAINTES FK sur reseaux
    -- ================================================================
    DO $$ BEGIN
      ALTER TABLE "reseaux"
        ADD CONSTRAINT "reseaux_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "reseaux"
        ADD CONSTRAINT "reseaux_logo_id_media_id_fk"
        FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "reseaux"
        ADD CONSTRAINT "reseaux_banniere_id_media_id_fk"
        FOREIGN KEY ("banniere_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "reseaux"
        ADD CONSTRAINT "reseaux_seo_og_image_id_media_id_fk"
        FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "reseaux"
        ADD CONSTRAINT "reseaux_categorie_id_types_evenement_id_fk"
        FOREIGN KEY ("categorie_id") REFERENCES "public"."types_evenement"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- FK sur les tables enfants
    DO $$ BEGIN
      ALTER TABLE "reseaux_reseaux_sociaux"
        ADD CONSTRAINT "reseaux_reseaux_sociaux_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."reseaux"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "reseaux_illustrations"
        ADD CONSTRAINT "reseaux_illustrations_image_id_media_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "reseaux_illustrations"
        ADD CONSTRAINT "reseaux_illustrations_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."reseaux"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- ================================================================
    -- 7. INDEXES sur reseaux
    -- ================================================================
    -- Unicité slug (SEO, contrat figé — ADR-0005)
    CREATE UNIQUE INDEX IF NOT EXISTS "reseaux_slug_idx"
      ON "reseaux" USING btree ("slug");

    -- Unicité user (1 user = 1 réseau — ADR-0003/Q4)
    CREATE UNIQUE INDEX IF NOT EXISTS "reseaux_user_id_unique"
      ON "reseaux" USING btree ("user_id")
      WHERE "user_id" IS NOT NULL;

    -- Statut (lecture publique)
    CREATE INDEX IF NOT EXISTS "reseaux_statut_idx"
      ON "reseaux" USING btree ("statut");

    -- Source (admin/filtrage)
    CREATE INDEX IF NOT EXISTS "reseaux_source_idx"
      ON "reseaux" USING btree ("source");

    -- Catégorie
    CREATE INDEX IF NOT EXISTS "reseaux_categorie_idx"
      ON "reseaux" USING btree ("categorie_id");

    -- Index GiST spatial — requêtes bbox/rayon (ADR-0002)
    CREATE INDEX IF NOT EXISTS "reseaux_geom_gist_idx"
      ON "reseaux" USING gist ("geom");

    -- Index partiel GiST sur les réseaux publiés (optimise la route carte)
    CREATE INDEX IF NOT EXISTS "reseaux_geom_publiee_gist_idx"
      ON "reseaux" USING gist ("geom")
      WHERE "statut" = 'publiee' AND "geom" IS NOT NULL;

    -- Horodatages (pagination admin, ordonnancement)
    CREATE INDEX IF NOT EXISTS "reseaux_updated_at_idx"
      ON "reseaux" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "reseaux_created_at_idx"
      ON "reseaux" USING btree ("created_at");

    -- Index enfants
    CREATE INDEX IF NOT EXISTS "reseaux_reseaux_sociaux_order_idx"
      ON "reseaux_reseaux_sociaux" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "reseaux_reseaux_sociaux_parent_id_idx"
      ON "reseaux_reseaux_sociaux" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "reseaux_illustrations_order_idx"
      ON "reseaux_illustrations" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "reseaux_illustrations_parent_id_idx"
      ON "reseaux_illustrations" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "reseaux_illustrations_image_idx"
      ON "reseaux_illustrations" USING btree ("image_id");

    -- ================================================================
    -- 8. COLONNE geom SUR EVENEMENTS (ADR-0002)
    -- ================================================================
    ALTER TABLE "evenements"
      ADD COLUMN IF NOT EXISTS "geom" geography(Point, 4326);

    -- Index GiST sur evenements.geom
    CREATE INDEX IF NOT EXISTS "evenements_geom_gist_idx"
      ON "evenements" USING gist ("geom");

    -- Index partiel GiST : occurrences publiées uniquement (requêtes carte)
    CREATE INDEX IF NOT EXISTS "evenements_geom_publie_gist_idx"
      ON "evenements" USING gist ("geom")
      WHERE "statut" = 'publie' AND "visible" = true AND "geom" IS NOT NULL;

    -- ================================================================
    -- 9. COLONNE reseau_id SUR EVENEMENTS (relation future — ADR-0003)
    --    Nullable à ce stade : le repointage se fait dans la migration 20260623_120000.
    -- ================================================================
    ALTER TABLE "evenements"
      ADD COLUMN IF NOT EXISTS "reseau_id" integer;

    DO $$ BEGIN
      ALTER TABLE "evenements"
        ADD CONSTRAINT "evenements_reseau_id_reseaux_id_fk"
        FOREIGN KEY ("reseau_id") REFERENCES "public"."reseaux"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE INDEX IF NOT EXISTS "evenements_reseau_id_idx"
      ON "evenements" USING btree ("reseau_id");

    -- ================================================================
    -- 10. PLACEHOLDER RECURRENCE sur evenements (ADR-0008 hors-MVP)
    --     serieId nullable, sans relation active au MVP.
    --     Presence inerte : rend une future activation additive.
    -- ================================================================
    ALTER TABLE "evenements"
      ADD COLUMN IF NOT EXISTS "serie_id" integer;

    -- Note : pas de FK ni d'index sur serie_id au MVP (la relation est inerte).
    -- Une future migration activera la relation vers une entité series_evenement.

    -- ================================================================
    -- 11. Enregistrement dans payload_locked_documents_rels (Payload bookkeeping)
    -- ================================================================
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "reseaux_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_reseaux_fk"
        FOREIGN KEY ("reseaux_id") REFERENCES "public"."reseaux"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_reseaux_id_idx"
      ON "payload_locked_documents_rels" USING btree ("reseaux_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- ================================================================
    -- ROLLBACK dans l'ordre inverse de la création
    -- ================================================================

    -- 11. Payload bookkeeping
    DROP INDEX IF EXISTS "payload_locked_documents_rels_reseaux_id_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_reseaux_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "reseaux_id";

    -- 10. Placeholder récurrence
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "serie_id";

    -- 9. Relation reseau_id sur evenements
    DROP INDEX IF EXISTS "evenements_reseau_id_idx";
    ALTER TABLE "evenements"
      DROP CONSTRAINT IF EXISTS "evenements_reseau_id_reseaux_id_fk";
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "reseau_id";

    -- 8. Colonne geom sur evenements
    DROP INDEX IF EXISTS "evenements_geom_publie_gist_idx";
    DROP INDEX IF EXISTS "evenements_geom_gist_idx";
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "geom";

    -- 7. Index reseaux
    DROP INDEX IF EXISTS "reseaux_illustrations_image_idx";
    DROP INDEX IF EXISTS "reseaux_illustrations_parent_id_idx";
    DROP INDEX IF EXISTS "reseaux_illustrations_order_idx";
    DROP INDEX IF EXISTS "reseaux_reseaux_sociaux_parent_id_idx";
    DROP INDEX IF EXISTS "reseaux_reseaux_sociaux_order_idx";
    DROP INDEX IF EXISTS "reseaux_created_at_idx";
    DROP INDEX IF EXISTS "reseaux_updated_at_idx";
    DROP INDEX IF EXISTS "reseaux_geom_publiee_gist_idx";
    DROP INDEX IF EXISTS "reseaux_geom_gist_idx";
    DROP INDEX IF EXISTS "reseaux_categorie_idx";
    DROP INDEX IF EXISTS "reseaux_source_idx";
    DROP INDEX IF EXISTS "reseaux_statut_idx";
    DROP INDEX IF EXISTS "reseaux_user_id_unique";
    DROP INDEX IF EXISTS "reseaux_slug_idx";

    -- 6 + 5 + 4 + 3. Tables enfants et reseaux
    DROP TABLE IF EXISTS "reseaux_illustrations" CASCADE;
    DROP TABLE IF EXISTS "reseaux_reseaux_sociaux" CASCADE;
    DROP TABLE IF EXISTS "reseaux" CASCADE;

    -- ENUMs
    DROP TYPE IF EXISTS "public"."enum_reseaux_reseaux_sociaux_plateforme";
    DROP TYPE IF EXISTS "public"."enum_reseaux_statut";
    DROP TYPE IF EXISTS "public"."enum_reseaux_source";
  `)
}

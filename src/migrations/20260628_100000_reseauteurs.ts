import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration J1.2 — Création de la table `reseauteurs` (ADR-0011 §1).
 *
 * Nouvelle collection : la personne qui réseaute.
 * - geom : centroïde ville (pas adresse exacte — RGPD ADR-0011 §7)
 * - badge : enum dérivé de evenements_par_mois (lib/badge.ts)
 * - M2M vers reseaux : table `reseauteurs_rels`
 * - 1 user = 1 reseauteur : index unique conditionnel sur user_id
 *
 * Dépend de :
 *   - 20260623_100000 (PostGIS activé)
 *   - 20260623_110000 (table reseaux existante pour FK)
 *   - 20260628_130000 (table categories) — appliqué avant
 *
 * Idempotente : toutes les instructions utilisent IF NOT EXISTS / DO NOTHING.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ================================================================
    -- 1. ENUMS
    -- ================================================================
    DO $$ BEGIN
      CREATE TYPE "public"."enum_reseauteurs_badge" AS ENUM (
        'bronze', 'argent', 'gold', 'platinum'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_reseauteurs_statut" AS ENUM (
        'en_attente', 'valide', 'suspendu'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- ================================================================
    -- 2. TABLE RESEAUTEURS
    -- ================================================================
    CREATE TABLE IF NOT EXISTS "reseauteurs" (
      "id"                    serial PRIMARY KEY NOT NULL,

      -- Propriété (1 user = 1 reseauteur — unique conditionnel)
      "user_id"               integer,

      -- Identité
      "slug"                  varchar NOT NULL,
      "prenom"                varchar NOT NULL DEFAULT '',
      "nom"                   varchar NOT NULL DEFAULT '',
      "photo_id"              integer,

      -- Profil
      "fonction"              varchar,
      "entreprise"            varchar,
      "description"           text,

      -- Contacts facultatifs (contrôle de confidentialité — ADR-0011 §7)
      "telephone"             varchar,
      "email_contact"         varchar,
      "site"                  varchar,
      "linkedin"              varchar,

      -- Localisation (ville/dept/région — pas d'adresse exacte)
      "ville"                 varchar NOT NULL DEFAULT '',
      "departement"           varchar,
      "region"                varchar,

      -- Secteur et badge
      "secteur_id"            integer,
      "evenements_par_mois"   integer NOT NULL DEFAULT 0,
      "badge"                 "enum_reseauteurs_badge",

      -- Géo PostGIS — centroïde ville (ADR-0002)
      "latitude"              double precision,
      "longitude"             double precision,
      "geom"                  geography(Point, 4326),

      -- Statut de modération
      "statut"                "enum_reseauteurs_statut" DEFAULT 'en_attente' NOT NULL,

      -- SEO (groupe Payload — colonnes préfixées seo_)
      "seo_title"             varchar(70),
      "seo_description"       varchar(200),
      "seo_keywords"          varchar,
      "seo_og_image_id"       integer,
      "seo_noindex"           boolean DEFAULT true,   -- noindex par défaut (RGPD)

      "updated_at"            timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at"            timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- ================================================================
    -- 3. TABLE reseauteurs_competences (array Payload)
    -- ================================================================
    CREATE TABLE IF NOT EXISTS "reseauteurs_competences" (
      "_order"      integer NOT NULL,
      "_parent_id"  integer NOT NULL,
      "id"          varchar PRIMARY KEY NOT NULL,
      "label"       varchar NOT NULL
    );

    -- ================================================================
    -- 4. TABLE reseauteurs_rels (M2M vers reseaux)
    -- Payload gère cette table pour les champs relationship hasMany.
    -- ================================================================
    CREATE TABLE IF NOT EXISTS "reseauteurs_rels" (
      "id"          serial PRIMARY KEY NOT NULL,
      "order"       integer,
      "parent_id"   integer NOT NULL,
      "path"        varchar NOT NULL,
      "reseaux_id"  integer
    );

    -- La migration runner de Payload applique par nom. Cette table est
    -- completée/seedée par 20260628_130000_categories, mais la FK ci-dessous
    -- en a besoin dès maintenant.
    CREATE TABLE IF NOT EXISTS "categories" (
      "id"          serial PRIMARY KEY NOT NULL,
      "label"       varchar NOT NULL,
      "value"       varchar NOT NULL,
      "couleur"     varchar,
      "ordre"       integer DEFAULT 0,
      "updated_at"  timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at"  timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "categories_value_unique_idx"
      ON "categories" USING btree ("value");

    -- ================================================================
    -- 5. CONTRAINTES FK
    -- ================================================================
    DO $$ BEGIN
      ALTER TABLE "reseauteurs"
        ADD CONSTRAINT "reseauteurs_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "reseauteurs"
        ADD CONSTRAINT "reseauteurs_photo_id_media_id_fk"
        FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "reseauteurs"
        ADD CONSTRAINT "reseauteurs_secteur_id_categories_id_fk"
        FOREIGN KEY ("secteur_id") REFERENCES "public"."categories"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "reseauteurs"
        ADD CONSTRAINT "reseauteurs_seo_og_image_id_media_id_fk"
        FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- FK table enfant competences
    DO $$ BEGIN
      ALTER TABLE "reseauteurs_competences"
        ADD CONSTRAINT "reseauteurs_competences_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."reseauteurs"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- FK table rels
    DO $$ BEGIN
      ALTER TABLE "reseauteurs_rels"
        ADD CONSTRAINT "reseauteurs_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."reseauteurs"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "reseauteurs_rels"
        ADD CONSTRAINT "reseauteurs_rels_reseaux_fk"
        FOREIGN KEY ("reseaux_id") REFERENCES "public"."reseaux"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- ================================================================
    -- 6. INDEX sur reseauteurs
    -- ================================================================

    -- Slug unique (SEO, contrat figé — ADR-0005)
    CREATE UNIQUE INDEX IF NOT EXISTS "reseauteurs_slug_idx"
      ON "reseauteurs" USING btree ("slug");

    -- 1 user = 1 reseauteur (index unique conditionnel)
    CREATE UNIQUE INDEX IF NOT EXISTS "reseauteurs_user_id_unique"
      ON "reseauteurs" USING btree ("user_id")
      WHERE "user_id" IS NOT NULL;

    -- Statut (filtrage modération + lecture publique)
    CREATE INDEX IF NOT EXISTS "reseauteurs_statut_idx"
      ON "reseauteurs" USING btree ("statut");

    -- Filtres de recherche (ADR-0011 §6 — recherche simple)
    CREATE INDEX IF NOT EXISTS "reseauteurs_ville_idx"
      ON "reseauteurs" USING btree ("ville");
    CREATE INDEX IF NOT EXISTS "reseauteurs_departement_idx"
      ON "reseauteurs" USING btree ("departement");
    CREATE INDEX IF NOT EXISTS "reseauteurs_region_idx"
      ON "reseauteurs" USING btree ("region");
    CREATE INDEX IF NOT EXISTS "reseauteurs_badge_idx"
      ON "reseauteurs" USING btree ("badge");
    CREATE INDEX IF NOT EXISTS "reseauteurs_secteur_idx"
      ON "reseauteurs" USING btree ("secteur_id");

    -- Index GiST spatial (carte réseauteurs — ADR-0002)
    CREATE INDEX IF NOT EXISTS "reseauteurs_geom_gist_idx"
      ON "reseauteurs" USING gist ("geom");

    -- Index partiel GiST : profils validés uniquement (optimise la route carte)
    CREATE INDEX IF NOT EXISTS "reseauteurs_geom_valide_gist_idx"
      ON "reseauteurs" USING gist ("geom")
      WHERE "statut" = 'valide' AND "geom" IS NOT NULL;

    -- Horodatages
    CREATE INDEX IF NOT EXISTS "reseauteurs_updated_at_idx"
      ON "reseauteurs" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "reseauteurs_created_at_idx"
      ON "reseauteurs" USING btree ("created_at");

    -- ================================================================
    -- 7. INDEX sur les tables enfants
    -- ================================================================
    CREATE INDEX IF NOT EXISTS "reseauteurs_competences_order_idx"
      ON "reseauteurs_competences" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "reseauteurs_competences_parent_idx"
      ON "reseauteurs_competences" USING btree ("_parent_id");

    CREATE INDEX IF NOT EXISTS "reseauteurs_rels_order_idx"
      ON "reseauteurs_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "reseauteurs_rels_parent_idx"
      ON "reseauteurs_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "reseauteurs_rels_path_idx"
      ON "reseauteurs_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "reseauteurs_rels_reseaux_idx"
      ON "reseauteurs_rels" USING btree ("reseaux_id");

    -- ================================================================
    -- 8. Payload bookkeeping
    -- ================================================================
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "reseauteurs_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_reseauteurs_fk"
        FOREIGN KEY ("reseauteurs_id") REFERENCES "public"."reseauteurs"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_reseauteurs_idx"
      ON "payload_locked_documents_rels" USING btree ("reseauteurs_id");

    -- Rapport
    DO $$
    BEGIN
      RAISE NOTICE '[migration 20260628_100000] Table reseauteurs créée avec geom, index GiST, M2M reseaux_rels.';
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Payload bookkeeping
    DROP INDEX IF EXISTS "payload_locked_documents_rels_reseauteurs_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_reseauteurs_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "reseauteurs_id";

    -- Tables
    DROP TABLE IF EXISTS "reseauteurs_rels" CASCADE;
    DROP TABLE IF EXISTS "reseauteurs_competences" CASCADE;
    DROP TABLE IF EXISTS "reseauteurs" CASCADE;

    -- ENUMs
    DROP TYPE IF EXISTS "public"."enum_reseauteurs_statut";
    DROP TYPE IF EXISTS "public"."enum_reseauteurs_badge";

    RAISE NOTICE '[migration 20260628_100000 DOWN] Table reseauteurs supprimée.';
  `)
}

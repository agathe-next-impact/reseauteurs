import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration — Création de la table `categories` (secteurs/métiers, ADR-0011).
 *
 * Nouvelle collection distincte de `categories_activite` (objets publicitaires legacy).
 * La table `categories_activite` est conservée (tables legacy — rollback possible)
 * mais n'est plus montée dans payload.config.ts.
 *
 * Seed initial : 16 secteurs d'activité couvrant les principaux métiers des réseauteurs.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
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
    CREATE INDEX IF NOT EXISTS "categories_ordre_idx"
      ON "categories" USING btree ("ordre");
    CREATE INDEX IF NOT EXISTS "categories_updated_at_idx"
      ON "categories" USING btree ("updated_at");

    -- Payload bookkeeping
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "categories_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_categories_fk"
        FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_categories_idx"
      ON "payload_locked_documents_rels" USING btree ("categories_id");

    -- ── Seed : 16 secteurs d'activité
    INSERT INTO "categories" ("label", "value", "couleur", "ordre", "updated_at", "created_at")
    VALUES
      ('BTP & Immobilier',            'btp-immobilier',        '#F97316', 1,  now(), now()),
      ('Commerce & Distribution',     'commerce-distribution', '#EF4444', 2,  now(), now()),
      ('Conseil & Services B2B',      'conseil-services-b2b',  '#8B5CF6', 3,  now(), now()),
      ('Finance & Assurance',         'finance-assurance',     '#2563EB', 4,  now(), now()),
      ('Formation & Education',       'formation-education',   '#0891B2', 5,  now(), now()),
      ('Hôtellerie & Restauration',   'hotellerie-restauration','#F59E0B', 6,  now(), now()),
      ('Industrie & Manufacture',     'industrie-manufacture', '#6B7280', 7,  now(), now()),
      ('Informatique & Tech',         'informatique-tech',     '#6D28D9', 8,  now(), now()),
      ('Juridique & Notariat',        'juridique-notariat',    '#1D4ED8', 9,  now(), now()),
      ('Marketing & Communication',   'marketing-communication','#EC4899', 10, now(), now()),
      ('Médical & Santé',             'medical-sante',         '#059669', 11, now(), now()),
      ('Ressources Humaines',         'ressources-humaines',   '#D97706', 12, now(), now()),
      ('Transport & Logistique',      'transport-logistique',  '#374151', 13, now(), now()),
      ('Énergie & Environnement',     'energie-environnement', '#16A34A', 14, now(), now()),
      ('Arts & Culture',              'arts-culture',          '#DB2777', 15, now(), now()),
      ('Autre',                       'autre',                 '#9CA3AF', 16, now(), now())
    ON CONFLICT ("value") DO UPDATE
      SET "label"    = EXCLUDED."label",
          "couleur"  = EXCLUDED."couleur",
          "ordre"    = EXCLUDED."ordre",
          "updated_at" = now();

    DO $$
    DECLARE nb integer;
    BEGIN
      SELECT COUNT(*) INTO nb FROM categories;
      RAISE NOTICE '[migration 20260628_130000] Table categories créée : % secteur(s) seedé(s).', nb;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_categories_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_categories_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "categories_id";
    -- Suppression de la FK dans reseauteurs avant de supprimer la table (si appliqué après 100000)
    ALTER TABLE "reseauteurs"
      DROP CONSTRAINT IF EXISTS "reseauteurs_secteur_id_categories_id_fk";
    DROP TABLE IF EXISTS "categories" CASCADE;
  `)
}

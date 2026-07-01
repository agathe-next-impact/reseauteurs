import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration — Référentiel badges (ADR-0011 §5).
 * Crée la table `badges` et seed les 4 niveaux initiaux.
 *
 * Note : la VALEUR sur reseauteurs.badge est un enum string (bronze/argent/gold/platinum),
 * PAS un FK vers cette table. Le référentiel sert uniquement à gérer les libellés/visuels
 * depuis l'admin Payload.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_badges_niveau" AS ENUM (
        'bronze', 'argent', 'gold', 'platinum'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE TABLE IF NOT EXISTS "badges" (
      "id"          serial PRIMARY KEY NOT NULL,
      "niveau"      "enum_badges_niveau" NOT NULL,
      "label"       varchar NOT NULL,
      "description" text,
      "icone_id"    integer,
      "couleur"     varchar,
      "seuil_min"   integer NOT NULL,
      "seuil_max"   integer,
      "updated_at"  timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at"  timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "badges"
        ADD CONSTRAINT "badges_icone_id_media_id_fk"
        FOREIGN KEY ("icone_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS "badges_niveau_unique_idx"
      ON "badges" USING btree ("niveau");
    CREATE INDEX IF NOT EXISTS "badges_updated_at_idx"
      ON "badges" USING btree ("updated_at");

    -- Payload bookkeeping
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "badges_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_badges_fk"
        FOREIGN KEY ("badges_id") REFERENCES "public"."badges"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_badges_idx"
      ON "payload_locked_documents_rels" USING btree ("badges_id");

    -- ── Seed initial (4 badges)
    INSERT INTO "badges" ("niveau", "label", "description", "couleur", "seuil_min", "seuil_max", "updated_at", "created_at")
    VALUES
      ('bronze',   'Bronze',   'Fréquente 0 à 1 événement de networking par mois.',      '#CD7F32', 0,  1,    now(), now()),
      ('argent',   'Argent',   'Fréquente 2 à 5 événements de networking par mois.',     '#C0C0C0', 2,  5,    now(), now()),
      ('gold',     'Gold',     'Fréquente 6 à 10 événements de networking par mois.',    '#FFD700', 6,  10,   now(), now()),
      ('platinum', 'Platinum', 'Fréquente plus de 10 événements de networking par mois.','#E5E4E2', 11, NULL, now(), now())
    ON CONFLICT DO NOTHING;

    DO $$
    BEGIN
      RAISE NOTICE '[migration 20260628_120000] Table badges créée et seedée (4 niveaux).';
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_badges_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_badges_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "badges_id";
    DROP TABLE IF EXISTS "badges" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_badges_niveau";
  `)
}

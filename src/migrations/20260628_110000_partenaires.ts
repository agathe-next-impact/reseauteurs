import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration — Création de la table `partenaires` (annonceurs B2B, ADR-0011 §3).
 * Table simple : nom, logo, lien, statut abonnement (actif/expire).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_partenaires_statut" AS ENUM ('actif', 'expire');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE TABLE IF NOT EXISTS "partenaires" (
      "id"                        serial PRIMARY KEY NOT NULL,
      "nom"                       varchar NOT NULL,
      "logo_id"                   integer,
      "lien"                      varchar,
      "statut"                    "enum_partenaires_statut" DEFAULT 'expire' NOT NULL,
      "stripe_subscription_id"    varchar,
      "abonnement_expire_at"      timestamp(3) with time zone,
      "description"               text,
      "updated_at"                timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at"                timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "partenaires"
        ADD CONSTRAINT "partenaires_logo_id_media_id_fk"
        FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE INDEX IF NOT EXISTS "partenaires_statut_idx"
      ON "partenaires" USING btree ("statut");
    CREATE INDEX IF NOT EXISTS "partenaires_stripe_sub_idx"
      ON "partenaires" USING btree ("stripe_subscription_id");
    CREATE INDEX IF NOT EXISTS "partenaires_updated_at_idx"
      ON "partenaires" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "partenaires_created_at_idx"
      ON "partenaires" USING btree ("created_at");

    -- Payload bookkeeping
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "partenaires_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_partenaires_fk"
        FOREIGN KEY ("partenaires_id") REFERENCES "public"."partenaires"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_partenaires_idx"
      ON "payload_locked_documents_rels" USING btree ("partenaires_id");

    DO $$
    BEGIN
      RAISE NOTICE '[migration 20260628_110000] Table partenaires créée.';
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_partenaires_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_partenaires_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "partenaires_id";
    DROP TABLE IF EXISTS "partenaires" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_partenaires_statut";
  `)
}

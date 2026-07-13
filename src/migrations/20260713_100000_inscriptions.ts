import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration — ADR-0013 §3bis : inscriptions aux événements Plus.
 *
 * Table `inscriptions` (evenement, reseauteur) avec index UNIQUE (evenement, reseauteur)
 * = une inscription par réseauteur et par événement. FK cascade (si l'événement ou le
 * réseauteur disparaît, l'inscription disparaît). + bookkeeping payload_locked_documents.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "inscriptions" (
      "id"             serial PRIMARY KEY NOT NULL,
      "evenement_id"   integer NOT NULL,
      "reseauteur_id"  integer NOT NULL,
      "updated_at"     timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at"     timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "inscriptions"
        ADD CONSTRAINT "inscriptions_evenement_fk"
        FOREIGN KEY ("evenement_id") REFERENCES "public"."evenements"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "inscriptions"
        ADD CONSTRAINT "inscriptions_reseauteur_fk"
        FOREIGN KEY ("reseauteur_id") REFERENCES "public"."reseauteurs"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- Une seule inscription par (événement, réseauteur)
    CREATE UNIQUE INDEX IF NOT EXISTS "inscriptions_evenement_reseauteur_idx"
      ON "inscriptions" ("evenement_id", "reseauteur_id");
    CREATE INDEX IF NOT EXISTS "inscriptions_evenement_idx"
      ON "inscriptions" USING btree ("evenement_id");
    CREATE INDEX IF NOT EXISTS "inscriptions_reseauteur_idx"
      ON "inscriptions" USING btree ("reseauteur_id");
    CREATE INDEX IF NOT EXISTS "inscriptions_created_at_idx"
      ON "inscriptions" USING btree ("created_at");

    -- Payload bookkeeping (locked documents)
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "inscriptions_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_inscriptions_fk"
        FOREIGN KEY ("inscriptions_id") REFERENCES "public"."inscriptions"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_inscriptions_idx"
      ON "payload_locked_documents_rels" USING btree ("inscriptions_id");

    DO $$ BEGIN
      RAISE NOTICE '[migration 20260713_100000] inscriptions : OK.';
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "inscriptions_id";
    DROP TABLE IF EXISTS "inscriptions";
  `)
}

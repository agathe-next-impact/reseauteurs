import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration — ADR-0013 P1 : Réseauteur Plus + packs de licences partenaires.
 *
 * 1. `users` : champs Plus (plus_actif, plus_expire_at, plus_source, plus_licence_pack_id).
 *    Statut posé serveur uniquement (webhook Stripe / route d'activation — P2.A).
 * 2. Tables `licences_packs` (quota + code promo, possédé par un partenaire) et
 *    `licences_activations` (traçabilité, UNE activation par user — index unique).
 * 3. `evenements` : organisateur réseauteur (organisateur_reseauteur_id, N-1 optionnel).
 *    `reseau_id` est déjà nullable en DB — l'invariant « exactement un organisateur »
 *    (réseau XOR réseauteur) est garanti par le hook beforeValidate de la collection.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ================================================================
    -- 1. USERS — champs Réseauteur Plus
    -- ================================================================
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plus_actif" boolean DEFAULT false;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plus_expire_at" timestamp(3) with time zone;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plus_source" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plus_licence_pack_id" integer;

    -- ================================================================
    -- 2. LICENCES_PACKS
    -- ================================================================
    DO $$ BEGIN
      CREATE TYPE "public"."enum_licences_packs_statut" AS ENUM ('actif', 'epuise', 'expire');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE TABLE IF NOT EXISTS "licences_packs" (
      "id"                          serial PRIMARY KEY NOT NULL,
      "partenaire_id"               integer NOT NULL,
      "quota"                       numeric NOT NULL,
      "quota_utilise"               numeric DEFAULT 0,
      "code"                        varchar,
      "statut"                      "enum_licences_packs_statut" DEFAULT 'actif' NOT NULL,
      "expire_at"                   timestamp(3) with time zone,
      "stripe_checkout_session_id"  varchar,
      "updated_at"                  timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at"                  timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "licences_packs"
        ADD CONSTRAINT "licences_packs_partenaire_fk"
        FOREIGN KEY ("partenaire_id") REFERENCES "public"."partenaires"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS "licences_packs_code_idx"
      ON "licences_packs" ("code") WHERE "code" IS NOT NULL;
    CREATE INDEX IF NOT EXISTS "licences_packs_partenaire_idx"
      ON "licences_packs" USING btree ("partenaire_id");
    CREATE INDEX IF NOT EXISTS "licences_packs_statut_idx"
      ON "licences_packs" USING btree ("statut");
    CREATE INDEX IF NOT EXISTS "licences_packs_stripe_session_idx"
      ON "licences_packs" USING btree ("stripe_checkout_session_id");
    CREATE INDEX IF NOT EXISTS "licences_packs_updated_at_idx"
      ON "licences_packs" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "licences_packs_created_at_idx"
      ON "licences_packs" USING btree ("created_at");

    -- ================================================================
    -- 3. LICENCES_ACTIVATIONS (1 activation par user — index UNIQUE)
    -- ================================================================
    CREATE TABLE IF NOT EXISTS "licences_activations" (
      "id"          serial PRIMARY KEY NOT NULL,
      "pack_id"     integer NOT NULL,
      "user_id"     integer NOT NULL,
      "active_at"   timestamp(3) with time zone,
      "updated_at"  timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at"  timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "licences_activations"
        ADD CONSTRAINT "licences_activations_pack_fk"
        FOREIGN KEY ("pack_id") REFERENCES "public"."licences_packs"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "licences_activations"
        ADD CONSTRAINT "licences_activations_user_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS "licences_activations_user_idx"
      ON "licences_activations" ("user_id");
    CREATE INDEX IF NOT EXISTS "licences_activations_pack_idx"
      ON "licences_activations" USING btree ("pack_id");
    CREATE INDEX IF NOT EXISTS "licences_activations_updated_at_idx"
      ON "licences_activations" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "licences_activations_created_at_idx"
      ON "licences_activations" USING btree ("created_at");

    -- FK users.plus_licence_pack_id (après création de licences_packs)
    DO $$ BEGIN
      ALTER TABLE "users"
        ADD CONSTRAINT "users_plus_licence_pack_fk"
        FOREIGN KEY ("plus_licence_pack_id") REFERENCES "public"."licences_packs"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "users_plus_licence_pack_idx"
      ON "users" USING btree ("plus_licence_pack_id");

    -- ================================================================
    -- 4. EVENEMENTS — organisateur réseauteur (XOR géré applicativement)
    -- ================================================================
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "organisateur_reseauteur_id" integer;
    DO $$ BEGIN
      ALTER TABLE "evenements"
        ADD CONSTRAINT "evenements_organisateur_reseauteur_fk"
        FOREIGN KEY ("organisateur_reseauteur_id") REFERENCES "public"."reseauteurs"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "evenements_organisateur_reseauteur_idx"
      ON "evenements" USING btree ("organisateur_reseauteur_id");

    -- ================================================================
    -- 5. Payload bookkeeping (locked documents)
    -- ================================================================
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "licences_packs_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "licences_activations_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_licences_packs_fk"
        FOREIGN KEY ("licences_packs_id") REFERENCES "public"."licences_packs"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_licences_activations_fk"
        FOREIGN KEY ("licences_activations_id") REFERENCES "public"."licences_activations"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_licences_packs_idx"
      ON "payload_locked_documents_rels" USING btree ("licences_packs_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_licences_activations_idx"
      ON "payload_locked_documents_rels" USING btree ("licences_activations_id");

    DO $$ BEGIN
      RAISE NOTICE '[migration 20260712_100000] Réseauteur Plus + licences : OK.';
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Bookkeeping
    DROP INDEX IF EXISTS "payload_locked_documents_rels_licences_activations_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_licences_packs_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_licences_activations_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_licences_packs_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "licences_activations_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "licences_packs_id";

    -- Evenements
    DROP INDEX IF EXISTS "evenements_organisateur_reseauteur_idx";
    ALTER TABLE "evenements" DROP CONSTRAINT IF EXISTS "evenements_organisateur_reseauteur_fk";
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "organisateur_reseauteur_id";

    -- Users (FK avant la table référencée)
    DROP INDEX IF EXISTS "users_plus_licence_pack_idx";
    ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_plus_licence_pack_fk";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "plus_licence_pack_id";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "plus_source";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "plus_expire_at";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "plus_actif";

    -- Tables licences
    DROP TABLE IF EXISTS "licences_activations" CASCADE;
    DROP TABLE IF EXISTS "licences_packs" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_licences_packs_statut";
  `)
}

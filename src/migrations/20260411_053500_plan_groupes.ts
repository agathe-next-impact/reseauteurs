import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration: introduces the new `plan` (gratuit/premium/infinite) field on users,
 * renames the legacy `plan` (gratuit/standard/premium) to `legacy_plan`, adds a
 * `groupe_id` relationship on users, and creates the new `groupes` collection.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1. Rename legacy enum + column on users (skip if already done)
    DO $$ BEGIN
      ALTER TYPE "public"."enum_users_plan" RENAME TO "enum_users_legacy_plan";
    EXCEPTION WHEN undefined_object THEN NULL; WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "users" RENAME COLUMN "plan" TO "legacy_plan";
    EXCEPTION WHEN undefined_column THEN NULL; WHEN duplicate_column THEN NULL; END $$;

    -- 2. Create new enum + column for the new 3-tier plan
    DO $$ BEGIN
      CREATE TYPE "public"."enum_users_plan" AS ENUM ('gratuit', 'premium', 'infinite');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan" "enum_users_plan" DEFAULT 'gratuit' NOT NULL;

    -- 3. Create the groupes table
    DO $$ BEGIN
      CREATE TYPE "public"."enum_groupes_palier_actuel" AS ENUM ('0', '5', '10', '15');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE TABLE IF NOT EXISTS "groupes" (
      "id" serial PRIMARY KEY NOT NULL,
      "nom" varchar NOT NULL,
      "code" varchar NOT NULL,
      "owner_id" integer NOT NULL,
      "palier_actuel" "enum_groupes_palier_actuel" DEFAULT '0' NOT NULL,
      "stripe_coupon_id" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "groupes_code_idx" ON "groupes" USING btree ("code");
    CREATE INDEX IF NOT EXISTS "groupes_owner_idx" ON "groupes" USING btree ("owner_id");
    CREATE INDEX IF NOT EXISTS "groupes_updated_at_idx" ON "groupes" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "groupes_created_at_idx" ON "groupes" USING btree ("created_at");
    DO $$ BEGIN
      ALTER TABLE "groupes" ADD CONSTRAINT "groupes_owner_id_users_id_fk"
        FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- 4. Add groupe_id FK on users
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "groupe_id" integer;
    DO $$ BEGIN
      ALTER TABLE "users" ADD CONSTRAINT "users_groupe_id_groupes_id_fk"
        FOREIGN KEY ("groupe_id") REFERENCES "public"."groupes"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "users_groupe_idx" ON "users" USING btree ("groupe_id");

    -- 5. Register groupes in payload_locked_documents (Payload bookkeeping)
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "groupes_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_groupes_fk"
        FOREIGN KEY ("groupes_id") REFERENCES "public"."groupes"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_groupes_id_idx"
      ON "payload_locked_documents_rels" USING btree ("groupes_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Reverse step 5
    DROP INDEX IF EXISTS "payload_locked_documents_rels_groupes_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_groupes_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "groupes_id";

    -- Reverse step 4
    DROP INDEX IF EXISTS "users_groupe_idx";
    ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_groupe_id_groupes_id_fk";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "groupe_id";

    -- Reverse step 3
    DROP TABLE IF EXISTS "groupes" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_groupes_palier_actuel";

    -- Reverse step 2
    ALTER TABLE "users" DROP COLUMN IF EXISTS "plan";
    DROP TYPE IF EXISTS "public"."enum_users_plan";

    -- Reverse step 1
    ALTER TABLE "users" RENAME COLUMN "legacy_plan" TO "plan";
    ALTER TYPE "public"."enum_users_legacy_plan" RENAME TO "enum_users_plan";
  `)
}

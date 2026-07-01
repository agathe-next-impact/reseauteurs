import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration : drops the legacy multi-pack columns from `users` and their
 * associated Postgres enum types. After this migration the only plan-related
 * columns are `plan` (enum_users_plan) and `plan_expires_at`.
 *
 * Prerequisite : data must have been migrated from legacy_plan to plan
 * (see scripts/migrate-legacy-plans.ts in commit history).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN IF EXISTS "legacy_plan";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "pack_type";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "feature_level";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "fiche_quota";

    DROP TYPE IF EXISTS "public"."enum_users_legacy_plan";
    DROP TYPE IF EXISTS "public"."enum_users_pack_type";
    DROP TYPE IF EXISTS "public"."enum_users_feature_level";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Recreate the enum types
    CREATE TYPE "public"."enum_users_legacy_plan" AS ENUM ('gratuit', 'standard', 'premium');
    CREATE TYPE "public"."enum_users_pack_type" AS ENUM ('gratuit', 'pack3', 'pack5', 'pack10');
    CREATE TYPE "public"."enum_users_feature_level" AS ENUM ('standard', 'premium');

    -- Recreate the columns with their original defaults
    ALTER TABLE "users" ADD COLUMN "legacy_plan" "enum_users_legacy_plan" DEFAULT 'gratuit';
    ALTER TABLE "users" ADD COLUMN "pack_type" "enum_users_pack_type" DEFAULT 'gratuit' NOT NULL;
    ALTER TABLE "users" ADD COLUMN "feature_level" "enum_users_feature_level" DEFAULT 'standard' NOT NULL;
    ALTER TABLE "users" ADD COLUMN "fiche_quota" numeric DEFAULT 1 NOT NULL;
  `)
}

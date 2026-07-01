import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_users_pack_type" AS ENUM('gratuit', 'pack3', 'pack5', 'pack10');
    CREATE TYPE "public"."enum_users_feature_level" AS ENUM('standard', 'premium');

    ALTER TABLE "users" ALTER COLUMN "plan" DROP NOT NULL;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pack_type" "enum_users_pack_type" DEFAULT 'gratuit' NOT NULL;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "feature_level" "enum_users_feature_level" DEFAULT 'standard' NOT NULL;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fiche_quota" numeric DEFAULT 1 NOT NULL;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "_verified" boolean;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "_verificationtoken" varchar;
    ALTER TABLE "users" DROP COLUMN IF EXISTS "is_email_verified";

    ALTER TABLE "fournisseurs" ALTER COLUMN "activite_principale_id" SET NOT NULL;
    ALTER TABLE "evenements" ALTER COLUMN "type_id" SET NOT NULL;

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "categories_activite_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "types_evenement_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_activite_fk" FOREIGN KEY ("categories_activite_id") REFERENCES "public"."categories_activite"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_types_evenement_fk" FOREIGN KEY ("types_evenement_id") REFERENCES "public"."types_evenement"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_locked_documents_rels_categories_activite_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_activite_id");
    CREATE INDEX "payload_locked_documents_rels_types_evenement_id_idx" ON "payload_locked_documents_rels" USING btree ("types_evenement_id");

    CREATE INDEX IF NOT EXISTS "fournisseurs_activite_principale_idx" ON "fournisseurs" USING btree ("activite_principale_id");
    CREATE INDEX IF NOT EXISTS "evenements_type_idx" ON "evenements" USING btree ("type_id");

    DROP INDEX IF EXISTS "fournisseurs_user_idx";
    CREATE INDEX "fournisseurs_user_idx" ON "fournisseurs" USING btree ("user_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "fournisseurs_user_idx";
    CREATE UNIQUE INDEX "fournisseurs_user_idx" ON "fournisseurs" USING btree ("user_id");

    DROP INDEX IF EXISTS "fournisseurs_activite_principale_idx";
    DROP INDEX IF EXISTS "evenements_type_idx";

    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_categories_activite_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_types_evenement_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_categories_activite_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_types_evenement_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "categories_activite_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "types_evenement_id";

    ALTER TABLE "fournisseurs" ALTER COLUMN "activite_principale_id" DROP NOT NULL;
    ALTER TABLE "evenements" ALTER COLUMN "type_id" DROP NOT NULL;

    ALTER TABLE "users" ADD COLUMN "is_email_verified" boolean DEFAULT false;
    ALTER TABLE "users" DROP COLUMN IF EXISTS "_verificationtoken";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "_verified";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "fiche_quota";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "feature_level";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "pack_type";
    ALTER TABLE "users" ALTER COLUMN "plan" SET NOT NULL;

    DROP TYPE "public"."enum_users_feature_level";
    DROP TYPE "public"."enum_users_pack_type";
  `)
}

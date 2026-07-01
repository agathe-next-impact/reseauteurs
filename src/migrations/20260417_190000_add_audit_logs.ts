import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_audit_logs_type" AS ENUM ('account_deleted', 'consent_given', 'consent_revoked', 'data_exported');

    CREATE TABLE "audit_logs" (
      "id" serial PRIMARY KEY NOT NULL,
      "type" "enum_audit_logs_type" NOT NULL,
      "user_id_hash" varchar NOT NULL,
      "metadata" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "audit_logs_id" integer;
    CREATE INDEX "audit_logs_user_id_hash_idx" ON "audit_logs" USING btree ("user_id_hash");
    CREATE INDEX "audit_logs_updated_at_idx" ON "audit_logs" USING btree ("updated_at");
    CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_logs_fk" FOREIGN KEY ("audit_logs_id") REFERENCES "public"."audit_logs"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_locked_documents_rels_audit_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_logs_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_audit_logs_fk";
    DROP INDEX "payload_locked_documents_rels_audit_logs_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "audit_logs_id";
    DROP TABLE "audit_logs" CASCADE;
    DROP TYPE "public"."enum_audit_logs_type";
  `)
}

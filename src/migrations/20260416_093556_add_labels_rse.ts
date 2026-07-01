import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "labels_rse" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"value" varchar NOT NULL,
  	"logo_id" integer NOT NULL,
  	"ordre" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "fournisseurs" ADD COLUMN "boutique_en_ligne" varchar;
  ALTER TABLE "fournisseurs" ADD COLUMN "lien_devis" varchar;
  ALTER TABLE "fournisseurs" ADD COLUMN "description_r_s_e" varchar;
  ALTER TABLE "fournisseurs_rels" ADD COLUMN "labels_rse_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "labels_rse_id" integer;
  ALTER TABLE "labels_rse" ADD CONSTRAINT "labels_rse_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "labels_rse_value_idx" ON "labels_rse" USING btree ("value");
  CREATE INDEX "labels_rse_logo_idx" ON "labels_rse" USING btree ("logo_id");
  CREATE INDEX "labels_rse_updated_at_idx" ON "labels_rse" USING btree ("updated_at");
  CREATE INDEX "labels_rse_created_at_idx" ON "labels_rse" USING btree ("created_at");
  ALTER TABLE "fournisseurs_rels" ADD CONSTRAINT "fournisseurs_rels_labels_rse_fk" FOREIGN KEY ("labels_rse_id") REFERENCES "public"."labels_rse"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_labels_rse_fk" FOREIGN KEY ("labels_rse_id") REFERENCES "public"."labels_rse"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "fournisseurs_rels_labels_rse_id_idx" ON "fournisseurs_rels" USING btree ("labels_rse_id");
  CREATE INDEX "payload_locked_documents_rels_labels_rse_id_idx" ON "payload_locked_documents_rels" USING btree ("labels_rse_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "labels_rse" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "labels_rse" CASCADE;
  ALTER TABLE "fournisseurs_rels" DROP CONSTRAINT "fournisseurs_rels_labels_rse_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_labels_rse_fk";
  DROP INDEX "fournisseurs_rels_labels_rse_id_idx";
  DROP INDEX "payload_locked_documents_rels_labels_rse_id_idx";
  ALTER TABLE "fournisseurs" DROP COLUMN "boutique_en_ligne";
  ALTER TABLE "fournisseurs" DROP COLUMN "lien_devis";
  ALTER TABLE "fournisseurs" DROP COLUMN "description_r_s_e";
  ALTER TABLE "fournisseurs_rels" DROP COLUMN "labels_rse_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "labels_rse_id";`)
}

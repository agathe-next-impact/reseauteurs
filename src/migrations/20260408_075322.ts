import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "organisateurs_evenements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"nom" varchar NOT NULL,
  	"ville" varchar,
  	"site_web" varchar,
  	"email_contact" varchar,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "evenements" ADD COLUMN "organisateur_externe_id" integer;
  ALTER TABLE "evenements_rels" ADD COLUMN "categories_activite_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "organisateurs_evenements_id" integer;
  CREATE INDEX "organisateurs_evenements_updated_at_idx" ON "organisateurs_evenements" USING btree ("updated_at");
  CREATE INDEX "organisateurs_evenements_created_at_idx" ON "organisateurs_evenements" USING btree ("created_at");
  ALTER TABLE "evenements" ADD CONSTRAINT "evenements_organisateur_externe_id_organisateurs_evenements_id_fk" FOREIGN KEY ("organisateur_externe_id") REFERENCES "public"."organisateurs_evenements"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "evenements_rels" ADD CONSTRAINT "evenements_rels_categories_activite_fk" FOREIGN KEY ("categories_activite_id") REFERENCES "public"."categories_activite"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_organisateurs_evenements_fk" FOREIGN KEY ("organisateurs_evenements_id") REFERENCES "public"."organisateurs_evenements"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "evenements_organisateur_externe_idx" ON "evenements" USING btree ("organisateur_externe_id");
  CREATE INDEX "evenements_rels_categories_activite_id_idx" ON "evenements_rels" USING btree ("categories_activite_id");
  CREATE INDEX "payload_locked_documents_rels_organisateurs_evenements_i_idx" ON "payload_locked_documents_rels" USING btree ("organisateurs_evenements_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "organisateurs_evenements" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "organisateurs_evenements" CASCADE;
  ALTER TABLE "evenements" DROP CONSTRAINT "evenements_organisateur_externe_id_organisateurs_evenements_id_fk";
  
  ALTER TABLE "evenements_rels" DROP CONSTRAINT "evenements_rels_categories_activite_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_organisateurs_evenements_fk";
  
  DROP INDEX "evenements_organisateur_externe_idx";
  DROP INDEX "evenements_rels_categories_activite_id_idx";
  DROP INDEX "payload_locked_documents_rels_organisateurs_evenements_i_idx";
  ALTER TABLE "evenements" DROP COLUMN "organisateur_externe_id";
  ALTER TABLE "evenements_rels" DROP COLUMN "categories_activite_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "organisateurs_evenements_id";`)
}

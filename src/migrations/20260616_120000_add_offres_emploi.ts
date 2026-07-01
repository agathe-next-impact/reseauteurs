import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE "fournisseurs_offres_emploi" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"titre" varchar NOT NULL,
  	"lien" varchar NOT NULL,
  	"date_publication" timestamp(3) with time zone NOT NULL
  );

  ALTER TABLE "fournisseurs_offres_emploi" ADD CONSTRAINT "fournisseurs_offres_emploi_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."fournisseurs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "fournisseurs_offres_emploi_order_idx" ON "fournisseurs_offres_emploi" USING btree ("_order");
  CREATE INDEX "fournisseurs_offres_emploi_parent_id_idx" ON "fournisseurs_offres_emploi" USING btree ("_parent_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "fournisseurs_offres_emploi" CASCADE;`)
}

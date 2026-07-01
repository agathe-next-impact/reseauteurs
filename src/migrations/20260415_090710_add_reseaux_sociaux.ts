import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_fournisseurs_reseaux_sociaux_plateforme" AS ENUM('facebook', 'instagram', 'linkedin', 'twitter', 'youtube', 'tiktok', 'pinterest');
  CREATE TABLE "fournisseurs_reseaux_sociaux" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"plateforme" "enum_fournisseurs_reseaux_sociaux_plateforme" NOT NULL,
  	"url" varchar NOT NULL
  );
  
  ALTER TABLE "fournisseurs_reseaux_sociaux" ADD CONSTRAINT "fournisseurs_reseaux_sociaux_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."fournisseurs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "fournisseurs_reseaux_sociaux_order_idx" ON "fournisseurs_reseaux_sociaux" USING btree ("_order");
  CREATE INDEX "fournisseurs_reseaux_sociaux_parent_id_idx" ON "fournisseurs_reseaux_sociaux" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "fournisseurs_reseaux_sociaux" CASCADE;
  DROP TYPE "public"."enum_fournisseurs_reseaux_sociaux_plateforme";`)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // ALTER TYPE ADD VALUE cannot run inside a transaction — execute separately
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'organisateur' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_users_role')) THEN
        ALTER TYPE "public"."enum_users_role" ADD VALUE 'organisateur';
      END IF;
    END $$;
  `)

  await db.execute(sql`
   CREATE TYPE "public"."enum_organisateurs_evenements_reseaux_sociaux_plateforme" AS ENUM('facebook', 'instagram', 'linkedin', 'twitter', 'youtube', 'tiktok', 'pinterest');
  CREATE TYPE "public"."enum_organisateurs_evenements_statut" AS ENUM('en-attente', 'publiee', 'rejetee', 'suspendue');
  CREATE TABLE "organisateurs_evenements_reseaux_sociaux" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"plateforme" "enum_organisateurs_evenements_reseaux_sociaux_plateforme" NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "organisateurs_evenements_illustrations" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL
  );
  
  CREATE TABLE "organisateurs_evenements_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_activite_id" integer
  );
  
  ALTER TABLE "organisateurs_evenements" ADD COLUMN "user_id" integer;
  ALTER TABLE "organisateurs_evenements" ADD COLUMN "slug" varchar;
  ALTER TABLE "organisateurs_evenements" ADD COLUMN "statut" "enum_organisateurs_evenements_statut" DEFAULT 'en-attente' NOT NULL;
  ALTER TABLE "organisateurs_evenements" ADD COLUMN "adresse" varchar;
  ALTER TABLE "organisateurs_evenements" ADD COLUMN "code_postal" varchar;
  ALTER TABLE "organisateurs_evenements" ADD COLUMN "telephone" varchar;
  ALTER TABLE "organisateurs_evenements" ADD COLUMN "banniere_id" integer;
  ALTER TABLE "organisateurs_evenements" ADD COLUMN "logo_id" integer;
  ALTER TABLE "organisateurs_evenements" ADD COLUMN "video_youtube" varchar;
  ALTER TABLE "organisateurs_evenements_reseaux_sociaux" ADD CONSTRAINT "organisateurs_evenements_reseaux_sociaux_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."organisateurs_evenements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "organisateurs_evenements_illustrations" ADD CONSTRAINT "organisateurs_evenements_illustrations_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "organisateurs_evenements_illustrations" ADD CONSTRAINT "organisateurs_evenements_illustrations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."organisateurs_evenements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "organisateurs_evenements_rels" ADD CONSTRAINT "organisateurs_evenements_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."organisateurs_evenements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "organisateurs_evenements_rels" ADD CONSTRAINT "organisateurs_evenements_rels_categories_activite_fk" FOREIGN KEY ("categories_activite_id") REFERENCES "public"."categories_activite"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "organisateurs_evenements_reseaux_sociaux_order_idx" ON "organisateurs_evenements_reseaux_sociaux" USING btree ("_order");
  CREATE INDEX "organisateurs_evenements_reseaux_sociaux_parent_id_idx" ON "organisateurs_evenements_reseaux_sociaux" USING btree ("_parent_id");
  CREATE INDEX "organisateurs_evenements_illustrations_order_idx" ON "organisateurs_evenements_illustrations" USING btree ("_order");
  CREATE INDEX "organisateurs_evenements_illustrations_parent_id_idx" ON "organisateurs_evenements_illustrations" USING btree ("_parent_id");
  CREATE INDEX "organisateurs_evenements_illustrations_image_idx" ON "organisateurs_evenements_illustrations" USING btree ("image_id");
  CREATE INDEX "organisateurs_evenements_rels_order_idx" ON "organisateurs_evenements_rels" USING btree ("order");
  CREATE INDEX "organisateurs_evenements_rels_parent_idx" ON "organisateurs_evenements_rels" USING btree ("parent_id");
  CREATE INDEX "organisateurs_evenements_rels_path_idx" ON "organisateurs_evenements_rels" USING btree ("path");
  CREATE INDEX "organisateurs_evenements_rels_categories_activite_id_idx" ON "organisateurs_evenements_rels" USING btree ("categories_activite_id");
  ALTER TABLE "organisateurs_evenements" ADD CONSTRAINT "organisateurs_evenements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "organisateurs_evenements" ADD CONSTRAINT "organisateurs_evenements_banniere_id_media_id_fk" FOREIGN KEY ("banniere_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "organisateurs_evenements" ADD CONSTRAINT "organisateurs_evenements_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "organisateurs_evenements_user_idx" ON "organisateurs_evenements" USING btree ("user_id");
  CREATE UNIQUE INDEX "organisateurs_evenements_slug_idx" ON "organisateurs_evenements" USING btree ("slug");
  CREATE INDEX "organisateurs_evenements_statut_idx" ON "organisateurs_evenements" USING btree ("statut");
  CREATE INDEX "organisateurs_evenements_banniere_idx" ON "organisateurs_evenements" USING btree ("banniere_id");
  CREATE INDEX "organisateurs_evenements_logo_idx" ON "organisateurs_evenements" USING btree ("logo_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "organisateurs_evenements_reseaux_sociaux" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "organisateurs_evenements_illustrations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "organisateurs_evenements_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "organisateurs_evenements_reseaux_sociaux" CASCADE;
  DROP TABLE "organisateurs_evenements_illustrations" CASCADE;
  DROP TABLE "organisateurs_evenements_rels" CASCADE;
  ALTER TABLE "organisateurs_evenements" DROP CONSTRAINT "organisateurs_evenements_user_id_users_id_fk";
  
  ALTER TABLE "organisateurs_evenements" DROP CONSTRAINT "organisateurs_evenements_banniere_id_media_id_fk";
  
  ALTER TABLE "organisateurs_evenements" DROP CONSTRAINT "organisateurs_evenements_logo_id_media_id_fk";
  
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'fournisseur'::text;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'fournisseur');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'fournisseur'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";
  DROP INDEX "organisateurs_evenements_user_idx";
  DROP INDEX "organisateurs_evenements_slug_idx";
  DROP INDEX "organisateurs_evenements_statut_idx";
  DROP INDEX "organisateurs_evenements_banniere_idx";
  DROP INDEX "organisateurs_evenements_logo_idx";
  ALTER TABLE "organisateurs_evenements" DROP COLUMN "user_id";
  ALTER TABLE "organisateurs_evenements" DROP COLUMN "slug";
  ALTER TABLE "organisateurs_evenements" DROP COLUMN "statut";
  ALTER TABLE "organisateurs_evenements" DROP COLUMN "adresse";
  ALTER TABLE "organisateurs_evenements" DROP COLUMN "code_postal";
  ALTER TABLE "organisateurs_evenements" DROP COLUMN "telephone";
  ALTER TABLE "organisateurs_evenements" DROP COLUMN "banniere_id";
  ALTER TABLE "organisateurs_evenements" DROP COLUMN "logo_id";
  ALTER TABLE "organisateurs_evenements" DROP COLUMN "video_youtube";
  DROP TYPE "public"."enum_organisateurs_evenements_reseaux_sociaux_plateforme";
  DROP TYPE "public"."enum_organisateurs_evenements_statut";`)
}

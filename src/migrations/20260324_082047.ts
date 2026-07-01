import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_fournisseurs_activites_secondaires" AS ENUM('objets-publicitaires', 'textile-publicitaire', 'goodies', 'cadeaux-entreprise', 'stim-fidelisation');
  CREATE TYPE "public"."enum_fournisseurs_activite_principale" AS ENUM('objets-publicitaires', 'textile-publicitaire', 'goodies', 'cadeaux-entreprise', 'stim-fidelisation');
  CREATE TYPE "public"."enum_fournisseurs_statut" AS ENUM('en-attente', 'publiee', 'rejetee', 'suspendue');
  CREATE TYPE "public"."enum_evenements_type" AS ENUM('salon', 'portes-ouvertes', 'demonstration', 'presence-salon', 'formation', 'autre');
  CREATE TYPE "public"."enum_evenements_statut" AS ENUM('en-attente', 'publie', 'archive');
  CREATE TABLE "fournisseurs_activites_secondaires" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_fournisseurs_activites_secondaires",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "fournisseurs_galerie" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL
  );
  
  CREATE TABLE "fournisseurs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"slug" varchar,
  	"raison_sociale" varchar NOT NULL,
  	"ville" varchar NOT NULL,
  	"activite_principale" "enum_fournisseurs_activite_principale" NOT NULL,
  	"statut" "enum_fournisseurs_statut" DEFAULT 'en-attente' NOT NULL,
  	"adresse" varchar,
  	"code_postal" varchar,
  	"site_web" varchar,
  	"email_contact" varchar,
  	"telephone" varchar,
  	"description" varchar,
  	"latitude" numeric,
  	"longitude" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "evenements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"fournisseur_id" integer,
  	"titre" varchar NOT NULL,
  	"type" "enum_evenements_type" NOT NULL,
  	"date_debut" timestamp(3) with time zone NOT NULL,
  	"date_fin" timestamp(3) with time zone,
  	"lieu_nom" varchar,
  	"lieu_adresse" varchar,
  	"lieu_code_postal" varchar,
  	"lieu_ville" varchar NOT NULL,
  	"description_courte" varchar,
  	"lien_inscription" varchar,
  	"email_contact" varchar,
  	"visuel_id" integer,
  	"statut" "enum_evenements_statut" DEFAULT 'en-attente' NOT NULL,
  	"lieu_latitude" numeric,
  	"lieu_longitude" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users" ADD COLUMN "nom_societe" varchar NOT NULL;
  ALTER TABLE "users" ADD COLUMN "ville" varchar NOT NULL;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_filename" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_card_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_card_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_card_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_card_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_card_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_card_filename" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_full_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_full_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_full_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_full_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_full_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_full_filename" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "fournisseurs_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "evenements_id" integer;
  ALTER TABLE "fournisseurs_activites_secondaires" ADD CONSTRAINT "fournisseurs_activites_secondaires_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."fournisseurs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "fournisseurs_galerie" ADD CONSTRAINT "fournisseurs_galerie_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "fournisseurs_galerie" ADD CONSTRAINT "fournisseurs_galerie_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."fournisseurs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "fournisseurs" ADD CONSTRAINT "fournisseurs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "evenements" ADD CONSTRAINT "evenements_fournisseur_id_fournisseurs_id_fk" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."fournisseurs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "evenements" ADD CONSTRAINT "evenements_visuel_id_media_id_fk" FOREIGN KEY ("visuel_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "fournisseurs_activites_secondaires_order_idx" ON "fournisseurs_activites_secondaires" USING btree ("order");
  CREATE INDEX "fournisseurs_activites_secondaires_parent_idx" ON "fournisseurs_activites_secondaires" USING btree ("parent_id");
  CREATE INDEX "fournisseurs_galerie_order_idx" ON "fournisseurs_galerie" USING btree ("_order");
  CREATE INDEX "fournisseurs_galerie_parent_id_idx" ON "fournisseurs_galerie" USING btree ("_parent_id");
  CREATE INDEX "fournisseurs_galerie_image_idx" ON "fournisseurs_galerie" USING btree ("image_id");
  CREATE UNIQUE INDEX "fournisseurs_user_idx" ON "fournisseurs" USING btree ("user_id");
  CREATE UNIQUE INDEX "fournisseurs_slug_idx" ON "fournisseurs" USING btree ("slug");
  CREATE INDEX "fournisseurs_updated_at_idx" ON "fournisseurs" USING btree ("updated_at");
  CREATE INDEX "fournisseurs_created_at_idx" ON "fournisseurs" USING btree ("created_at");
  CREATE INDEX "evenements_fournisseur_idx" ON "evenements" USING btree ("fournisseur_id");
  CREATE INDEX "evenements_visuel_idx" ON "evenements" USING btree ("visuel_id");
  CREATE INDEX "evenements_updated_at_idx" ON "evenements" USING btree ("updated_at");
  CREATE INDEX "evenements_created_at_idx" ON "evenements" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_fournisseurs_fk" FOREIGN KEY ("fournisseurs_id") REFERENCES "public"."fournisseurs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_evenements_fk" FOREIGN KEY ("evenements_id") REFERENCES "public"."evenements"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_full_sizes_full_filename_idx" ON "media" USING btree ("sizes_full_filename");
  CREATE INDEX "payload_locked_documents_rels_fournisseurs_id_idx" ON "payload_locked_documents_rels" USING btree ("fournisseurs_id");
  CREATE INDEX "payload_locked_documents_rels_evenements_id_idx" ON "payload_locked_documents_rels" USING btree ("evenements_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "fournisseurs_activites_secondaires" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "fournisseurs_galerie" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "fournisseurs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "evenements" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "fournisseurs_activites_secondaires" CASCADE;
  DROP TABLE "fournisseurs_galerie" CASCADE;
  DROP TABLE "fournisseurs" CASCADE;
  DROP TABLE "evenements" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_fournisseurs_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_evenements_fk";
  
  DROP INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx";
  DROP INDEX "media_sizes_card_sizes_card_filename_idx";
  DROP INDEX "media_sizes_full_sizes_full_filename_idx";
  DROP INDEX "payload_locked_documents_rels_fournisseurs_id_idx";
  DROP INDEX "payload_locked_documents_rels_evenements_id_idx";
  ALTER TABLE "users" DROP COLUMN "nom_societe";
  ALTER TABLE "users" DROP COLUMN "ville";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_url";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_width";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_height";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_filename";
  ALTER TABLE "media" DROP COLUMN "sizes_card_url";
  ALTER TABLE "media" DROP COLUMN "sizes_card_width";
  ALTER TABLE "media" DROP COLUMN "sizes_card_height";
  ALTER TABLE "media" DROP COLUMN "sizes_card_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_card_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_card_filename";
  ALTER TABLE "media" DROP COLUMN "sizes_full_url";
  ALTER TABLE "media" DROP COLUMN "sizes_full_width";
  ALTER TABLE "media" DROP COLUMN "sizes_full_height";
  ALTER TABLE "media" DROP COLUMN "sizes_full_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_full_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_full_filename";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "fournisseurs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "evenements_id";
  DROP TYPE "public"."enum_fournisseurs_activites_secondaires";
  DROP TYPE "public"."enum_fournisseurs_activite_principale";
  DROP TYPE "public"."enum_fournisseurs_statut";
  DROP TYPE "public"."enum_evenements_type";
  DROP TYPE "public"."enum_evenements_statut";`)
}

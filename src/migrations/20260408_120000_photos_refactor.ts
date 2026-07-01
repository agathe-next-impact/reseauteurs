import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "fournisseurs_galerie" CASCADE;

    ALTER TABLE "evenements" DROP CONSTRAINT IF EXISTS "evenements_visuel_id_media_id_fk";
    DROP INDEX IF EXISTS "evenements_visuel_idx";
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "visuel_id";

    ALTER TABLE "fournisseurs" ADD COLUMN IF NOT EXISTS "banniere_id" integer;
    ALTER TABLE "fournisseurs" ADD COLUMN IF NOT EXISTS "logo_id" integer;
    DO $$ BEGIN
      ALTER TABLE "fournisseurs" ADD CONSTRAINT "fournisseurs_banniere_id_media_id_fk" FOREIGN KEY ("banniere_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "fournisseurs" ADD CONSTRAINT "fournisseurs_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "fournisseurs_banniere_idx" ON "fournisseurs" USING btree ("banniere_id");
    CREATE INDEX IF NOT EXISTS "fournisseurs_logo_idx" ON "fournisseurs" USING btree ("logo_id");

    CREATE TABLE IF NOT EXISTS "fournisseurs_illustrations" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "image_id" integer NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE "fournisseurs_illustrations" ADD CONSTRAINT "fournisseurs_illustrations_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "fournisseurs_illustrations" ADD CONSTRAINT "fournisseurs_illustrations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."fournisseurs"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "fournisseurs_illustrations_order_idx" ON "fournisseurs_illustrations" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "fournisseurs_illustrations_parent_id_idx" ON "fournisseurs_illustrations" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "fournisseurs_illustrations_image_idx" ON "fournisseurs_illustrations" USING btree ("image_id");

    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "banniere_id" integer;
    ALTER TABLE "evenements" ADD COLUMN IF NOT EXISTS "logo_id" integer;
    DO $$ BEGIN
      ALTER TABLE "evenements" ADD CONSTRAINT "evenements_banniere_id_media_id_fk" FOREIGN KEY ("banniere_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "evenements" ADD CONSTRAINT "evenements_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "evenements_banniere_idx" ON "evenements" USING btree ("banniere_id");
    CREATE INDEX IF NOT EXISTS "evenements_logo_idx" ON "evenements" USING btree ("logo_id");

    CREATE TABLE IF NOT EXISTS "evenements_illustrations" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "image_id" integer NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE "evenements_illustrations" ADD CONSTRAINT "evenements_illustrations_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "evenements_illustrations" ADD CONSTRAINT "evenements_illustrations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."evenements"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "evenements_illustrations_order_idx" ON "evenements_illustrations" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "evenements_illustrations_parent_id_idx" ON "evenements_illustrations" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "evenements_illustrations_image_idx" ON "evenements_illustrations" USING btree ("image_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "evenements_illustrations" CASCADE;
    DROP TABLE IF EXISTS "fournisseurs_illustrations" CASCADE;

    ALTER TABLE "evenements" DROP CONSTRAINT IF EXISTS "evenements_banniere_id_media_id_fk";
    ALTER TABLE "evenements" DROP CONSTRAINT IF EXISTS "evenements_logo_id_media_id_fk";
    DROP INDEX IF EXISTS "evenements_banniere_idx";
    DROP INDEX IF EXISTS "evenements_logo_idx";
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "banniere_id";
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "logo_id";

    ALTER TABLE "fournisseurs" DROP CONSTRAINT IF EXISTS "fournisseurs_banniere_id_media_id_fk";
    ALTER TABLE "fournisseurs" DROP CONSTRAINT IF EXISTS "fournisseurs_logo_id_media_id_fk";
    DROP INDEX IF EXISTS "fournisseurs_banniere_idx";
    DROP INDEX IF EXISTS "fournisseurs_logo_idx";
    ALTER TABLE "fournisseurs" DROP COLUMN IF EXISTS "banniere_id";
    ALTER TABLE "fournisseurs" DROP COLUMN IF EXISTS "logo_id";

    ALTER TABLE "evenements" ADD COLUMN "visuel_id" integer;
    ALTER TABLE "evenements" ADD CONSTRAINT "evenements_visuel_id_media_id_fk" FOREIGN KEY ("visuel_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "evenements_visuel_idx" ON "evenements" USING btree ("visuel_id");
  `)
}

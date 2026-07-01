import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Compatibilite schema Evenements pour le champ upload `image`.
 *
 * L'ancien schema stockait les visuels dans `banniere_id` / `logo_id`, tandis
 * que la collection actuelle expose `image`, donc Payload lit `image_id`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "evenements"
      ADD COLUMN IF NOT EXISTS "image_id" integer;

    UPDATE "evenements"
       SET "image_id" = "banniere_id"
     WHERE "image_id" IS NULL
       AND "banniere_id" IS NOT NULL;

    DO $$ BEGIN
      ALTER TABLE "evenements"
        ADD CONSTRAINT "evenements_image_id_media_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "evenements"
      DROP CONSTRAINT IF EXISTS "evenements_image_id_media_id_fk";
    ALTER TABLE "evenements"
      DROP COLUMN IF EXISTS "image_id";
  `)
}

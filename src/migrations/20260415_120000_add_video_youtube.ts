import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "fournisseurs" ADD COLUMN IF NOT EXISTS "video_youtube" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "fournisseurs" DROP COLUMN IF EXISTS "video_youtube";
  `)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "fournisseurs_statut_lat_lon_idx"
      ON "fournisseurs" ("statut", "latitude", "longitude");

    CREATE INDEX IF NOT EXISTS "evenements_statut_visible_lat_lon_idx"
      ON "evenements" ("statut", "visible", "lieu_latitude", "lieu_longitude");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "fournisseurs_statut_lat_lon_idx";
    DROP INDEX IF EXISTS "evenements_statut_visible_lat_lon_idx";
  `)
}

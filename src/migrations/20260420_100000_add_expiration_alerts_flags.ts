import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN "expiration_alerts_j30_sent" boolean DEFAULT false;
    ALTER TABLE "users" ADD COLUMN "expiration_alerts_j7_sent" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN "expiration_alerts_j30_sent";
    ALTER TABLE "users" DROP COLUMN "expiration_alerts_j7_sent";
  `)
}

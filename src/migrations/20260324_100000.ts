import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" RENAME COLUMN "is_email_verified" TO "_verified";
    ALTER TABLE "users" ADD COLUMN "_verificationtoken" varchar;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" RENAME COLUMN "_verified" TO "is_email_verified";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "_verificationtoken";
  `)
}

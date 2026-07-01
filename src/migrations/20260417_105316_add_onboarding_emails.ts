import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "onboarding_emails_welcome_sent" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "onboarding_emails_j3_sent" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "onboarding_emails_j7_sent" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "onboarding_emails_j14_sent" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN "onboarding_emails_welcome_sent";
  ALTER TABLE "users" DROP COLUMN "onboarding_emails_j3_sent";
  ALTER TABLE "users" DROP COLUMN "onboarding_emails_j7_sent";
  ALTER TABLE "users" DROP COLUMN "onboarding_emails_j14_sent";`)
}

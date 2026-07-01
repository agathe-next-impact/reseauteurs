import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN "cgu_accepted_at" timestamp(3) with time zone;
    ALTER TABLE "users" ADD COLUMN "confidentialite_accepted_at" timestamp(3) with time zone;
    ALTER TABLE "users" ADD COLUMN "opt_in_marketing" boolean DEFAULT false;
    ALTER TABLE "users" ADD COLUMN "opt_in_marketing_at" timestamp(3) with time zone;
    ALTER TABLE "users" ADD COLUMN "opt_out_marketing_at" timestamp(3) with time zone;
    ALTER TABLE "users" ADD COLUMN "billing_address" jsonb;
    ALTER TABLE "users" ADD COLUMN "vat_number" varchar;
    ALTER TABLE "users" ADD COLUMN "raison_sociale_facturation" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN "cgu_accepted_at";
    ALTER TABLE "users" DROP COLUMN "confidentialite_accepted_at";
    ALTER TABLE "users" DROP COLUMN "opt_in_marketing";
    ALTER TABLE "users" DROP COLUMN "opt_in_marketing_at";
    ALTER TABLE "users" DROP COLUMN "opt_out_marketing_at";
    ALTER TABLE "users" DROP COLUMN "billing_address";
    ALTER TABLE "users" DROP COLUMN "vat_number";
    ALTER TABLE "users" DROP COLUMN "raison_sociale_facturation";
  `)
}

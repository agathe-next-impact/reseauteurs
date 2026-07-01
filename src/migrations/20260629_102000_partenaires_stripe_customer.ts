import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "partenaires"
      ADD COLUMN IF NOT EXISTS "stripe_customer_id" varchar;

    CREATE INDEX IF NOT EXISTS "partenaires_stripe_customer_idx"
      ON "partenaires" USING btree ("stripe_customer_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "partenaires_stripe_customer_idx";
    ALTER TABLE "partenaires"
      DROP COLUMN IF EXISTS "stripe_customer_id";
  `)
}

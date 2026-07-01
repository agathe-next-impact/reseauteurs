import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'fournisseur');
  CREATE TYPE "public"."enum_users_plan" AS ENUM('gratuit', 'standard', 'premium');
  ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'fournisseur' NOT NULL;
  ALTER TABLE "users" ADD COLUMN "plan" "enum_users_plan" DEFAULT 'gratuit' NOT NULL;
  ALTER TABLE "users" ADD COLUMN "stripe_customer_id" varchar;
  ALTER TABLE "users" ADD COLUMN "stripe_subscription_id" varchar;
  ALTER TABLE "users" ADD COLUMN "plan_expires_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "is_email_verified" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN "role";
  ALTER TABLE "users" DROP COLUMN "plan";
  ALTER TABLE "users" DROP COLUMN "stripe_customer_id";
  ALTER TABLE "users" DROP COLUMN "stripe_subscription_id";
  ALTER TABLE "users" DROP COLUMN "plan_expires_at";
  ALTER TABLE "users" DROP COLUMN "is_email_verified";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_users_plan";`)
}

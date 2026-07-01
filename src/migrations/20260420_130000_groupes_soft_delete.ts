import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "groupes" ADD COLUMN "deleted_at" timestamp(3) with time zone;
    CREATE INDEX "groupes_deleted_at_idx" ON "groupes" USING btree ("deleted_at");
    ALTER TYPE "public"."enum_audit_logs_type" ADD VALUE IF NOT EXISTS 'groupe_soft_deleted';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "groupes_deleted_at_idx";
    ALTER TABLE "groupes" DROP COLUMN IF EXISTS "deleted_at";
  `)
  // PostgreSQL ne permet pas DROP VALUE sur l'enum — valeur 'groupe_soft_deleted'
  // reste dans enum_audit_logs_type.
}

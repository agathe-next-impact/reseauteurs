import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_audit_logs_type" ADD VALUE IF NOT EXISTS 'groupe_created';
    ALTER TYPE "public"."enum_audit_logs_type" ADD VALUE IF NOT EXISTS 'groupe_joined';
    ALTER TYPE "public"."enum_audit_logs_type" ADD VALUE IF NOT EXISTS 'groupe_left';
    ALTER TYPE "public"."enum_audit_logs_type" ADD VALUE IF NOT EXISTS 'groupe_ownership_transferred';
  `)
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // PostgreSQL ne permet pas DROP VALUE sur un enum — no-op.
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_audit_logs_type" ADD VALUE IF NOT EXISTS 'groupe_sync_failed';
  `)
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // PostgreSQL ne permet pas DROP VALUE sur un enum — no-op. Cf AUD-005.
}

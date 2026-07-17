import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * ADR-0014 — trace des invitations email envoyées aux réseaux nationaux absents
 * (encadré « inviter le réseau » de l'espace Mes réseaux du réseauteur Plus).
 * Ajout additif à l'enum audit_logs.type (pattern 20260420_120000_plan_changed).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_audit_logs_type" ADD VALUE IF NOT EXISTS 'national_invited';
  `)
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // PostgreSQL ne permet pas DROP VALUE sur un enum — no-op.
}

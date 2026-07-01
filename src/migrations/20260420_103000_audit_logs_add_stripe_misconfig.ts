import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ALTER TYPE ADD VALUE doit etre execute hors d'un bloc transactionnel
  // et ne peut pas etre retrograde — la down() documente la limitation.
  await db.execute(sql`
    ALTER TYPE "public"."enum_audit_logs_type" ADD VALUE IF NOT EXISTS 'stripe_misconfig';
  `)
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // PostgreSQL ne permet pas DROP VALUE sur un enum. Le down() est un no-op.
  // Pour revenir en arriere : recreer l'enum sans 'stripe_misconfig' via
  // CREATE TYPE ... / ALTER TABLE ... ALTER COLUMN USING ... / DROP TYPE.
}

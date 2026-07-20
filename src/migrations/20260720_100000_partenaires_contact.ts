import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 2026-07-20 — CTA « Prendre contact » sur les fiches publiques.
 * Ajoute à `partenaires` deux contacts publics facultatifs (email + téléphone),
 * pour aligner la fiche partenaire sur les fiches réseauteur/réseau (email + tél + site).
 * Colonnes nullables (additif, non destructif).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "partenaires" ADD COLUMN IF NOT EXISTS "email_contact" varchar;
    ALTER TABLE "partenaires" ADD COLUMN IF NOT EXISTS "telephone" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "partenaires" DROP COLUMN IF EXISTS "email_contact";
    ALTER TABLE "partenaires" DROP COLUMN IF EXISTS "telephone";
  `)
}

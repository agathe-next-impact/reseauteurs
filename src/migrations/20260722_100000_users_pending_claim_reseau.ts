import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Revendication différée d'une fiche de tête de réseau (décision 2026-07-22).
 *
 * La revendication n'est plus appliquée à la création du compte mais à la
 * VÉRIFICATION de l'email : l'id de la fiche visée est mémorisé ici entre les deux.
 * Sans ce report, une adresse jetable suffisait à s'approprier une fiche de
 * l'annuaire national (le compte ne pouvant jamais se connecter, la fiche restait
 * bloquée jusqu'à intervention admin).
 *
 * Colonne nullable, sans valeur par défaut : les comptes existants ne sont pas
 * concernés. Aucune donnée n'est réécrite.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "pending_claim_reseau_id" numeric;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN IF EXISTS "pending_claim_reseau_id";
  `)
}

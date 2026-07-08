import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration — Restaure le DEFAULT de `users.plan` (correctif inscription).
 *
 * CONTEXTE
 *   Le champ Payload `plan` est DORMANT (ADR-0011 — pas de palier payant côté
 *   réseauteur), donc défini `type: 'text'` sans `defaultValue`. À la création
 *   d'un utilisateur, Payload n'envoie AUCUNE valeur pour `plan` → l'INSERT
 *   généré émet `"plan" DEFAULT`.
 *
 * BUG
 *   La colonne DB `users.plan` (enum `enum_users_plan`, NOT NULL) a perdu son
 *   DEFAULT lors de `20260623_130000_plan_enum_et_categories` (l'enum a été
 *   recréé sans restaurer la valeur par défaut). Conséquence : `DEFAULT` → NULL
 *   → violation de la contrainte NOT NULL → TOUTE inscription
 *   (POST /api/auth/register) échoue en HTTP 500, en local comme en prod.
 *
 * CORRECTIF
 *   Restaure `DEFAULT 'acces'` (valeur de base de l'enum). Non destructif ;
 *   la table `users` est vide au moment de l'application. L'INSERT `DEFAULT`
 *   résout désormais vers 'acces' et la contrainte NOT NULL est satisfaite.
 *
 * NB : `plan` sera retiré proprement par accounts-and-billing (J2.A). Cette
 *   migration est un correctif d'intérim pour ne pas bloquer les inscriptions.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ALTER COLUMN "plan" SET DEFAULT 'acces';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ALTER COLUMN "plan" DROP DEFAULT;
  `)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration — Slug réseauteur = prénom-nom (correctif du figeage prématuré).
 *
 * Avant : `reseauteurs.slug` était `NOT NULL` car l'ancien hook générait TOUJOURS
 * un slug à la création — y compris pour le SQUELETTE d'inscription, dont le seul
 * « nom » disponible est le placeholder `nomSociete` (champ « Prénom et nom » du
 * formulaire). Résultat : le slug se figeait sur la raison sociale / le blob de nom,
 * jamais sur les champs structurés prénom+nom.
 *
 * Désormais (hook Reseauteurs.beforeValidate) : le slug reste NULL tant que
 * prénom+nom ne sont pas renseignés, puis est généré depuis ces champs à la
 * complétion du profil, et figé dès la publication (statut 'valide').
 * L'index UNIQUE `reseauteurs_slug_idx` tolère plusieurs NULL (squelettes) en Postgres.
 *
 * Cette migration rend donc la colonne nullable. Réversible (down = re-NOT NULL,
 * après backfill des NULL éventuels par un placeholder pour ne pas échouer).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "reseauteurs" ALTER COLUMN "slug" DROP NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Backfill défensif : aucun slug NULL ne doit subsister avant de rétablir NOT NULL.
    UPDATE "reseauteurs"
       SET "slug" = 'reseauteur-' || "id"
     WHERE "slug" IS NULL;
    ALTER TABLE "reseauteurs" ALTER COLUMN "slug" SET NOT NULL;
  `)
}

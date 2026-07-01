import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration J1.1 — Activation de l'extension PostGIS.
 *
 * PostGIS est confirmé supporté par Neon (cf. ADR-0002, Q5).
 * Cette migration doit être appliquée AVANT toute migration qui crée des
 * colonnes geography(Point,4326) ou des index GiST spatiaux.
 *
 * Déploiement : l'extension est activée sur l'instance Neon au moment de
 * l'exécution de cette migration (yarn payload migrate). Elle n'est pas
 * bloquante pour l'écriture du schéma et des migrations en amont.
 *
 * Note sécurité : CREATE EXTENSION est idempotent (IF NOT EXISTS). En cas de
 * re-run involontaire, aucun effet de bord.
 *
 * Rollback : DROP EXTENSION est intentionnellement absent du down() car supprimer
 * PostGIS détruirait toutes les colonnes geography et index GiST ajoutés par les
 * migrations suivantes. Le rollback de l'extension doit accompagner le rollback
 * de TOUTES les migrations qui dépendent de PostGIS — documenté dans MIGRATION.md.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE EXTENSION IF NOT EXISTS postgis;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Intentionnellement vide : on ne supprime pas l'extension PostGIS dans le down()
  // car cette action détruirait en cascade toutes les colonnes geography et index GiST
  // ajoutés par les migrations 20260623_110000 et 20260623_120000.
  // Rollback complet = revenir à l'état avant la migration 20260623_100000 en
  // appliquant les down() dans l'ordre inverse (120000 → 110000 → 100000),
  // puis en supprimant l'extension si nécessaire manuellement.
  //
  // DROP EXTENSION IF EXISTS postgis CASCADE; -- DÉCONSEILLÉ ici, cf. MIGRATION.md
}

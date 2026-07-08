import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration — Synchronisation de `geom` par TRIGGER Postgres (correctif deadlock).
 *
 * PROBLÈME
 *   Les collections reseauteurs / reseaux / evenements synchronisaient la colonne
 *   PostGIS `geom` via un hook `afterChange` (`syncGeom`) qui exécutait
 *   `req.payload.db.drizzle.execute(UPDATE … SET geom … WHERE id = X)` — c.-à-d.
 *   sur une connexion SÉPARÉE, HORS de la transaction Payload de l'écriture.
 *   Sur une MISE À JOUR, la transaction détient déjà un verrou sur la ligne X
 *   (non commitée) : le raw UPDATE (connexion B) attend ce verrou pendant que la
 *   transaction A attend la fin du hook (donc de B) → interblocage. Postgres ne le
 *   voit pas comme un deadlock (A n'attend pas un verrou mais du code applicatif),
 *   donc rien ne le tue jusqu'au `idle_in_transaction_session_timeout` de Neon
 *   (25P03) → « Connection terminated unexpectedly ». La création marchait
 *   (ligne neuve invisible hors transaction → aucun verrou en conflit).
 *
 * CORRECTIF
 *   `geom` n'est pas un champ géré par Payload : on le calcule désormais dans un
 *   TRIGGER `BEFORE INSERT OR UPDATE` qui écrit `NEW.geom` DANS la même instruction
 *   que l'écriture de la ligne. Plus de connexion séparée, plus de verrou croisé,
 *   `geom` toujours cohérent quel que soit le chemin d'écriture (Payload, seed, SQL).
 *   Les hooks `syncGeom` sont supprimés côté application (voir Reseauteurs/Reseaux/
 *   Evenements.ts).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Fonction : geom depuis latitude/longitude (reseauteurs, reseaux)
    CREATE OR REPLACE FUNCTION sync_geom_from_latlng() RETURNS trigger AS $$
    BEGIN
      IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
      ELSE
        NEW.geom := NULL;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Fonction : geom depuis lieu_latitude/lieu_longitude (evenements)
    CREATE OR REPLACE FUNCTION sync_geom_from_lieu() RETURNS trigger AS $$
    BEGIN
      IF NEW.lieu_latitude IS NOT NULL AND NEW.lieu_longitude IS NOT NULL THEN
        NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lieu_longitude, NEW.lieu_latitude), 4326)::geography;
      ELSE
        NEW.geom := NULL;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_reseauteurs_geom ON reseauteurs;
    CREATE TRIGGER trg_reseauteurs_geom BEFORE INSERT OR UPDATE ON reseauteurs
      FOR EACH ROW EXECUTE FUNCTION sync_geom_from_latlng();

    DROP TRIGGER IF EXISTS trg_reseaux_geom ON reseaux;
    CREATE TRIGGER trg_reseaux_geom BEFORE INSERT OR UPDATE ON reseaux
      FOR EACH ROW EXECUTE FUNCTION sync_geom_from_latlng();

    DROP TRIGGER IF EXISTS trg_evenements_geom ON evenements;
    CREATE TRIGGER trg_evenements_geom BEFORE INSERT OR UPDATE ON evenements
      FOR EACH ROW EXECUTE FUNCTION sync_geom_from_lieu();

    -- Backfill : recalcule geom sur les lignes existantes (le trigger recompute NEW.geom).
    UPDATE reseauteurs SET geom = geom WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
    UPDATE reseaux     SET geom = geom WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
    UPDATE evenements  SET geom = geom WHERE lieu_latitude IS NOT NULL AND lieu_longitude IS NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TRIGGER IF EXISTS trg_reseauteurs_geom ON reseauteurs;
    DROP TRIGGER IF EXISTS trg_reseaux_geom ON reseaux;
    DROP TRIGGER IF EXISTS trg_evenements_geom ON evenements;
    DROP FUNCTION IF EXISTS sync_geom_from_latlng();
    DROP FUNCTION IF EXISTS sync_geom_from_lieu();
  `)
}

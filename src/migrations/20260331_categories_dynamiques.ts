import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration: Categories d'activites et types d'evenements dynamiques
 *
 * 1. Cree les tables categories_activite et types_evenement
 * 2. Seed les donnees initiales
 * 3. Ajoute les colonnes relationship (integer) sur fournisseurs et evenements
 * 4. Migre les donnees existantes (enum string -> relationship ID)
 * 5. Supprime les anciennes colonnes enum et tables associees
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // -------------------------------------------------------
  // 1. Creer les nouvelles tables
  // -------------------------------------------------------
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "categories_activite" (
      "id" serial PRIMARY KEY NOT NULL,
      "label" varchar NOT NULL,
      "value" varchar NOT NULL,
      "couleur" varchar NOT NULL,
      "ordre" numeric DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "categories_activite_value_idx" ON "categories_activite" ("value");
    CREATE INDEX IF NOT EXISTS "categories_activite_updated_at_idx" ON "categories_activite" ("updated_at");
    CREATE INDEX IF NOT EXISTS "categories_activite_created_at_idx" ON "categories_activite" ("created_at");

    CREATE TABLE IF NOT EXISTS "types_evenement" (
      "id" serial PRIMARY KEY NOT NULL,
      "label" varchar NOT NULL,
      "value" varchar NOT NULL,
      "couleur" varchar NOT NULL,
      "ordre" numeric DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "types_evenement_value_idx" ON "types_evenement" ("value");
    CREATE INDEX IF NOT EXISTS "types_evenement_updated_at_idx" ON "types_evenement" ("updated_at");
    CREATE INDEX IF NOT EXISTS "types_evenement_created_at_idx" ON "types_evenement" ("created_at");
  `)

  // -------------------------------------------------------
  // 2. Seed les categories d'activite
  // -------------------------------------------------------
  const categoriesData = [
    { label: 'Objets publicitaires', value: 'objets-publicitaires', couleur: '#1e40af', ordre: 1 },
    { label: 'Textile publicitaire', value: 'textile-publicitaire', couleur: '#16a34a', ordre: 2 },
    { label: 'Goodies', value: 'goodies', couleur: '#ea580c', ordre: 3 },
    { label: "Cadeaux d'entreprise", value: 'cadeaux-entreprise', couleur: '#9f1239', ordre: 4 },
    { label: 'Stimulation & Fidelisation', value: 'stim-fidelisation', couleur: '#7c3aed', ordre: 5 },
  ]

  for (const cat of categoriesData) {
    await db.execute(sql`
      INSERT INTO "categories_activite" ("label", "value", "couleur", "ordre")
      VALUES (${cat.label}, ${cat.value}, ${cat.couleur}, ${cat.ordre})
      ON CONFLICT ("value") DO NOTHING
    `)
  }

  // -------------------------------------------------------
  // 3. Seed les types d'evenement
  // -------------------------------------------------------
  const typesData = [
    { label: 'Salon', value: 'salon', couleur: '#1e40af', ordre: 1 },
    { label: 'Portes ouvertes', value: 'portes-ouvertes', couleur: '#16a34a', ordre: 2 },
    { label: 'Demonstration', value: 'demonstration', couleur: '#ea580c', ordre: 3 },
    { label: 'Presence salon', value: 'presence-salon', couleur: '#7c3aed', ordre: 4 },
    { label: 'Formation', value: 'formation', couleur: '#0891b2', ordre: 5 },
    { label: 'Autre', value: 'autre', couleur: '#6b7280', ordre: 6 },
  ]

  for (const t of typesData) {
    await db.execute(sql`
      INSERT INTO "types_evenement" ("label", "value", "couleur", "ordre")
      VALUES (${t.label}, ${t.value}, ${t.couleur}, ${t.ordre})
      ON CONFLICT ("value") DO NOTHING
    `)
  }

  // -------------------------------------------------------
  // 4. Ajouter les nouvelles colonnes relationship (integer)
  // -------------------------------------------------------

  // Fournisseurs: activite_principale_id (integer FK)
  await db.execute(sql`
    ALTER TABLE "fournisseurs"
    ADD COLUMN IF NOT EXISTS "activite_principale_id" integer
    REFERENCES "categories_activite" ("id") ON DELETE SET NULL
  `)

  // Evenements: type_id (integer FK)
  await db.execute(sql`
    ALTER TABLE "evenements"
    ADD COLUMN IF NOT EXISTS "type_id" integer
    REFERENCES "types_evenement" ("id") ON DELETE SET NULL
  `)

  // -------------------------------------------------------
  // 5. Migrer les donnees existantes
  // -------------------------------------------------------

  // Fournisseurs: copier activite_principale (enum) -> activite_principale_id (FK)
  await db.execute(sql`
    UPDATE "fournisseurs" f
    SET "activite_principale_id" = ca."id"
    FROM "categories_activite" ca
    WHERE f."activite_principale"::text = ca."value"
      AND f."activite_principale_id" IS NULL
  `)

  // Evenements: copier type (enum) -> type_id (FK)
  await db.execute(sql`
    UPDATE "evenements" e
    SET "type_id" = te."id"
    FROM "types_evenement" te
    WHERE e."type"::text = te."value"
      AND e."type_id" IS NULL
  `)

  // Fournisseurs activites secondaires:
  // L'ancienne table fournisseurs_activites_secondaires stocke des enums.
  // La nouvelle structure Payload pour relationship hasMany utilise
  // "fournisseurs_rels" (la table de relations Payload auto-generee).
  // On doit creer la table rels si elle n'existe pas, puis migrer.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "fournisseurs_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL REFERENCES "fournisseurs" ("id") ON DELETE CASCADE,
      "path" varchar NOT NULL,
      "categories_activite_id" integer REFERENCES "categories_activite" ("id") ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "fournisseurs_rels_order_idx" ON "fournisseurs_rels" ("order");
    CREATE INDEX IF NOT EXISTS "fournisseurs_rels_parent_idx" ON "fournisseurs_rels" ("parent_id");
    CREATE INDEX IF NOT EXISTS "fournisseurs_rels_path_idx" ON "fournisseurs_rels" ("path");
    CREATE INDEX IF NOT EXISTS "fournisseurs_rels_categories_activite_id_idx" ON "fournisseurs_rels" ("categories_activite_id");
  `)

  // Migrer activites secondaires
  await db.execute(sql`
    INSERT INTO "fournisseurs_rels" ("order", "parent_id", "path", "categories_activite_id")
    SELECT fas."order", fas."parent_id", 'activitesSecondaires', ca."id"
    FROM "fournisseurs_activites_secondaires" fas
    JOIN "categories_activite" ca ON fas."value"::text = ca."value"
    ON CONFLICT DO NOTHING
  `)

  // -------------------------------------------------------
  // 6. Supprimer les anciennes colonnes et tables
  // -------------------------------------------------------
  await db.execute(sql`
    ALTER TABLE "fournisseurs" DROP COLUMN IF EXISTS "activite_principale";
    DROP TABLE IF EXISTS "fournisseurs_activites_secondaires";
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "type";
  `)

  // Supprimer les types enum orphelins
  await db.execute(sql`
    DROP TYPE IF EXISTS "enum_fournisseurs_activite_principale";
    DROP TYPE IF EXISTS "enum_fournisseurs_activites_secondaires";
    DROP TYPE IF EXISTS "enum_evenements_type";
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Recreer les enums
  await db.execute(sql`
    CREATE TYPE "enum_fournisseurs_activite_principale" AS ENUM('objets-publicitaires', 'textile-publicitaire', 'goodies', 'cadeaux-entreprise', 'stim-fidelisation');
    CREATE TYPE "enum_fournisseurs_activites_secondaires" AS ENUM('objets-publicitaires', 'textile-publicitaire', 'goodies', 'cadeaux-entreprise', 'stim-fidelisation');
    CREATE TYPE "enum_evenements_type" AS ENUM('salon', 'portes-ouvertes', 'demonstration', 'presence-salon', 'formation', 'autre');
  `)

  // Recreer les anciennes colonnes
  await db.execute(sql`
    ALTER TABLE "fournisseurs" ADD COLUMN "activite_principale" "enum_fournisseurs_activite_principale";
    ALTER TABLE "evenements" ADD COLUMN "type" "enum_evenements_type";
  `)

  // Restaurer les donnees
  await db.execute(sql`
    UPDATE "fournisseurs" f
    SET "activite_principale" = ca."value"::"enum_fournisseurs_activite_principale"
    FROM "categories_activite" ca
    WHERE f."activite_principale_id" = ca."id"
  `)

  await db.execute(sql`
    UPDATE "evenements" e
    SET "type" = te."value"::"enum_evenements_type"
    FROM "types_evenement" te
    WHERE e."type_id" = te."id"
  `)

  // Recreer la table activites secondaires
  await db.execute(sql`
    CREATE TABLE "fournisseurs_activites_secondaires" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_fournisseurs_activites_secondaires",
      "id" serial PRIMARY KEY NOT NULL
    );

    INSERT INTO "fournisseurs_activites_secondaires" ("order", "parent_id", "value")
    SELECT fr."order", fr."parent_id", ca."value"::"enum_fournisseurs_activites_secondaires"
    FROM "fournisseurs_rels" fr
    JOIN "categories_activite" ca ON fr."categories_activite_id" = ca."id"
    WHERE fr."path" = 'activitesSecondaires';
  `)

  // Supprimer les nouvelles colonnes et tables
  await db.execute(sql`
    ALTER TABLE "fournisseurs" DROP COLUMN IF EXISTS "activite_principale_id";
    ALTER TABLE "evenements" DROP COLUMN IF EXISTS "type_id";
    DROP TABLE IF EXISTS "fournisseurs_rels";
    DROP TABLE IF EXISTS "categories_activite";
    DROP TABLE IF EXISTS "types_evenement";
  `)
}

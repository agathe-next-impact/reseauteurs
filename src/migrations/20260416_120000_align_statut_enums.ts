import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Aligns the DB enum types with the current code which removed
 * 'en-attente' and 'rejetee' from all statut fields.
 *
 * Data migration:
 *   fournisseurs:               en-attente → publiee, rejetee → suspendue
 *   evenements:                 en-attente → publie
 *   organisateurs_evenements:   en-attente → publiee, rejetee → suspendue
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Migrate data to valid values
  await db.execute(sql`
    UPDATE "fournisseurs" SET "statut" = 'publiee' WHERE "statut" = 'en-attente';
    UPDATE "fournisseurs" SET "statut" = 'suspendue' WHERE "statut" = 'rejetee';
    UPDATE "evenements" SET "statut" = 'publie' WHERE "statut" = 'en-attente';
    UPDATE "organisateurs_evenements" SET "statut" = 'publiee' WHERE "statut" = 'en-attente';
    UPDATE "organisateurs_evenements" SET "statut" = 'suspendue' WHERE "statut" = 'rejetee';
  `)

  // 2. Convert columns to text, drop old enums, create reduced enums, convert back
  await db.execute(sql`
    ALTER TABLE "fournisseurs" ALTER COLUMN "statut" SET DATA TYPE text;
    ALTER TABLE "fournisseurs" ALTER COLUMN "statut" SET DEFAULT 'publiee'::text;
    DROP TYPE "public"."enum_fournisseurs_statut";
    CREATE TYPE "public"."enum_fournisseurs_statut" AS ENUM('publiee', 'suspendue');
    ALTER TABLE "fournisseurs" ALTER COLUMN "statut" SET DEFAULT 'publiee'::"public"."enum_fournisseurs_statut";
    ALTER TABLE "fournisseurs" ALTER COLUMN "statut" SET DATA TYPE "public"."enum_fournisseurs_statut" USING "statut"::"public"."enum_fournisseurs_statut";

    ALTER TABLE "evenements" ALTER COLUMN "statut" SET DATA TYPE text;
    ALTER TABLE "evenements" ALTER COLUMN "statut" SET DEFAULT 'publie'::text;
    DROP TYPE "public"."enum_evenements_statut";
    CREATE TYPE "public"."enum_evenements_statut" AS ENUM('publie', 'archive');
    ALTER TABLE "evenements" ALTER COLUMN "statut" SET DEFAULT 'publie'::"public"."enum_evenements_statut";
    ALTER TABLE "evenements" ALTER COLUMN "statut" SET DATA TYPE "public"."enum_evenements_statut" USING "statut"::"public"."enum_evenements_statut";

    ALTER TABLE "organisateurs_evenements" ALTER COLUMN "statut" SET DATA TYPE text;
    ALTER TABLE "organisateurs_evenements" ALTER COLUMN "statut" SET DEFAULT 'publiee'::text;
    DROP TYPE "public"."enum_organisateurs_evenements_statut";
    CREATE TYPE "public"."enum_organisateurs_evenements_statut" AS ENUM('publiee', 'suspendue');
    ALTER TABLE "organisateurs_evenements" ALTER COLUMN "statut" SET DEFAULT 'publiee'::"public"."enum_organisateurs_evenements_statut";
    ALTER TABLE "organisateurs_evenements" ALTER COLUMN "statut" SET DATA TYPE "public"."enum_organisateurs_evenements_statut" USING "statut"::"public"."enum_organisateurs_evenements_statut";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Restore the old enums with all values (non-destructive — just adds back removed values)
  await db.execute(sql`
    ALTER TABLE "fournisseurs" ALTER COLUMN "statut" SET DATA TYPE text;
    DROP TYPE "public"."enum_fournisseurs_statut";
    CREATE TYPE "public"."enum_fournisseurs_statut" AS ENUM('en-attente', 'publiee', 'rejetee', 'suspendue');
    ALTER TABLE "fournisseurs" ALTER COLUMN "statut" SET DEFAULT 'en-attente'::"public"."enum_fournisseurs_statut";
    ALTER TABLE "fournisseurs" ALTER COLUMN "statut" SET DATA TYPE "public"."enum_fournisseurs_statut" USING "statut"::"public"."enum_fournisseurs_statut";

    ALTER TABLE "evenements" ALTER COLUMN "statut" SET DATA TYPE text;
    DROP TYPE "public"."enum_evenements_statut";
    CREATE TYPE "public"."enum_evenements_statut" AS ENUM('en-attente', 'publie', 'archive');
    ALTER TABLE "evenements" ALTER COLUMN "statut" SET DEFAULT 'en-attente'::"public"."enum_evenements_statut";
    ALTER TABLE "evenements" ALTER COLUMN "statut" SET DATA TYPE "public"."enum_evenements_statut" USING "statut"::"public"."enum_evenements_statut";

    ALTER TABLE "organisateurs_evenements" ALTER COLUMN "statut" SET DATA TYPE text;
    DROP TYPE "public"."enum_organisateurs_evenements_statut";
    CREATE TYPE "public"."enum_organisateurs_evenements_statut" AS ENUM('en-attente', 'publiee', 'rejetee', 'suspendue');
    ALTER TABLE "organisateurs_evenements" ALTER COLUMN "statut" SET DEFAULT 'en-attente'::"public"."enum_organisateurs_evenements_statut";
    ALTER TABLE "organisateurs_evenements" ALTER COLUMN "statut" SET DATA TYPE "public"."enum_organisateurs_evenements_statut" USING "statut"::"public"."enum_organisateurs_evenements_statut";
  `)
}

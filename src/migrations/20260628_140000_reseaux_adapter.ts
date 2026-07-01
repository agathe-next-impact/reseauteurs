import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration — Adaptation de la table `reseaux` pour le modèle à 3 entités (ADR-0011).
 *
 * La table reseaux existe déjà (migration 20260623_110000).
 * On y AJOUTE les colonnes manquantes SANS toucher à l'existant (approche additive).
 *
 * Ajouts :
 *   - partenaire        : boolean (drapeau abonnement partenaire, posé par accounts-and-billing)
 *   - stripe_subscription_id : varchar (ID abonnement Stripe partenaire)
 *   - partenaire_expire_at : timestamp (expiration abonnement)
 *   - presentation      : text (description longue, distinct du champ description court)
 *   - nb_reseauteurs    : integer (compteur dérivé — recalculé par hook Reseauteurs)
 *   - nb_evenements     : integer (compteur dérivé — recalculé par hook Evenements)
 *
 * NB : le champ `categorie_id` (FK vers types_evenement) existant reste en place (dormant).
 *
 * Rollback SAFE : les colonnes ajoutées sont nouvelles — les supprimer ne détruit aucune
 * donnée existante.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Présentation longue (champ distinct de description courte)
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "presentation" text;

    -- Drapeau partenaire (abonnement actif, accounts-and-billing)
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "partenaire" boolean DEFAULT false NOT NULL;

    -- Stripe (pour accounts-and-billing)
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" varchar;
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "partenaire_expire_at" timestamp(3) with time zone;

    -- Compteurs dérivés
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "nb_reseauteurs" integer DEFAULT 0;
    ALTER TABLE "reseaux" ADD COLUMN IF NOT EXISTS "nb_evenements" integer DEFAULT 0;

    -- Index sur le drapeau partenaire (home — filtrage réseaux partenaires)
    CREATE INDEX IF NOT EXISTS "reseaux_partenaire_idx"
      ON "reseaux" USING btree ("partenaire");

    -- Index sur stripe_subscription_id (webhook lookup)
    CREATE INDEX IF NOT EXISTS "reseaux_stripe_sub_idx"
      ON "reseaux" USING btree ("stripe_subscription_id");

    -- Rapport
    DO $$
    DECLARE nb integer;
    BEGIN
      SELECT COUNT(*) INTO nb FROM reseaux;
      RAISE NOTICE '[migration 20260628_140000] reseaux adaptée : % réseau(x) existant(s). Colonnes partenaire/compteurs ajoutées.', nb;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "reseaux_stripe_sub_idx";
    DROP INDEX IF EXISTS "reseaux_partenaire_idx";
    ALTER TABLE "reseaux" DROP COLUMN IF EXISTS "nb_evenements";
    ALTER TABLE "reseaux" DROP COLUMN IF EXISTS "nb_reseauteurs";
    ALTER TABLE "reseaux" DROP COLUMN IF EXISTS "partenaire_expire_at";
    ALTER TABLE "reseaux" DROP COLUMN IF EXISTS "stripe_subscription_id";
    ALTER TABLE "reseaux" DROP COLUMN IF EXISTS "partenaire";
    ALTER TABLE "reseaux" DROP COLUMN IF EXISTS "presentation";
  `)
}

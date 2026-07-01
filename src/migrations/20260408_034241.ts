import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "evenements_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "fournisseurs_id" integer
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "evenements_rels" ADD CONSTRAINT "evenements_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."evenements"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "evenements_rels" ADD CONSTRAINT "evenements_rels_fournisseurs_fk" FOREIGN KEY ("fournisseurs_id") REFERENCES "public"."fournisseurs"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "evenements_rels_order_idx" ON "evenements_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "evenements_rels_parent_idx" ON "evenements_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "evenements_rels_path_idx" ON "evenements_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "evenements_rels_fournisseurs_id_idx" ON "evenements_rels" USING btree ("fournisseurs_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "evenements_rels" CASCADE;`)
}

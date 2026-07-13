import { postgresAdapter } from '@payloadcms/db-postgres'
import { resendAdapter } from '@payloadcms/email-resend'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
// ── Collections ADR-0011 (modèle 3 entités)
import { Reseauteurs } from './collections/Reseauteurs'
import { Reseaux } from './collections/Reseaux'
import { Evenements } from './collections/Evenements'
import { Inscriptions } from './collections/Inscriptions'
import { Partenaires } from './collections/Partenaires'
// ── Monétisation ADR-0013 (Réseauteur Plus — packs de licences partenaires)
import { LicencesPacks } from './collections/LicencesPacks'
import { LicencesActivations } from './collections/LicencesActivations'
// ── Référentiels
import { Categories } from './collections/Categories'
import { TypesEvenement } from './collections/TypesEvenement'
import { Badges } from './collections/Badges'
// ── Infrastructure (conservée, agnostique)
import { Groupes } from './collections/Groupes'
import { Testimonials } from './collections/Testimonials'
import { AuditLogs } from './collections/AuditLogs'
import { StripeEvents } from './collections/StripeEvents'
// ── Legacy (tables conservées en DB mais collections démontées de Payload)
// Fournisseurs, OrganisateursEvenements, LabelsRSE, CategoriesActivite :
// retirés du config (ADR-0011). Tables DB non supprimées (rollback possible).

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Normalise la connection string Postgres pour silence le warning Node
 * "SECURITY WARNING: SSL modes 'prefer', 'require', and 'verify-ca' are
 * treated as aliases for 'verify-full'" (pg-connection-string v2). Ce warning
 * apparait a chaque cold start et signale un breaking change en v3.
 *
 * Regle : sur Neon (.neon.tech), on force `sslmode=verify-full` — le
 * `rejectUnauthorized: true` plus bas le garantit deja, le pin explicite
 * aligne juste la connection string. Sur les autres hosts (local Windows,
 * tests, autres providers), on laisse tel quel : `verify-full` echoue en
 * local sur Windows quand le CA Postgres n'est pas installe (cf. README).
 */
function withExplicitSslMode(url: string): string {
  if (!url) return url
  // Sur un host non-Neon, on ne modifie rien — le user sait ce qu'il fait.
  if (!/neon/i.test(url)) return url
  // Sur Neon : remplacer sslmode=(require|prefer|verify-ca) par verify-full,
  // ou l'ajouter si absent. Les autres modes (disable, allow) sont impensables
  // sur Neon et on ne les touche pas (fail fast vaut mieux que masquer).
  if (/[?&]sslmode=(require|prefer|verify-ca)\b/i.test(url)) {
    return url.replace(/([?&])sslmode=(require|prefer|verify-ca)\b/gi, '$1sslmode=verify-full')
  }
  if (/[?&]sslmode=/i.test(url)) return url
  return url + (url.includes('?') ? '&' : '?') + 'sslmode=verify-full'
}

if (process.env.NODE_ENV === 'production' && !process.env.BLOB_READ_WRITE_TOKEN) {
  console.warn(
    '\x1b[33m⚠ [payload] BLOB_READ_WRITE_TOKEN is not set. ' +
      'Media uploads will use ephemeral local storage and files will be lost between requests. ' +
      'Configure Vercel Blob Storage: Vercel Dashboard → Storage → Create Blob Store.\x1b[0m',
  )
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      afterDashboard: ['@/components/admin/DashboardWidgets'],
      afterNavLinks: ['@/components/admin/AdminNavLinks'],
    },
  },
  collections: [
    // ── Comptes
    Users,
    Media,
    // ── 3 entités ADR-0011
    Reseauteurs,
    Reseaux,
    Evenements,
    Inscriptions,
    Partenaires,
    // ── Monétisation ADR-0013
    LicencesPacks,
    LicencesActivations,
    // ── Référentiels
    Categories,
    TypesEvenement,
    Badges,
    // ── Infrastructure conservée
    Groupes,        // DORMANT (ADR-0009)
    Testimonials,   // preuve sociale home — non lié aux 3 entités
    AuditLogs,
    StripeEvents,
  ],
  email: resendAdapter({
    apiKey: process.env.RESEND_API_KEY || '',
    defaultFromAddress: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    defaultFromName: process.env.SITE_NAME || 'RÉSEAUTEURS',
  }),
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    // Migration only: schema changes must go through src/migrations.
    // Disables the dev push that silently DROPs columns when collections evolve.
    push: false,
    pool: {
      // withExplicitSslMode force `sslmode=verify-full` dans l'URL si absent :
      // 1) la securite reelle est deja assuree par `rejectUnauthorized: true`
      //    plus bas, 2) pg-connection-string v2 emet un Node warning
      //    "SECURITY WARNING: SSL modes 'prefer/require/verify-ca' are treated
      //    as aliases for verify-full" a chaque cold start quand l'URL n'a
      //    pas de sslmode explicite — warning qui sera casse en v3 au prochain
      //    bump de `pg`. Le pin explicite coupe le warning ET rend le comportement
      //    stable independamment de la version de pg.
      connectionString: withExplicitSslMode(
        process.env.DATABASE_URI || process.env.DATABASE_URL || '',
      ),
      max: 10,
      connectionTimeoutMillis: 10000,
      // Neon coupe les sockets idle cote serveur tres rapidement (compute
      // serverless qui scale-to-zero). Avec un idleTimeoutMillis trop long,
      // le pool `pg` garde une socket morte et retourne `Connection terminated
      // unexpectedly` sur la query suivante (cf. logs Vercel 2026-04-25 :
      // home / + cron expiration-alertes en 500). 10s = default `pg`, on
      // ferme cote client avant que Neon ne le fasse cote serveur. Les retries
      // applicatifs (lib/db-retry.ts) couvrent les rares cas qui passent
      // au travers.
      idleTimeoutMillis: 10000,
      allowExitOnIdle: true,
      ssl: (process.env.DATABASE_URI || process.env.DATABASE_URL || '').includes('neon')
        ? { rejectUnauthorized: true }
        : false,
    },
  }),
  sharp,
  plugins: [
    vercelBlobStorage({
      enabled: !!process.env.BLOB_READ_WRITE_TOKEN,
      collections: {
        media: true,
      },
      token: process.env.BLOB_READ_WRITE_TOKEN || '',
    }),
  ],
})

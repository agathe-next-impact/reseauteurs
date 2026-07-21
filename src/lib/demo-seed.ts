/**
 * demo-seed.ts — Données + logique du seed de démonstration (modèle 3 entités).
 *
 * Partagé par :
 *   - le CLI  src/scripts/seed-demo.ts (local / staging)
 *   - la route src/app/api/dev/seed-demo/route.ts (prod, sans shell)
 *
 * Idempotent (upsert par slug métier / nom / value) et additif (ne supprime rien).
 * Coordonnées fournies → pas de géocodage ; geom PostGIS + compteurs recalculés
 * par les hooks afterChange des collections.
 */

import type { Payload, CollectionSlug, Where } from 'payload'
import { sql } from '@payloadcms/db-postgres'

/** Marqueur (dans les descriptions) pour repérer/nettoyer la démo. */
export const DEMO_TAG = '[démo]'

type City = { lng: number; lat: number; dep: string; region: string }
const CITIES: Record<string, City> = {
  Paris: { lng: 2.3522, lat: 48.8566, dep: 'Paris', region: 'Île-de-France' },
  Lyon: { lng: 4.8357, lat: 45.764, dep: 'Rhône', region: 'Auvergne-Rhône-Alpes' },
  Marseille: { lng: 5.3698, lat: 43.2965, dep: 'Bouches-du-Rhône', region: "Provence-Alpes-Côte d'Azur" },
  Bordeaux: { lng: -0.5792, lat: 44.8378, dep: 'Gironde', region: 'Nouvelle-Aquitaine' },
  Lille: { lng: 3.0573, lat: 50.6292, dep: 'Nord', region: 'Hauts-de-France' },
  Toulouse: { lng: 1.4442, lat: 43.6047, dep: 'Haute-Garonne', region: 'Occitanie' },
  Nantes: { lng: -1.5536, lat: 47.2184, dep: 'Loire-Atlantique', region: 'Pays de la Loire' },
  'Clermont-Ferrand': { lng: 3.087, lat: 45.7772, dep: 'Puy-de-Dôme', region: 'Auvergne-Rhône-Alpes' },
  Strasbourg: { lng: 7.7521, lat: 48.5734, dep: 'Bas-Rhin', region: 'Grand Est' },
  Nice: { lng: 7.262, lat: 43.7102, dep: 'Alpes-Maritimes', region: "Provence-Alpes-Côte d'Azur" },
  Rennes: { lng: -1.6778, lat: 48.1173, dep: 'Ille-et-Vilaine', region: 'Bretagne' },
  Montpellier: { lng: 3.8767, lat: 43.6108, dep: 'Hérault', region: 'Occitanie' },
}

function jitter(base: number, i: number): number {
  const delta = (((i * 37) % 20) - 10) / 1000
  return Number((base + delta).toFixed(5))
}

const CATEGORIES = [
  { label: 'Conseil & Services', value: 'conseil', couleur: '#2563EB', ordre: 1 },
  { label: 'BTP & Immobilier', value: 'btp', couleur: '#f5851f', ordre: 2 },
  { label: 'Tech & Digital', value: 'tech', couleur: '#0284c7', ordre: 3 },
  { label: 'Finance & Assurance', value: 'finance', couleur: '#16a34a', ordre: 4 },
  { label: 'Santé & Bien-être', value: 'sante', couleur: '#a855f7', ordre: 5 },
  { label: 'Commerce & Distribution', value: 'commerce', couleur: '#eab308', ordre: 6 },
  { label: 'Industrie', value: 'industrie', couleur: '#64748b', ordre: 7 },
  { label: 'Communication & Marketing', value: 'communication', couleur: '#ec4899', ordre: 8 },
]

const TYPES_EVENEMENT = [
  { label: 'Afterwork', value: 'afterwork', couleur: '#2563EB', ordre: 1 },
  { label: 'Petit-déjeuner', value: 'petit-dejeuner', couleur: '#f5851f', ordre: 2 },
  { label: 'Conférence', value: 'conference', couleur: '#0284c7', ordre: 3 },
  { label: 'Réunion de réseau', value: 'reunion', couleur: '#a855f7', ordre: 4 },
  { label: 'Atelier', value: 'atelier', couleur: '#16a34a', ordre: 5 },
]

const NATIONAUX = [
  { nom: 'BNI', ville: 'Paris', partenaire: true, siteWeb: 'https://bni.fr', description: "Réseau international de recommandations d'affaires." },
  { nom: 'DCF', ville: 'Paris', partenaire: true, siteWeb: 'https://reseau-dcf.fr', description: 'Dirigeants Commerciaux de France.' },
  { nom: 'CJD', ville: 'Lyon', partenaire: true, siteWeb: 'https://cjd.net', description: "Centre des Jeunes Dirigeants d'entreprise." },
  { nom: 'Dynabuy', ville: 'Lille', partenaire: false, siteWeb: 'https://dynabuy.fr', description: "Réseau d'affaires et centrale d'achats pour indépendants et TPE." },
  { nom: 'Rotary Club', ville: 'Nice', partenaire: false, siteWeb: 'https://rotary.fr', description: 'Club service de professionnels engagés localement.' },
  { nom: 'CPME', ville: 'Nantes', partenaire: false, siteWeb: 'https://cpme.fr', description: 'Confédération des Petites et Moyennes Entreprises.' },
]

const LOCAUX = [
  { nom: "BNI Lyon Presqu'île", parent: 'BNI', ville: 'Lyon' },
  { nom: 'BNI Paris Opéra', parent: 'BNI', ville: 'Paris' },
  { nom: 'BNI Clermont Business', parent: 'BNI', ville: 'Clermont-Ferrand' },
  { nom: 'DCF Paris', parent: 'DCF', ville: 'Paris' },
  { nom: 'DCF Bordeaux', parent: 'DCF', ville: 'Bordeaux' },
  { nom: 'CJD Lyon', parent: 'CJD', ville: 'Lyon' },
  { nom: 'CJD Toulouse', parent: 'CJD', ville: 'Toulouse' },
  { nom: 'Dynabuy Lille', parent: 'Dynabuy', ville: 'Lille' },
  { nom: "Rotary Nice Côte d'Azur", parent: 'Rotary Club', ville: 'Nice' },
  { nom: 'CPME Loire-Atlantique', parent: 'CPME', ville: 'Nantes' },
]

const RESEAUTEURS = [
  { prenom: 'Camille', nom: 'Bernard', ville: 'Lyon', entreprise: 'Bernard Conseil', fonction: 'Consultante en stratégie', secteur: 'conseil', reseaux: ["BNI Lyon Presqu'île", 'CJD Lyon'], evMois: 8, competences: ['Stratégie', 'Organisation', 'Pilotage'], linkedin: 'https://www.linkedin.com/in/demo-camille' },
  { prenom: 'Thomas', nom: 'Martin', ville: 'Paris', entreprise: 'Martin & Associés', fonction: 'Expert-comptable', secteur: 'finance', reseaux: ['DCF Paris', 'BNI Paris Opéra'], evMois: 12, competences: ['Comptabilité', 'Fiscalité', 'Gestion'] },
  { prenom: 'Sophie', nom: 'Dubois', ville: 'Bordeaux', entreprise: 'Dubois Immobilier', fonction: 'Agent immobilier', secteur: 'btp', reseaux: ['DCF Bordeaux'], evMois: 4, competences: ['Immobilier', 'Transaction', 'Négociation'] },
  { prenom: 'Julien', nom: 'Moreau', ville: 'Toulouse', entreprise: 'Moreau Digital', fonction: 'Développeur web freelance', secteur: 'tech', reseaux: ['CJD Toulouse'], evMois: 3, competences: ['Développement web', 'SEO', 'E-commerce'], site: 'https://moreau-digital.fr' },
  { prenom: 'Marie', nom: 'Laurent', ville: 'Lyon', entreprise: 'Cabinet Laurent', fonction: 'Avocate en droit des affaires', secteur: 'conseil', reseaux: ["BNI Lyon Presqu'île"], evMois: 6, competences: ['Droit des affaires', 'Contrats', 'Contentieux'] },
  { prenom: 'Nicolas', nom: 'Petit', ville: 'Lille', entreprise: 'Petit Assurances', fonction: 'Courtier en assurances', secteur: 'finance', reseaux: ['Dynabuy Lille'], evMois: 2, competences: ['Assurance', 'Prévoyance', 'Retraite'] },
  { prenom: 'Émilie', nom: 'Roux', ville: 'Paris', entreprise: 'Roux Communication', fonction: 'Directrice de communication', secteur: 'communication', reseaux: ['DCF Paris'], evMois: 15, competences: ['Communication', 'Relations presse', 'Événementiel'] },
  { prenom: 'Alexandre', nom: 'Fontaine', ville: 'Nice', entreprise: 'Fontaine Patrimoine', fonction: 'Conseiller en gestion de patrimoine', secteur: 'finance', reseaux: ["Rotary Nice Côte d'Azur"], evMois: 5, competences: ['Patrimoine', 'Investissement', 'Fiscalité'] },
  { prenom: 'Laura', nom: 'Girard', ville: 'Nantes', entreprise: 'Girard Santé', fonction: 'Ostéopathe', secteur: 'sante', reseaux: ['CPME Loire-Atlantique'], evMois: 1, competences: ['Ostéopathie', 'Bien-être'] },
  { prenom: 'Maxime', nom: 'Lefevre', ville: 'Clermont-Ferrand', entreprise: 'Lefevre BTP', fonction: 'Gérant entreprise de rénovation', secteur: 'btp', reseaux: ['BNI Clermont Business'], evMois: 9, competences: ['Rénovation', 'Gros œuvre', 'Devis'] },
  { prenom: 'Chloé', nom: 'Mercier', ville: 'Lyon', entreprise: 'Mercier RH', fonction: 'Consultante RH', secteur: 'conseil', reseaux: ['CJD Lyon'], evMois: 7, competences: ['Recrutement', 'Formation', 'QVT'] },
  { prenom: 'Antoine', nom: 'Blanc', ville: 'Paris', entreprise: 'Blanc Studio', fonction: 'Designer UX/UI', secteur: 'tech', reseaux: ['BNI Paris Opéra'], evMois: 3, competences: ['UX', 'UI', 'Design produit'], site: 'https://blanc-studio.fr' },
  { prenom: 'Sarah', nom: 'Garcia', ville: 'Toulouse', entreprise: 'Garcia Marketing', fonction: 'Consultante marketing digital', secteur: 'communication', reseaux: ['CJD Toulouse'], evMois: 11, competences: ['Marketing digital', 'Publicité', 'Réseaux sociaux'] },
  { prenom: 'Pierre', nom: 'Faure', ville: 'Bordeaux', entreprise: 'Faure Industrie', fonction: 'Dirigeant PME industrielle', secteur: 'industrie', reseaux: ['DCF Bordeaux'], evMois: 6, competences: ['Production', 'Supply chain', 'Qualité'] },
  { prenom: 'Aurélie', nom: 'Chevalier', ville: 'Lille', entreprise: 'Chevalier Commerce', fonction: 'Franchisée retail', secteur: 'commerce', reseaux: ['Dynabuy Lille'], evMois: 2, competences: ['Retail', 'Franchise', 'Merchandising'] },
  { prenom: 'David', nom: 'Robin', ville: 'Nice', entreprise: 'Robin Coaching', fonction: 'Coach professionnel', secteur: 'sante', reseaux: ["Rotary Nice Côte d'Azur"], evMois: 10, competences: ['Coaching', 'Leadership', 'Développement personnel'] },
  { prenom: 'Manon', nom: 'Vincent', ville: 'Paris', entreprise: 'Vincent Legal', fonction: "Juriste d'entreprise", secteur: 'conseil', reseaux: ['DCF Paris', 'BNI Paris Opéra'], evMois: 5, competences: ['Droit social', 'RGPD', 'Conformité'] },
  { prenom: 'Lucas', nom: 'Simon', ville: 'Lyon', entreprise: 'Simon Web', fonction: 'Agence web', secteur: 'tech', reseaux: ["BNI Lyon Presqu'île", 'CJD Lyon'], evMois: 14, competences: ['Sites web', 'Applications', 'Hébergement'] },
]

const EVENEMENTS = [
  { titre: 'Afterwork networking de la rentrée', reseau: "BNI Lyon Presqu'île", type: 'afterwork', inDays: 5, hour: 18, ville: 'Lyon', lieuNom: 'Rooftop des Terreaux', description: "Soirée de reprise pour élargir son réseau autour d'un verre." },
  { titre: 'Petit-déjeuner des dirigeants', reseau: 'DCF Paris', type: 'petit-dejeuner', inDays: 8, hour: 8, ville: 'Paris', lieuNom: 'Hôtel Scribe', description: "Échanges business autour d'un café, tour de table et recommandations." },
  { titre: 'Conférence : réussir sa prospection', reseau: 'CJD Lyon', type: 'conference', inDays: 12, hour: 19, ville: 'Lyon', lieuNom: 'Campus CJD', description: "Retours d'expérience et méthodes concrètes de développement commercial." },
  { titre: 'Réunion hebdomadaire BNI', reseau: 'BNI Paris Opéra', type: 'reunion', inDays: 3, hour: 7, ville: 'Paris', lieuNom: 'Salle Opéra', description: 'Réunion de recommandations entre membres.' },
  { titre: 'Atelier LinkedIn pour entrepreneurs', reseau: 'CJD Toulouse', type: 'atelier', inDays: 15, hour: 14, ville: 'Toulouse', lieuNom: 'La Cantine', description: 'Optimiser son profil et sa prospection sur LinkedIn.' },
  { titre: 'Soirée réseau du Sud-Ouest', reseau: 'DCF Bordeaux', type: 'afterwork', inDays: 20, hour: 18, ville: 'Bordeaux', lieuNom: 'Quai des Marques', description: 'Rencontre inter-réseaux des professionnels bordelais.' },
  { titre: "Déjeuner d'affaires Dynabuy", reseau: 'Dynabuy Lille', type: 'petit-dejeuner', inDays: 9, hour: 12, ville: 'Lille', lieuNom: 'Brasserie André', description: 'Présentation des membres et opportunités de collaboration.' },
  { titre: 'Conférence Rotary : entreprendre responsable', reseau: "Rotary Nice Côte d'Azur", type: 'conference', inDays: 25, hour: 19, ville: 'Nice', lieuNom: 'Palais de la Méditerranée', description: "Table ronde sur l'engagement des entreprises locales." },
  { titre: 'Rencontre des PME ligériennes', reseau: 'CPME Loire-Atlantique', type: 'reunion', inDays: 18, hour: 17, ville: 'Nantes', lieuNom: 'Cité des Congrès', description: 'Networking et échanges entre dirigeants de PME.' },
  { titre: 'Afterwork Business Clermont', reseau: 'BNI Clermont Business', type: 'afterwork', inDays: 7, hour: 18, ville: 'Clermont-Ferrand', lieuNom: 'Le Comptoir', description: 'Networking décontracté des entrepreneurs auvergnats.' },
]

const PARTENAIRES = [
  { nom: 'NeoBank Pro', lien: 'https://example.com/neobank', couleur: '#2563EB', description: 'Solutions bancaires pour indépendants et TPE.' },
  { nom: "Assur'Entreprise", lien: 'https://example.com/assur', couleur: '#16a34a', description: 'Assurances professionnelles sur-mesure.' },
  { nom: 'CloudFacture', lien: 'https://example.com/cloudfacture', couleur: '#0284c7', description: 'Facturation et comptabilité en ligne.' },
  { nom: "Imprim'Express", lien: 'https://example.com/imprim', couleur: '#f5851f', description: 'Impression et signalétique pour événements.' },
]

/** Nombre d'entités que le seed peut créer (pour l'aperçu). */
export const DEMO_COUNTS = {
  secteurs: CATEGORIES.length,
  types: TYPES_EVENEMENT.length,
  nationaux: NATIONAUX.length,
  locaux: LOCAUX.length,
  reseauteurs: RESEAUTEURS.length,
  evenements: EVENEMENTS.length,
  partenaires: PARTENAIRES.length,
}

function dateInDays(days: number, hour: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace('#', '')
  return { r: parseInt(m.slice(0, 2), 16), g: parseInt(m.slice(2, 4), 16), b: parseInt(m.slice(4, 6), 16) }
}

export interface DemoSeedResult {
  created: number
  skipped: number
  partenaires: 'seeded' | 'skipped-no-blob'
}

/**
 * Exécute le seed de démo sur l'instance Payload fournie.
 * @param payload  instance Payload déjà initialisée (getPayload)
 * @param log      journalisation optionnelle (console.log en CLI, no-op en route)
 */
export async function runDemoSeed(
  payload: Payload,
  log: (msg: string) => void = () => {},
): Promise<DemoSeedResult> {
  // Le temps du seed, on active SEED_DEV : les hooks lourds des collections
  // (syncGeom PostGIS, recalcul des compteurs, géocodage) sont neutralisés — sur
  // le pooler Neon ils gardaient la transaction ouverte trop longtemps
  // (« idle-in-transaction timeout »). On rétablit geom + compteurs ensuite via
  // un backfill dédié (statements courts, hors transaction longue). SEED_DEV est
  // restauré dans le finally (important pour la route serverless : ne pas laisser
  // l'instance chaude avec les hooks désactivés).
  const prevSeedDev = process.env.SEED_DEV
  process.env.SEED_DEV = 'true'

  const stats = { created: 0, skipped: 0 }
  // Coordonnées collectées pour le backfill geom (id + lng/lat).
  const geomReseaux: Array<{ id: number | string; lat?: number; lng?: number }> = []
  const geomReseauteurs: Array<{ id: number | string; lat?: number; lng?: number }> = []
  const geomEvenements: Array<{ id: number | string; lat?: number; lng?: number }> = []

  try {
    // Forme permissive : le seed lit id + coordonnées selon la collection.
    type UpsertedDoc = {
      id: number | string
      latitude?: number
      longitude?: number
      lieuLatitude?: number
      lieuLongitude?: number
    }
    const upsert = async (
      collection: CollectionSlug,
      where: Where,
      data: Record<string, unknown>,
    ): Promise<UpsertedDoc> => {
      const existing = await payload.find({ collection, where, limit: 1, depth: 0, overrideAccess: true })
      if (existing.docs.length > 0) {
        stats.skipped++
        return existing.docs[0] as UpsertedDoc
      }
      // Seed dynamique : la data varie par collection, on relâche le typage strict de create.
      const doc = await payload.create({ collection, data: data as never, overrideAccess: true })
      stats.created++
      return doc as UpsertedDoc
    }

    // 1) Secteurs
    log('secteurs')
    const secteurByValue: Record<string, number | string> = {}
    for (const c of CATEGORIES) {
      const doc = await upsert('categories', { value: { equals: c.value } }, c)
      secteurByValue[c.value] = doc.id
    }

    // 2) Types d'événement
    log('types')
    const typeByValue: Record<string, number | string> = {}
    for (const t of TYPES_EVENEMENT) {
      const doc = await upsert('types-evenement', { value: { equals: t.value } }, t)
      typeByValue[t.value] = doc.id
    }

    // 3) Réseaux nationaux
    log('réseaux nationaux')
    const reseauByNom: Record<string, number | string> = {}
    for (const n of NATIONAUX) {
      const city = CITIES[n.ville]
      const doc = await upsert(
        'reseaux',
        { and: [{ nom: { equals: n.nom } }, { niveau: { equals: 'national' } }] },
        {
          nom: n.nom,
          niveau: 'national',
          ville: n.ville,
          source: 'importe',
          statut: 'publiee',
          partenaire: n.partenaire,
          siteWeb: n.siteWeb,
          description: `${n.description} ${DEMO_TAG}`,
          latitude: city?.lat,
          longitude: city?.lng,
        },
      )
      reseauByNom[n.nom] = doc.id
      geomReseaux.push({ id: doc.id, lat: doc.latitude, lng: doc.longitude })
    }

    // 4) Réseaux locaux
    log('réseaux locaux')
    for (const l of LOCAUX) {
      const parentId = reseauByNom[l.parent]
      if (!parentId) continue
      const city = CITIES[l.ville]
      const doc = await upsert(
        'reseaux',
        { and: [{ nom: { equals: l.nom } }, { niveau: { equals: 'local' } }] },
        {
          nom: l.nom,
          niveau: 'local',
          parent: parentId,
          ville: l.ville,
          source: 'importe',
          statut: 'publiee',
          description: `Groupe local de ${l.parent} à ${l.ville}. ${DEMO_TAG}`,
          latitude: city?.lat,
          longitude: city?.lng,
        },
      )
      reseauByNom[l.nom] = doc.id
      geomReseaux.push({ id: doc.id, lat: doc.latitude, lng: doc.longitude })
    }

    // 5) Réseauteurs
    log('réseauteurs')
    let idx = 0
    for (const r of RESEAUTEURS) {
      idx++
      const city = CITIES[r.ville]
      const reseauxIds = r.reseaux.map((nom) => reseauByNom[nom]).filter(Boolean)
      const doc = await upsert(
        'reseauteurs',
        { and: [{ prenom: { equals: r.prenom } }, { nom: { equals: r.nom } }] },
        {
          prenom: r.prenom,
          nom: r.nom,
          ville: r.ville,
          departement: city?.dep,
          region: city?.region,
          entreprise: r.entreprise,
          fonction: r.fonction,
          description: `${r.fonction} chez ${r.entreprise}. ${DEMO_TAG}`,
          secteur: secteurByValue[r.secteur],
          competences: (r.competences ?? []).map((label) => ({ label })),
          reseauxFrequentes: reseauxIds,
          evenementsParMois: r.evMois,
          linkedin: r.linkedin,
          site: r.site,
          statut: 'valide',
          latitude: city ? jitter(city.lat, idx) : undefined,
          longitude: city ? jitter(city.lng, idx) : undefined,
        },
      )
      geomReseauteurs.push({ id: doc.id, lat: doc.latitude, lng: doc.longitude })
    }

    // 6) Événements
    log('événements')
    for (const e of EVENEMENTS) {
      const reseauId = reseauByNom[e.reseau]
      if (!reseauId) continue
      const city = CITIES[e.ville]
      const doc = await upsert(
        'evenements',
        { titre: { equals: e.titre } },
        {
          titre: e.titre,
          reseau: reseauId,
          type: typeByValue[e.type],
          dateDebut: dateInDays(e.inDays, e.hour),
          lieuNom: e.lieuNom,
          lieuVille: e.ville,
          description: `${e.description} ${DEMO_TAG}`,
          lienInscription: 'https://example.com/inscription',
          statut: 'publie',
          lieuLatitude: city?.lat,
          lieuLongitude: city?.lng,
        },
      )
      geomEvenements.push({ id: doc.id, lat: doc.lieuLatitude, lng: doc.lieuLongitude })
    }

    // 7) Partenaires — logo requis : seulement si stockage média persistant (Vercel Blob)
    let partenaires: 'seeded' | 'skipped-no-blob' = 'skipped-no-blob'
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      partenaires = 'seeded'
      log('partenaires')
      const sharp = (await import('sharp')).default
      for (const p of PARTENAIRES) {
        const existing = await payload.find({
          collection: 'partenaires',
          where: { nom: { equals: p.nom } },
          limit: 1,
          overrideAccess: true,
        })
        if (existing.docs.length > 0) {
          stats.skipped++
          continue
        }
        try {
          const { r, g, b } = hexToRgb(p.couleur)
          const buffer = await sharp({
            create: { width: 400, height: 400, channels: 3, background: { r, g, b } },
          })
            .png()
            .toBuffer()
          const media = await payload.create({
            collection: 'media',
            data: { alt: `Logo ${p.nom} ${DEMO_TAG}` },
            file: {
              data: buffer,
              mimetype: 'image/png',
              name: `demo-${p.nom.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
              size: buffer.length,
            },
            overrideAccess: true,
          })
          await payload.create({
            collection: 'partenaires',
            data: { nom: p.nom, logo: media.id, lien: p.lien, description: `${p.description} ${DEMO_TAG}`, statut: 'actif' },
            overrideAccess: true,
          })
          stats.created++
        } catch {
          // best-effort : on ignore un partenaire en échec
        }
      }
    }

    // 8) Backfill geom PostGIS (miroir des hooks syncGeom, mais en statements
    //    autonomes — pas de transaction longue → pas d'idle-in-transaction).
    //    `WHERE geom IS NULL` : idempotent, ne réécrit pas les lignes déjà remplies.
    log('backfill géo (PostGIS)')
    const drizzle = payload.db.drizzle
    for (const r of geomReseaux) {
      if (r.lat == null || r.lng == null) continue
      try {
        await drizzle.execute(sql`UPDATE reseaux SET geom = ST_SetSRID(ST_MakePoint(${r.lng}, ${r.lat}), 4326)::geography WHERE id = ${r.id} AND geom IS NULL`.inlineParams())
      } catch { /* PostGIS indisponible — best effort */ }
    }
    for (const r of geomReseauteurs) {
      if (r.lat == null || r.lng == null) continue
      try {
        await drizzle.execute(sql`UPDATE reseauteurs SET geom = ST_SetSRID(ST_MakePoint(${r.lng}, ${r.lat}), 4326)::geography WHERE id = ${r.id} AND geom IS NULL`.inlineParams())
      } catch { /* best effort */ }
    }
    for (const r of geomEvenements) {
      if (r.lat == null || r.lng == null) continue
      try {
        await drizzle.execute(sql`UPDATE evenements SET geom = ST_SetSRID(ST_MakePoint(${r.lng}, ${r.lat}), 4326)::geography WHERE id = ${r.id} AND geom IS NULL`.inlineParams())
      } catch { /* best effort */ }
    }

    // 9) Recalcul des compteurs dérivés des réseaux (nbReseauteurs / nbEvenements).
    log('compteurs réseaux')
    for (const { id } of geomReseaux) {
      try {
        const [{ totalDocs: nbR }, { totalDocs: nbE }] = await Promise.all([
          payload.count({
            collection: 'reseauteurs',
            where: { and: [{ reseauxFrequentes: { contains: id } }, { statut: { equals: 'valide' } }] },
            overrideAccess: true,
          }),
          payload.count({
            collection: 'evenements',
            where: { and: [{ reseau: { equals: id } }, { statut: { equals: 'publie' } }] },
            overrideAccess: true,
          }),
        ])
        await payload.update({
          collection: 'reseaux',
          id,
          data: { nbReseauteurs: nbR, nbEvenements: nbE },
          overrideAccess: true,
        })
      } catch { /* best effort */ }
    }

    return { created: stats.created, skipped: stats.skipped, partenaires }
  } finally {
    if (prevSeedDev === undefined) delete process.env.SEED_DEV
    else process.env.SEED_DEV = prevSeedDev
  }
}

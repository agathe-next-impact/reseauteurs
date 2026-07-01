// @ts-nocheck — types en attente de generate:types (data-architect)
/**
 * seed-dev.ts — Seed de développement pour le modèle à 3 entités (ADR-0011).
 *
 * Crée des données réalistes pour les 2 cartes en dev local :
 *   - 5 réseaux (BNI, DCF, CJD, Afterwork, Réseau Entreprendre)
 *   - 8 réseauteurs validés (grandes villes FR)
 *   - 6 événements
 *   - 2 partenaires (annonceurs actifs)
 *
 * Idempotent : vérifie l'existence avant d'insérer.
 *
 * Usage :
 *   yarn ts-node src/scripts/seed-dev.ts
 *   (ou via payload local API dans un script de migration dev)
 *
 * NE PAS exécuter en production.
 */

import dotenv from 'dotenv'
import path from 'path'

// Charger l'env AVANT payload.config : Payload lit PAYLOAD_SECRET a l'import.
dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })
process.env.SEED_DEV = 'true'

const CITY_COORDS: Record<string, { latitude: number; longitude: number }> = {
  Paris: { latitude: 48.8566, longitude: 2.3522 },
  Lyon: { latitude: 45.764, longitude: 4.8357 },
  Marseille: { latitude: 43.2965, longitude: 5.3698 },
  Bordeaux: { latitude: 44.8378, longitude: -0.5792 },
  Toulouse: { latitude: 43.6047, longitude: 1.4442 },
  Nantes: { latitude: 47.2184, longitude: -1.5536 },
  Strasbourg: { latitude: 48.5734, longitude: 7.7521 },
  'Clermont-Ferrand': { latitude: 45.7772, longitude: 3.087 },
  Grenoble: { latitude: 45.1885, longitude: 5.7245 },
}

async function seed() {
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('../payload.config'),
  ])
  const payload = await getPayload({ config })
  console.log('[seed-dev] Démarrage du seed 3 entités...')

  // ── 1. Réseaux ───────────────────────────────────────────────────────
  const reseauxData = [
    { nom: 'BNI France', ville: 'Paris', description: 'Business Network International — le plus grand réseau de networking d\'affaires au monde.', presentation: 'BNI aide les professionnels à développer leur activité par le bouche-à-oreille structuré. Présent dans toutes les régions françaises.', siteWeb: 'https://www.bni.fr', partenaire: true },
    { nom: 'DCF — Dirigeants Commerciaux de France', ville: 'Lyon', description: 'Association des dirigeants et cadres commerciaux.', presentation: 'Les DCF fédèrent 5 000 membres dans 60 délégations régionales.', siteWeb: 'https://www.dcf.fr', partenaire: true },
    { nom: 'CJD — Centre des Jeunes Dirigeants', ville: 'Bordeaux', description: 'Mouvement de dirigeants pour un management responsable.', siteWeb: 'https://www.cjd.net', partenaire: false },
    { nom: 'Afterwork Business Auvergne', ville: 'Clermont-Ferrand', description: 'Afterworks professionnels en Auvergne.', siteWeb: '', partenaire: false },
    { nom: 'Réseau Entreprendre Rhône-Alpes', ville: 'Grenoble', description: 'Accompagnement des créateurs et repreneurs d\'entreprises.', siteWeb: 'https://www.reseau-entreprendre.org', partenaire: false },
  ]

  const reseauxIds: Record<string, number | string> = {}
  for (const r of reseauxData) {
    const existing = await payload.find({
      collection: 'reseaux',
      where: { nom: { equals: r.nom } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      reseauxIds[r.nom] = existing.docs[0].id
      console.log(`[seed-dev] Réseau existant : ${r.nom}`)
      continue
    }
    const coords = CITY_COORDS[r.ville]
    const created = await payload.create({
      collection: 'reseaux',
      data: {
        nom: r.nom,
        ville: r.ville,
        description: r.description,
        presentation: r.presentation ?? '',
        siteWeb: r.siteWeb,
        partenaire: r.partenaire,
        statut: 'publiee',
        source: 'importe',
        ...(coords ?? {}),
      },
      overrideAccess: true,
    })
    reseauxIds[r.nom] = created.id
    console.log(`[seed-dev] Réseau créé : ${r.nom} (id=${created.id})`)
  }

  // ── 2. Catégories (secteurs) — on vérifie que le seed 130000 a tourné
  const secteurs = await payload.find({ collection: 'categories', limit: 20, overrideAccess: true })
  const secteurMap: Record<string, number | string> = {}
  for (const s of secteurs.docs) {
    secteurMap[s.value as string] = s.id
  }
  console.log(`[seed-dev] ${secteurs.totalDocs} secteurs disponibles.`)

  // ── 3. Réseauteurs ───────────────────────────────────────────────────
  const reseauteursData = [
    { prenom: 'Marie', nom: 'Dupont', ville: 'Paris', departement: 'Paris', region: 'Île-de-France', entreprise: 'MD Consulting', fonction: 'Consultante RH', evenementsParMois: 8, reseaux: ['BNI France', 'DCF — Dirigeants Commerciaux de France'], secteur: 'conseil-services-b2b' },
    { prenom: 'Jean', nom: 'Martin', ville: 'Lyon', departement: 'Rhône', region: 'Auvergne-Rhône-Alpes', entreprise: 'Martin Immobilier', fonction: 'Directeur commercial', evenementsParMois: 4, reseaux: ['DCF — Dirigeants Commerciaux de France'], secteur: 'btp-immobilier' },
    { prenom: 'Sophie', nom: 'Bernard', ville: 'Marseille', departement: 'Bouches-du-Rhône', region: 'Provence-Alpes-Côte d\'Azur', entreprise: 'Bernard Tech Solutions', fonction: 'CTO', evenementsParMois: 12, reseaux: ['BNI France'], secteur: 'informatique-tech' },
    { prenom: 'Pierre', nom: 'Leblanc', ville: 'Bordeaux', departement: 'Gironde', region: 'Nouvelle-Aquitaine', entreprise: 'Leblanc Formation', fonction: 'Formateur', evenementsParMois: 3, reseaux: ['CJD — Centre des Jeunes Dirigeants'], secteur: 'formation-education' },
    { prenom: 'Claire', nom: 'Moreau', ville: 'Toulouse', departement: 'Haute-Garonne', region: 'Occitanie', entreprise: 'Santé & Bien-être', fonction: 'Médecin généraliste', evenementsParMois: 2, reseaux: [], secteur: 'medical-sante' },
    { prenom: 'Antoine', nom: 'Leroy', ville: 'Nantes', departement: 'Loire-Atlantique', region: 'Pays de la Loire', entreprise: 'Leroy Finance', fonction: 'Expert-comptable', evenementsParMois: 6, reseaux: ['BNI France', 'Afterwork Business Auvergne'], secteur: 'finance-assurance' },
    { prenom: 'Isabelle', nom: 'Petit', ville: 'Strasbourg', departement: 'Bas-Rhin', region: 'Grand Est', entreprise: 'Petit Avocats', fonction: 'Avocate d\'affaires', evenementsParMois: 5, reseaux: ['DCF — Dirigeants Commerciaux de France'], secteur: 'juridique-notariat' },
    { prenom: 'Thomas', nom: 'Dupont', ville: 'Clermont-Ferrand', departement: 'Puy-de-Dôme', region: 'Auvergne-Rhône-Alpes', entreprise: 'Dupont Marketing', fonction: 'Directeur marketing', evenementsParMois: 1, reseaux: ['Afterwork Business Auvergne'], secteur: 'marketing-communication' },
  ]

  for (const r of reseauteursData) {
    const existing = await payload.find({
      collection: 'reseauteurs',
      where: { and: [{ prenom: { equals: r.prenom } }, { nom: { equals: r.nom } }, { ville: { equals: r.ville } }] },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      console.log(`[seed-dev] Réseauteur existant : ${r.prenom} ${r.nom}`)
      continue
    }

    const reseauxRelIds = r.reseaux
      .map((rn) => reseauxIds[rn])
      .filter((id): id is number | string => id !== undefined)

    const secteurId = secteurMap[r.secteur]
    const coords = CITY_COORDS[r.ville]

    try {
      const created = await payload.create({
        collection: 'reseauteurs',
        data: {
          prenom: r.prenom,
          nom: r.nom,
          ville: r.ville,
          departement: r.departement,
          region: r.region,
          entreprise: r.entreprise,
          fonction: r.fonction,
          evenementsParMois: r.evenementsParMois,
          reseauxFrequentes: reseauxRelIds,
          secteur: secteurId ?? undefined,
          statut: 'valide',
          seo: { noindex: false },
          ...(coords ?? {}),
        },
        overrideAccess: true,
      })
      console.log(`[seed-dev] Réseauteur créé : ${r.prenom} ${r.nom}, badge=${created.badge}, ville=${r.ville}`)
    } catch (err) {
      console.error(`[seed-dev] Erreur création ${r.prenom} ${r.nom}:`, err)
    }
  }

  // ── 4. Événements ────────────────────────────────────────────────────
  const typesEvt = await payload.find({ collection: 'types-evenement', limit: 10, overrideAccess: true })
  const typeMap: Record<string, number | string> = {}
  for (const t of typesEvt.docs) {
    typeMap[t.value as string] = t.id
  }

  const now = new Date()
  const evenementsData = [
    {
      titre: 'Réunion BNI Paris 8e — Petit-déjeuner networking',
      reseau: 'BNI France',
      lieuVille: 'Paris',
      lieuAdresse: '12 Avenue de Wagram',
      lieuCodePostal: '75008',
      dateDebut: new Date(now.getTime() + 7 * 24 * 3600000).toISOString(),
      lienInscription: 'https://www.bni.fr/rejoindre',
      type: 'reseaux-affaires',
    },
    {
      titre: 'DCF Lyon — Soirée networking Presqu\'île',
      reseau: 'DCF — Dirigeants Commerciaux de France',
      lieuVille: 'Lyon',
      lieuAdresse: '20 Place Bellecour',
      lieuCodePostal: '69002',
      dateDebut: new Date(now.getTime() + 14 * 24 * 3600000).toISOString(),
      lienInscription: 'https://www.dcf.fr/evenements',
      type: 'afterworks',
    },
    {
      titre: 'CJD Bordeaux — Forum des dirigeants responsables',
      reseau: 'CJD — Centre des Jeunes Dirigeants',
      lieuVille: 'Bordeaux',
      lieuAdresse: '1 Place de la Bourse',
      lieuCodePostal: '33000',
      dateDebut: new Date(now.getTime() + 21 * 24 * 3600000).toISOString(),
      lienInscription: 'https://www.cjd.net/evenements',
      type: 'conferences',
    },
    {
      titre: 'Afterwork Business — Spécial Tech & Innovation',
      reseau: 'Afterwork Business Auvergne',
      lieuVille: 'Clermont-Ferrand',
      lieuAdresse: '5 Place de Jaude',
      lieuCodePostal: '63000',
      dateDebut: new Date(now.getTime() + 10 * 24 * 3600000).toISOString(),
      lienInscription: '',
      type: 'afterworks',
    },
    {
      titre: 'Réseau Entreprendre — Pitch & Financement',
      reseau: 'Réseau Entreprendre Rhône-Alpes',
      lieuVille: 'Grenoble',
      lieuAdresse: '3 Rue Félix Poulat',
      lieuCodePostal: '38000',
      dateDebut: new Date(now.getTime() + 28 * 24 * 3600000).toISOString(),
      lienInscription: 'https://www.reseau-entreprendre.org',
      type: 'conferences',
    },
    {
      titre: 'BNI National Congress — Paris La Défense',
      reseau: 'BNI France',
      lieuVille: 'Paris',
      lieuAdresse: 'CNIT, 2 Place de la Défense',
      lieuCodePostal: '92400',
      dateDebut: new Date(now.getTime() + 60 * 24 * 3600000).toISOString(),
      lienInscription: 'https://www.bni.fr/congres',
      type: 'congres',
    },
  ]

  for (const e of evenementsData) {
    const existing = await payload.find({
      collection: 'evenements',
      where: { titre: { equals: e.titre } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      console.log(`[seed-dev] Événement existant : ${e.titre}`)
      continue
    }
    const reseauId = reseauxIds[e.reseau]
    if (!reseauId) {
      console.warn(`[seed-dev] Réseau introuvable pour l'événement : ${e.reseau}`)
      continue
    }
    try {
      const coords = CITY_COORDS[e.lieuVille]
      const created = await payload.create({
        collection: 'evenements',
        data: {
          titre: e.titre,
          reseau: reseauId,
          lieuVille: e.lieuVille,
          lieuAdresse: e.lieuAdresse,
          lieuCodePostal: e.lieuCodePostal,
          dateDebut: e.dateDebut,
          lienInscription: e.lienInscription || undefined,
          type: typeMap[e.type] ?? undefined,
          statut: 'publie',
          lieuLatitude: coords?.latitude,
          lieuLongitude: coords?.longitude,
        },
        overrideAccess: true,
      })
      console.log(`[seed-dev] Événement créé : ${e.titre} (id=${created.id})`)
    } catch (err) {
      console.error(`[seed-dev] Erreur création événement "${e.titre}":`, err)
    }
  }

  // ── 5. Partenaires (annonceurs) ────────────────────────────────────
  let partnerLogoId: number | string | undefined
  const existingLogo = await payload.find({
    collection: 'media',
    where: { alt: { equals: 'Logo partenaire demo' } },
    limit: 1,
    overrideAccess: true,
  })
  if (existingLogo.docs.length > 0) {
    partnerLogoId = existingLogo.docs[0].id
  } else {
    const logo = await payload.create({
      collection: 'media',
      data: { alt: 'Logo partenaire demo' },
      filePath: path.join(process.cwd(), 'public', 'img', 'logo.png'),
      overrideAccess: true,
    })
    partnerLogoId = logo.id
  }

  const partenairesData = [
    { nom: 'Banque Populaire', lien: 'https://www.banquepopulaire.fr', description: 'Partenaire bancaire des entrepreneurs et réseaux d\'affaires.' },
    { nom: 'Sage France', lien: 'https://www.sage.com/fr-fr', description: 'Logiciels de gestion pour les PME et TPE.' },
  ]

  for (const p of partenairesData) {
    const existing = await payload.find({
      collection: 'partenaires',
      where: { nom: { equals: p.nom } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      console.log(`[seed-dev] Partenaire existant : ${p.nom}`)
      continue
    }
    try {
      await payload.create({
        collection: 'partenaires',
        data: {
          nom: p.nom,
          logo: partnerLogoId,
          lien: p.lien,
          description: p.description,
          statut: 'actif',
        },
        overrideAccess: true,
      })
      console.log(`[seed-dev] Partenaire créé : ${p.nom}`)
    } catch (err) {
      console.error(`[seed-dev] Erreur création partenaire "${p.nom}":`, err)
    }
  }

  await payload.db.drizzle.execute(`
    UPDATE reseaux
       SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
     WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

    UPDATE reseauteurs
       SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
     WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

    UPDATE evenements
       SET geom = ST_SetSRID(ST_MakePoint(lieu_longitude, lieu_latitude), 4326)::geography
     WHERE lieu_latitude IS NOT NULL AND lieu_longitude IS NOT NULL;
  `)

  console.log('[seed-dev] Seed terminé. Les deux cartes sont non vides.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('[seed-dev] Erreur fatale:', err)
  process.exit(1)
})

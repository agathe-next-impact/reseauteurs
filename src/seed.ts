import { getPayload } from 'payload'
import config from './payload.config'

// ─── Referentiel ────────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: 'Objets publicitaires', value: 'objets-publicitaires', couleur: '#1e40af', ordre: 1 },
  { label: 'Textile promotionnel', value: 'textile-promotionnel', couleur: '#0284c7', ordre: 2 },
  { label: 'Cadeaux d\'entreprise', value: 'cadeaux-entreprise', couleur: '#dc2626', ordre: 3 },
  { label: 'Signalétique & PLV', value: 'signaletique-plv', couleur: '#ea580c', ordre: 4 },
  { label: 'Packaging personnalisé', value: 'packaging-personnalise', couleur: '#0d9488', ordre: 5 },
  { label: 'Impression numérique', value: 'impression-numerique', couleur: '#4f46e5', ordre: 6 },
]

const TYPES_EVENEMENT = [
  { label: 'Salon', value: 'salon', couleur: '#2563eb', ordre: 1 },
  { label: 'Portes ouvertes', value: 'portes-ouvertes', couleur: '#16a34a', ordre: 2 },
  { label: 'Formation', value: 'formation', couleur: '#d97706', ordre: 3 },
  { label: 'Webinaire', value: 'webinaire', couleur: '#0284c7', ordre: 4 },
]

// ─── Utilisateurs de demo ───────────────────────────────────────────────────

const DEMO_PASSWORD = 'demo1234'

const USERS: {
  email: string
  password: string
  role: 'admin' | 'fournisseur'
  plan: 'gratuit' | 'premium' | 'infinite'
  nomSociete: string
  ville: string
  planExpiresAt?: string
}[] = [
  // Admin
  { email: 'admin@panorama-pub.com', password: 'Admin12345!', role: 'admin', plan: 'infinite', nomSociete: 'Panorama Pub Admin', ville: 'Paris' },
  // Gratuit
  { email: 'demo-gratuit@panorama-pub.com', password: DEMO_PASSWORD, role: 'fournisseur', plan: 'gratuit', nomSociete: 'PromoBasic SARL', ville: 'Lyon' },
  { email: 'demo-gratuit2@panorama-pub.com', password: DEMO_PASSWORD, role: 'fournisseur', plan: 'gratuit', nomSociete: 'StartPub', ville: 'Rennes' },
  // Premium
  { email: 'demo-premium@panorama-pub.com', password: DEMO_PASSWORD, role: 'fournisseur', plan: 'premium', nomSociete: 'TextilePro SAS', ville: 'Paris', planExpiresAt: '2027-06-01T00:00:00.000Z' },
  { email: 'demo-premium2@panorama-pub.com', password: DEMO_PASSWORD, role: 'fournisseur', plan: 'premium', nomSociete: 'GoodiesPlus', ville: 'Bordeaux', planExpiresAt: '2027-06-01T00:00:00.000Z' },
  // Infinite
  { email: 'demo-infinite@panorama-pub.com', password: DEMO_PASSWORD, role: 'fournisseur', plan: 'infinite', nomSociete: 'MegaPub International', ville: 'Nice', planExpiresAt: '2027-06-01T00:00:00.000Z' },
  { email: 'demo-infinite2@panorama-pub.com', password: DEMO_PASSWORD, role: 'fournisseur', plan: 'infinite', nomSociete: 'LuxePromo SA', ville: 'Strasbourg', planExpiresAt: '2027-06-01T00:00:00.000Z' },
  // Infinite — membre groupe
  { email: 'demo-groupe1@panorama-pub.com', password: DEMO_PASSWORD, role: 'fournisseur', plan: 'infinite', nomSociete: 'Groupe Tricolore Paris', ville: 'Paris', planExpiresAt: '2027-06-01T00:00:00.000Z' },
  { email: 'demo-groupe2@panorama-pub.com', password: DEMO_PASSWORD, role: 'fournisseur', plan: 'premium', nomSociete: 'Groupe Tricolore Lyon', ville: 'Lyon', planExpiresAt: '2027-06-01T00:00:00.000Z' },
  { email: 'demo-groupe3@panorama-pub.com', password: DEMO_PASSWORD, role: 'fournisseur', plan: 'premium', nomSociete: 'Groupe Tricolore Marseille', ville: 'Marseille', planExpiresAt: '2027-06-01T00:00:00.000Z' },
  // Fiche suspendue (pour tester la suspension admin)
  { email: 'demo-suspendu@panorama-pub.com', password: DEMO_PASSWORD, role: 'fournisseur', plan: 'premium', nomSociete: 'FicheSuspendue SAS', ville: 'Grenoble', planExpiresAt: '2027-06-01T00:00:00.000Z' },
  // Plan expire (pour tester le cron downgrade-expires)
  { email: 'demo-expire@panorama-pub.com', password: DEMO_PASSWORD, role: 'fournisseur', plan: 'premium', nomSociete: 'PlanExpire SARL', ville: 'Dijon', planExpiresAt: '2025-01-15T00:00:00.000Z' },
]

// Fiches fournisseurs — enrichies selon le plan
const FICHES: Record<string, {
  raisonSociale: string
  ville: string
  codePostal?: string
  adresse?: string
  siteWeb?: string
  boutiqueEnLigne?: string
  lienDevis?: string
  emailContact?: string
  telephone?: string
  description?: string
  descriptionRSE?: string
  labelsRSEIndexes?: number[]
  catIndex: number
  catSecondairesIndexes?: number[]
  statut?: 'publiee' | 'suspendue'
}> = {
  'demo-gratuit@panorama-pub.com': {
    raisonSociale: 'PromoBasic SARL', ville: 'Lyon', catIndex: 0,
  },
  'demo-gratuit2@panorama-pub.com': {
    raisonSociale: 'StartPub', ville: 'Rennes', catIndex: 1,
  },
  'demo-premium@panorama-pub.com': {
    raisonSociale: 'TextilePro SAS', ville: 'Paris', codePostal: '75008', adresse: '55 Avenue Montaigne',
    siteWeb: 'https://textilepro.fr', boutiqueEnLigne: 'https://shop.textilepro.fr',
    emailContact: 'contact@textilepro.fr', telephone: '01 42 00 00 00',
    descriptionRSE: 'Engages depuis 2019 dans une demarche de textile responsable. Nos collections utilisent exclusivement du coton biologique certifie GOTS et des encres a base d\'eau.',
    labelsRSEIndexes: [4], // GOTS
    catIndex: 1, catSecondairesIndexes: [0, 3],
  },
  'demo-premium2@panorama-pub.com': {
    raisonSociale: 'GoodiesPlus', ville: 'Bordeaux', codePostal: '33000', adresse: '22 Cours de l\'Intendance',
    siteWeb: 'https://goodiesplus.fr', lienDevis: 'https://goodiesplus.fr/devis',
    emailContact: 'hello@goodiesplus.fr', telephone: '05 56 00 00 00',
    descriptionRSE: 'Nos goodies sont fabriques en France a partir de materiaux recycles. Membre du reseau Imprim\'Vert depuis 2021.',
    labelsRSEIndexes: [3], // Imprim'Vert
    catIndex: 0, catSecondairesIndexes: [2],
  },
  'demo-infinite@panorama-pub.com': {
    raisonSociale: 'MegaPub International', ville: 'Nice', codePostal: '06000', adresse: '10 Avenue Jean Medecin',
    siteWeb: 'https://megapub.fr', boutiqueEnLigne: 'https://boutique.megapub.fr', lienDevis: 'https://megapub.fr/devis-en-ligne',
    emailContact: 'pro@megapub.fr', telephone: '04 93 00 00 00',
    description: 'Leader national des objets publicitaires haut de gamme. Plus de 20 ans d\'experience dans la conception et la distribution de goodies premium, textile brode et cadeaux d\'entreprise personnalises. Nous accompagnons les grandes marques dans leurs campagnes promotionnelles.',
    descriptionRSE: 'Certifie EcoVadis Gold et ISO 14001 depuis 2020. Notre chaine d\'approvisionnement est auditee annuellement et nous compensons 100% de nos emissions carbone. Nous privilegions les fournisseurs locaux et les matieres premieres recyclees ou biosourcees.',
    labelsRSEIndexes: [0, 1, 5], // EcoVadis Gold, ISO 14001, FSC
    catIndex: 0, catSecondairesIndexes: [2, 4, 5],
  },
  'demo-infinite2@panorama-pub.com': {
    raisonSociale: 'LuxePromo SA', ville: 'Strasbourg', codePostal: '67000', adresse: '18 Place Kleber',
    siteWeb: 'https://luxepromo.fr', boutiqueEnLigne: 'https://luxepromo.fr/catalogue', lienDevis: 'https://luxepromo.fr/demande-devis',
    emailContact: 'info@luxepromo.fr', telephone: '03 88 00 00 00',
    description: 'Specialiste du cadeau d\'entreprise premium et de la signaletique evenementielle. Nos creations sur mesure subliment votre image de marque lors de vos evenements professionnels et salons.',
    descriptionRSE: 'Entreprise certifiee B Corp. Nous fabriquons nos cadeaux d\'entreprise a partir de bois FSC et de plastique recycle. Notre atelier est alimente a 100% par de l\'energie renouvelable.',
    labelsRSEIndexes: [2, 5], // B Corp, FSC
    catIndex: 2, catSecondairesIndexes: [3, 5],
  },
  'demo-groupe1@panorama-pub.com': {
    raisonSociale: 'Groupe Tricolore Paris', ville: 'Paris', codePostal: '75001', adresse: '12 Rue de Rivoli',
    siteWeb: 'https://tricolore-pub.fr', boutiqueEnLigne: 'https://shop.tricolore-pub.fr',
    emailContact: 'paris@tricolore-pub.fr', telephone: '01 40 00 00 00',
    description: 'Antenne parisienne du Groupe Tricolore, reseau national de distribution d\'objets publicitaires et textile promotionnel. Showroom permanent et service de personnalisation express.',
    descriptionRSE: 'Le Groupe Tricolore s\'engage pour une publicite responsable. Certification Imprim\'Vert sur tous nos sites de production et objectif zero dechet en 2027.',
    labelsRSEIndexes: [3, 4], // Imprim'Vert, GOTS
    catIndex: 0, catSecondairesIndexes: [1, 2],
  },
  'demo-groupe2@panorama-pub.com': {
    raisonSociale: 'Groupe Tricolore Lyon', ville: 'Lyon', codePostal: '69002', adresse: '45 Rue de la Republique',
    siteWeb: 'https://tricolore-pub.fr', emailContact: 'lyon@tricolore-pub.fr', telephone: '04 72 00 00 00',
    catIndex: 1, catSecondairesIndexes: [0],
  },
  'demo-groupe3@panorama-pub.com': {
    raisonSociale: 'Groupe Tricolore Marseille', ville: 'Marseille', codePostal: '13001', adresse: '8 La Canebiere',
    siteWeb: 'https://tricolore-pub.fr', emailContact: 'marseille@tricolore-pub.fr', telephone: '04 91 00 00 00',
    catIndex: 3, catSecondairesIndexes: [0],
  },
  // Fiche avec statut suspendue (pour tester la suspension admin)
  'demo-suspendu@panorama-pub.com': {
    raisonSociale: 'FicheSuspendue SAS', ville: 'Grenoble', codePostal: '38000', adresse: '3 Place Victor Hugo',
    siteWeb: 'https://fiche-suspendue.fr', emailContact: 'contact@fiche-suspendue.fr', telephone: '04 76 00 00 00',
    catIndex: 5, statut: 'suspendue',
  },
  'demo-expire@panorama-pub.com': {
    raisonSociale: 'PlanExpire SARL', ville: 'Dijon', codePostal: '21000', adresse: '10 Place de la Liberation',
    siteWeb: 'https://plan-expire.fr', emailContact: 'contact@plan-expire.fr', telephone: '03 80 00 00 00',
    catIndex: 0, statut: 'publiee',
  },
}

// Evenements (uniquement pour les Infinite)
const EVENEMENTS: {
  userEmail: string
  titre: string
  typeIndex: number
  dateDebut: string
  dateFin?: string
  lieuNom?: string
  lieuVille: string
  lieuAdresse?: string
  lieuCodePostal?: string
  descriptionCourte?: string
  statut?: 'publie' | 'archive'
}[] = [
  {
    userEmail: 'demo-infinite@panorama-pub.com',
    titre: 'Salon du Goodies 2026',
    typeIndex: 0,
    dateDebut: '2026-06-15T09:00:00.000Z',
    dateFin: '2026-06-17T18:00:00.000Z',
    lieuNom: 'Palais des Expositions',
    lieuVille: 'Nice', lieuAdresse: '1 Esplanade Kennedy', lieuCodePostal: '06300',
    descriptionCourte: 'Le rendez-vous annuel des professionnels de l\'objet publicitaire sur la Cote d\'Azur. Exposants, conferences et networking.',
  },
  {
    userEmail: 'demo-infinite@panorama-pub.com',
    titre: 'Formation Serigraphie Avancee',
    typeIndex: 2,
    dateDebut: '2026-09-10T09:00:00.000Z',
    lieuNom: 'Atelier MegaPub',
    lieuVille: 'Nice', lieuAdresse: '10 Avenue Jean Medecin', lieuCodePostal: '06000',
    descriptionCourte: 'Formation intensive de 2 jours aux techniques de serigraphie sur textile et objets.',
  },
  {
    userEmail: 'demo-infinite2@panorama-pub.com',
    titre: 'Portes Ouvertes LuxePromo',
    typeIndex: 1,
    dateDebut: '2026-05-20T10:00:00.000Z',
    dateFin: '2026-05-20T18:00:00.000Z',
    lieuNom: 'Showroom LuxePromo',
    lieuVille: 'Strasbourg', lieuAdresse: '18 Place Kleber', lieuCodePostal: '67000',
    descriptionCourte: 'Decouvrez nos nouvelles collections de cadeaux d\'entreprise et nos solutions de personnalisation.',
  },
  {
    userEmail: 'demo-groupe1@panorama-pub.com',
    titre: 'Webinaire Tendances Pub 2026',
    typeIndex: 3,
    dateDebut: '2026-07-03T14:00:00.000Z',
    lieuVille: 'Paris',
    descriptionCourte: 'Webinaire gratuit sur les tendances 2026 en objets publicitaires et textile promotionnel.',
  },
  // Evenement archive (date passee)
  {
    userEmail: 'demo-infinite2@panorama-pub.com',
    titre: 'Salon Textile Pro 2024 (archive)',
    typeIndex: 0,
    dateDebut: '2024-03-10T09:00:00.000Z',
    dateFin: '2024-03-12T18:00:00.000Z',
    lieuNom: 'Parc des Expositions',
    lieuVille: 'Strasbourg', lieuAdresse: '7 Place Adrien Zeller', lieuCodePostal: '67000',
    descriptionCourte: 'Edition 2024 du salon professionnel du textile promotionnel.',
    statut: 'archive',
  },
]

// Organisateur externe (pour evenements nationaux sans fournisseur)
const ORGANISATEUR_EXTERNE = {
  nom: 'Federation Francaise de la Pub',
  ville: 'Paris',
  siteWeb: 'https://federation-pub.fr',
  emailContact: 'contact@federation-pub.fr',
  description: 'Federation professionnelle regroupant les acteurs de la publicite par l\'objet en France.',
  statut: 'publiee' as const,
}

const EVENEMENT_NATIONAL = {
  titre: 'Congres National Pub par l\'Objet 2026',
  typeIndex: 0,
  dateDebut: '2026-11-20T09:00:00.000Z',
  dateFin: '2026-11-22T17:00:00.000Z',
  lieuNom: 'Palais des Congres',
  lieuVille: 'Paris',
  lieuAdresse: '2 Place de la Porte Maillot',
  lieuCodePostal: '75017',
  descriptionCourte: 'Le plus grand congres annuel de la filiere publicitaire en France. 200 exposants, 50 conferences.',
}

// Labels RSE
const LABELS_RSE = [
  { label: 'EcoVadis Gold', value: 'ecovadis-gold', ordre: 1 },
  { label: 'ISO 14001', value: 'iso-14001', ordre: 2 },
  { label: 'B Corp', value: 'b-corp', ordre: 3 },
  { label: 'Imprim\'Vert', value: 'imprim-vert', ordre: 4 },
  { label: 'GOTS', value: 'gots', ordre: 5 },
  { label: 'FSC', value: 'fsc', ordre: 6 },
]

// ─── Seed logic ─────────────────────────────────────────────────────────────

async function seed() {
  const payload = await getPayload({ config })
  console.log('--- Seed: demarrage ---')

  // 1. Categories d'activite
  const catIds: number[] = []
  for (const cat of CATEGORIES) {
    const existing = await payload.find({
      collection: 'categories-activite',
      where: { value: { equals: cat.value } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      catIds.push(existing.docs[0].id)
      console.log(`  [categories-activite] existe deja: ${cat.label}`)
    } else {
      const doc = await payload.create({ collection: 'categories-activite', data: cat, overrideAccess: true })
      catIds.push(doc.id)
      console.log(`  [categories-activite] cree: ${cat.label}`)
    }
  }

  // 2. Types d'evenement
  const typeIds: number[] = []
  for (const t of TYPES_EVENEMENT) {
    const existing = await payload.find({
      collection: 'types-evenement',
      where: { value: { equals: t.value } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      typeIds.push(existing.docs[0].id)
      console.log(`  [types-evenement] existe deja: ${t.label}`)
    } else {
      const doc = await payload.create({ collection: 'types-evenement', data: t, overrideAccess: true })
      typeIds.push(doc.id)
      console.log(`  [types-evenement] cree: ${t.label}`)
    }
  }

  // 3. Labels RSE (sans logo en seed — a ajouter manuellement via l'admin)
  const rseIds: number[] = []
  for (const rse of LABELS_RSE) {
    const existing = await payload.find({
      collection: 'labels-rse',
      where: { value: { equals: rse.value } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      rseIds.push(existing.docs[0].id)
      console.log(`  [labels-rse] existe deja: ${rse.label}`)
    } else {
      const doc = await payload.create({
        collection: 'labels-rse',
        data: rse,
        overrideAccess: true,
      })
      rseIds.push(doc.id)
      console.log(`  [labels-rse] cree: ${rse.label}`)
    }
  }

  // 4. Utilisateurs + fiches
  const userMap: Record<string, number> = {}
  const fournisseurMap: Record<string, number> = {}

  for (const u of USERS) {
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: u.email } },
      limit: 1,
      overrideAccess: true,
    })

    let userId: number
    if (existing.docs.length > 0) {
      userId = existing.docs[0].id
      // Update plan if needed
      await payload.update({
        collection: 'users',
        id: userId,
        data: { plan: u.plan, role: u.role, ...(u.planExpiresAt ? { planExpiresAt: u.planExpiresAt } : {}) },
        overrideAccess: true,
      })
      console.log(`  [users] existe deja: ${u.email} -> plan mis a jour: ${u.plan}`)
    } else {
      const doc = await payload.create({
        collection: 'users',
        data: {
          email: u.email,
          password: u.password,
          role: u.role,
          plan: u.plan,
          nomSociete: u.nomSociete,
          ville: u.ville,
          _verified: true,
          ...(u.planExpiresAt ? { planExpiresAt: u.planExpiresAt } : {}),
        },
        overrideAccess: true,
        disableVerificationEmail: true,
      })
      userId = doc.id
      console.log(`  [users] cree: ${u.email} (${u.plan})`)
    }
    userMap[u.email] = userId

    // Fiche fournisseur (1:1)
    if (u.role === 'fournisseur' && FICHES[u.email]) {
      const fiche = FICHES[u.email]
      const existingFiche = await payload.find({
        collection: 'fournisseurs',
        where: { user: { equals: userId } },
        limit: 1,
        overrideAccess: true,
      })

      const ficheStatut = fiche.statut ?? 'publiee'
      const ficheData = {
        user: userId,
        raisonSociale: fiche.raisonSociale,
        ville: fiche.ville,
        activitePrincipale: catIds[fiche.catIndex],
        ...(fiche.catSecondairesIndexes ? { activitesSecondaires: fiche.catSecondairesIndexes.map((i) => catIds[i]) } : {}),
        statut: ficheStatut as 'publiee' | 'suspendue',
        ...(fiche.codePostal ? { codePostal: fiche.codePostal } : {}),
        ...(fiche.adresse ? { adresse: fiche.adresse } : {}),
        ...(fiche.siteWeb ? { siteWeb: fiche.siteWeb } : {}),
        ...(fiche.boutiqueEnLigne ? { boutiqueEnLigne: fiche.boutiqueEnLigne } : {}),
        ...(fiche.lienDevis ? { lienDevis: fiche.lienDevis } : {}),
        ...(fiche.emailContact ? { emailContact: fiche.emailContact } : {}),
        ...(fiche.telephone ? { telephone: fiche.telephone } : {}),
        ...(fiche.description ? { description: fiche.description } : {}),
        ...(fiche.descriptionRSE ? { descriptionRSE: fiche.descriptionRSE } : {}),
        ...(fiche.labelsRSEIndexes ? { labelsRSE: fiche.labelsRSEIndexes.map((i) => rseIds[i]) } : {}),
      }

      if (existingFiche.docs.length > 0) {
        await payload.update({
          collection: 'fournisseurs',
          id: existingFiche.docs[0].id,
          data: ficheData,
          overrideAccess: true,
        })
        fournisseurMap[u.email] = existingFiche.docs[0].id
        console.log(`  [fournisseurs] mis a jour: ${fiche.raisonSociale}`)
      } else {
        const doc = await payload.create({
          collection: 'fournisseurs',
          data: ficheData,
          overrideAccess: true,
        })
        fournisseurMap[u.email] = doc.id
        console.log(`  [fournisseurs] cree: ${fiche.raisonSociale}`)
      }
    }
  }

  // 5. Groupe d'affiliation
  const groupOwnerEmail = 'demo-groupe1@panorama-pub.com'
  const groupMembers = ['demo-groupe1@panorama-pub.com', 'demo-groupe2@panorama-pub.com', 'demo-groupe3@panorama-pub.com']

  const existingGroupe = await payload.find({
    collection: 'groupes',
    where: { nom: { equals: 'Groupe Tricolore' } },
    limit: 1,
    overrideAccess: true,
  })

  let groupeId: number
  if (existingGroupe.docs.length > 0) {
    groupeId = existingGroupe.docs[0].id
    console.log(`  [groupes] existe deja: Groupe Tricolore`)
  } else {
    const doc = await payload.create({
      collection: 'groupes',
      data: {
        nom: 'Groupe Tricolore',
        owner: userMap[groupOwnerEmail],
        palierActuel: '5',
      } as any,
      overrideAccess: true,
    })
    groupeId = doc.id
    console.log(`  [groupes] cree: Groupe Tricolore (code: ${doc.code})`)
  }

  // Rattacher les membres au groupe
  for (const email of groupMembers) {
    await payload.update({
      collection: 'users',
      id: userMap[email],
      data: { groupe: groupeId },
      overrideAccess: true,
    })
    console.log(`  [users] rattache au groupe: ${email}`)
  }

  // 6. Evenements
  for (const ev of EVENEMENTS) {
    const fournisseurId = fournisseurMap[ev.userEmail]
    if (!fournisseurId) continue

    const existingEv = await payload.find({
      collection: 'evenements',
      where: {
        and: [
          { titre: { equals: ev.titre } },
          { fournisseur: { equals: fournisseurId } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })

    if (existingEv.docs.length > 0) {
      console.log(`  [evenements] existe deja: ${ev.titre}`)
      continue
    }

    await payload.create({
      collection: 'evenements',
      data: {
        fournisseur: fournisseurId,
        titre: ev.titre,
        type: typeIds[ev.typeIndex],
        dateDebut: ev.dateDebut,
        ...(ev.dateFin ? { dateFin: ev.dateFin } : {}),
        ...(ev.lieuNom ? { lieuNom: ev.lieuNom } : {}),
        lieuVille: ev.lieuVille,
        ...(ev.lieuAdresse ? { lieuAdresse: ev.lieuAdresse } : {}),
        ...(ev.lieuCodePostal ? { lieuCodePostal: ev.lieuCodePostal } : {}),
        ...(ev.descriptionCourte ? { descriptionCourte: ev.descriptionCourte } : {}),
        statut: ev.statut ?? 'publie',
      },
      overrideAccess: true,
    })
    console.log(`  [evenements] cree: ${ev.titre} (${ev.statut ?? 'publie'})`)
  }

  // 7. Organisateur externe + evenement national
  const existingOrg = await payload.find({
    collection: 'organisateurs-evenements',
    where: { nom: { equals: ORGANISATEUR_EXTERNE.nom } },
    limit: 1,
    overrideAccess: true,
  })

  let orgId: number
  if (existingOrg.docs.length > 0) {
    orgId = existingOrg.docs[0].id
    console.log(`  [organisateurs-evenements] existe deja: ${ORGANISATEUR_EXTERNE.nom}`)
  } else {
    const doc = await payload.create({
      collection: 'organisateurs-evenements',
      data: ORGANISATEUR_EXTERNE,
      overrideAccess: true,
    })
    orgId = doc.id
    console.log(`  [organisateurs-evenements] cree: ${ORGANISATEUR_EXTERNE.nom}`)
  }

  // Evenement national (organisateur externe, sans fournisseur)
  const existingNational = await payload.find({
    collection: 'evenements',
    where: { titre: { equals: EVENEMENT_NATIONAL.titre } },
    limit: 1,
    overrideAccess: true,
  })

  if (existingNational.docs.length > 0) {
    console.log(`  [evenements] existe deja: ${EVENEMENT_NATIONAL.titre}`)
  } else {
    await payload.create({
      collection: 'evenements',
      data: {
        organisateurExterne: orgId,
        titre: EVENEMENT_NATIONAL.titre,
        type: typeIds[EVENEMENT_NATIONAL.typeIndex],
        dateDebut: EVENEMENT_NATIONAL.dateDebut,
        dateFin: EVENEMENT_NATIONAL.dateFin,
        lieuNom: EVENEMENT_NATIONAL.lieuNom,
        lieuVille: EVENEMENT_NATIONAL.lieuVille,
        lieuAdresse: EVENEMENT_NATIONAL.lieuAdresse,
        lieuCodePostal: EVENEMENT_NATIONAL.lieuCodePostal,
        descriptionCourte: EVENEMENT_NATIONAL.descriptionCourte,
        statut: 'publie',
      },
      overrideAccess: true,
    })
    console.log(`  [evenements] cree: ${EVENEMENT_NATIONAL.titre} (organisateur externe)`)
  }

  console.log('--- Seed: termine ---')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})

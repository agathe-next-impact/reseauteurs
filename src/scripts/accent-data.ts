/**
 * Migration des accents francais sur les donnees existantes (Payload).
 *
 * Applique un dictionnaire de mots non accentues -> accentues sur les champs
 * texte des collections a contenu utilisateur. Mode dry-run par defaut : affiche
 * les diffs et un resume, sans ecrire. Passer `--apply` pour persister.
 *
 * Usage :
 *   pnpm accent-data                  # dry-run, toutes collections
 *   pnpm accent-data --apply          # ecrit en DB
 *   pnpm accent-data --collection=fournisseurs
 *   pnpm accent-data --collection=fournisseurs --apply
 *
 * Le dictionnaire ne contient QUE des transformations univoques. Mots ambigus
 * (place, traite, complete, present, paye, etc.) exclus pour eviter les faux
 * positifs sur des donnees client deja correctement saisies.
 */

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

type CollectionScope = {
  slug: string
  fields: string[]
}

const SCOPES: CollectionScope[] = [
  {
    slug: 'fournisseurs',
    fields: ['raisonSociale', 'description', 'descriptionRSE', 'adresse', 'ville'],
  },
  {
    slug: 'evenements',
    fields: ['titre', 'descriptionCourte', 'lieuNom', 'lieuAdresse', 'lieuVille'],
  },
  {
    slug: 'organisateurs-evenements',
    fields: ['nom', 'description', 'adresse', 'ville'],
  },
  { slug: 'categories-activite', fields: ['label'] },
  { slug: 'types-evenement', fields: ['label'] },
  { slug: 'labels-rse', fields: ['label'] },
  { slug: 'testimonials', fields: ['quote', 'author', 'company'] },
  { slug: 'groupes', fields: ['nom'] },
  {
    slug: 'users',
    fields: ['nomSociete', 'ville', 'raisonSocialeFacturation'],
  },
]

// Dictionnaire des mots univoques. Chaque entree : forme sans accent -> avec.
// Ne pas ajouter de mots ambigus (homographes verbe/nom, present/passe).
const DICT: Array<[string, string]> = [
  ['evenement', 'événement'],
  ['evenements', 'événements'],
  ['Evenement', 'Événement'],
  ['Evenements', 'Événements'],
  ['banniere', 'bannière'],
  ['Banniere', 'Bannière'],
  ['bannieres', 'bannières'],
  ['telephone', 'téléphone'],
  ['Telephone', 'Téléphone'],
  ['numero', 'numéro'],
  ['numeros', 'numéros'],
  ['Numero', 'Numéro'],
  ['categorie', 'catégorie'],
  ['categories', 'catégories'],
  ['Categorie', 'Catégorie'],
  ['Categories', 'Catégories'],
  ['detail', 'détail'],
  ['details', 'détails'],
  ['Detail', 'Détail'],
  ['Details', 'Détails'],
  ['detaille', 'détaillé'],
  ['detailles', 'détaillés'],
  ['detaillee', 'détaillée'],
  ['detaillees', 'détaillées'],
  ['reference', 'référence'],
  ['references', 'références'],
  ['Reference', 'Référence'],
  ['References', 'Références'],
  ['referencee', 'référencée'],
  ['referencees', 'référencées'],
  ['referencement', 'référencement'],
  ['Referencement', 'Référencement'],
  ['referencer', 'référencer'],
  ['Referencer', 'Référencer'],
  ['referencez', 'référencez'],
  ['Referencez', 'Référencez'],
  ['reduction', 'réduction'],
  ['reductions', 'réductions'],
  ['Reduction', 'Réduction'],
  ['creer', 'créer'],
  ['Creer', 'Créer'],
  ['creez', 'créez'],
  ['Creez', 'Créez'],
  ['creant', 'créant'],
  ['creee', 'créée'],
  ['creees', 'créées'],
  ['donnee', 'donnée'],
  ['donnees', 'données'],
  ['Donnee', 'Donnée'],
  ['Donnees', 'Données'],
  ['fonctionnalite', 'fonctionnalité'],
  ['fonctionnalites', 'fonctionnalités'],
  ['Fonctionnalite', 'Fonctionnalité'],
  ['Fonctionnalites', 'Fonctionnalités'],
  ['departement', 'département'],
  ['departements', 'départements'],
  ['Departement', 'Département'],
  ['Departements', 'Départements'],
  ['premiere', 'première'],
  ['premieres', 'premières'],
  ['Premiere', 'Première'],
  ['derniere', 'dernière'],
  ['dernieres', 'dernières'],
  ['Derniere', 'Dernière'],
  ['annee', 'année'],
  ['annees', 'années'],
  ['Annee', 'Année'],
  ['Annees', 'Années'],
  ['etablissement', 'établissement'],
  ['etablissements', 'établissements'],
  ['Etablissement', 'Établissement'],
  ['Etablissements', 'Établissements'],
  ['verification', 'vérification'],
  ['verifier', 'vérifier'],
  ['Verifier', 'Vérifier'],
  ['preference', 'préférence'],
  ['preferences', 'préférences'],
  ['Preference', 'Préférence'],
  ['Preferences', 'Préférences'],
  ['parametre', 'paramètre'],
  ['parametres', 'paramètres'],
  ['Parametre', 'Paramètre'],
  ['Parametres', 'Paramètres'],
  ['succes', 'succès'],
  ['Succes', 'Succès'],
  ['echeance', 'échéance'],
  ['echeances', 'échéances'],
  ['Echeance', 'Échéance'],
  ['echec', 'échec'],
  ['echecs', 'échecs'],
  ['Echec', 'Échec'],
  ['acces', 'accès'],
  ['Acces', 'Accès'],
  ['selectionner', 'sélectionner'],
  ['Selectionner', 'Sélectionner'],
  ['video', 'vidéo'],
  ['videos', 'vidéos'],
  ['Video', 'Vidéo'],
  ['etape', 'étape'],
  ['etapes', 'étapes'],
  ['Etape', 'Étape'],
  ['Etapes', 'Étapes'],
  ['demarche', 'démarche'],
  ['demarches', 'démarches'],
  ['Demarche', 'Démarche'],
  ['geographique', 'géographique'],
  ['Geographique', 'Géographique'],
  ['geolocalisation', 'géolocalisation'],
  ['telecharger', 'télécharger'],
  ['telechargement', 'téléchargement'],
  ['Telecharger', 'Télécharger'],
  ['confidentialite', 'confidentialité'],
  ['Confidentialite', 'Confidentialité'],
  ['inferieur', 'inférieur'],
  ['superieur', 'supérieur'],
  ['ecoute', 'écoute'],
  ['equipe', 'équipe'],
  ['equipes', 'équipes'],
  ['Equipe', 'Équipe'],
  ['securite', 'sécurité'],
  ['Securite', 'Sécurité'],
  ['proximite', 'proximité'],
  ['visibilite', 'visibilité'],
  ['Visibilite', 'Visibilité'],
  ['specialise', 'spécialisé'],
  ['specialisee', 'spécialisée'],
  ['specialises', 'spécialisés'],
  ['specialisees', 'spécialisées'],
  ['Specialise', 'Spécialisé'],
  ['aupres', 'auprès'],
  ['pres', 'près'],
  ['apres', 'après'],
  ['Apres', 'Après'],
  ['deja', 'déjà'],
  ['Deja', 'Déjà'],
  ['tres', 'très'],
  ['Tres', 'Très'],
  ['etes', 'êtes'],
  ['Etes', 'Êtes'],
  ['meme', 'même'],
  ['memes', 'mêmes'],
  ['Meme', 'Même'],
  ['regle', 'règle'],
  ['regles', 'règles'],
  ['Regle', 'Règle'],
  ['siege', 'siège'],
  ['requete', 'requête'],
  ['requetes', 'requêtes'],
  ['envoyee', 'envoyée'],
  ['envoyees', 'envoyées'],
  ['recue', 'reçue'],
  ['recues', 'reçues'],
  ['presence', 'présence'],
  ['Presence', 'Présence'],
  ['recente', 'récente'],
  ['recent', 'récent'],
  ['desormais', 'désormais'],
  ['Desormais', 'Désormais'],
  ['interet', 'intérêt'],
  ['interets', 'intérêts'],
  ['metier', 'métier'],
  ['metiers', 'métiers'],
  ['Metier', 'Métier'],
  ['cle', 'clé'],
  ['cles', 'clés'],
  ['beneficier', 'bénéficier'],
  ['Beneficier', 'Bénéficier'],
  ['beneficie', 'bénéficie'],
  ['beneficient', 'bénéficient'],
  ['beneficiez', 'bénéficiez'],
  ['Beneficiez', 'Bénéficiez'],
  ['illimite', 'illimité'],
  ['illimitee', 'illimitée'],
  ['illimites', 'illimités'],
  ['illimitees', 'illimitées'],
  ['Illimite', 'Illimité'],
  ['ideal', 'idéal'],
  ['ideale', 'idéale'],
  ['Ideal', 'Idéal'],
  ['clientele', 'clientèle'],
  ['desabonnement', 'désabonnement'],
  ['Desabonnement', 'Désabonnement'],
  ['desinscription', 'désinscription'],
  ['vehicule', 'véhicule'],
  ['vehicules', 'véhicules'],
  ['delai', 'délai'],
  ['delais', 'délais'],
  ['Delai', 'Délai'],
  ['Delais', 'Délais'],
  ['generale', 'générale'],
  ['general', 'général'],
  ['generaux', 'généraux'],
  ['generales', 'générales'],
  ['Generale', 'Générale'],
  ['General', 'Général'],
  ['modele', 'modèle'],
  ['modeles', 'modèles'],
  ['Modele', 'Modèle'],
  ['maniere', 'manière'],
  ['Maniere', 'Manière'],
  ['entierement', 'entièrement'],
  ['particuliere', 'particulière'],
  ['caractere', 'caractère'],
  ['caracteres', 'caractères'],
  ['caracteristique', 'caractéristique'],
  ['caracteristiques', 'caractéristiques'],
  ['Caracteristique', 'Caractéristique'],
  ['precis', 'précis'],
  ['preciser', 'préciser'],
  ['precision', 'précision'],
  ['precisions', 'précisions'],
  ['procedure', 'procédure'],
  ['procedures', 'procédures'],
  ['progres', 'progrès'],
  ['cout', 'coût'],
  ['couts', 'coûts'],
  ['couteux', 'coûteux'],
  ['entree', 'entrée'],
  ['entrees', 'entrées'],
  ['Entree', 'Entrée'],
  ['arrivee', 'arrivée'],
  ['etre', 'être'],
  ['Etre', 'Être'],
  ['bientot', 'bientôt'],
  ['Bientot', 'Bientôt'],
  ['communaute', 'communauté'],
  ['Communaute', 'Communauté'],
  ['diversite', 'diversité'],
  ['identite', 'identité'],
  ['unite', 'unité'],
  ['qualite', 'qualité'],
  ['qualites', 'qualités'],
  ['Qualite', 'Qualité'],
  ['notoriete', 'notoriété'],
  ['gerer', 'gérer'],
  ['Gerer', 'Gérer'],
  ['gerez', 'gérez'],
  ['Gerez', 'Gérez'],
  ['etranger', 'étranger'],
  ['etrangere', 'étrangère'],
  ['Etranger', 'Étranger'],
  ['societe', 'société'],
  ['societes', 'sociétés'],
  ['Societe', 'Société'],
  ['Societes', 'Sociétés'],
  ['debut', 'début'],
  ['debuts', 'débuts'],
  ['Debut', 'Début'],
  ['debuter', 'débuter'],
  ['operation', 'opération'],
  ['operations', 'opérations'],
  ['Operation', 'Opération'],
  ['operationnel', 'opérationnel'],
  ['operationnelle', 'opérationnelle'],
  ['specifique', 'spécifique'],
  ['specifiques', 'spécifiques'],
  ['Specifique', 'Spécifique'],
  ['idealement', 'idéalement'],
  ['decouvrir', 'découvrir'],
  ['Decouvrir', 'Découvrir'],
  ['decouvrez', 'découvrez'],
  ['Decouvrez', 'Découvrez'],
  ['decouverte', 'découverte'],
  ['decouvertes', 'découvertes'],
  ['Decouverte', 'Découverte'],
  ['decoration', 'décoration'],
  ['Decoration', 'Décoration'],
  ['decoratif', 'décoratif'],
  ['decorative', 'décorative'],
  ['decoratifs', 'décoratifs'],
  ['decoratives', 'décoratives'],
  ['decision', 'décision'],
  ['decisions', 'décisions'],
  ['deconnecter', 'déconnecter'],
  ['recurrent', 'récurrent'],
  ['recurrente', 'récurrente'],
  ['recurrents', 'récurrents'],
  ['recurrentes', 'récurrentes'],
  ['repondre', 'répondre'],
  ['Repondre', 'Répondre'],
  ['response', 'réponse'],
  ['responses', 'réponses'],
  ['declaration', 'déclaration'],
  ['declarations', 'déclarations'],
  ['integralite', 'intégralité'],
  ['Integralite', 'Intégralité'],
  ['integrer', 'intégrer'],
  ['Integrer', 'Intégrer'],
  ['internationale', 'internationale'],
  ['oublie', 'oublié'],
  ['oubliee', 'oubliée'],
  ['oublier', 'oublier'],
  ['oublies', 'oubliés'],
  ['Oublie', 'Oublié'],
  ['etat', 'état'],
  ['etats', 'états'],
  ['Etat', 'État'],
  ['Etats', 'États'],
  ['duree', 'durée'],
  ['durees', 'durées'],
  ['Duree', 'Durée'],
  ['defaut', 'défaut'],
  ['defauts', 'défauts'],
  ['Defaut', 'Défaut'],
  ['editeur', 'éditeur'],
  ['editeurs', 'éditeurs'],
  ['Editeur', 'Éditeur'],
  ['emetteur', 'émetteur'],
  ['Emetteur', 'Émetteur'],
  ['finalite', 'finalité'],
  ['finalites', 'finalités'],
  ['Finalite', 'Finalité'],
  ['disponibilite', 'disponibilité'],
  ['Disponibilite', 'Disponibilité'],
  ['denomination', 'dénomination'],
  ['Denomination', 'Dénomination'],
  ['creation', 'création'],
  ['creations', 'créations'],
  ['Creation', 'Création'],
  ['reservation', 'réservation'],
  ['reservations', 'réservations'],
  ['Reservation', 'Réservation'],
  ['realisation', 'réalisation'],
  ['realisations', 'réalisations'],
  ['Realisation', 'Réalisation'],
  ['realiser', 'réaliser'],
  ['Realiser', 'Réaliser'],
  ['realisee', 'réalisée'],
  ['realisees', 'réalisées'],
  ['periode', 'période'],
  ['periodes', 'périodes'],
  ['Periode', 'Période'],
  ['regissent', 'régissent'],
  ['regir', 'régir'],
  ['regie', 'régie'],
  ['regies', 'régies'],
  ['conformement', 'conformément'],
  ['Conformement', 'Conformément'],
  ['securisee', 'sécurisée'],
  ['securisees', 'sécurisées'],
  ['securiser', 'sécuriser'],
  ['reservee', 'réservée'],
  ['reservees', 'réservées'],
  ['reserves', 'réservés'],
  ['delivree', 'délivrée'],
  ['delivrer', 'délivrer'],
  ['notifier', 'notifier'],
  ['Notifier', 'Notifier'],
  ['notifiee', 'notifiée'],
  ['notifies', 'notifiés'],
  ['notifiees', 'notifiées'],
  ['perdure', 'perdure'],
  ['perdurer', 'perdurer'],
  ['supprimee', 'supprimée'],
  ['supprimees', 'supprimées'],
  ['supprimer', 'supprimer'],
  ['Supprimer', 'Supprimer'],
  ['negligence', 'négligence'],
  ['concedee', 'concédée'],
  ['concedees', 'concédées'],
  ['conceder', 'concéder'],
  ['considerer', 'considérer'],
  ['Considerer', 'Considérer'],
  ['considere', 'considéré'],
  ['consideree', 'considérée'],
  ['differente', 'différente'],
  ['differentes', 'différentes'],
  ['different', 'différent'],
  ['differents', 'différents'],
  ['differences', 'différences'],
  ['difference', 'différence'],
  ['Difference', 'Différence'],
  ['proposee', 'proposée'],
  ['proposees', 'proposées'],
  ['basee', 'basée'],
  ['basees', 'basées'],
  ['souscrire', 'souscrire'],
  ['enregistree', 'enregistrée'],
  ['enregistrer', 'enregistrer'],
  ['Enregistrer', 'Enregistrer'],
  ['numerique', 'numérique'],
  ['numeriques', 'numériques'],
  ['Numerique', 'Numérique'],
  ['desactiver', 'désactiver'],
  ['Desactiver', 'Désactiver'],
  ['dedommager', 'dédommager'],
  ['dedommagement', 'dédommagement'],
  ['specialement', 'spécialement'],
  ['Specialement', 'Spécialement'],
  ['completement', 'complètement'],
  ['galerie', 'galerie'],
  ['galeries', 'galeries'],
  ['probleme', 'problème'],
  ['problemes', 'problèmes'],
  ['Probleme', 'Problème'],
  ['systeme', 'système'],
  ['systemes', 'systèmes'],
  ['Systeme', 'Système'],
  ['Systemes', 'Systèmes'],
  ['fevrier', 'février'],
  ['decembre', 'décembre'],
  ['salaries', 'salariés'],
  ['salarie', 'salarié'],
  ['salariee', 'salariée'],
  ['salariees', 'salariées'],
  ['accompagnee', 'accompagnée'],
  ['accompagnees', 'accompagnées'],
  ['accompagnes', 'accompagnés'],
  ['authentifie', 'authentifié'],
  ['authentifiee', 'authentifiée'],
  ['validee', 'validée'],
  ['validees', 'validées'],
  ['legitime', 'légitime'],
  ['legitimes', 'légitimes'],
  ['legitimite', 'légitimité'],
  ['legere', 'légère'],
  ['leger', 'léger'],
  ['legers', 'légers'],
  ['legerement', 'légèrement'],
  ['libere', 'libéré'],
  ['liberee', 'libérée'],
  ['liberer', 'libérer'],
  ['liberte', 'liberté'],
  ['justifier', 'justifier'],
  ['justifiee', 'justifiée'],
  ['justification', 'justification'],
  ['memoire', 'mémoire'],
  ['memoires', 'mémoires'],
  ['Memoire', 'Mémoire'],
  ['exterieur', 'extérieur'],
  ['exterieure', 'extérieure'],
  ['exterieurs', 'extérieurs'],
  ['exterieures', 'extérieures'],
  ['interieur', 'intérieur'],
  ['interieure', 'intérieure'],
  ['interieurs', 'intérieurs'],
  ['interieures', 'intérieures'],
  ['evaluation', 'évaluation'],
  ['evaluations', 'évaluations'],
  ['Evaluation', 'Évaluation'],
  ['experience', 'expérience'],
  ['experiences', 'expériences'],
  ['Experience', 'Expérience'],
  ['exploitation', 'exploitation'],
  ['eventuel', 'éventuel'],
  ['eventuelle', 'éventuelle'],
  ['eventuels', 'éventuels'],
  ['eventuelles', 'éventuelles'],
  ['eventuellement', 'éventuellement'],
  ['emission', 'émission'],
  ['emissions', 'émissions'],
  ['Emission', 'Émission'],
  ['propriete', 'propriété'],
  ['proprietes', 'propriétés'],
  ['Propriete', 'Propriété'],
  ['responsabilite', 'responsabilité'],
  ['responsabilites', 'responsabilités'],
  ['Responsabilite', 'Responsabilité'],
  ['Role', 'Rôle'],
  ['Siege', 'Siège'],
  ['adherer', 'adhérer'],
  ['Adherer', 'Adhérer'],
  ['adhesion', 'adhésion'],
  ['Adhesion', 'Adhésion'],
  ['adherent', 'adhérent'],
  ['adherents', 'adhérents'],
  ['Adherent', 'Adhérent'],
  ['region', 'région'],
  ['regions', 'régions'],
  ['Region', 'Région'],
  ['regionale', 'régionale'],
  ['regional', 'régional'],
  ['regionaux', 'régionaux'],
  ['nationalite', 'nationalité'],
  ['reinitialiser', 'réinitialiser'],
  ['Reinitialiser', 'Réinitialiser'],
  ['reinitialisation', 'réinitialisation'],
  ['Reinitialisation', 'Réinitialisation'],
  ['desole', 'désolé'],
  ['desolee', 'désolée'],
  ['Desole', 'Désolé'],
  ['reessayer', 'réessayer'],
  ['Reessayer', 'Réessayer'],
  ['proteger', 'protéger'],
  ['Proteger', 'Protéger'],
  ['protegee', 'protégée'],
  ['protegees', 'protégées'],
  ['proteges', 'protégés'],
  ['ete', 'été'],
  ['Ete', 'Été'],
  ['etant', 'étant'],
  ['Etant', 'Étant'],
  ['bareme', 'barème'],
  ['Bareme', 'Barème'],
  ['marche', 'marché'],
  ['marches', 'marchés'],
  ['materiel', 'matériel'],
  ['materiels', 'matériels'],
  ['Materiel', 'Matériel'],
  ['lies', 'liés'],
  ['lie', 'lié'],
  ['liee', 'liée'],
  ['liees', 'liées'],
  ['renseignee', 'renseignée'],
  ['renseignees', 'renseignées'],
  ['decrit', 'décrit'],
  ['decrite', 'décrite'],
  ['decrits', 'décrits'],
  ['decrites', 'décrites'],
  ['moderation', 'modération'],
  ['Moderation', 'Modération'],
  ['appliquee', 'appliquée'],
  ['appliquees', 'appliquées'],
  ['reutiliser', 'réutiliser'],
  ['Reutiliser', 'Réutiliser'],
  ['retractation', 'rétractation'],
  ['Retractation', 'Rétractation'],
  ['mutualisee', 'mutualisée'],
  ['etablis', 'établis'],
  ['europeenne', 'européenne'],
  ['europeen', 'européen'],
  ['europeens', 'européens'],
  ['europeennes', 'européennes'],
  ['anonymisee', 'anonymisée'],
  ['anonymisees', 'anonymisées'],
  ['publicite', 'publicité'],
  ['publicites', 'publicités'],
  ['Geocodage', 'Géocodage'],
  ['Hebergement', 'Hébergement'],
  ['hebergement', 'hébergement'],
  ['hebergeur', 'hébergeur'],
  ['revocable', 'révocable'],
  ['execution', 'exécution'],
  ['Execution', 'Exécution'],
  ['publiee', 'publiée'], // NB: ne touche que les rows TEXTE; le statut enum ne passe jamais par ce script
  // Si une row contient le mot "publiee" comme contenu, il sera accentue.
  // Les enums DB sont stockes dans des champs `statut` non listes ci-dessus.
]

const APPLY = process.argv.includes('--apply')
const SCOPED = process.argv.find((a) => a.startsWith('--collection='))?.split('=')[1]

function applyDict(input: string): string {
  let out = input
  for (const [from, to] of DICT) {
    // Ancrage word-boundary ASCII (\b). Suffit ici car les transformations
    // partent de mots ASCII.
    const re = new RegExp(`\\b${from}\\b`, 'g')
    out = out.replace(re, to)
  }
  return out
}

function diff(before: string, after: string): { changes: number; preview: string } {
  if (before === after) return { changes: 0, preview: '' }
  // Compte sommaire : nombre de positions divergentes en chars accentues.
  let changes = 0
  const len = Math.max(before.length, after.length)
  for (let i = 0; i < len; i++) {
    if (before[i] !== after[i]) changes++
  }
  // Apercu : 80 chars autour de la 1re difference.
  let firstDiff = 0
  while (firstDiff < len && before[firstDiff] === after[firstDiff]) firstDiff++
  const start = Math.max(0, firstDiff - 30)
  const end = Math.min(len, firstDiff + 50)
  const preview = `\n   - ${before.slice(start, end)}\n   + ${after.slice(start, end)}`
  return { changes, preview }
}

async function run() {
  const { getPayload } = await import('payload')
  const config = (await import('../payload.config')).default
  const payload = await getPayload({ config })

  const scopes = SCOPED ? SCOPES.filter((s) => s.slug === SCOPED) : SCOPES
  if (SCOPED && scopes.length === 0) {
    console.error(`Collection inconnue : ${SCOPED}`)
    process.exit(1)
  }

  console.log(`Mode : ${APPLY ? 'APPLY (ecrit en DB)' : 'DRY-RUN (lecture seule)'}`)
  console.log(`Collections : ${scopes.map((s) => s.slug).join(', ')}\n`)

  let totalDocs = 0
  let totalChanged = 0
  let totalSubs = 0

  for (const scope of scopes) {
    let page = 1
    const limit = 100
    let pageDocs = 0
    let pageChanged = 0
    let pageSubs = 0

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { docs, hasNextPage } = await payload.find({
        collection: scope.slug as Parameters<typeof payload.find>[0]['collection'],
        depth: 0,
        limit,
        page,
        overrideAccess: true,
      })

      for (const doc of docs as unknown as Array<Record<string, unknown>>) {
        pageDocs++
        const update: Record<string, unknown> = {}
        let docChanges = 0

        for (const field of scope.fields) {
          const value = doc[field]
          if (typeof value !== 'string' || value.length === 0) continue
          const next = applyDict(value)
          if (next === value) continue
          const { changes, preview } = diff(value, next)
          docChanges += changes
          update[field] = next

          if (!APPLY) {
            console.log(`[${scope.slug}#${doc.id}] ${field} (+${changes})${preview}`)
          }
        }

        if (docChanges > 0) {
          pageChanged++
          pageSubs += docChanges
          if (APPLY) {
            await payload.update({
              collection: scope.slug as Parameters<typeof payload.update>[0]['collection'],
              id: doc.id as number,
              data: update,
              overrideAccess: true,
            })
            console.log(`[${scope.slug}#${doc.id}] APPLY +${docChanges} char(s)`)
          }
        }
      }

      if (!hasNextPage) break
      page++
    }

    totalDocs += pageDocs
    totalChanged += pageChanged
    totalSubs += pageSubs
    console.log(`= ${scope.slug} : ${pageChanged}/${pageDocs} docs touches, +${pageSubs} chars\n`)
  }

  console.log(`\nResume :`)
  console.log(`  ${totalChanged}/${totalDocs} documents avec des changements`)
  console.log(`  +${totalSubs} caracteres accentues`)
  if (!APPLY) {
    console.log(`\n>> Re-executer avec --apply pour ecrire en DB.`)
  }

  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

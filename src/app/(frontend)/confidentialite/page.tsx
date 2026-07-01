import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalLayout } from '@/components/legal/LegalLayout'
import { SITE_URL, SITE_DOMAIN, CONTACT_EMAIL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Politique de confidentialité — RÉSEAUTEURS',
  description:
    'Politique de confidentialité et traitement des données personnelles sur RÉSEAUTEURS.',
  alternates: { canonical: `${SITE_URL}/confidentialite` },
}

export default function ConfidentialitePage() {
  return (
    <LegalLayout title="Politique de confidentialité" updatedAt="29 juin 2026">
      {/* TODO juridique : contenu aligné sur le modèle RÉSEAUTEURS B2B (ADR-0011) — à faire valider par un juriste avant production. */}
      <p>
        La présente politique décrit la manière dont l&apos;Éditeur du site{' '}
        <strong>{SITE_DOMAIN}</strong> (ci-après &laquo; l&apos;Éditeur &raquo; — voir les{' '}
        <Link href="/mentions-legales">mentions légales</Link>) collecte, utilise et protège les
        données à caractère personnel traitées dans le cadre de l&apos;utilisation du Site,
        conformément au Règlement général sur la protection des données (RGPD) et à la loi
        Informatique et libertés modifiée.
      </p>
      <p>
        RÉSEAUTEURS référence des <strong>personnes physiques</strong> (les réseauteurs) qui
        choisissent de se rendre visibles. Le traitement de leurs données est en conséquence encadré
        avec un soin particulier (consentement, contacts facultatifs, géolocalisation au niveau
        ville, opt-out d&apos;indexation).
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement est l&apos;Éditeur identifié dans les{' '}
        <Link href="/mentions-legales">mentions légales</Link>. Contact :{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>2. Données collectées et finalités</h2>

      <h3>2.1 Création et gestion du compte</h3>
      <p>
        <strong>Données : </strong>email, mot de passe (haché), rôle (réseauteur / organisateur /
        administrateur), date de création.
      </p>
      <p>
        <strong>Finalité : </strong>création et authentification du compte, communications liées au
        service.
      </p>
      <p>
        <strong>Base légale : </strong>exécution du contrat (article 6.1.b RGPD).
      </p>
      <p>
        <strong>Durée de conservation : </strong>pendant toute la durée du compte, puis suppression
        ou anonymisation.
      </p>

      <h3>2.2 Profil public du réseauteur (personne physique)</h3>
      <p>
        <strong>Données : </strong>prénom, nom, photo, fonction, entreprise, description, ville /
        département / région, secteur d&apos;activité, compétences, réseaux fréquentés, badge
        déclaratif, et — <strong>au choix du réseauteur</strong> — coordonnées de contact{' '}
        <strong>facultatives</strong> (téléphone, email, site web, LinkedIn).
      </p>
      <p>
        <strong>Géolocalisation : </strong>le profil est positionné sur la carte au{' '}
        <strong>niveau de la ville / commune (centroïde)</strong>. Aucune adresse personnelle exacte
        n&apos;est requise ni affichée.
      </p>
      <p>
        <strong>Finalité : </strong>affichage du profil public et du marqueur sur la carte des
        réseauteurs, mise en relation professionnelle.
      </p>
      <p>
        <strong>Base légale : </strong>consentement (article 6.1.a RGPD) : le réseauteur crée et
        publie volontairement son profil, et maîtrise les champs de contact facultatifs qu&apos;il
        renseigne.
      </p>
      <p>
        <strong>Durée de conservation : </strong>pendant toute la durée du compte ; le réseauteur
        peut modifier ou supprimer son profil à tout moment.
      </p>

      <h3>2.3 Fiche réseau (organisateur)</h3>
      <p>
        <strong>Données : </strong>nom du réseau, logo, description, présentation, lien internet,
        coordonnées de contact du réseau, ville, coordonnées géographiques.
      </p>
      <p>
        <strong>Finalité : </strong>affichage public de la fiche réseau et de ses événements.
      </p>
      <p>
        <strong>Base légale : </strong>exécution du contrat ; les données publiées le sont à la
        demande expresse de l&apos;organisateur.
      </p>

      <h3>2.4 Offres professionnelles et facturation</h3>
      <p>
        <strong>Données : </strong>identifiant Stripe, adresse de facturation, numéro de TVA
        intracommunautaire, raison sociale de facturation, historique des paiements et factures
        (offres réseau partenaire, événement Premium, partenaire annonceur).
      </p>
      <p>
        <strong>Finalité : </strong>exécution du contrat, facturation, respect des obligations
        fiscales et comptables.
      </p>
      <p>
        <strong>Base légale : </strong>exécution du contrat + obligation légale (articles 6.1.b et c
        RGPD ; conservation des pièces comptables pendant 10 ans).
      </p>
      <p>
        <strong>Durée de conservation : </strong>10 ans après la fin de l&apos;exercice comptable
        concerné, conformément au Code de commerce.
      </p>

      <h3>2.5 Communications marketing (optionnelles)</h3>
      <p>
        <strong>Données : </strong>email, préférences, date du consentement, date de révocation
        éventuelle.
      </p>
      <p>
        <strong>Finalité : </strong>envoi d&apos;emails d&apos;information et de conseils.
      </p>
      <p>
        <strong>Base légale : </strong>consentement (article 6.1.a RGPD), révocable à tout moment.
      </p>
      <p>
        <strong>Durée de conservation : </strong>jusqu&apos;au retrait du consentement, puis 3 ans à
        titre de preuve.
      </p>

      <h3>2.6 Journaux techniques et sécurité</h3>
      <p>
        <strong>Données : </strong>adresse IP (partiellement anonymisée), date et heure des accès,
        user-agent, événements d&apos;authentification.
      </p>
      <p>
        <strong>Finalité : </strong>sécurité du Site, détection de fraudes, respect des obligations
        légales de conservation des logs.
      </p>
      <p>
        <strong>Base légale : </strong>intérêt légitime de l&apos;Éditeur (article 6.1.f RGPD).
      </p>
      <p>
        <strong>Durée de conservation : </strong>12 mois maximum.
      </p>

      <h2>3. Destinataires des données</h2>
      <p>
        Les données sont accessibles aux personnels habilités de l&apos;Éditeur ainsi qu&apos;aux
        sous-traitants suivants, agissant sous instructions documentées :
      </p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Sous-traitant</th>
              <th>Rôle</th>
              <th>Localisation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Vercel Inc.</td>
              <td>Hébergement applicatif et stockage médias (Blob)</td>
              <td>États-Unis (clauses contractuelles types)</td>
            </tr>
            <tr>
              <td>Neon Inc.</td>
              <td>Base de données PostgreSQL</td>
              <td>États-Unis (clauses contractuelles types)</td>
            </tr>
            <tr>
              <td>Stripe Payments Europe Ltd.</td>
              <td>Paiement, facturation, gestion des abonnements</td>
              <td>Irlande (Union européenne)</td>
            </tr>
            <tr>
              <td>Resend</td>
              <td>Envoi des emails transactionnels et marketing</td>
              <td>États-Unis (clauses contractuelles types)</td>
            </tr>
            <tr>
              <td>OpenStreetMap</td>
              <td>Fourniture des tuiles cartographiques (cartes MapLibre)</td>
              <td>Union européenne / Royaume-Uni (aucune donnée identifiante transmise)</td>
            </tr>
            <tr>
              <td>API Adresse (data.gouv.fr)</td>
              <td>Géocodage des villes et adresses publiques</td>
              <td>France</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Les transferts de données hors Union européenne sont encadrés par les clauses contractuelles
        types de la Commission européenne.
      </p>

      <h2>4. Cookies et traceurs</h2>
      <p>
        Le Site utilise principalement des cookies techniques strictement nécessaires au
        fonctionnement du service (session d&apos;authentification, jetons de sécurité, paiement
        Stripe). Pour plus de détails, consultez la <Link href="/cookies">Politique cookies</Link>.
      </p>

      <h2>5. Vos droits</h2>
      <p>Conformément aux articles 15 à 22 du RGPD, vous disposez des droits suivants :</p>
      <ul>
        <li><strong>Droit d&apos;accès</strong> : obtenir la confirmation que vos données sont traitées et en demander une copie</li>
        <li><strong>Droit de rectification</strong> : corriger des données inexactes</li>
        <li><strong>Droit à l&apos;effacement</strong> : demander la suppression de vos données (sous réserve des obligations légales de conservation)</li>
        <li><strong>Droit à la limitation</strong> : demander la suspension temporaire du traitement</li>
        <li><strong>Droit à la portabilité</strong> : récupérer vos données dans un format structuré et réutilisable</li>
        <li><strong>Droit d&apos;opposition</strong> : vous opposer au traitement pour motifs légitimes</li>
        <li><strong>Droit de retirer votre consentement</strong> à tout moment pour les traitements fondés sur celui-ci</li>
        <li><strong>Droit de définir des directives post-mortem</strong></li>
      </ul>
      <p>
        <strong>Contrôle de visibilité du réseauteur.</strong> Au-delà des droits ci-dessus, le
        réseauteur maîtrise sa visibilité : il choisit les champs de contact facultatifs qu&apos;il
        publie, et peut activer une <strong>option d&apos;opt-out d&apos;indexation</strong> qui
        retire son profil des moteurs de recherche (balise <code>noindex</code>) et du plan du site
        (sitemap). Par défaut, un profil non encore validé par la modération n&apos;est pas indexé.
      </p>
      <p>Plusieurs de ces droits sont directement exerçables depuis votre espace personnel :</p>
      <ul>
        <li>modification ou suppression de votre profil / fiche</li>
        <li>téléchargement de l&apos;ensemble de vos données au format JSON</li>
        <li>gestion des préférences d&apos;emails marketing et de l&apos;opt-out d&apos;indexation</li>
        <li>suppression complète du compte</li>
      </ul>
      <p>
        Pour toute autre demande, contactez l&apos;Éditeur à{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Nous répondrons sous un délai maximal
        d&apos;un mois.
      </p>

      <h2>6. Réclamation auprès de la CNIL</h2>
      <p>
        Si vous estimez que le traitement de vos données constitue une violation du RGPD, vous avez
        le droit d&apos;introduire une réclamation auprès de la Commission nationale de
        l&apos;informatique et des libertés (CNIL) :
      </p>
      <ul>
        <li>3 Place de Fontenoy — TSA 80715 — 75334 Paris Cedex 07</li>
        <li>Téléphone : 01 53 73 22 22</li>
        <li>Site : <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">www.cnil.fr</a></li>
      </ul>

      <h2>7. Sécurité</h2>
      <p>
        L&apos;Éditeur met en œuvre des mesures techniques et organisationnelles appropriées :
        chiffrement TLS de toutes les communications, hachage des mots de passe, contrôle
        d&apos;accès granulaire, verrouillage automatique après tentatives d&apos;authentification
        échouées, limitation de débit des API, journaux d&apos;audit.
      </p>

      <h2>8. Modifications de la politique</h2>
      <p>
        La présente politique peut être modifiée pour tenir compte d&apos;évolutions légales ou des
        services. Les utilisateurs seront informés par email de toute modification substantielle. La
        version en vigueur est celle publiée sur le Site, datée en haut de page.
      </p>
    </LegalLayout>
  )
}

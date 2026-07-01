import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalLayout } from '@/components/legal/LegalLayout'
import { SITE_URL, SITE_DOMAIN, CONTACT_EMAIL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Conditions générales d\'utilisation — RÉSEAUTEURS',
  description:
    'Conditions générales d\'utilisation de RÉSEAUTEURS, la plateforme nationale du networking.',
  alternates: { canonical: `${SITE_URL}/cgu` },
}

export default function CGUPage() {
  return (
    <LegalLayout title="Conditions générales d'utilisation" updatedAt="29 juin 2026">
      {/* TODO juridique : contenu aligné sur le modèle RÉSEAUTEURS B2B (ADR-0011) — à faire valider par un juriste avant production. */}
      <h2>Article 1 — Objet</h2>
      <p>
        Les présentes conditions générales d&apos;utilisation (ci-après les &laquo; CGU &raquo;)
        régissent l&apos;accès et l&apos;utilisation du site <strong>{SITE_DOMAIN}</strong>{' '}
        (ci-après le &laquo; Site &raquo;), édité par l&apos;Éditeur identifié dans les{' '}
        <Link href="/mentions-legales">mentions légales</Link>.
      </p>
      <p>
        RÉSEAUTEURS est <strong>la plateforme nationale du networking</strong>. Le Site ne remplace
        aucun réseau : il les rassemble. Il met en relation, au même endroit, trois entités —{' '}
        <strong>les réseauteurs</strong> (les personnes qui réseautent), <strong>les événements</strong>{' '}
        business et <strong>les réseaux</strong> d&apos;affaires (BNI, DCF, CJD…).
      </p>
      <p>
        L&apos;utilisation du Site implique l&apos;acceptation pleine et entière des présentes CGU.
      </p>

      <h2>Article 2 — Accès au Site et rôles</h2>
      <p>
        Le Site est accessible librement à tout utilisateur disposant d&apos;un accès à Internet.
        Les frais liés à l&apos;accès (matériel, logiciel, connexion) sont à la charge exclusive de
        l&apos;utilisateur. Quatre profils coexistent :
      </p>
      <ul>
        <li>
          <strong>Visiteur</strong> (sans compte) : consulte les deux cartes, les fiches publiques
          (réseauteur, événement, réseau) et la recherche, sans inscription.
        </li>
        <li>
          <strong>Réseauteur</strong> (compte gratuit) : crée et gère son propre profil public et
          son marqueur sur la carte des réseauteurs. L&apos;inscription est et reste gratuite.
        </li>
        <li>
          <strong>Organisateur</strong> : gère la fiche de son réseau et ses événements (un compte
          organisateur correspond à un réseau). La publication d&apos;événements requiert un{' '}
          abonnement &laquo; réseau partenaire &raquo; actif (voir les{' '}
          <Link href="/cgv">CGV</Link>).
        </li>
        <li>
          <strong>Administrateur</strong> : back-office, modération et gestion des contenus.
        </li>
      </ul>

      <h2>Article 3 — Inscription et compte utilisateur</h2>
      <h3>3.1 Conditions d&apos;inscription</h3>
      <p>
        L&apos;inscription suppose la communication d&apos;une adresse email valide et d&apos;un mot
        de passe d&apos;au moins 8 caractères. Le réseauteur renseigne ensuite son profil
        professionnel ; l&apos;organisateur renseigne les informations de son réseau.
      </p>
      <p>
        En s&apos;inscrivant comme organisateur, l&apos;utilisateur certifie disposer du pouvoir de
        représenter le réseau concerné. Tout utilisateur accepte les présentes CGU ainsi que la{' '}
        <Link href="/confidentialite">Politique de confidentialité</Link>.
      </p>

      <h3>3.2 Vérification de l&apos;email</h3>
      <p>
        Un email de vérification est envoyé à l&apos;adresse renseignée. Le compte n&apos;est
        pleinement actif qu&apos;après clic sur le lien de vérification.
      </p>

      <h3>3.3 Unicité des profils</h3>
      <p>
        Un compte réseauteur correspond à un seul profil de personne. Un compte organisateur
        correspond à un seul réseau.
      </p>

      <h3>3.4 Sécurité du compte</h3>
      <p>
        L&apos;utilisateur est responsable de la confidentialité de ses identifiants et de
        l&apos;ensemble des actions effectuées depuis son compte. Toute utilisation suspecte doit
        être signalée sans délai à l&apos;Éditeur.
      </p>

      <h2>Article 4 — Contenus publiés par les utilisateurs</h2>
      <p>
        Les réseauteurs et les organisateurs publient leurs profils, fiches réseau et événements
        sous leur entière responsabilité. L&apos;utilisateur s&apos;engage à ne publier que des
        informations exactes, licites, non trompeuses, et conformes à l&apos;ordre public et aux
        bonnes mœurs.
      </p>
      <p>Sont notamment interdits :</p>
      <ul>
        <li>les contenus contrefaits, injurieux, diffamatoires, racistes, homophobes, sexistes</li>
        <li>les contenus à caractère pornographique ou violent</li>
        <li>les fausses informations ou informations trompeuses</li>
        <li>les contenus portant atteinte aux droits de tiers (marques, droits d&apos;auteur, vie privée)</li>
        <li>la promotion de produits ou services illicites</li>
      </ul>
      <p>
        L&apos;Éditeur se réserve le droit de suspendre ou supprimer tout contenu contraire aux
        présentes CGU, avec ou sans préavis.
      </p>

      <h2>Article 5 — Modération</h2>
      <p>
        Les profils, fiches et événements peuvent être soumis à modération. L&apos;Éditeur dispose
        d&apos;un délai raisonnable pour valider ou rejeter un contenu ; la décision de rejet est
        communiquée par email. L&apos;Éditeur n&apos;est pas tenu à une obligation générale de
        surveillance, mais tout utilisateur peut signaler un contenu illicite via{' '}
        <Link href="/contact">la page de contact</Link>.
      </p>

      <h2>Article 6 — Propriété sur les contenus et autorisation</h2>
      <p>
        Chaque acteur n&apos;agit que sur ses propres contenus : un réseauteur sur son seul profil,
        un organisateur sur son seul réseau et ses propres événements, l&apos;administrateur sur
        l&apos;ensemble. RÉSEAUTEURS rassemble les réseaux et leurs événements mais{' '}
        <strong>n&apos;organise pas</strong> les événements et ne gère pas les inscriptions :
        celles-ci s&apos;effectuent via le lien externe fourni par le réseau organisateur.
      </p>

      <h2>Article 7 — Obligations de l&apos;utilisateur</h2>
      <p>L&apos;utilisateur s&apos;engage à :</p>
      <ul>
        <li>utiliser le Site de bonne foi et dans le respect des présentes CGU</li>
        <li>ne pas tenter de nuire au bon fonctionnement du Site (intrusion, scraping massif, déni de service)</li>
        <li>ne pas utiliser le Site à des fins de prospection commerciale non sollicitée</li>
        <li>ne pas extraire, reproduire ou réutiliser tout ou partie des données du Site aux fins de constitution d&apos;une base de données concurrente</li>
      </ul>

      <h2>Article 8 — Propriété intellectuelle</h2>
      <p>
        La structure générale, les textes, logos, graphismes, mises en page, bases de données et
        toute autre création du Site sont protégés par le droit d&apos;auteur et le droit sui
        generis des bases de données (articles L.341-1 et suivants du Code de la propriété
        intellectuelle).
      </p>
      <p>
        En publiant du contenu (profil, fiche réseau, événement, visuel), l&apos;utilisateur concède
        à l&apos;Éditeur une licence non-exclusive, gratuite, mondiale, pour la durée de publication,
        aux fins exclusives d&apos;affichage sur le Site et sur ses supports de communication.
      </p>

      <h2>Article 9 — Disponibilité du Site</h2>
      <p>
        L&apos;Éditeur s&apos;efforce de maintenir le Site accessible 24h/24 et 7j/7, sans toutefois
        pouvoir s&apos;y engager. En cas de maintenance, d&apos;évolution, de panne ou de force
        majeure, l&apos;accès au Site pourra être interrompu sans que cette indisponibilité puisse
        engager la responsabilité de l&apos;Éditeur.
      </p>

      <h2>Article 10 — Données personnelles</h2>
      <p>
        Le traitement des données personnelles est décrit dans la{' '}
        <Link href="/confidentialite">Politique de confidentialité</Link>.
      </p>

      <h2>Article 11 — Résiliation</h2>
      <p>
        L&apos;utilisateur peut à tout moment supprimer son compte depuis son espace personnel. La
        suppression entraîne l&apos;effacement définitif des contenus qui lui sont rattachés. Les
        conditions spécifiques aux offres payantes figurent aux <Link href="/cgv">CGV</Link>.
      </p>
      <p>
        L&apos;Éditeur peut suspendre ou résilier un compte en cas de manquement aux présentes CGU,
        après mise en demeure restée infructueuse pendant 7 jours. En cas de manquement grave
        (fraude, contenu manifestement illicite), la suspension peut être immédiate.
      </p>

      <h2>Article 12 — Modification des CGU</h2>
      <p>
        L&apos;Éditeur se réserve le droit de modifier les présentes CGU à tout moment. Les
        utilisateurs titulaires d&apos;un compte seront informés par email au moins 30 jours avant
        l&apos;entrée en vigueur des nouvelles CGU. À défaut de refus suivi d&apos;une suppression de
        compte, la poursuite de l&apos;utilisation du Site vaut acceptation.
      </p>

      <h2>Article 13 — Droit applicable et litiges</h2>
      <p>
        Les présentes CGU sont soumises au droit français. En cas de litige, les parties
        s&apos;efforceront de trouver une solution amiable. À défaut, les tribunaux du ressort du
        siège social de l&apos;Éditeur seront seuls compétents.
      </p>

      <h2>Article 14 — Contact</h2>
      <p>
        Pour toute question relative aux présentes CGU :{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalLayout>
  )
}

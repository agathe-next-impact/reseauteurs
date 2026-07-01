import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalLayout } from '@/components/legal/LegalLayout'
import { SITE_URL, CONTACT_EMAIL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Politique cookies — RÉSEAUTEURS',
  description: 'Politique relative aux cookies et traceurs utilisés sur RÉSEAUTEURS.',
  alternates: { canonical: `${SITE_URL}/cookies` },
}

export default function CookiesPage() {
  return (
    <LegalLayout title="Politique cookies" updatedAt="29 juin 2026">
      {/* TODO juridique : contenu aligné sur le modèle RÉSEAUTEURS B2B (ADR-0011) — à faire valider par un juriste avant production. */}
      <p>
        La présente politique décrit l&apos;usage des cookies et traceurs sur RÉSEAUTEURS, en
        application de l&apos;article 82 de la loi Informatique et libertés et des recommandations de
        la CNIL.
      </p>

      <h2>1. Qu&apos;est-ce qu&apos;un cookie ?</h2>
      <p>
        Un cookie est un petit fichier texte déposé sur votre terminal (ordinateur, tablette,
        téléphone) lors de la visite d&apos;un site. Il permet de reconnaître votre navigateur et de
        stocker certaines informations (identifiant de session, préférences, etc.).
      </p>

      <h2>2. Cookies strictement nécessaires</h2>
      <p>
        Ces cookies sont exemptés de consentement en application de l&apos;article 82 de la loi
        Informatique et libertés (dispense &laquo; cookies strictement nécessaires &raquo;).
      </p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Finalité</th>
              <th>Durée</th>
              <th>Émetteur</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>payload-token</td>
              <td>Jeton d&apos;authentification (session utilisateur)</td>
              <td>30 jours</td>
              <td>RÉSEAUTEURS</td>
            </tr>
            <tr>
              <td>__Host-next-auth.csrf-token</td>
              <td>Protection contre la falsification de requêtes (CSRF)</td>
              <td>Session</td>
              <td>RÉSEAUTEURS</td>
            </tr>
            <tr>
              <td>cookie-consent</td>
              <td>Mémorise la prise de connaissance de la présente information</td>
              <td>localStorage (illimité, supprimable)</td>
              <td>RÉSEAUTEURS</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>3. Cartes interactives (OpenStreetMap / MapLibre)</h2>
      <p>
        Les deux cartes du Site — la carte des{' '}
        <Link href="/reseauteurs">réseauteurs</Link> et celle des{' '}
        <Link href="/evenements">événements</Link> — sont affichées via la bibliothèque MapLibre GL,
        à partir de tuiles cartographiques OpenStreetMap. Le chargement des tuiles peut s&apos;
        accompagner de cookies techniques strictement nécessaires à la gestion du cache et à la
        limitation d&apos;abus.
      </p>
      <p>
        Ces cookies sont considérés comme strictement nécessaires au service demandé par
        l&apos;utilisateur (affichage de la carte). Aucune donnée personnelle identifiante
        n&apos;est transmise au fournisseur de tuiles par RÉSEAUTEURS.
      </p>

      <h2>4. Paiement (Stripe)</h2>
      <p>
        Lors de la souscription à une offre professionnelle, le prestataire de paiement Stripe peut
        déposer des cookies strictement nécessaires à la sécurisation de la transaction et à la
        prévention de la fraude. Pour en savoir plus, consultez la{' '}
        <a href="https://stripe.com/fr/privacy" target="_blank" rel="noopener noreferrer">
          politique de confidentialité Stripe
        </a>
        .
      </p>

      <h2>5. Mesure d&apos;audience et publicité</h2>
      <p>
        À ce jour, <strong>aucun traceur de mesure d&apos;audience ni de publicité ciblée</strong>{' '}
        (Google Analytics, Meta Pixel, TikTok Pixel, tracking comportemental cross-site) n&apos;est
        déposé sur le Site. Toute intégration ultérieure d&apos;un tel traceur fera l&apos;objet
        d&apos;une mise à jour de la présente politique et d&apos;une demande de consentement
        préalable via un bandeau dédié.
      </p>

      <h2>6. Gestion des cookies par votre navigateur</h2>
      <p>
        Vous pouvez à tout moment configurer votre navigateur pour bloquer les cookies. Le blocage
        du cookie <code>payload-token</code> aura pour effet de vous déconnecter du Site et de vous
        empêcher d&apos;accéder à votre espace personnel.
      </p>
      <p>Consultez les guides de votre navigateur :</p>
      <ul>
        <li>
          <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">
            Google Chrome
          </a>
        </li>
        <li>
          <a href="https://support.mozilla.org/fr/kb/protection-renforcee-contre-pistage-firefox-ordinateur" target="_blank" rel="noopener noreferrer">
            Mozilla Firefox
          </a>
        </li>
        <li>
          <a href="https://support.apple.com/fr-fr/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">
            Apple Safari
          </a>
        </li>
        <li>
          <a href="https://support.microsoft.com/fr-fr/microsoft-edge" target="_blank" rel="noopener noreferrer">
            Microsoft Edge
          </a>
        </li>
      </ul>

      <h2>7. Évolutions de cette politique</h2>
      <p>
        Toute intégration ultérieure d&apos;un traceur soumis à consentement fera l&apos;objet
        d&apos;une mise à jour de cette politique et, le cas échéant, d&apos;une nouvelle demande de
        consentement.
      </p>

      <h2>8. Contact</h2>
      <p>
        Pour toute question : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </LegalLayout>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalLayout } from '@/components/legal/LegalLayout'
import { SITE_URL, SITE_DOMAIN, CONTACT_EMAIL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Conditions générales de vente — RÉSEAUTEURS',
  description:
    'Conditions générales de vente des offres professionnelles (B2B) de RÉSEAUTEURS : réseau partenaire, événement Premium, partenaire annonceur.',
  alternates: { canonical: `${SITE_URL}/cgv` },
}

export default function CGVPage() {
  return (
    <LegalLayout title="Conditions générales de vente" updatedAt="29 juin 2026">
      {/* TODO juridique : contenu aligné sur le modèle RÉSEAUTEURS B2B (ADR-0011) — à faire valider par un juriste avant production. */}
      <p>
        Les présentes conditions générales de vente (ci-après les &laquo; CGV &raquo;) régissent
        exclusivement la relation commerciale entre l&apos;Éditeur du site{' '}
        <strong>{SITE_DOMAIN}</strong> (ci-après &laquo; l&apos;Éditeur &raquo; — voir les{' '}
        <Link href="/mentions-legales">mentions légales</Link>) et tout professionnel (ci-après
        &laquo; le Client &raquo;) souscrivant à une offre payante.
      </p>
      <p>
        <strong>
          L&apos;inscription des réseauteurs (personnes physiques) est et reste gratuite : elle
          n&apos;entre pas dans le champ des présentes CGV.
        </strong>{' '}
        Seules les offres professionnelles décrites ci-dessous sont payantes.
      </p>
      <p>
        Les CGV constituent, avec les <Link href="/cgu">CGU</Link> et la{' '}
        <Link href="/confidentialite">Politique de confidentialité</Link>, l&apos;intégralité de
        l&apos;accord liant les parties. Toute souscription vaut acceptation pleine et entière des
        CGV en vigueur au jour de la commande.
      </p>

      <h2>Article 1 — Objet et nature B2B du contrat</h2>
      <p>
        Les offres de RÉSEAUTEURS sont des services rendus à des professionnels dans le cadre
        exclusif de leur activité. Le Client déclare agir à des fins qui entrent dans le cadre de
        son activité commerciale, industrielle, artisanale ou libérale.
      </p>
      <p>
        En conséquence,{' '}
        <strong>
          le droit de rétractation prévu aux articles L.221-18 et suivants du Code de la
          consommation n&apos;est pas applicable
        </strong>
        . Le Client renonce expressément à tout droit de rétractation au moment de la souscription.
      </p>

      <h2>Article 2 — Description des offres</h2>
      <p>L&apos;Éditeur propose trois offres professionnelles :</p>
      <table>
        <thead>
          <tr>
            <th>Offre</th>
            <th>Type</th>
            <th>Principales prestations</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Réseau partenaire</td>
            <td>Abonnement annuel</td>
            <td>
              Fiche réseau enrichie, droit de publier des événements, logo en page d&apos;accueil,
              badge partenaire, lien vers le site du réseau
            </td>
          </tr>
          <tr>
            <td>Événement Premium</td>
            <td>Paiement ponctuel (par événement)</td>
            <td>
              Mise en avant de l&apos;événement, marqueur distinct sur la carte, badge Premium
            </td>
          </tr>
          <tr>
            <td>Partenaire annonceur</td>
            <td>Abonnement</td>
            <td>Logo en page d&apos;accueil et sur la page Partenaires, lien vers le site</td>
          </tr>
        </tbody>
      </table>
      <p>
        Les prix applicables sont ceux de la grille tarifaire en vigueur, affichée au cours du
        parcours de commande avant validation du paiement. Les prix sont exprimés hors taxes (HT) ;
        la TVA applicable est ajoutée lors du paiement, en fonction du pays d&apos;établissement du
        Client.
      </p>

      <h2>Article 3 — Commande et conclusion du contrat</h2>
      <p>
        La souscription s&apos;effectue en ligne, depuis l&apos;espace personnel du Client pour les
        abonnements (réseau partenaire, partenaire annonceur) ou depuis la fiche de
        l&apos;événement concerné pour l&apos;option Événement Premium. Le parcours comprend la
        sélection de l&apos;offre, la redirection vers la page sécurisée du prestataire de paiement
        Stripe, la saisie des informations de facturation puis bancaires, et la validation du
        paiement.
      </p>
      <p>
        Le contrat est réputé formé au moment de la confirmation du paiement par Stripe. Un email de
        confirmation valant reçu est adressé au Client. La facture au format PDF est accessible à
        tout moment depuis l&apos;espace personnel.
      </p>

      <h2>Article 4 — Prix et modalités de paiement</h2>
      <h3>4.1 Prix</h3>
      <p>
        Les prix sont exprimés en euros hors taxes. La TVA est calculée automatiquement par le
        prestataire de paiement Stripe en fonction de l&apos;adresse de facturation communiquée par
        le Client et de son statut fiscal (assujetti ou non à la TVA intracommunautaire).
      </p>
      <p>
        Les Clients établis dans un autre État membre de l&apos;Union européenne et communiquant un
        numéro de TVA intracommunautaire valide bénéficient de l&apos;autoliquidation (reverse
        charge) : la facture est émise hors taxes, le Client étant redevable de la TVA dans son
        pays.
      </p>

      <h3>4.2 Modalités de paiement</h3>
      <p>
        Le paiement est effectué par carte bancaire via le prestataire Stripe Payments Europe Ltd.
        Aucune donnée bancaire n&apos;est stockée par l&apos;Éditeur. Les offres souscrites sous
        forme d&apos;abonnement (réseau partenaire, partenaire annonceur) sont reconduites
        automatiquement à chaque échéance, sauf résiliation conformément à l&apos;article 6.
        L&apos;option Événement Premium est un paiement ponctuel, sans reconduction.
      </p>

      <h3>4.3 Défaut de paiement</h3>
      <p>
        En cas d&apos;échec d&apos;un paiement d&apos;abonnement, Stripe tente automatiquement de
        relancer le prélèvement selon son calendrier standard. À l&apos;issue des tentatives
        infructueuses, l&apos;abonnement est suspendu et les avantages associés (notamment le droit
        de publier des événements pour le réseau partenaire) sont désactivés jusqu&apos;à
        régularisation.
      </p>

      <h2>Article 5 — Facturation</h2>
      <p>
        Une facture au format PDF est générée automatiquement par Stripe à chaque paiement. Elle
        comporte les mentions légales obligatoires (numéro séquentiel, date, dénomination des
        parties, prix HT, TVA, TTC, numéros d&apos;identification fiscale). Les factures sont
        accessibles à tout moment depuis la section &laquo; Abonnement &raquo; / &laquo; Factures
        &raquo; de l&apos;espace personnel.
      </p>

      <h2>Article 6 — Durée, reconduction, résiliation</h2>
      <h3>6.1 Durée</h3>
      <p>
        Les abonnements (réseau partenaire, partenaire annonceur) sont souscrits pour une durée
        ferme de 12 mois, reconductible tacitement par périodes successives de 12 mois. L&apos;option
        Événement Premium est attachée à un événement donné et ne fait l&apos;objet d&apos;aucune
        reconduction.
      </p>

      <h3>6.2 Résiliation par le Client</h3>
      <p>
        Conformément aux articles L.215-1 et L.215-3 du Code de la consommation, le Client peut
        résilier son abonnement à tout moment, sans frais, depuis son espace personnel (portail de
        gestion Stripe / Customer Portal). La résiliation prend effet à l&apos;échéance de la
        période en cours : le Client conserve l&apos;accès aux prestations payantes jusqu&apos;à
        cette date, puis les avantages associés sont désactivés.
      </p>

      <h3>6.3 Résiliation par l&apos;Éditeur</h3>
      <p>
        L&apos;Éditeur peut résilier le contrat de plein droit en cas de manquement grave du Client
        à ses obligations (défaut de paiement, contenu manifestement illicite, fraude, violation des
        CGU), après mise en demeure restée infructueuse pendant 7 jours. Dans ce cas, aucun
        remboursement ne sera dû.
      </p>

      <h3>6.4 Effet de la résiliation</h3>
      <p>
        À la résiliation d&apos;un abonnement, la fiche réseau et les événements demeurent en base ;
        les avantages payants (mise en avant, droit de publier de nouveaux événements, logo en page
        d&apos;accueil, badge) cessent. La suppression du compte entraîne l&apos;effacement définitif
        des données associées, dans les conditions de la{' '}
        <Link href="/confidentialite">Politique de confidentialité</Link>.
      </p>

      <h2>Article 7 — Modification des services</h2>
      <p>
        L&apos;Éditeur se réserve le droit de faire évoluer les prestations des offres. Toute
        modification substantielle défavorable au Client (retrait d&apos;une prestation existante,
        hausse de tarif) sera notifiée par email au moins 30 jours avant entrée en vigueur. Le
        Client disposera alors d&apos;un droit de résiliation sans frais à sa prochaine échéance.
      </p>

      <h2>Article 8 — Garantie de disponibilité</h2>
      <p>
        L&apos;Éditeur s&apos;engage à fournir ses meilleurs efforts pour maintenir le Site
        accessible 24h/24, 7j/7. Il ne peut toutefois garantir une disponibilité ininterrompue. Des
        interruptions pour maintenance, mise à jour ou en cas de force majeure sont susceptibles
        d&apos;intervenir sans que la responsabilité de l&apos;Éditeur puisse être engagée.
      </p>

      <h2>Article 9 — Responsabilité</h2>
      <p>
        La responsabilité de l&apos;Éditeur, toutes causes confondues, ne pourra excéder le montant
        HT effectivement payé par le Client au titre de l&apos;offre en cours au moment du fait
        générateur. L&apos;Éditeur ne saurait en aucun cas être tenu responsable des dommages
        indirects (perte de chiffre d&apos;affaires, perte de clientèle, préjudice commercial).
        RÉSEAUTEURS rassemble les réseaux et leurs événements mais n&apos;organise pas les
        événements et ne gère pas les inscriptions, lesquelles se font via le lien externe du réseau
        organisateur.
      </p>

      <h2>Article 10 — Force majeure</h2>
      <p>
        Aucune des parties ne sera tenue pour responsable en cas de manquement à ses obligations
        résultant d&apos;un cas de force majeure au sens de l&apos;article 1218 du Code civil.
      </p>

      <h2>Article 11 — Données personnelles</h2>
      <p>
        Le traitement des données personnelles est décrit dans la{' '}
        <Link href="/confidentialite">Politique de confidentialité</Link>. Les données de
        facturation transmises à Stripe sont traitées conformément à la politique de Stripe (
        <a href="https://stripe.com/fr/privacy" target="_blank" rel="noopener noreferrer">
          stripe.com/fr/privacy
        </a>
        ).
      </p>

      <h2>Article 12 — Réclamations</h2>
      <p>
        Toute réclamation doit être adressée par email à{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. L&apos;Éditeur s&apos;engage à y
        répondre dans un délai raisonnable. S&apos;agissant d&apos;un contrat entre professionnels,
        le dispositif de médiation de la consommation n&apos;est pas applicable ; les parties
        s&apos;efforceront néanmoins de résoudre amiablement tout différend.
      </p>

      <h2>Article 13 — Droit applicable et juridiction compétente</h2>
      <p>
        Les présentes CGV sont régies par le droit français. En cas de litige, et à défaut
        d&apos;accord amiable, les tribunaux compétents du ressort du siège social de l&apos;Éditeur
        seront seuls compétents, même en cas d&apos;appel en garantie ou de pluralité de défendeurs.
      </p>
    </LegalLayout>
  )
}

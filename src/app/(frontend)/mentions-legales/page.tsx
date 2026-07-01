import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalLayout } from '@/components/legal/LegalLayout'
import { SITE_URL, SITE_DOMAIN, CONTACT_EMAIL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Mentions légales — RÉSEAUTEURS',
  description: 'Mentions légales du site RÉSEAUTEURS — la plateforme nationale du networking.',
  alternates: { canonical: `${SITE_URL}/mentions-legales` },
}

export default function MentionsLegalesPage() {
  return (
    <LegalLayout title="Mentions légales" updatedAt="29 juin 2026">
      {/* TODO juridique : contenu aligné sur le modèle RÉSEAUTEURS B2B (ADR-0011) — identité de l'éditeur à confirmer pour la marque RÉSEAUTEURS, à faire valider par un juriste avant production. */}
      <p>
        Conformément aux dispositions des articles 6-III et 19 de la loi n&deg; 2004-575 du 21 juin
        2004 pour la Confiance dans l&apos;économie numérique (LCEN), il est porté à la connaissance
        des utilisateurs du site <strong>{SITE_DOMAIN}</strong> les présentes mentions légales.
      </p>

      <h2>1. Éditeur du site</h2>
      <p>
        Le site <strong>{SITE_DOMAIN}</strong> est édité par :
      </p>
      <ul>
        <li>Dénomination sociale : HBLGB</li>
        <li>Forme juridique : SASU (Société par actions simplifiée à associé unique)</li>
        <li>Capital social : 1 000 EUR</li>
        <li>Siège social : 47 rue Vivienne, 75002 Paris</li>
        <li>Numéro SIREN : 102 509 759</li>
        <li>Numéro SIRET : 102 509 759 00019</li>
        <li>RCS : Paris</li>
        <li>Code NAF/APE : 7022Z (Conseil pour les affaires et autres conseils de gestion)</li>
        <li>Numéro de TVA intracommunautaire : FR04102509759</li>
        <li>Email : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></li>
      </ul>
      <p>
        <em>
          [À confirmer par un juriste : identité et coordonnées de l&apos;éditeur exploitant la
          marque RÉSEAUTEURS.]
        </em>
      </p>

      <h2>2. Directeur de la publication</h2>
      <p>Le directeur de la publication est Benoit Huberd, en qualité de Président. <em>[À confirmer]</em></p>

      <h2>3. Hébergeur</h2>
      <p>Le site est hébergé par :</p>
      <ul>
        <li>Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis</li>
        <li>Site web : <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a></li>
      </ul>
      <p>
        Les données de la base sont hébergées par Neon Inc. (infrastructure AWS). Les médias sont
        stockés sur Vercel Blob.
      </p>

      <h2>4. Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble des contenus du site (textes, graphismes, logos, photos, vidéos, icônes) est
        la propriété exclusive de l&apos;Éditeur ou de ses partenaires, sauf mention contraire. Toute
        reproduction, représentation, modification, publication ou adaptation de tout ou partie des
        éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite sauf
        autorisation écrite préalable.
      </p>
      <p>
        Les contenus publiés par les réseauteurs (profil, photo) et par les organisateurs (fiche
        réseau, logo, description, événements) restent la propriété de leur auteur. En les publiant
        sur RÉSEAUTEURS, l&apos;auteur concède à l&apos;Éditeur une licence non-exclusive
        d&apos;affichage sur le site et ses supports de communication, le temps de la publication.
      </p>

      <h2>5. Responsabilité</h2>
      <p>
        L&apos;Éditeur s&apos;efforce d&apos;assurer l&apos;exactitude et la mise à jour des
        informations publiées, sans pouvoir garantir leur exactitude, leur précision ou leur
        exhaustivité. Les profils des réseauteurs ainsi que les fiches réseau et les événements sont
        rédigés sous la responsabilité de leurs auteurs.
      </p>
      <p>
        RÉSEAUTEURS rassemble les réseaux et leurs événements mais{' '}
        <strong>n&apos;organise pas</strong> les événements et ne gère pas les inscriptions :
        celles-ci s&apos;effectuent via le lien externe fourni par le réseau organisateur.
        L&apos;Éditeur décline toute responsabilité en cas d&apos;interruption du service, de
        survenance de bugs ou pour toute inexactitude ou omission portant sur des informations
        disponibles sur le site.
      </p>

      <h2>6. Liens hypertextes</h2>
      <p>
        Le site peut contenir des liens vers des sites tiers (notamment les sites des réseaux et les
        liens d&apos;inscription aux événements). L&apos;Éditeur n&apos;exerce aucun contrôle sur ces
        sites et n&apos;assume aucune responsabilité quant à leur contenu.
      </p>

      <h2>7. Droit applicable et juridiction</h2>
      <p>
        Les présentes mentions légales sont régies par le droit français. Tout litige sera porté
        devant les tribunaux compétents du ressort du siège social de l&apos;Éditeur.
      </p>

      <h2>8. Contact</h2>
      <p>Pour toute question relative aux présentes mentions, vous pouvez nous contacter :</p>
      <ul>
        <li>Par email : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></li>
        <li>Via la <Link href="/contact">page de contact</Link></li>
      </ul>
    </LegalLayout>
  )
}

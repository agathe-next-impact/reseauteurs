import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { LegalLayout } from '@/components/legal/LegalLayout'
import { SITE_URL, CONTACT_EMAIL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Contact — RÉSEAUTEURS',
  description: "Contactez l'équipe RÉSEAUTEURS.",
  alternates: { canonical: `${SITE_URL}/contact` },
}

export default function ContactPage() {
  return (
    <LegalLayout title="Nous contacter" updatedAt="17 avril 2026">
      <p>
        Une question, une suggestion, un signalement ? Contactez-nous par email a l&apos;adresse
        ci-dessous. Nous répondons généralement sous 2 jours ouvrés.
      </p>

      <h2>Nous écrire</h2>
      <p>
        <Mail size={16} className="inline-block mr-2 align-text-bottom" />
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>

      <h2>Motifs de contact</h2>
      <ul>
        <li>
          <strong>Compte et abonnement</strong> — questions sur votre compte, votre plan, votre
          facturation ou le fonctionnement du service.
        </li>
        <li>
          <strong>Signalement de contenu</strong> — fiche ou événement contraire aux{' '}
          <Link href="/cgu">CGU</Link> (informations inexactes, contenu illicite, usurpation
          d&apos;identité). Précisez l&apos;URL concernée et la nature du problème.
        </li>
        <li>
          <strong>Protection des données personnelles (RGPD)</strong> — exercice de vos droits
          (accès, rectification, effacement, portabilité, opposition). La plupart de ces démarches
          peuvent être effectuées directement depuis votre{' '}
          <Link href="/dashboard/compte">espace personnel</Link>. Voir notre{' '}
          <Link href="/confidentialite">Politique de confidentialité</Link>.
        </li>
        <li>
          <strong>Groupes et partenariats</strong> — création de groupe d&apos;affiliation,
          coupons mutualisés, demandes commerciales.
        </li>
        <li>
          <strong>Presse et communication</strong> — demandes médias, interviews, partenariats
          éditoriaux.
        </li>
        <li>
          <strong>Bug et suggestions</strong> — anomalie technique, idée d&apos;amélioration,
          retour d&apos;expérience.
        </li>
      </ul>
      <p>
        Pour faciliter le traitement, indiquez le motif en objet de votre email (ex.{' '}
        <em>« Signalement de contenu »</em>, <em>« RGPD — droit d&apos;accès »</em>).
      </p>

      <h2>Adresse postale</h2>
      <p>
        <span className="placeholder">HBLGB</span>
        <br />
        <span className="placeholder">47 rue Vivienne, 75002 Paris</span>
      </p>
    </LegalLayout>
  )
}

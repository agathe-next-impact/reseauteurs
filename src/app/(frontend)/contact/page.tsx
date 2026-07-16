import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, MessageCircle, ShieldCheck, Bug, Newspaper, Users2, ArrowRight } from 'lucide-react'
import { SITE_URL, CONTACT_EMAIL } from '@/lib/site'
import PageHeader from '@/components/layout/PageHeader'
import Reveal from '@/components/home/Reveal'

export const metadata: Metadata = {
  title: 'Contact — RÉSEAUTEURS',
  description: "Contactez l'équipe RÉSEAUTEURS.",
  alternates: { canonical: `${SITE_URL}/contact` },
}

const motifs = [
  {
    icon: Users2,
    title: 'Compte et abonnement',
    desc: 'Questions sur votre compte, votre plan, votre facturation ou le fonctionnement du service.',
  },
  {
    icon: ShieldCheck,
    title: 'Signalement de contenu',
    desc: (
      <>
        Fiche ou événement contraire aux <Link href="/cgu">CGU</Link> (informations inexactes,
        contenu illicite, usurpation d&apos;identité). Précisez l&apos;URL concernée et la nature
        du problème.
      </>
    ),
  },
  {
    icon: ShieldCheck,
    title: 'Protection des données personnelles (RGPD)',
    desc: (
      <>
        Exercice de vos droits (accès, rectification, effacement, portabilité, opposition). La
        plupart de ces démarches peuvent être effectuées directement depuis votre{' '}
        <Link href="/dashboard/compte">espace personnel</Link>. Voir notre{' '}
        <Link href="/confidentialite">Politique de confidentialité</Link>.
      </>
    ),
  },
  {
    icon: Users2,
    title: 'Groupes et partenariats',
    desc: "Création de groupe d'affiliation, coupons mutualisés, demandes commerciales.",
  },
  {
    icon: Newspaper,
    title: 'Presse et communication',
    desc: 'Demandes médias, interviews, partenariats éditoriaux.',
  },
  {
    icon: Bug,
    title: 'Bug et suggestions',
    desc: "Anomalie technique, idée d'amélioration, retour d'expérience.",
  },
]

export default function ContactPage() {
  return (
    <div className="rsn-page">
      <PageHeader
        tone="blue"
        icon={<MessageCircle size={13} aria-hidden />}
        eyebrow="Contact"
        title={<>Nous contacter</>}
        lead="Une question, une suggestion, un signalement ? Écrivez-nous : nous répondons généralement sous 2 jours ouvrés."
      />

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        {/* Écrire */}
        <Reveal>
          <div className="rsn-card p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 mb-4">
              <Mail size={22} className="text-[#2563EB]" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-[#16284f] mb-2">Nous écrire</h2>
            <p className="text-[#52525b] mb-4">
              Contactez-nous par email à l&apos;adresse ci-dessous.
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="ir-atlas-primary rsn-linkrow inline-flex"
            >
              {CONTACT_EMAIL}
              <ArrowRight size={15} aria-hidden className="rsn-arrow" />
            </a>
          </div>
        </Reveal>

        {/* Motifs de contact */}
        <section>
          <Reveal>
            <h2 className="rsn-eyebrow justify-center mb-2">Motifs de contact</h2>
          </Reveal>
          <div className="space-y-4 mt-6">
            {motifs.map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 70}>
                <div className="flex items-start gap-4 rsn-card p-5 rsn-lift">
                  <div className="w-10 h-10 bg-[#bfdbfe]/40 flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-[#2563EB]" aria-hidden />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#18181b] mb-1">{title}</h3>
                    <p className="text-sm text-[#52525b] leading-relaxed">{desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="text-sm text-[#71717a] text-center mt-6">
              Pour faciliter le traitement, indiquez le motif en objet de votre email (ex.{' '}
              <em>« Signalement de contenu »</em>, <em>« RGPD — droit d&apos;accès »</em>).
            </p>
          </Reveal>
        </section>

        {/* Adresse postale */}
        <Reveal>
          <div className="rsn-card p-6 text-center">
            <h2 className="font-semibold text-[#18181b] mb-2">Adresse postale</h2>
            <p className="text-sm text-[#52525b]">
              HBLGB
              <br />
              47 rue Vivienne, 75002 Paris
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  )
}

/**
 * /a-propos — Page À propos RÉSEAUTEURS
 *
 * Ancienne page PanoramaPub entièrement réécrite pour le modèle 3 entités (ADR-0011).
 * Design aligné sur l'accueil : en-tête de marque, reveals au scroll, compteurs animés.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
import { SITE_URL, SITE_NAME, SITE_TAGLINE, CONTACT_EMAIL } from '@/lib/site'
import { Network, Users, CalendarDays, MapPin, Building2, Heart, ArrowRight } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import Reveal from '@/components/home/Reveal'
import CountUp from '@/components/home/CountUp'

export const revalidate = 3600

export const metadata: Metadata = {
  title: `À propos — ${SITE_NAME}`,
  description: `${SITE_NAME} — ${SITE_TAGLINE}. Découvrez notre mission : rassembler tous les réseaux d'affaires de France en un seul endroit.`,
  alternates: { canonical: `${SITE_URL}/a-propos` },
  openGraph: {
    title: `À propos — ${SITE_NAME}`,
    description: `La plateforme qui rassemble réseauteurs, événements business et réseaux d'affaires de toute la France.`,
    url: `${SITE_URL}/a-propos`,
    type: 'website',
  },
}

export default async function AProposPage() {
  const payload = await getPayload({ config })

  const [{ totalDocs: nbReseauteurs }, { totalDocs: nbEvenements }, { totalDocs: nbReseaux }] =
    await Promise.all([
      payload
        .count({
          collection: 'reseauteurs',
          where: { statut: { equals: 'valide' } },
          overrideAccess: true,
        })
        .catch(() => ({ totalDocs: 0 })),
      payload
        .count({
          collection: 'evenements',
          where: { statut: { equals: 'publie' } },
          overrideAccess: true,
        })
        .catch(() => ({ totalDocs: 0 })),
      payload.count({ collection: 'reseaux', overrideAccess: true }).catch(() => ({ totalDocs: 0 })),
    ])

  return (
    <div className="rsn-page">
      <PageHeader
        tone="navy"
        eyebrow="À propos"
        title={
          <>
            La plateforme nationale
            <br />
            du networking
          </>
        }
        lead="Des centaines de milliers de professionnels fréquentent BNI, DCF, CJD, Rotary, Lions Club, Réseau Entreprendre et des dizaines d'autres réseaux partout en France. RÉSEAUTEURS les rassemble tous en un seul endroit."
      />

      {/* Notre mission */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <h2 className="text-2xl font-bold text-[#16284f] mb-6 text-center">Notre mission</h2>
            <div className="rsn-card p-8">
              <blockquote className="text-xl font-medium text-[#18181b] text-center leading-relaxed italic">
                « Le site ne remplace aucun réseau. Il les rassemble. »
              </blockquote>
              <p className="text-[#52525b] text-center mt-4 leading-relaxed">
                RÉSEAUTEURS est une couche de visibilité et de mise en relation, neutre et
                indépendante, superposée à l&apos;écosystème du networking français. On ne concurrence
                aucun réseau ; on les transforme en partenaires.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Trois entités */}
      <section className="py-16 px-4 bg-white border-y border-[#e4e4e7]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <h2 className="text-2xl font-bold text-[#16284f] mb-3 text-center">
              Trois entités, une plateforme
            </h2>
            <p className="text-[#52525b] text-center mb-10 max-w-2xl mx-auto">
              RÉSEAUTEURS repose sur trois bases de données interconnectées qui forment le cœur du
              service.
            </p>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Users,
                title: 'Les réseauteurs',
                color: 'text-[#2563EB]',
                bg: 'bg-blue-50',
                desc: 'Des personnes. Inscription gratuite, fiche publique et marqueur sur la carte. Chaque professionnel qui réseaute peut se rendre visible.',
                link: '/reseauteurs',
                cta: 'Découvrir les réseauteurs',
              },
              {
                icon: CalendarDays,
                title: 'Les événements',
                color: 'text-[#0284c7]',
                bg: 'bg-sky-50',
                desc: "Des rencontres datées. Chaque réseau publie ses événements business ; les réseauteurs les retrouvent sur la carte et dans l'agenda.",
                link: '/evenements',
                cta: 'Voir les événements',
              },
              {
                icon: Network,
                title: 'Les réseaux',
                color: 'text-[#f5851f]',
                bg: 'bg-orange-50',
                desc: "BNI, DCF, CJD, Rotary, Dynabuy et bien d'autres. Chaque réseau a sa fiche, son badge partenaire et ses événements référencés.",
                link: '/reseaux',
                cta: 'Voir les réseaux',
              },
            ].map(({ icon: Icon, title, color, bg, desc, link, cta }, i) => (
              <Reveal key={title} delay={i * 90}>
                <div className="rsn-card p-6 rsn-lift h-full">
                  <div className={`inline-flex items-center justify-center w-12 h-12 ${bg} mb-4`}>
                    <Icon size={22} className={color} />
                  </div>
                  <h3 className="font-bold text-[#18181b] mb-2">{title}</h3>
                  <p className="text-sm text-[#52525b] mb-4 leading-relaxed">{desc}</p>
                  <Link
                    href={link}
                    className={`inline-flex items-center gap-1.5 text-sm font-semibold ${color} hover:underline no-underline rsn-linkrow`}
                  >
                    {cta}
                    <ArrowRight size={14} aria-hidden className="rsn-arrow" />
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Chiffres */}
      <section className="section-dark py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Reveal>
            <h2 className="text-2xl font-bold mb-10 text-white">La plateforme en chiffres</h2>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { value: nbReseauteurs, label: 'Réseauteurs', icon: Users },
              { value: nbEvenements, label: 'Événements', icon: CalendarDays },
              { value: nbReseaux, label: 'Réseaux référencés', icon: Network },
            ].map(({ value, label, icon: Icon }) => (
              <div key={label}>
                <Icon size={24} className="mx-auto text-[#60a5fa] mb-3" />
                <div className="text-4xl font-extrabold text-white mb-1">
                  {value > 0 ? <CountUp value={value} /> : '—'}
                </div>
                <div className="text-blue-300 text-sm">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Valeurs */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <h2 className="text-2xl font-bold text-[#16284f] mb-8 text-center">Nos principes</h2>
          </Reveal>
          <div className="space-y-4">
            {[
              {
                icon: Heart,
                title: 'Gratuit pour les réseauteurs',
                desc: "L'inscription, la création de profil et la visibilité sur la carte sont entièrement gratuits. La valeur vient de la densité du réseau.",
              },
              {
                icon: Building2,
                title: 'B2B avec les réseaux',
                desc: 'Notre modèle économique repose sur les réseaux partenaires et les annonceurs — pas sur la monétisation des membres.',
              },
              {
                icon: MapPin,
                title: 'France entière',
                desc: "La carte couvre l'ensemble du territoire. Chaque ville, chaque département, chaque région.",
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 80}>
                <div className="flex items-start gap-4 rsn-card p-5 rsn-lift">
                  <div className="w-10 h-10 bg-[#bfdbfe]/40 flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-[#2563EB]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#18181b] mb-1">{title}</h3>
                    <p className="text-sm text-[#52525b] leading-relaxed">{desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-white border-t border-[#e4e4e7] text-center">
        <Reveal>
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-bold text-[#16284f] mb-4">Rejoignez RÉSEAUTEURS</h2>
            <p className="text-[#52525b] mb-8">
              Créez votre profil gratuitement et rejoignez la plateforme nationale du networking.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Link href="/inscription" className="ir-atlas-primary rsn-linkrow">
                Créer mon profil gratuitement
                <ArrowRight size={15} aria-hidden className="rsn-arrow" />
              </Link>
              <Link href={`mailto:${CONTACT_EMAIL}`} className="ir-atlas-secondary rsn-linkrow">
                Nous contacter
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}

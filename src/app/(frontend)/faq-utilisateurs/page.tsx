import type { Metadata } from 'next'
import { HelpCircle } from 'lucide-react'
import { FAQAccordion, type FAQSection } from '@/components/ui/FAQAccordion'
import { SITE_URL } from '@/lib/site'
import PageHeader from '@/components/layout/PageHeader'
import Reveal from '@/components/home/Reveal'

export const metadata: Metadata = {
  title: 'FAQ — RÉSEAUTEURS',
  description:
    'Foire aux questions à destination des visiteurs et membres de RÉSEAUTEURS — la plateforme nationale du networking.',
  alternates: { canonical: `${SITE_URL}/faq-utilisateurs` },
}

const sections: FAQSection[] = [
  {
    title: '',
    items: [
      {
        question:
          'Pourquoi utiliser cette plateforme plutôt que Google ou un moteur de recherche classique ?',
        answer: (
          <>
            <p>
              Les moteurs de recherche donnent des résultats larges et peu structurés, ce qui oblige
              à comparer manuellement plusieurs sources.
            </p>
            <p>
              La plateforme centralise l&apos;information dans un environnement spécialisé et
              organisé :
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>annuaire des réseauteurs</li>
              <li>carte interactive des réseauteurs et des événements</li>
              <li>agenda des événements business par réseau</li>
            </ul>
            <p>
              Vous accédez directement à une information exploitable et ciblée, sans perte de temps.
            </p>
          </>
        ),
      },
      {
        question: 'Que puis-je trouver concrètement sur la plateforme ?',
        answer: (
          <>
            <p>Vous avez accès à trois niveaux d&apos;information :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>un annuaire structuré des réseauteurs avec leur profil et badge</li>
              <li>
                une carte interactive pour identifier les réseauteurs et événements proches de vous
              </li>
              <li>
                un agenda des événements business (afterworks, petits-déjeuners, conférences) publiés
                par les réseaux partenaires
              </li>
            </ul>
            <p>
              Tout est regroupé au même endroit pour faciliter la recherche et la mise en relation.
            </p>
          </>
        ),
      },
      {
        question: 'Les informations sont-elles fiables ?',
        answer: (
          <>
            <p>
              Les données sont organisées dans une logique de structuration métier, avec des profils
              présentés de manière homogène pour faciliter la lecture et la comparaison.
            </p>
            <p>Les informations sont mises en forme pour être :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>claires</li>
              <li>exploitables</li>
              <li>cohérentes entre les différents acteurs</li>
            </ul>
            <p>
              L&apos;objectif est de faciliter la prise de décision avec une vision lisible du
              marché.
            </p>
          </>
        ),
      },
      {
        question: "Est-ce que je vais vraiment trouver l'ensemble des acteurs du marché ?",
        answer: (
          <>
            <p>
              La plateforme vise à référencer l&apos;ensemble des réseauteurs actifs en France,
              afin de proposer une vision globale de l&apos;écosystème du networking.
            </p>
            <p>
              Contrairement à une recherche dispersée, vous accédez ici à une cartographie organisée
              des acteurs, incluant leur positionnement et leur localisation.
            </p>
          </>
        ),
      },
      {
        question:
          'En quoi la plateforme est-elle adaptée aux nouveaux modes de recherche (IA, assistants, etc.) ?',
        answer: (
          <>
            <p>
              La plateforme est conçue avec une logique de données structurées et de référencement
              optimisé (SEO + IA) :
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>structuration sémantique des profils</li>
              <li>données exploitables par les moteurs de recherche et agents IA</li>
              <li>organisation pensée pour la lecture algorithmique et humaine</li>
            </ul>
            <p>
              Cela améliore la visibilité des informations dans les recherches classiques et les
              outils d&apos;IA.
            </p>
          </>
        ),
      },
      {
        question: 'Quel est le bénéfice concret pour moi en tant que décideur ?',
        answer: (
          <>
            <p>Vous centralisez vos recherches sur un seul outil :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>trouver des prestataires</li>
              <li>comparer les offres</li>
              <li>identifier les acteurs proches de vous</li>
              <li>accéder aux événements du secteur</li>
            </ul>
            <p>Vous gagnez en efficacité, en visibilité marché et en capacité de décision.</p>
          </>
        ),
      },
      {
        question: "À qui s'adresse la plateforme ?",
        answer: (
          <>
            <p>
              La plateforme s&apos;adresse aux décideurs et prescripteurs : DRH, directions
              commerciales, achats, collectivités, CSE…
            </p>
            <p>
              Des profils qui ont besoin d&apos;une vision claire, structurée et complète de
              l&apos;écosystème pour piloter leurs choix.
            </p>
          </>
        ),
      },
    ],
  },
]

export default function FAQUtilisateursPage() {
  return (
    <div className="rsn-page">
      <PageHeader
        tone="blue"
        icon={<HelpCircle size={13} aria-hidden />}
        eyebrow="FAQ"
        title={<>FAQ utilisateurs</>}
        lead="Toutes les réponses aux questions les plus fréquentes des visiteurs et membres de RÉSEAUTEURS."
      />
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Reveal>
          <div className="rsn-card p-6 sm:p-8">
            <FAQAccordion sections={sections} />
          </div>
        </Reveal>
      </div>
    </div>
  )
}

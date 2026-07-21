import Link from 'next/link'
import Image from 'next/image'
import { CONTACT_EMAIL, SITE_NAME, SOCIAL_LINKS } from '@/lib/site'
import FooterAccountLink from './FooterAccountLink'

/* Icônes de marque en SVG inline (lucide-react 1.7.0 ne fournit plus les icônes
   de réseaux sociaux). `currentColor` → héritent la couleur/hover du lien. */
function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

function LinkedinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

export default function FooterReseauteurs() {
  const year = new Date().getFullYear()

  return (
    <footer className="ir-plasma-footer bg-white border-t border-[#e4e4e7] mt-16">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
        <div>
          <h3 className="text-sm font-semibold text-[#18181b] mb-4">Annuaire</h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link href="/reseauteurs" className="text-[#71717a] hover:text-[#2563EB] no-underline transition-colors">
                Réseauteurs
              </Link>
            </li>
            <li>
              <Link href="/evenements" className="text-[#71717a] hover:text-[#2563EB] no-underline transition-colors">
                Événements
              </Link>
            </li>
            <li>
              <Link href="/reseaux" className="text-[#71717a] hover:text-[#2563EB] no-underline transition-colors">
                Réseaux
              </Link>
            </li>
            <li>
              <Link href="/partenaires" className="text-[#71717a] hover:text-[#2563EB] no-underline transition-colors">
                Entreprises
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[#18181b] mb-4">Compte</h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link href="/inscription" className="text-[#71717a] hover:text-[#2563EB] no-underline transition-colors">
                Créer mon profil
              </Link>
            </li>
            <li>
              <Link href="/login" className="text-[#71717a] hover:text-[#2563EB] no-underline transition-colors">
                Se connecter
              </Link>
            </li>
            <FooterAccountLink />
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[#18181b] mb-4">À propos</h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link href="/a-propos" className="text-[#71717a] hover:text-[#2563EB] no-underline transition-colors">
                Notre mission
              </Link>
            </li>
            <li>
              <Link href="/faq-utilisateurs" className="text-[#71717a] hover:text-[#2563EB] no-underline transition-colors">
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/contact" className="text-[#71717a] hover:text-[#2563EB] no-underline transition-colors">
                Contact
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[#18181b] mb-4">Légal</h3>
          <ul className="space-y-2.5 text-sm">
            <li>
              <Link href="/mentions-legales" className="text-[#71717a] hover:text-[#2563EB] no-underline transition-colors">
                Mentions légales
              </Link>
            </li>
            <li>
              <Link href="/cgu" className="text-[#71717a] hover:text-[#2563EB] no-underline transition-colors">
                CGU
              </Link>
            </li>
            <li>
              <Link href="/confidentialite" className="text-[#71717a] hover:text-[#2563EB] no-underline transition-colors">
                Confidentialité & RGPD
              </Link>
            </li>
            <li>
              <Link href="/cookies" className="text-[#71717a] hover:text-[#2563EB] no-underline transition-colors">
                Cookies
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[#e4e4e7]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-[#71717a]">
          <Link href="/" className="flex items-center gap-2 no-underline text-[#71717a] hover:text-[#2563EB] font-medium transition-colors" aria-label="Accueil RÉSEAUTEURS">
            <Image src="/img/logo.png" alt="" width={24} height={24} className="h-5 w-5 flex-none" aria-hidden />
            <span className="font-extrabold text-[#16284f] tracking-tight">{SITE_NAME.toUpperCase()}</span>
            <span>&copy; {year} Tous droits réservés.</span>
          </Link>
          <div className="flex items-center gap-4">
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#71717a] hover:text-[#2563EB] no-underline transition-colors">
              {CONTACT_EMAIL}
            </a>
            <div className="flex items-center gap-1">
              <a
                href={SOCIAL_LINKS.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${SITE_NAME} sur Instagram`}
                className="p-2 rounded-lg text-[#71717a] hover:text-[#2563EB] hover:bg-[#f4f4f5] transition-colors"
              >
                <InstagramIcon />
              </a>
              <a
                href={SOCIAL_LINKS.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${SITE_NAME} sur LinkedIn`}
                className="p-2 rounded-lg text-[#71717a] hover:text-[#2563EB] hover:bg-[#f4f4f5] transition-colors"
              >
                <LinkedinIcon />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface LegalLayoutProps {
  title: string
  updatedAt: string
  children: React.ReactNode
}

export function LegalLayout({ title, updatedAt, children }: LegalLayoutProps) {
  return (
    <div className="rsn-page py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <nav
          className="flex items-center gap-1 text-sm text-text-light mb-4"
          aria-label="fil d'ariane"
        >
          <Link href="/" className="hover:text-text-medium no-underline">
            Accueil
          </Link>
          <ChevronRight size={12} />
          <span className="text-text-medium">{title}</span>
        </nav>
        <article className="rsn-card shadow-sm p-8 sm:p-12">
          <header className="mb-8 pb-6 border-b border-[#e4e4e7]">
            <h1 className="text-3xl font-bold text-text-dark mb-2">{title}</h1>
            <p className="text-sm text-text-light">
              Dernière mise a jour : <time>{updatedAt}</time>
            </p>
          </header>
          <div className="legal-prose">{children}</div>
        </article>
      </div>
    </div>
  )
}

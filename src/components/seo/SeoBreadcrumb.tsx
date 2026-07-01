import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { buildBreadcrumbListJsonLd, type BreadcrumbItem } from '@/lib/jsonld'
import { JsonLd } from './JsonLd'

export type SeoBreadcrumbProps = {
  items: BreadcrumbItem[]
  className?: string
}

/**
 * Renders a visual breadcrumb AND injects the matching BreadcrumbList JSON-LD.
 * The final item is rendered as plain text (current page, no link).
 */
export function SeoBreadcrumb({ items, className }: SeoBreadcrumbProps) {
  if (items.length === 0) return null
  return (
    <>
      <JsonLd data={buildBreadcrumbListJsonLd(items)} />
      <nav
        aria-label="Fil d'Ariane"
        className={className ?? "flex items-center gap-1.5 text-sm text-text-light mb-4"}
      >
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <React.Fragment key={item.url}>
              {i > 0 && <ChevronRight size={12} className="shrink-0" />}
              {isLast ? (
                <span className="text-text-dark font-medium truncate max-w-[200px]">{item.name}</span>
              ) : (
                <Link href={item.url} className="hover:text-text-medium transition-colors">
                  {item.name}
                </Link>
              )}
            </React.Fragment>
          )
        })}
      </nav>
    </>
  )
}

'use client'

import { useState } from 'react'
export type FAQItem = {
  question: string
  answer: React.ReactNode
}

export type FAQSection = {
  title: string
  items: FAQItem[]
}

function AccordionItem({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 py-4 text-left text-sm font-medium text-text-dark hover:text-primary transition-colors"
      >
        <span>{item.question}</span>
      </button>
      {open && (
        <div className="pb-4 pr-8 text-sm text-text-medium leading-relaxed space-y-3">
          {item.answer}
        </div>
      )}
    </div>
  )
}

export function FAQAccordion({ sections }: { sections: FAQSection[] }) {
  return (
    <div className="space-y-10">
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="text-xl font-semibold text-text-dark mb-4">{section.title}</h2>
          <div>
            {section.items.map((item, idx) => (
              <AccordionItem key={idx} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

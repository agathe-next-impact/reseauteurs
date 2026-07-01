import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vérification email | RÉSEAUTEURS',
  description: 'Vérification de votre adresse email RÉSEAUTEURS.',
}

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children
}

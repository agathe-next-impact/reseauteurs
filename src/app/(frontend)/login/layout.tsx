import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Connexion | RÉSEAUTEURS',
  description: 'Connectez-vous à votre espace RÉSEAUTEURS.',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}

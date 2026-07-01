import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Réinitialisation du mot de passe | RÉSEAUTEURS',
  description: 'Définissez un nouveau mot de passe pour votre compte RÉSEAUTEURS.',
}

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Check, UserPlus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import AuthShell from '@/components/layout/AuthShell'

// Toutes les inscriptions créent un compte gratuit. Les réseauteurs sont gratuits ;
// un organisateur souscrit l'abonnement réseau partenaire depuis /dashboard/abonnement
// après vérification de son email (évite une session Stripe orpheline si la vérif échoue).
const STEPS_RESEAUTEUR = ['Votre compte', 'Votre profil']
const STEPS_ORGANISATEUR = ['Votre compte', 'Votre organisation']

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0
  if (pw.length >= 6) score++
  if (pw.length >= 10) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++

  if (score <= 1) return { score: 1, label: 'Faible', color: 'bg-red-500' }
  if (score <= 2) return { score: 2, label: 'Moyen', color: 'bg-amber-500' }
  if (score <= 3) return { score: 3, label: 'Bon', color: 'bg-blue-500' }
  return { score: 4, label: 'Fort', color: 'bg-green-500' }
}

export default function InscriptionPage() {
  const searchParams = useSearchParams()
  const groupeCodeParam = (searchParams.get('code') ?? '').trim().slice(0, 20).toUpperCase()
  const postSignupLoginUrl = groupeCodeParam
    ? `/login?redirect=${encodeURIComponent(`/dashboard/groupe?code=${groupeCodeParam}`)}`
    : '/login'

  const [accountType, setAccountType] = useState<'reseauteur' | 'organisateur' | null>(null)
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const STEPS = accountType === 'organisateur' ? STEPS_ORGANISATEUR : STEPS_RESEAUTEUR

  // Step 1
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [cguAccepted, setCguAccepted] = useState(false)
  const [optInMarketing, setOptInMarketing] = useState(false)

  // Step 2
  const [nomSociete, setNomSociete] = useState('')
  const [ville, setVille] = useState('')

  const pwStrength = getPasswordStrength(password)

  function nextStep() {
    setError('')
    if (step === 0) {
      if (!email || !password || !passwordConfirm) {
        setError('Veuillez remplir tous les champs.')
        return
      }
      if (password !== passwordConfirm) {
        setError('Les mots de passe ne correspondent pas.')
        return
      }
      if (password.length < 8) {
        setError('Le mot de passe doit contenir au moins 8 caractères.')
        return
      }
      if (!cguAccepted) {
        setError('Vous devez accepter les CGU et la politique de confidentialité pour continuer.')
        return
      }
    }
    if (step === 1) {
      if (!nomSociete || !ville) {
        setError('Veuillez remplir la raison sociale et la ville.')
        return
      }
    }
    setStep((s) => s + 1)
  }

  function prevStep() {
    setError('')
    if (step === 0) {
      setAccountType(null)
      return
    }
    setStep((s) => s - 1)
  }

  async function handleSubmit() {
    setError('')
    if (!nomSociete || !ville) {
      setError('Veuillez remplir la raison sociale et la ville.')
      return
    }
    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          nomSociete,
          ville,
          cguAccepted,
          optInMarketing,
          ...(accountType === 'organisateur' ? { type: 'organisateur' } : {}),
          ...(groupeCodeParam ? { pendingGroupeCode: groupeCodeParam } : {}),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erreur lors de l'inscription.")
        setLoading(false)
        return
      }

      setSuccess(true)
    } catch {
      toast.error('Erreur de connexion. Reessayez.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AuthShell title="Verifiez votre email">
        <div className="text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-green-600" />
          </div>
          <p className="text-sm text-text-light mb-6">
            Un email de vérification a été envoyé a{' '}
            <strong className="text-text-dark">{email}</strong>. Cliquez sur le lien pour activer
            votre compte.
          </p>
          <p className="text-sm text-text-light mb-4">
            {accountType === 'organisateur'
              ? "Pour publier vos événements, souscrivez à l'abonnement réseau partenaire depuis votre tableau de bord après vérification de votre email."
              : 'Votre compte réseauteur est gratuit. Complétez votre profil pour apparaître sur la carte des réseauteurs.'}
          </p>
          {groupeCodeParam && (
            <p className="text-sm text-text-light mb-4">
              Après connexion, le code de groupe{' '}
              <strong className="text-text-dark font-mono">{groupeCodeParam}</strong> sera
              pre-rempli pour rejoindre le groupe.
            </p>
          )}
          <Link
            href={postSignupLoginUrl}
            className="inline-flex items-center justify-center px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors text-sm no-underline"
          >
            Aller à la connexion
          </Link>
        </div>
      </AuthShell>
    )
  }

  // Account type selection screen
  if (accountType === null) {
    return (
      <AuthShell
        title="Vous êtes..."
        subtitle="Créez votre compte"
        footer={
          <p>
            Déjà un compte ?{' '}
            <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
              Se connecter
            </Link>
          </p>
        }
      >
        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => setAccountType('reseauteur')}
            className="p-5 border border-gray-200 rounded-xl hover:border-primary hover:bg-primary-light/20 transition-all text-left cursor-pointer"
          >
            <h3 className="font-semibold text-text-dark mb-1">Réseauteur</h3>
            <p className="text-sm text-text-light">
              Vous fréquentez des réseaux d&apos;affaires et souhaitez vous rendre visible
              sur la carte nationale des réseauteurs. Inscription gratuite.
            </p>
          </button>
          <button
            onClick={() => setAccountType('organisateur')}
            className="p-5 border border-gray-200 rounded-xl hover:border-primary hover:bg-primary-light/20 transition-all text-left cursor-pointer"
          >
            <h3 className="font-semibold text-text-dark mb-1">
              Réseau d&apos;affaires (organisateur)
            </h3>
            <p className="text-sm text-text-light">
              Vous gérez un réseau (BNI, DCF, CJD…) et souhaitez publier votre fiche
              et vos événements.
            </p>
          </button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={accountType === 'organisateur' ? 'Créez votre compte organisateur' : 'Créez votre profil réseauteur — gratuit'}
      footer={
        <>
          <p>
            Déjà un compte ?{' '}
            <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
              Se connecter
            </Link>
          </p>
          <p className="mt-2">
            <Link
              href="/"
              className="text-sm text-text-light hover:text-text-medium transition-colors"
            >
              Retour a l&apos;accueil
            </Link>
          </p>
        </>
      }
    >
      {groupeCodeParam && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
          <Sparkles size={20} className="text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-text-dark">
              Vous êtes invité a rejoindre un groupe
            </p>
            <p className="text-sm text-text-medium mt-0.5">
              Code <span className="font-mono font-semibold">{groupeCodeParam}</span> — il sera
              disponible pour rejoindre le groupe depuis votre tableau de bord après vérification
              de votre email.
            </p>
          </div>
        </div>
      )}

      {/* Stepper */}
      <div className="flex items-center justify-center gap-0 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center">
            {i > 0 && (
              <div
                className={`w-12 h-0.5 ${i <= step ? 'bg-primary' : 'bg-gray-200'} transition-colors`}
              />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  i < step
                    ? 'bg-green-500 text-white'
                    : i === step
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {i < step ? <Check size={16} /> : i + 1}
              </div>
              <span
                className={`text-sm ${i === step ? 'text-primary font-medium' : 'text-text-light'}`}
              >
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Account */}
      {step === 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-text-dark mb-1">Votre compte</h2>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-medium mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors"
              placeholder="vous@entreprise.fr"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-text-medium mb-1.5"
            >
              Mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors pr-16"
                placeholder="Minimum 8 caractères"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-light hover:text-text-medium transition-colors cursor-pointer"
              >
                {showPassword ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            {password.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        level <= pwStrength.score ? pwStrength.color : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm text-text-light mt-1">{pwStrength.label}</p>
              </div>
            )}
          </div>
          <div>
            <label
              htmlFor="passwordConfirm"
              className="block text-sm font-medium text-text-medium mb-1.5"
            >
              Confirmer le mot de passe
            </label>
            <input
              id="passwordConfirm"
              type={showPassword ? 'text' : 'password'}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors"
              placeholder="Retapez votre mot de passe"
            />
          </div>
          <div className="pt-2 space-y-3 border-t border-gray-100">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={cguAccepted}
                onChange={(e) => setCguAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer shrink-0"
                required
              />
              <span className="text-sm text-text-medium leading-relaxed">
                J&apos;accepte les{' '}
                <Link
                  href="/cgu"
                  target="_blank"
                  className="text-primary hover:underline font-medium"
                >
                  Conditions générales d&apos;utilisation
                </Link>{' '}
                et la{' '}
                <Link
                  href="/confidentialite"
                  target="_blank"
                  className="text-primary hover:underline font-medium"
                >
                  Politique de confidentialité
                </Link>
                . <span className="text-red-500">*</span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={optInMarketing}
                onChange={(e) => setOptInMarketing(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer shrink-0"
              />
              <span className="text-sm text-text-light leading-relaxed">
                J&apos;accepte de recevoir des emails d&apos;information et conseils pour
                optimiser ma visibilité (désinscription possible à tout moment).
              </span>
            </label>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={prevStep} className="flex-1">
              Retour
            </Button>
            <Button onClick={nextStep} className="flex-1">
              Continuer
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Company */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-text-dark mb-1">
            {accountType === 'organisateur' ? 'Votre organisation' : 'Votre profil'}
          </h2>
          <div>
            <label
              htmlFor="nomSociete"
              className="block text-sm font-medium text-text-medium mb-1.5"
            >
              {accountType === 'organisateur' ? "Nom de l'organisation" : 'Prénom et nom'}
            </label>
            <input
              id="nomSociete"
              type="text"
              value={nomSociete}
              onChange={(e) => setNomSociete(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors"
              placeholder={
                accountType === 'organisateur'
                  ? 'Nom de votre organisation'
                  : 'Ex : Marie Dupont'
              }
            />
          </div>
          <div>
            <label htmlFor="ville" className="block text-sm font-medium text-text-medium mb-1.5">
              Ville
            </label>
            <input
              id="ville"
              type="text"
              value={ville}
              onChange={(e) => setVille(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors"
              placeholder="Ville du siège"
            />
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <Button variant="secondary" onClick={prevStep} className="flex-1">
              Retour
            </Button>
            <Button onClick={handleSubmit} loading={loading} iconLeft={UserPlus} className="flex-1">
              Créer mon compte
            </Button>
          </div>
        </div>
      )}
    </AuthShell>
  )
}

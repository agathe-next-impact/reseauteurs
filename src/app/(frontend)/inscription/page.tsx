'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Sparkles, CalendarPlus, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import AuthShell, { AUTH_TITLE_ID } from '@/components/layout/AuthShell'
import { CONTACT_EMAIL } from '@/lib/site'

// Toutes les inscriptions créent un compte gratuit — y compris le choix « Réseauteur+ » :
// l'abonnement Plus (39 € HT/an) se souscrit depuis /dashboard/plus après vérification de
// l'email (évite une session Stripe orpheline si la vérif échoue). Le choix fait à
// l'inscription oriente simplement le parcours post-connexion. Même logique pour un
// organisateur (abonnement réseau partenaire depuis /dashboard/abonnement).
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

  // Revendication d'une fiche de réseau orpheline (/reseau/<slug> → « C'est votre réseau ? »).
  // Une revendication implique un compte organisateur : le choix du type est court-circuité.
  const claimParam = (searchParams.get('claim') ?? '').trim()
  const claimReseauId = /^\d+$/.test(claimParam) ? claimParam : null
  // Nom de la fiche revendiquée, résolu côté serveur (jamais depuis l'URL — l'utilisateur
  // doit voir CE qu'il revendique, et le serveur reste juge de la revendicabilité).
  const [claimNom, setClaimNom] = useState<string | null>(null)
  const [claimInvalide, setClaimInvalide] = useState<string | null>(null)

  const typeParam = searchParams.get('type')
  const [accountType, setAccountType] = useState<'reseauteur' | 'organisateur' | 'partenaire' | null>(
    claimReseauId
      ? 'organisateur'
      : typeParam === 'partenaire'
        ? 'partenaire'
        : typeParam === 'organisateur'
          ? 'organisateur'
          : null,
  )

  useEffect(() => {
    if (!claimReseauId) return
    let actif = true
    fetch(`/api/reseaux/${encodeURIComponent(claimReseauId)}/revendication`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!actif || !j) return
        if (j.revendicable) setClaimNom(j.nom ?? null)
        else setClaimInvalide(j.raison ?? 'Cette fiche n\'est plus revendicable.')
      })
      .catch(() => {
        /* silencieux : le formulaire reste utilisable, le serveur revalidera au POST */
      })
    return () => {
      actif = false
    }
  }, [claimReseauId])
  // Choix de formule réseauteur (étape immédiatement après le choix « Réseauteur ») :
  // gratuit, ou Réseauteur+ (l'abonnement se souscrit après vérification de l'email).
  const [offreReseauteur, setOffreReseauteur] = useState<'gratuit' | 'plus' | null>(null)
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  // Compte déjà vérifié : on propose la connexion / le mot de passe oublié plutôt
  // qu'un simple message d'erreur sans issue.
  const [accountExists, setAccountExists] = useState(false)
  const [success, setSuccess] = useState(false)
  // Réponse du serveur : le compte existait déjà (non vérifié, lien renvoyé) et
  // l'email a-t-il effectivement pu partir (Resend peut échouer sans bloquer).
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const [emailSent, setEmailSent] = useState(true)
  const [loading, setLoading] = useState(false)
  // `loading` passe par un re-render : un double-clic rapide peut envoyer deux
  // POST avant que le bouton ne soit désactivé (le 2e finissait en 409).
  const submittingRef = useRef(false)
  const STEPS =
    accountType === 'organisateur' || accountType === 'partenaire' ? STEPS_ORGANISATEUR : STEPS_RESEAUTEUR

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

  // Chaque écran du tunnel (type de compte → formule → compte → profil → succès)
  // remplace le précédent sans changer d'URL : le navigateur conserve donc la
  // position de défilement. Un clic sur un bouton situé en bas d'un écran long
  // (« Devenir Réseauteur+ ») affichait l'écran suivant au milieu de la page.
  // On repart du haut à chaque transition, et on déplace le focus sur le titre
  // pour que le clavier et les lecteurs d'écran suivent le même changement.
  const isFirstRender = useRef(true)
  useEffect(() => {
    // Premier rendu exclu : ne pas écraser la restauration de scroll du navigateur
    // (retour arrière depuis /login, par exemple).
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    window.scrollTo({ top: 0, behavior: 'auto' })
    document.getElementById(AUTH_TITLE_ID)?.focus({ preventScroll: true })
  }, [step, accountType, offreReseauteur, success])

  // Destination après connexion : code de groupe > activation Réseauteur+ > défaut.
  const postSignupLoginUrl = groupeCodeParam
    ? `/login?redirect=${encodeURIComponent(`/dashboard/groupe?code=${groupeCodeParam}`)}`
    : accountType === 'reseauteur' && offreReseauteur === 'plus'
      ? `/login?redirect=${encodeURIComponent('/dashboard/plus')}`
      : '/login'

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
      // Réseauteur : retour à l'étape de choix de formule (Gratuit / Réseauteur+) ;
      // les autres types reviennent au choix du type de compte.
      if (accountType === 'reseauteur') setOffreReseauteur(null)
      else setAccountType(null)
      return
    }
    setStep((s) => s - 1)
  }

  async function handleSubmit() {
    setError('')
    setAccountExists(false)
    if (!nomSociete || !ville) {
      setError('Veuillez remplir la raison sociale et la ville.')
      return
    }
    if (submittingRef.current) return
    submittingRef.current = true
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
          ...(accountType === 'organisateur'
            ? { type: 'organisateur' }
            : accountType === 'partenaire'
              ? { type: 'partenaire' }
              : {}),
          ...(groupeCodeParam ? { pendingGroupeCode: groupeCodeParam } : {}),
          // Revendication : la route force le rôle organisateur et linke la fiche
          // au nouveau compte (claim atomique). Elle revalide la revendicabilité.
          ...(claimReseauId ? { claimReseauId: Number(claimReseauId) } : {}),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erreur lors de l'inscription.")
        setAccountExists(data.code === 'account_exists')
        return
      }

      setAlreadyRegistered(data.alreadyRegistered === true)
      setEmailSent(data.emailSent !== false)
      setSuccess(true)
    } catch {
      toast.error('Erreur de connexion. Reessayez.')
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AuthShell title={emailSent ? 'Verifiez votre email' : 'Votre compte est créé'}>
        <div className="text-center">
          <div
            className={`w-14 h-14 ${emailSent ? 'bg-green-100' : 'bg-amber-100'} rounded-full flex items-center justify-center mx-auto mb-4`}
          >
            {emailSent ? (
              <Check size={28} className="text-green-600" />
            ) : (
              <AlertTriangle size={28} className="text-amber-600" />
            )}
          </div>
          {emailSent ? (
            <p className="text-sm text-text-light mb-6">
              {alreadyRegistered ? (
                <>
                  Un compte existait déjà pour{' '}
                  <strong className="text-text-dark">{email}</strong> mais son email n&apos;avait
                  jamais été vérifié. Nous venons de vous renvoyer le lien de vérification :
                  cliquez dessus pour activer votre compte. Le mot de passe enregistré lors de
                  votre première inscription reste inchangé — utilisez « mot de passe oublié » si
                  besoin.
                </>
              ) : (
                <>
                  Un email de vérification a été envoyé a{' '}
                  <strong className="text-text-dark">{email}</strong>. Cliquez sur le lien pour
                  activer votre compte.
                </>
              )}
            </p>
          ) : (
            <p className="text-sm text-text-light mb-6">
              Votre compte <strong className="text-text-dark">{email}</strong> est bien enregistré,
              mais l&apos;email de vérification n&apos;a pas pu être envoyé. Relancez
              l&apos;inscription avec le même email dans quelques minutes pour recevoir un nouveau
              lien, ou écrivez-nous à{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          )}
          <p className="text-sm text-text-light mb-4">
            {accountType === 'organisateur'
              ? "Pour publier vos événements, souscrivez à l'abonnement réseau partenaire depuis votre tableau de bord après vérification de votre email."
              : accountType === 'reseauteur' && offreReseauteur === 'plus'
                ? 'Après vérification de votre email et connexion, activez votre abonnement Réseauteur+ (39 € HT / an) depuis votre tableau de bord pour créer vos propres événements.'
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
            className="inline-flex items-center justify-center p-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors text-sm no-underline"
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
          <button
            onClick={() => setAccountType('partenaire')}
            className="p-5 border border-gray-200 rounded-xl hover:border-[#F5E050] hover:bg-[#FEFBE6] transition-all text-left cursor-pointer"
          >
            <h3 className="font-semibold text-text-dark mb-1">Entreprise (annonceur)</h3>
            <p className="text-sm text-text-light">
              Vous représentez une entreprise et souhaitez être visible auprès des réseauteurs :
              logo en page d&apos;accueil, fiche dédiée et offre exclusive. Sur abonnement.
            </p>
          </button>
        </div>
      </AuthShell>
    )
  }

  // Étape immédiatement après le choix « Réseauteur » : Gratuit ou Réseauteur+.
  if (accountType === 'reseauteur' && offreReseauteur === null) {
    const AVANTAGES_GRATUIT = [
      'Création d\'une fiche professionnelle',
      'Être visible sur la carte des Réseauteurs',
      'Être contacté par les autres membres',
      'Rechercher et contacter les Réseauteurs',
      'Consulter tous les événements',
      'S\'inscrire aux événements',
      'Découvrir les réseaux partenaires',
      'Accéder aux partenaires de la plateforme',
    ]
    const EXEMPLES_EVENEMENTS = [
      'Petit-déjeuner networking',
      'Déjeuner entre entrepreneurs',
      'Afterwork',
      'Visite de votre entreprise',
      'Rencontre informelle',
      'Atelier ou conférence',
    ]
    const CHAMPS_EVENEMENT = [
      'le titre',
      'la description',
      'la date',
      'les horaires',
      'le lieu',
      'le nombre de places',
      'les modalités d\'inscription',
      'les éventuelles conditions de participation',
    ]
    return (
      <AuthShell
        wide
        title="Choisissez votre formule"
        subtitle="Compte réseauteur"
        footer={
          <p>
            Déjà un compte ?{' '}
            <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
              Se connecter
            </Link>
          </p>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          {/* ── Offre gratuite ── */}
          <section
            aria-label="Offre Réseauteur gratuit"
            className="flex flex-col rounded-2xl border border-[#DFE0E1] bg-white p-6"
          >
            <h2 className="text-lg font-bold text-[#012A4A]">Réseauteur</h2>
            <p className="text-2xl font-extrabold text-[#012A4A] mt-1">Gratuit</p>
            <p className="text-sm text-[#6E7175] mt-2 mb-4">
              Pour les personnes qui souhaitent développer leur réseau professionnel.
            </p>
            <ul className="space-y-2 text-sm text-[#4E5155] flex-1">
              {AVANTAGES_GRATUIT.map((a) => (
                <li key={a} className="flex items-start gap-2">
                  <Check size={15} className="text-[#035AA6] shrink-0 mt-0.5" aria-hidden />
                  {a}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setOffreReseauteur('gratuit')}
              className="mt-6 w-full p-2.5 rounded-xl border border-[#CFD0D2] text-sm font-semibold text-[#012A4A] bg-white hover:bg-[#E9E9EA] transition-colors cursor-pointer"
            >
              S&apos;inscrire gratuitement
            </button>
          </section>

          {/* ── Offre Réseauteur+ (mise en avant) ── */}
          <section
            aria-label="Offre Réseauteur+ recommandée"
            className="relative flex flex-col rounded-2xl border-2 border-[#F5E050] bg-[#FEFDF3] p-6 shadow-lg shadow-[#F5E050]/15"
          >
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#F5E050] text-[#012A4A] text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full">
              Recommandé
            </span>
            <h2 className="text-lg font-bold text-[#012A4A]">⭐ Réseauteur+</h2>
            <p className="text-2xl font-extrabold text-[#8A6D0B] mt-1">
              39 € <span className="text-base font-semibold">HT / an</span>
            </p>
            <p className="text-sm font-semibold text-[#012A4A] mt-3">
              Tout ce qui est inclus dans le compte Réseauteur, <strong>PLUS :</strong>
            </p>
            <div className="mt-3 flex-1">
              <p className="text-sm font-bold text-[#012A4A] flex items-center gap-1.5">
                <CalendarPlus size={15} className="text-[#8A6D0B]" aria-hidden />
                Créez vos propres événements
              </p>
              <p className="text-sm text-[#4E5155] mt-1">
                Vous pouvez organiser librement vos propres rencontres, sans passer par un réseau
                ou une association.
              </p>
              <p className="text-xs font-semibold text-[#6E7175] uppercase tracking-wide mt-3 mb-1.5">
                Par exemple
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-sm text-[#4E5155]">
                {EXEMPLES_EVENEMENTS.map((e) => (
                  <li key={e} className="flex items-start gap-2">
                    <Check size={14} className="text-[#8A6D0B] shrink-0 mt-0.5" aria-hidden />
                    {e}
                  </li>
                ))}
              </ul>
              <p className="text-xs font-semibold text-[#6E7175] uppercase tracking-wide mt-4 mb-1.5">
                Lors de la création d&apos;un événement, le membre peut définir
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-sm text-[#4E5155]">
                {CHAMPS_EVENEMENT.map((c) => (
                  <li key={c} className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-[#F5E050] shrink-0 mt-2" aria-hidden />
                    {c}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-[#4E5155] mt-3">
                Les autres Réseauteurs peuvent ensuite s&apos;inscrire directement à cet événement.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOffreReseauteur('plus')}
              className="mt-6 w-full p-2.5 rounded-xl bg-[#F5E050] text-[#012A4A] text-base font-bold hover:bg-[#E3CB2E] transition-colors shadow-md shadow-[#F5E050]/30 cursor-pointer"
            >
              Devenir Réseauteur+
            </button>
          </section>
        </div>

        {/* ── Encadré : devenez créateur de connexions ── */}
        <aside
          aria-label="Devenez créateur de connexions"
          className="mt-5 rounded-2xl bg-[#012A4A] text-white p-6"
        >
          <h2 className="text-base font-bold">🚀 Devenez créateur de connexions</h2>
          <p className="text-sm text-white/85 mt-2">
            Avec Réseauteur+, vous ne vous contentez plus de participer aux événements…{' '}
            <strong className="text-white">Vous les créez.</strong>
          </p>
          <p className="text-sm text-white/85 mt-3">Invitez les membres de Réseauteurs à venir :</p>
          <ul className="mt-1.5 space-y-1 text-sm text-white/85">
            <li className="flex items-start gap-2">
              <Check size={14} className="text-[#8A6D0B] shrink-0 mt-0.5" aria-hidden />
              découvrir votre entreprise,
            </li>
            <li className="flex items-start gap-2">
              <Check size={14} className="text-[#8A6D0B] shrink-0 mt-0.5" aria-hidden />
              partager un café,
            </li>
            <li className="flex items-start gap-2">
              <Check size={14} className="text-[#8A6D0B] shrink-0 mt-0.5" aria-hidden />
              participer à un déjeuner,
            </li>
            <li className="flex items-start gap-2">
              <Check size={14} className="text-[#8A6D0B] shrink-0 mt-0.5" aria-hidden />
              échanger lors d&apos;un afterwork,
            </li>
            <li className="flex items-start gap-2">
              <Check size={14} className="text-[#8A6D0B] shrink-0 mt-0.5" aria-hidden />
              ou organiser toute autre rencontre professionnelle.
            </li>
          </ul>
          <p className="text-sm text-white/85 mt-3">
            Vous développez ainsi votre réseau personnel tout au long de l&apos;année.
          </p>
        </aside>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setAccountType(null)}
            className="text-sm text-[#6E7175] hover:text-[#012A4A] transition-colors cursor-pointer"
          >
            ← Choisir un autre type de compte
          </button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={
        accountType === 'organisateur'
          ? 'Créez votre compte organisateur'
          : accountType === 'partenaire'
            ? 'Créez votre compte partenaire'
            : offreReseauteur === 'plus'
              ? 'Créez votre compte Réseauteur+'
              : 'Créez votre profil réseauteur — gratuit'
      }
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

      {accountType === 'reseauteur' && offreReseauteur === 'plus' && (
        <div className="mb-6 bg-[#FEFBE6] border border-[#EFE08F] rounded-xl p-4 flex items-start gap-3">
          <Sparkles size={20} className="text-[#8A6D0B] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-text-dark">
              Formule choisie : ⭐ Réseauteur+ — 39 € HT / an
            </p>
            <p className="text-sm text-text-medium mt-0.5">
              Votre compte est créé gratuitement ; vous activerez votre abonnement depuis votre
              tableau de bord après vérification de votre email.
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

      {/* Revendication en cours : l'utilisateur doit voir CE qu'il revendique. */}
      {claimReseauId && claimNom && (
        <div className="mb-4 px-4 py-3 bg-[#FEFBE6] border border-[#EFE08F] rounded-lg text-sm">
          <p className="font-semibold text-[#8A6D0B]">
            Vous revendiquez la fiche de {claimNom}
          </p>
          <p className="text-[#4E5155] mt-0.5">
            Cette fiche vous sera rattachée dès que vous aurez vérifié votre email —
            vous pourrez ensuite la compléter depuis votre tableau de bord.
          </p>
        </div>
      )}
      {claimReseauId && claimInvalide && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
          {claimInvalide} Vous pouvez poursuivre : un réseau sera créé pour votre compte.
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
          {accountExists && (
            <p className="mt-2 flex flex-wrap gap-x-4">
              <Link href="/login" className="font-medium text-primary hover:underline">
                Se connecter
              </Link>
              <Link
                href="/mot-de-passe-oublie"
                className="font-medium text-primary hover:underline"
              >
                Mot de passe oublié
              </Link>
            </p>
          )}
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
            <Button onClick={handleSubmit} loading={loading} className="flex-1">
              Créer mon compte
            </Button>
          </div>
        </div>
      )}
    </AuthShell>
  )
}

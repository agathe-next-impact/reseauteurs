'use client'

/**
 * RevendiquerReseau — CTA « C'est votre réseau ? » sur la fiche d'une tête orpheline.
 *
 * La fiche /reseau/<slug> est en ISR : le serveur ne rend ce composant que lorsque la
 * fiche est objectivement revendicable (tête publiée, sans compte propriétaire), et
 * l'état PER-USER est hydraté ici via GET /api/reseaux/<id>/revendication. Aucun état
 * de session n'entre donc dans le HTML statique.
 *
 * Trois issues selon le visiteur :
 *   - anonyme          → créer un compte organisateur (claim atomique) ou se connecter ;
 *   - connecté éligible → revendication en un clic (POST) ;
 *   - connecté inéligible → motif explicite renvoyé par le serveur.
 *
 * Le serveur reste l'unique juge : ce composant n'affiche que ce que la route lui dit.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface EtatRevendication {
  revendicable: boolean
  nom?: string
  connecte?: boolean
  eligible?: boolean
  motif?: string
  raison?: string
}

export default function RevendiquerReseau({
  reseauId,
  slug,
  nom,
}: {
  reseauId: number | string
  slug: string | null
  nom: string
}) {
  const router = useRouter()
  const [etat, setEtat] = useState<EtatRevendication | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    let actif = true
    fetch(`/api/reseaux/${encodeURIComponent(String(reseauId))}/revendication`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (actif && j) setEtat(j as EtatRevendication)
      })
      .catch(() => {
        /* silencieux : le CTA disparaît, la fiche reste lisible */
      })
    return () => {
      actif = false
    }
  }, [reseauId])

  const revendiquer = async () => {
    setEnvoi(true)
    setErreur(null)
    try {
      const res = await fetch(
        `/api/reseaux/${encodeURIComponent(String(reseauId))}/revendication`,
        { method: 'POST' },
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setErreur(data?.error ?? 'La revendication a échoué. Réessayez.')
        return
      }
      router.push(data?.redirect ?? '/dashboard/reseau')
      router.refresh()
    } catch {
      setErreur('Erreur de connexion. Réessayez.')
    } finally {
      setEnvoi(false)
    }
  }

  // Chargement, ou fiche devenue non revendicable entre le rendu ISR et l'hydratation.
  if (etat === null) {
    return (
      <div
        className="rounded-2xl border border-dashed border-[#DFE0E1] bg-[#F2F2F2] p-4 min-h-[92px] animate-pulse"
        aria-hidden
      />
    )
  }
  if (!etat.revendicable) return null

  const retour = slug ? `/reseau/${slug}` : '/reseaux'

  return (
    <section
      aria-labelledby="revendication-titre"
      className="rounded-2xl border border-[#EFE08F] bg-[#FEFBE6] p-5"
    >
      <h2 id="revendication-titre" className="text-sm font-semibold text-[#8A6D0B] mb-1">
        C&apos;est votre réseau ?
      </h2>
      <p className="text-sm text-[#4E5155] mb-4">
        Cette fiche a été créée pour référencer {nom} sur la plateforme, mais personne ne
        la gère encore. Revendiquez-la pour la compléter, publier vos événements et
        fédérer vos groupes locaux.
      </p>

      {erreur && (
        <p
          className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3"
          role="alert"
        >
          {erreur}
        </p>
      )}

      {/* Visiteur anonyme : création de compte (claim atomique) ou connexion. */}
      {!etat.connecte && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/inscription?type=organisateur&claim=${encodeURIComponent(String(reseauId))}`}
            className="inline-flex items-center p-2.5 rounded-xl bg-[#035AA6] text-white text-sm font-semibold hover:bg-[#02467F] transition-colors no-underline"
          >
            Revendiquer ce réseau
          </Link>
          {/* La page de connexion attend `redirect` (validé same-origin côté login). */}
          <Link
            href={`/login?redirect=${encodeURIComponent(retour)}`}
            className="inline-flex items-center p-2.5 rounded-xl border border-[#DFE0E1] bg-white text-sm font-medium text-[#4E5155] hover:border-[#035AA6] hover:text-[#035AA6] transition-colors no-underline"
          >
            J&apos;ai déjà un compte
          </Link>
        </div>
      )}

      {/* Connecté et éligible : revendication immédiate. */}
      {etat.connecte && etat.eligible && (
        <button
          type="button"
          onClick={revendiquer}
          disabled={envoi}
          className="inline-flex items-center p-2.5 rounded-xl bg-[#035AA6] text-white text-sm font-semibold hover:bg-[#02467F] disabled:opacity-60 transition-colors cursor-pointer"
        >
          {envoi ? 'Revendication…' : 'Revendiquer ce réseau'}
        </button>
      )}

      {/* Connecté mais inéligible : motif renvoyé par le serveur. */}
      {etat.connecte && !etat.eligible && (
        <p className="text-xs text-[#6E7175]">
          {etat.motif ?? 'Votre compte ne permet pas de revendiquer cette fiche.'}
        </p>
      )}
    </section>
  )
}

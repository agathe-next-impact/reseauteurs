'use client'

/**
 * InscriptionEvenement — CTA d'inscription en ligne à un événement organisé par un
 * réseauteur Plus (ADR-0013 §3bis). Rendu uniquement pour les événements Plus.
 *
 * La fiche reste ISR/statique : l'état PER-USER (connecté ? réseauteur ? inscrit ?)
 * est hydraté côté client via GET /api/evenements/inscription. Le compteur initial
 * vient du serveur (public) pour un affichage immédiat + SEO.
 *
 * Écritures via POST /api/evenements/inscription (statut serveur, jamais le client).
 */
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Users } from 'lucide-react'

interface Props {
  evenementId: number
  slug: string
  initialTotal: number
  isPast: boolean
  /** true = héros sombre (navy) ; adapte les couleurs. */
  onDark?: boolean
}

interface Statut {
  connected: boolean
  isReseauteur: boolean
  inscrit: boolean
  total: number
}

export default function InscriptionEvenement({ evenementId, slug, initialTotal, isPast, onDark = false }: Props) {
  const [statut, setStatut] = useState<Statut | null>(null)
  const [total, setTotal] = useState(initialTotal)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let alive = true
    fetch(`/api/evenements/inscription?evenementId=${evenementId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Statut | null) => {
        if (!alive || !j) return
        setStatut(j)
        setTotal(j.total)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [evenementId])

  const compteur = (
    <span className={`inline-flex items-center gap-1.5 text-sm ${onDark ? 'text-white/70' : 'text-[#6E7175]'}`}>
      <Users size={14} aria-hidden />
      {total} inscrit{total > 1 ? 's' : ''}
    </span>
  )

  if (isPast) {
    return (
      <div className="flex items-center gap-3">
        <span className={`text-sm font-medium ${onDark ? 'text-white/60' : 'text-[#6E7175]'}`}>
          Événement terminé
        </span>
        {total > 0 && compteur}
      </div>
    )
  }

  // Tant que l'état per-user n'est pas chargé : afficher le compteur (pas de bouton flottant).
  if (!statut) {
    return <div className="flex items-center gap-3 min-h-[42px]">{total > 0 && compteur}</div>
  }

  if (!statut.connected) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={`/login?redirect=${encodeURIComponent(`/evenement/${slug}`)}`}
          className="ir-atlas-primary rsn-linkrow rsn-shine"
        >
          Je m&apos;inscris
        </a>
        <span className={`text-xs ${onDark ? 'text-white/60' : 'text-[#6E7175]'}`}>
          Connectez-vous en tant que réseauteur
        </span>
        {total > 0 && compteur}
      </div>
    )
  }

  if (!statut.isReseauteur) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className={`text-sm ${onDark ? 'text-white/70' : 'text-[#6E7175]'}`}>
          Inscription réservée aux réseauteurs.
        </span>
        {total > 0 && compteur}
      </div>
    )
  }

  const toggle = () => {
    const next = !statut.inscrit
    startTransition(async () => {
      try {
        const res = await fetch('/api/evenements/inscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ evenementId, inscrire: next }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(json.error ?? 'Opération impossible.')
          return
        }
        setStatut({ ...statut, inscrit: next })
        setTotal(typeof json.total === 'number' ? json.total : total + (next ? 1 : -1))
        toast.success(next ? 'Vous êtes inscrit à cet événement.' : 'Vous vous êtes désinscrit.')
      } catch {
        toast.error('Erreur réseau. Réessayez.')
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {statut.inscrit ? (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={`inline-flex items-center gap-2 font-semibold p-2.5 rounded-xl text-sm transition-colors disabled:opacity-60 ${
            onDark
              ? 'bg-white/10 text-white border border-white/25 hover:bg-white/15'
              : 'bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0] hover:bg-[#d1fae5]'
          }`}
          aria-label="Se désinscrire de cet événement"
        >
          {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
          Inscrit — se désinscrire
        </button>
      ) : (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className="ir-atlas-primary rsn-linkrow rsn-shine disabled:opacity-60"
          aria-label="S'inscrire à cet événement"
        >
          {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
          Je m&apos;inscris
        </button>
      )}
      {compteur}
    </div>
  )
}

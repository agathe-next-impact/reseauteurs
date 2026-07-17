'use client'

/**
 * MesReseauxClient — gestion des réseaux locaux d'un réseauteur Plus (ADR-0014).
 * Liste des réseaux possédés (badge « Affilié à X » / « Réseau indépendant »),
 * création (affiliation libre à une tête OU indépendant), édition de la fiche,
 * et encadré d'invitation email du réseau national absent.
 * Tous les gates sont serveur (actions) — le client n'affiche que les erreurs.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Network, Plus, Pencil, ExternalLink, MapPin, Loader2, Mail, X } from 'lucide-react'
import { createMonReseauLocal, updateMonReseauLocal, inviterReseauNational } from './actions'

export interface MonReseauLocal {
  id: number
  nom: string
  ville: string | null
  slug: string | null
  description: string | null
  presentation: string | null
  siteWeb: string | null
  emailContact: string | null
  telephone: string | null
  /** Nom de la tête parente — null = réseau indépendant. */
  parentNom: string | null
}

export interface TeteLite {
  id: number
  nom: string
  ville: string | null
}

const inputClass =
  'w-full rounded-xl border border-[#e4e4e7] bg-white px-3 py-2 text-sm text-[#18181b] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] transition-colors'
const labelClass = 'block text-xs font-medium text-[#52525b] mb-1'

export function MesReseauxClient({
  reseaux,
  tetes,
  maxReseaux,
}: {
  reseaux: MonReseauLocal[]
  tetes: TeteLite[]
  maxReseaux: number
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<MonReseauLocal | 'new' | null>(null)
  const [pending, startTransition] = useTransition()

  const current = editing !== null && editing !== 'new' ? editing : null
  const quotaAtteint = reseaux.length >= maxReseaux

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const s = (k: string) => String(fd.get(k) ?? '')
    startTransition(async () => {
      const res = current
        ? await updateMonReseauLocal(current.id, {
            nom: s('nom'),
            ville: s('ville'),
            description: s('description'),
            presentation: s('presentation'),
            siteWeb: s('siteWeb'),
            emailContact: s('emailContact'),
            telephone: s('telephone'),
          })
        : await createMonReseauLocal({
            nom: s('nom'),
            ville: s('ville'),
            description: s('description'),
            parentId: fd.get('parentId') ? Number(fd.get('parentId')) : null,
          })
      if (res.ok) {
        toast.success(current ? 'Fiche mise à jour.' : 'Réseau créé.')
        setEditing(null)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Formulaire création / édition */}
      {editing !== null ? (
        <form onSubmit={onSubmit} className="rsn-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#18181b]">
              {current ? `Modifier « ${current.nom} »` : 'Nouveau réseau local'}
            </h2>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="p-1 rounded-lg text-[#71717a] hover:text-[#18181b] hover:bg-[#f4f4f5] transition-colors"
              aria-label="Fermer le formulaire"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="nom" className={labelClass}>Nom du réseau *</label>
              <input id="nom" name="nom" type="text" required maxLength={100} defaultValue={current?.nom ?? ''} className={inputClass} placeholder="Ex : Cafés Business Aurillac" />
            </div>
            <div>
              <label htmlFor="ville" className={labelClass}>Ville *</label>
              <input id="ville" name="ville" type="text" required maxLength={100} defaultValue={current?.ville ?? ''} className={inputClass} />
            </div>
          </div>

          {/* Affiliation — création uniquement (figée ensuite ; l'admin corrige en back-office) */}
          {!current && (
            <div>
              <label htmlFor="parentId" className={labelClass}>Réseau national</label>
              <select id="parentId" name="parentId" defaultValue="" className={inputClass}>
                <option value="">Réseau indépendant (sans rattachement)</option>
                {tetes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nom}{t.ville ? ` — ${t.ville}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[#a1a1aa] mt-1">
                Rattachez votre groupe à son réseau national, ou laissez « indépendant ».
              </p>
            </div>
          )}
          {current && (
            <p className="text-xs text-[#71717a] bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-3 py-2">
              {current.parentNom
                ? <>Affilié au réseau <strong>{current.parentNom}</strong> (rattachement non modifiable — contactez-nous si besoin).</>
                : <>Réseau indépendant (rattachement non modifiable — contactez-nous si besoin).</>}
            </p>
          )}

          <div>
            <label htmlFor="description" className={labelClass}>Description courte</label>
            <textarea id="description" name="description" rows={2} maxLength={500} defaultValue={current?.description ?? ''} className={`${inputClass} resize-none`} />
          </div>

          {current && (
            <>
              <div>
                <label htmlFor="presentation" className={labelClass}>Présentation complète</label>
                <textarea id="presentation" name="presentation" rows={4} maxLength={5000} defaultValue={current.presentation ?? ''} className={`${inputClass} resize-none`} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="siteWeb" className={labelClass}>Site web</label>
                  <input id="siteWeb" name="siteWeb" type="url" maxLength={500} placeholder="https://…" defaultValue={current.siteWeb ?? ''} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="emailContact" className={labelClass}>Email de contact</label>
                  <input id="emailContact" name="emailContact" type="email" maxLength={254} defaultValue={current.emailContact ?? ''} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="telephone" className={labelClass}>Téléphone</label>
                  <input id="telephone" name="telephone" type="tel" maxLength={30} defaultValue={current.telephone ?? ''} className={inputClass} />
                </div>
              </div>
            </>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 bg-[#a855f7] text-white font-semibold py-2.5 px-5 rounded-xl hover:bg-[#9333ea] transition-colors text-sm disabled:opacity-60"
            >
              {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {current ? 'Enregistrer' : 'Créer le réseau'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              disabled={pending}
              className="text-sm text-[#71717a] hover:text-[#18181b] transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-3">
          {quotaAtteint ? (
            <p className="text-xs text-[#71717a] bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-3 py-2">
              Vous avez atteint la limite de {maxReseaux} réseaux locaux.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setEditing('new')}
              className="inline-flex items-center gap-2 bg-[#a855f7] text-white font-semibold py-2.5 px-5 rounded-xl hover:bg-[#9333ea] transition-colors text-sm"
            >
              <Plus size={15} aria-hidden />
              Créer un réseau local
            </button>
          )}
        </div>
      )}

      {/* Liste des réseaux possédés */}
      <div className="rsn-card rounded-2xl">
        <div className="px-6 py-4 border-b border-[#e4e4e7]">
          <h2 className="text-sm font-semibold text-[#18181b] flex items-center gap-1.5">
            <Network size={14} className="text-[#a855f7]" aria-hidden />
            Mes réseaux locaux
            <span className="text-[#a1a1aa] font-normal">({reseaux.length}/{maxReseaux})</span>
          </h2>
        </div>
        {reseaux.length === 0 ? (
          <div className="p-8 text-center">
            <Network size={28} className="text-[#d4d4d8] mx-auto mb-3" aria-hidden />
            <p className="text-sm text-[#71717a]">
              Aucun réseau local pour l&apos;instant. Créez votre première fiche pour apparaître
              sur la carte des réseaux et publier vos événements.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#e4e4e7]">
            {reseaux.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-6 py-4">
                <div className="w-10 h-10 rounded-xl bg-[#f3e8ff]/50 flex items-center justify-center text-[#a855f7] shrink-0" aria-hidden>
                  <Network size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#18181b] truncate">{r.nom}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    {r.ville && (
                      <span className="text-xs text-[#71717a] flex items-center gap-1">
                        <MapPin size={10} aria-hidden />
                        {r.ville}
                      </span>
                    )}
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${r.parentNom ? 'bg-[#f3e8ff]/60 text-[#7e22ce]' : 'bg-[#f4f4f5] text-[#52525b]'}`}>
                      {r.parentNom ? `Affilié à ${r.parentNom}` : 'Réseau indépendant'}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(r)}
                    className="p-1.5 rounded-lg text-[#71717a] hover:text-[#a855f7] hover:bg-[#f3e8ff]/50 transition-colors"
                    aria-label={`Modifier ${r.nom}`}
                  >
                    <Pencil size={14} />
                  </button>
                  {r.slug && (
                    <Link
                      href={`/reseau/${r.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2563EB] hover:text-[#1d4ed8] transition-colors"
                      aria-label={`Voir la fiche de ${r.nom}`}
                    >
                      <ExternalLink size={14} aria-hidden />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Encadré invitation du réseau national absent */}
      <InvitationNational />
    </div>
  )
}

/**
 * Encadré « Le réseau national n'existe pas encore ? » — envoie un email
 * d'invitation au réseau national (adresse fournie par le réseauteur).
 */
function InvitationNational() {
  const [pending, startTransition] = useTransition()
  const [envoye, setEnvoye] = useState(false)

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const form = e.currentTarget
    startTransition(async () => {
      const res = await inviterReseauNational({
        nomReseau: String(fd.get('nomReseau') ?? ''),
        email: String(fd.get('email') ?? ''),
      })
      if (res.ok) {
        toast.success('Invitation envoyée au réseau national.')
        setEnvoye(true)
        form.reset()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="bg-[#eff6ff]/40 border border-[#2563EB]/20 rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-[#18181b] mb-1 flex items-center gap-1.5">
        <Mail size={14} className="text-[#2563EB]" aria-hidden />
        Le réseau national n&apos;existe pas encore ?
      </h2>
      <p className="text-xs text-[#71717a] mb-3">
        Invitez-le à créer sa fiche sur RÉSEAUTEURS : indiquez son nom et un email de contact,
        nous lui envoyons une invitation en votre nom (3 invitations par jour maximum).
      </p>
      {envoye && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2 mb-3">
          Invitation envoyée. Une fois le réseau inscrit, vous pourrez y rattacher votre groupe.
        </p>
      )}
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          name="nomReseau"
          type="text"
          required
          maxLength={200}
          placeholder="Nom du réseau national"
          className={`${inputClass} sm:flex-1`}
          aria-label="Nom du réseau national"
        />
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          placeholder="email@reseau.fr"
          className={`${inputClass} sm:flex-1`}
          aria-label="Email du réseau national"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 bg-[#2563EB] text-white font-semibold py-2 px-4 rounded-xl hover:bg-[#1d4ed8] transition-colors text-sm disabled:opacity-60 shrink-0"
        >
          {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Mail size={14} aria-hidden />}
          Inviter
        </button>
      </form>
    </div>
  )
}

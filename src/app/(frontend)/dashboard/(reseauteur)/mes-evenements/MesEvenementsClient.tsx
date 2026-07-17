'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { CalendarDays, MapPin, Pencil, Trash2, Plus, Loader2, ExternalLink, Users, ChevronDown } from 'lucide-react'
import { createMonEvenement, updateMonEvenement, deleteMonEvenement, type EvenementFormData } from './actions'
import { ImageUploadField } from '@/components/dashboard/ImageUploadField'

export interface TypeEvLite {
  id: number
  label: string
}

export interface InscritLite {
  reseauteurId: number
  slug: string | null
  prenom: string
  nom: string
  ville: string | null
  dateInscription: string
}

export interface GroupeAdminLite {
  id: number
  nom: string
}

export interface MonEvenement {
  id: number
  slug: string | null
  /** Calculé côté serveur (règle de pureté — pas de Date.now() en rendu client). */
  past: boolean
  /** Groupe local organisateur (événement créé « pour un groupe » — décision 2026-07-16). */
  reseauId: number | null
  reseauNom: string | null
  titre: string
  type: number
  descriptionCourte: string | null
  description: string | null
  intervenants: string | null
  dateDebut: string
  dateFin: string | null
  lieuNom: string | null
  lieuAdresse: string | null
  lieuCodePostal: string | null
  lieuVille: string
  lieuDepartement: string | null
  lienInscription: string | null
  gratuit: boolean
  tarif: string | null
  nombrePlaces: number | null
  dateLimiteInscription: string | null
  ouvertATous: string | null
  reserveMembres: string | null
  participationInvite: string | null
  niveauPublic: string | null
  publicConcerne: string | null
  contactNom: string | null
  contactEmail: string | null
  contactTelephone: string | null
  parking: boolean
  accesPmr: boolean
  infosPratiques: string | null
  statut: string
  /** URL d'aperçu du visuel (thumbnail — calculée côté serveur). */
  imageUrl: string | null
  /** Inscrits en ligne (ADR-0013 §3bis). */
  inscrits: InscritLite[]
}

const inputClass =
  'w-full rounded-xl border border-[#e4e4e7] bg-white px-3 py-2 text-sm text-[#18181b] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] transition-colors'
const labelClass = 'block text-xs font-medium text-[#52525b] mb-1'

/** ISO → valeur datetime-local (heure locale, sans secondes). */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function MesEvenementsClient({
  evenements,
  types,
  groupesAdmin = [],
}: {
  evenements: MonEvenement[]
  types: TypeEvLite[]
  /** Réseaux locaux POSSÉDÉS par le réseauteur Plus (choix d'organisateur à la création — ADR-0014). */
  groupesAdmin?: GroupeAdminLite[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<MonEvenement | 'new' | null>(null)
  const [expandedInscrits, setExpandedInscrits] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()
  // Visuel uploadé (id media) — appliqué à la soumission ; null = visuel inchangé
  const [imageId, setImageId] = useState<number | null>(null)

  // Ouverture/fermeture du formulaire = visuel en attente réinitialisé
  const changeEditing = (v: MonEvenement | 'new' | null) => {
    setEditing(v)
    setImageId(null)
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const s = (k: string) => String(fd.get(k) ?? '')
    const data: EvenementFormData = {
      titre: s('titre'),
      type: Number(fd.get('type')),
      // Organisateur (création uniquement) : '' = en mon nom, sinon id d'un réseau local possédé
      organisateurReseau:
        editing === 'new' && fd.get('organisateurReseau') ? Number(fd.get('organisateurReseau')) : null,
      descriptionCourte: s('descriptionCourte'),
      description: s('description'),
      intervenants: s('intervenants'),
      dateDebut: fd.get('dateDebut') ? new Date(String(fd.get('dateDebut'))).toISOString() : '',
      dateFin: fd.get('dateFin') ? new Date(String(fd.get('dateFin'))).toISOString() : '',
      lieuNom: s('lieuNom'),
      lieuAdresse: s('lieuAdresse'),
      lieuCodePostal: s('lieuCodePostal'),
      lieuVille: s('lieuVille'),
      lieuDepartement: s('lieuDepartement'),
      lienInscription: s('lienInscription'),
      gratuit: fd.get('gratuit') === 'on',
      tarif: s('tarif'),
      nombrePlaces: s('nombrePlaces'),
      dateLimiteInscription: fd.get('dateLimiteInscription') ? new Date(String(fd.get('dateLimiteInscription'))).toISOString() : '',
      ouvertATous: s('ouvertATous'),
      reserveMembres: s('reserveMembres'),
      participationInvite: s('participationInvite'),
      niveauPublic: s('niveauPublic'),
      publicConcerne: s('publicConcerne'),
      contactNom: s('contactNom'),
      contactEmail: s('contactEmail'),
      contactTelephone: s('contactTelephone'),
      parking: fd.get('parking') === 'on',
      accesPmr: fd.get('accesPmr') === 'on',
      infosPratiques: s('infosPratiques'),
      imageId: imageId ?? undefined,
    }
    startTransition(async () => {
      const res =
        editing === 'new' || editing === null
          ? await createMonEvenement(data)
          : await updateMonEvenement(editing.id, data)
      if (res.ok) {
        toast.success(editing === 'new' ? 'Événement publié.' : 'Événement mis à jour.')
        changeEditing(null)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  const onDelete = (ev: MonEvenement) => {
    if (!window.confirm(`Supprimer « ${ev.titre} » ?`)) return
    startTransition(async () => {
      const res = await deleteMonEvenement(ev.id)
      if (res.ok) {
        toast.success('Événement supprimé.')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  const current = editing !== null && editing !== 'new' ? editing : null

  return (
    <div className="space-y-6">
      {/* Formulaire création/édition */}
      {editing !== null ? (
        <form onSubmit={onSubmit} className="rsn-card rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[#18181b]">
            {current ? `Modifier « ${current.titre} »` : 'Nouvel événement'}
          </h2>

          {/* Organisateur — en mon nom OU pour un groupe admin (création ; figé ensuite) */}
          {!current && groupesAdmin.length > 0 && (
            <div>
              <label htmlFor="organisateurReseau" className={labelClass}>Organisateur</label>
              <select id="organisateurReseau" name="organisateurReseau" defaultValue="" className={inputClass}>
                <option value="">En mon nom</option>
                {groupesAdmin.map((g) => (
                  <option key={g.id} value={g.id}>Pour le groupe : {g.nom}</option>
                ))}
              </select>
              <p className="text-xs text-[#a1a1aa] mt-1">
                Un événement de groupe apparaît au nom du groupe sur sa fiche et sur la carte.
              </p>
            </div>
          )}
          {current?.reseauNom && (
            <p className="text-xs text-[#71717a] bg-[#fafafa] border border-[#e4e4e7] rounded-xl px-3 py-2">
              Événement organisé pour le groupe <strong>{current.reseauNom}</strong> (non modifiable).
            </p>
          )}

          <div>
            <label htmlFor="titre" className={labelClass}>Titre *</label>
            <input id="titre" name="titre" type="text" required maxLength={200} defaultValue={current?.titre ?? ''} className={inputClass} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="type" className={labelClass}>Catégorie *</label>
              <select id="type" name="type" required defaultValue={current?.type ?? ''} className={inputClass}>
                <option value="" disabled>Choisir…</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lienInscription" className={labelClass}>Lien d&apos;inscription (externe)</label>
              <input id="lienInscription" name="lienInscription" type="url" maxLength={500} placeholder="https://…" defaultValue={current?.lienInscription ?? ''} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="dateDebut" className={labelClass}>Date et heure *</label>
              <input id="dateDebut" name="dateDebut" type="datetime-local" required defaultValue={toLocalInput(current?.dateDebut ?? null)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="dateFin" className={labelClass}>Fin (optionnel)</label>
              <input id="dateFin" name="dateFin" type="datetime-local" defaultValue={toLocalInput(current?.dateFin ?? null)} className={inputClass} />
            </div>
          </div>

          <div>
            <label htmlFor="descriptionCourte" className={labelClass}>Description courte (2 à 3 lignes)</label>
            <textarea id="descriptionCourte" name="descriptionCourte" rows={2} maxLength={500} defaultValue={current?.descriptionCourte ?? ''} className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label htmlFor="description" className={labelClass}>Description détaillée</label>
            <textarea id="description" name="description" rows={4} maxLength={3000} defaultValue={current?.description ?? ''} className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label htmlFor="intervenants" className={labelClass}>Intervenant(s)</label>
            <textarea id="intervenants" name="intervenants" rows={2} maxLength={1000} defaultValue={current?.intervenants ?? ''} className={`${inputClass} resize-none`} />
          </div>

          <ImageUploadField
            label="Visuel / affiche"
            hint="Format paysage recommandé."
            alt={current ? `Visuel — ${current.titre}` : "Visuel de l'événement"}
            currentUrl={current?.imageUrl ?? null}
            onUploaded={({ id }) => {
              setImageId(Number(id))
            }}
          />

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-[#52525b]">Lieu</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="lieuNom" className={labelClass}>Nom du lieu</label>
                <input id="lieuNom" name="lieuNom" type="text" maxLength={200} defaultValue={current?.lieuNom ?? ''} className={inputClass} />
              </div>
              <div>
                <label htmlFor="lieuAdresse" className={labelClass}>Adresse</label>
                <input id="lieuAdresse" name="lieuAdresse" type="text" maxLength={300} defaultValue={current?.lieuAdresse ?? ''} className={inputClass} />
              </div>
              <div>
                <label htmlFor="lieuCodePostal" className={labelClass}>Code postal</label>
                <input id="lieuCodePostal" name="lieuCodePostal" type="text" maxLength={10} defaultValue={current?.lieuCodePostal ?? ''} className={inputClass} />
              </div>
              <div>
                <label htmlFor="lieuVille" className={labelClass}>Ville *</label>
                <input id="lieuVille" name="lieuVille" type="text" required maxLength={100} defaultValue={current?.lieuVille ?? ''} className={inputClass} />
              </div>
              <div>
                <label htmlFor="lieuDepartement" className={labelClass}>Département</label>
                <input id="lieuDepartement" name="lieuDepartement" type="text" maxLength={100} placeholder="Rhône, Paris…" defaultValue={current?.lieuDepartement ?? ''} className={inputClass} />
              </div>
            </div>
            <p className="text-xs text-[#a1a1aa]">L&apos;adresse est géocodée automatiquement pour la carte.</p>
          </fieldset>

          {/* Participation */}
          <fieldset className="space-y-3 pt-1">
            <legend className="text-xs font-semibold text-[#52525b]">Participation</legend>
            <label className="flex items-center gap-2 text-sm text-[#18181b]">
              <input type="checkbox" name="gratuit" defaultChecked={current ? current.gratuit : true} className="rounded border-[#e4e4e7]" />
              Événement gratuit
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="tarif" className={labelClass}>Tarif (si payant)</label>
                <input id="tarif" name="tarif" type="text" maxLength={100} placeholder="ex : 25 €" defaultValue={current?.tarif ?? ''} className={inputClass} />
              </div>
              <div>
                <label htmlFor="nombrePlaces" className={labelClass}>Nombre de places</label>
                <input id="nombrePlaces" name="nombrePlaces" type="number" min={0} defaultValue={current?.nombrePlaces ?? ''} className={inputClass} />
              </div>
              <div>
                <label htmlFor="dateLimiteInscription" className={labelClass}>Date limite d&apos;inscription</label>
                <input id="dateLimiteInscription" name="dateLimiteInscription" type="datetime-local" defaultValue={toLocalInput(current?.dateLimiteInscription ?? null)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="niveauPublic" className={labelClass}>Niveau</label>
                <select id="niveauPublic" name="niveauPublic" defaultValue={current?.niveauPublic ?? ''} className={inputClass}>
                  <option value="">—</option>
                  <option value="debutant">Débutant</option>
                  <option value="confirme">Confirmé</option>
                  <option value="tous">Tous</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="publicConcerne" className={labelClass}>Public concerné</label>
              <input id="publicConcerne" name="publicConcerne" type="text" maxLength={300} placeholder="dirigeants, indépendants…" defaultValue={current?.publicConcerne ?? ''} className={inputClass} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                ['ouvertATous', 'Ouvert à tous ?'],
                ['reserveMembres', 'Réservé aux membres ?'],
                ['participationInvite', 'Invités possibles ?'],
              ] as const).map(([name, label]) => (
                <div key={name}>
                  <label htmlFor={name} className={labelClass}>{label}</label>
                  <select id={name} name={name} defaultValue={(current?.[name] as string | null) ?? ''} className={inputClass}>
                    <option value="">—</option>
                    <option value="oui">Oui</option>
                    <option value="non">Non</option>
                  </select>
                </div>
              ))}
            </div>
          </fieldset>

          {/* Contact */}
          <fieldset className="space-y-3 pt-1">
            <legend className="text-xs font-semibold text-[#52525b]">Contact (facultatif)</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="contactNom" className={labelClass}>Nom</label>
                <input id="contactNom" name="contactNom" type="text" maxLength={200} defaultValue={current?.contactNom ?? ''} className={inputClass} />
              </div>
              <div>
                <label htmlFor="contactEmail" className={labelClass}>Email</label>
                <input id="contactEmail" name="contactEmail" type="email" maxLength={254} defaultValue={current?.contactEmail ?? ''} className={inputClass} />
              </div>
              <div>
                <label htmlFor="contactTelephone" className={labelClass}>Téléphone</label>
                <input id="contactTelephone" name="contactTelephone" type="tel" maxLength={30} defaultValue={current?.contactTelephone ?? ''} className={inputClass} />
              </div>
            </div>
          </fieldset>

          {/* Infos pratiques */}
          <fieldset className="space-y-3 pt-1">
            <legend className="text-xs font-semibold text-[#52525b]">Informations pratiques</legend>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-[#18181b]">
                <input type="checkbox" name="parking" defaultChecked={current?.parking ?? false} className="rounded border-[#e4e4e7]" />
                Parking disponible
              </label>
              <label className="flex items-center gap-2 text-sm text-[#18181b]">
                <input type="checkbox" name="accesPmr" defaultChecked={current?.accesPmr ?? false} className="rounded border-[#e4e4e7]" />
                Accès PMR
              </label>
            </div>
            <div>
              <label htmlFor="infosPratiques" className={labelClass}>Informations complémentaires</label>
              <textarea id="infosPratiques" name="infosPratiques" rows={2} maxLength={1000} defaultValue={current?.infosPratiques ?? ''} className={`${inputClass} resize-none`} />
            </div>
          </fieldset>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 bg-[#2563EB] text-white font-semibold py-2.5 px-5 rounded-xl hover:bg-[#1d4ed8] transition-colors text-sm disabled:opacity-60"
            >
              {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {current ? 'Enregistrer' : 'Publier l\'événement'}
            </button>
            <button
              type="button"
              onClick={() => changeEditing(null)}
              disabled={pending}
              className="text-sm text-[#71717a] hover:text-[#18181b] transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => changeEditing('new')}
          className="inline-flex items-center gap-2 bg-[#2563EB] text-white font-semibold py-2.5 px-5 rounded-xl hover:bg-[#1d4ed8] transition-colors text-sm"
        >
          <Plus size={15} aria-hidden />
          Nouvel événement
        </button>
      )}

      {/* Liste */}
      {evenements.length === 0 && editing === null ? (
        <div className="rsn-card rounded-2xl border-dashed p-10 text-center">
          <CalendarDays size={32} className="text-[#d4d4d8] mx-auto mb-4" aria-hidden />
          <p className="text-sm font-medium text-[#52525b] mb-1">Aucun événement pour l&apos;instant</p>
          <p className="text-sm text-[#71717a]">Publiez votre premier événement de networking.</p>
        </div>
      ) : (
        <ul className="space-y-3" role="list">
          {evenements.map((ev) => {
            const d = new Date(ev.dateDebut)
            const past = ev.past
            return (
              <li key={ev.id} className="rsn-card rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#16284f] truncate">
                      {ev.titre}
                      {past && <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-[#a1a1aa]">passé</span>}
                      {ev.statut !== 'publie' && <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-amber-600">{ev.statut}</span>}
                      {ev.reseauNom && (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[#a855f7]">
                          Pour {ev.reseauNom}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[#71717a] flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1"><CalendarDays size={11} aria-hidden />{d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span className="inline-flex items-center gap-1"><MapPin size={11} aria-hidden />{ev.lieuVille}</span>
                    </p>
                  </div>
                  {ev.slug && (
                    <Link href={`/evenement/${ev.slug}`} target="_blank" className="text-[#a1a1aa] hover:text-[#2563EB] transition-colors" aria-label={`Voir la fiche de ${ev.titre}`}>
                      <ExternalLink size={15} />
                    </Link>
                  )}
                  <button type="button" onClick={() => changeEditing(ev)} className="text-[#a1a1aa] hover:text-[#2563EB] transition-colors" aria-label={`Modifier ${ev.titre}`}>
                    <Pencil size={15} />
                  </button>
                  <button type="button" onClick={() => onDelete(ev)} disabled={pending} className="text-[#a1a1aa] hover:text-red-600 transition-colors disabled:opacity-50" aria-label={`Supprimer ${ev.titre}`}>
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Inscrits en ligne (ADR-0013 §3bis) */}
                <div className="mt-3 pt-3 border-t border-[#f4f4f5]">
                  <button
                    type="button"
                    onClick={() => setExpandedInscrits(expandedInscrits === ev.id ? null : ev.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#52525b] hover:text-[#2563EB] transition-colors"
                    aria-expanded={expandedInscrits === ev.id}
                    disabled={ev.inscrits.length === 0}
                  >
                    <Users size={12} aria-hidden />
                    {ev.inscrits.length} inscrit{ev.inscrits.length > 1 ? 's' : ''}
                    {ev.inscrits.length > 0 && (
                      <ChevronDown
                        size={12}
                        aria-hidden
                        className={`transition-transform ${expandedInscrits === ev.id ? 'rotate-180' : ''}`}
                      />
                    )}
                  </button>
                  {expandedInscrits === ev.id && ev.inscrits.length > 0 && (
                    <ul className="mt-2 space-y-1" role="list">
                      {ev.inscrits.map((i) => (
                        <li key={i.reseauteurId} className="flex items-center justify-between gap-2 text-xs py-1">
                          <span className="min-w-0 truncate">
                            {i.slug ? (
                              <Link href={`/reseauteur/${i.slug}`} target="_blank" className="font-medium text-[#16284f] hover:text-[#2563EB] no-underline">
                                {i.prenom} {i.nom}
                              </Link>
                            ) : (
                              <span className="font-medium text-[#16284f]">{i.prenom} {i.nom}</span>
                            )}
                            {i.ville && <span className="text-[#a1a1aa]"> · {i.ville}</span>}
                          </span>
                          <span className="text-[#a1a1aa] shrink-0">
                            {i.dateInscription ? new Date(i.dateInscription).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

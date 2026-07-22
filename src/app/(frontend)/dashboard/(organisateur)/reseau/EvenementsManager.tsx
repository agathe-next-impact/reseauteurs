'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Calendar, Pencil, Trash2, X } from 'lucide-react'
import { createEvenement, updateEvenement, deleteEvenement } from './actions'
import { ImageUploadField } from '@/components/dashboard/ImageUploadField'
import type { Media } from '@/types/reseauteurs-domain'

interface EvenementsManagerProps {
  /** Le réseau cible est résolu côté serveur (Server Action) — jamais transmis par le client. */
  evenements: Record<string, unknown>[]
  /** Catégories d'événement (select requis — type_id NOT NULL en base). */
  types: Array<{ id: number; label: string }>
}

type FormMode = 'idle' | 'create' | { edit: Record<string, unknown> }

export function EvenementsManager({ evenements, types }: EvenementsManagerProps) {
  const [mode, setMode] = useState<FormMode>('idle')
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [localEvenements, setLocalEvenements] = useState(evenements)
  // Récurrence (création uniquement) — pilote l'affichage du champ « jusqu'au »
  const [recurrence, setRecurrence] = useState('aucune')
  // Visuel uploadé (id media) — appliqué à la soumission ; null = visuel inchangé
  const [imageId, setImageId] = useState<number | null>(null)

  // Changement de mode = formulaire réinitialisé (erreur + visuel en attente)
  const changeMode = (m: FormMode) => {
    setMode(m)
    setErrorMsg(null)
    setImageId(null)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg(null)

    const fd = new FormData(e.currentTarget)
    const gs = (k: string) => (fd.get(k) as string | null) ?? undefined
    const data = {
      titre: fd.get('titre') as string,
      type: Number(fd.get('type')),
      descriptionCourte: gs('descriptionCourte'),
      description: gs('description'),
      intervenants: gs('intervenants'),
      dateDebut: fd.get('dateDebut') as string,
      dateFin: gs('dateFin'),
      lieuNom: gs('lieuNom'),
      lieuVille: gs('lieuVille'),
      lieuAdresse: gs('lieuAdresse'),
      lieuCodePostal: gs('lieuCodePostal'),
      lieuDepartement: gs('lieuDepartement'),
      lienInscription: gs('lienInscription'),
      gratuit: fd.get('gratuit') === 'on',
      tarif: gs('tarif'),
      nombrePlaces: gs('nombrePlaces'),
      dateLimiteInscription: gs('dateLimiteInscription'),
      ouvertATous: gs('ouvertATous'),
      reserveMembres: gs('reserveMembres'),
      participationInvite: gs('participationInvite'),
      niveauPublic: gs('niveauPublic'),
      publicConcerne: gs('publicConcerne'),
      contactNom: gs('contactNom'),
      contactEmail: gs('contactEmail'),
      contactTelephone: gs('contactTelephone'),
      parking: fd.get('parking') === 'on',
      accesPmr: fd.get('accesPmr') === 'on',
      infosPratiques: gs('infosPratiques'),
      // Le select n'émet que des valeurs de l'enum ; Zod revalide côté serveur.
      recurrence: gs('recurrence') as 'aucune' | 'hebdomadaire' | 'quinzaine' | 'mensuelle' | undefined,
      recurrenceFin: gs('recurrenceFin'),
      imageId: imageId ?? undefined,
    }

    startTransition(async () => {
      if (mode === 'create') {
        const result = await createEvenement(data)
        if ('error' in result) {
          setErrorMsg(result.error)
        } else {
          // Refresh optimiste — rechargement complet nécessaire pour avoir l'id/slug
          window.location.reload()
        }
      } else if (typeof mode === 'object' && 'edit' in mode) {
        const result = await updateEvenement(mode.edit.id as string | number, data)
        if ('error' in result) {
          setErrorMsg(result.error)
        } else {
          setLocalEvenements((prev) =>
            prev.map((ev) =>
              ev.id === (mode.edit.id as string | number)
                ? { ...ev, ...data }
                : ev
            )
          )
          changeMode('idle')
        }
      }
    })
  }

  const handleDelete = (evenementId: string | number) => {
    if (!window.confirm('Supprimer cet événement ? Cette action est irréversible.')) return
    startTransition(async () => {
      const result = await deleteEvenement(evenementId)
      if ('error' in result) {
        setErrorMsg(result.error)
      } else {
        setLocalEvenements((prev) => prev.filter((ev) => ev.id !== evenementId))
      }
    })
  }

  const inputClass =
    'w-full rounded-xl border border-[#DFE0E1] bg-white px-3 py-2 text-sm text-[#1D1E21] focus:outline-none focus:ring-2 focus:ring-[#035AA6]/30 focus:border-[#035AA6] transition-colors'
  const labelClass = 'block text-xs font-medium text-[#4E5155] mb-1'

  const editingEvenement =
    typeof mode === 'object' && 'edit' in mode ? mode.edit : null

  return (
    <div className="p-6">
      {/* Liste événements */}
      {localEvenements.length === 0 && mode === 'idle' ? (
        <div className="text-center py-6">
          <Calendar size={28} className="text-[#CFD0D2] mx-auto mb-3" aria-hidden />
          <p className="text-sm text-[#6E7175] mb-4">Aucun événement publié.</p>
          <button
            type="button"
            onClick={() => changeMode('create')}
            className="text-sm text-[#035AA6] font-medium hover:text-[#02467F] transition-colors"
          >
            Créer le premier événement →
          </button>
        </div>
      ) : (
        <div className="space-y-2 mb-4" role="list" aria-label="Événements du réseau">
          {localEvenements.map((ev) => (
            <div
              key={ev.id as string}
              role="listitem"
              className="flex items-center gap-3 p-3 rounded-xl border border-[#DFE0E1] hover:border-[#CFD0D2] transition-colors"
            >
              <div className="shrink-0 flex items-center justify-center text-[#035AA6]" aria-hidden>
                <Calendar size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {ev.slug ? (
                    <Link
                      href={`/evenement/${ev.slug as string}`}
                      className="text-sm font-medium text-[#1D1E21] hover:text-[#035AA6] no-underline transition-colors truncate"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {ev.titre as string}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-[#1D1E21] truncate">{ev.titre as string}</p>
                  )}
                  {/* ADR-0012 : événement Premium supprimé — marqueur unique */}
                </div>
                <p className="text-xs text-[#6E7175]">
                  {new Date(ev.dateDebut as string).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {ev.lieuVille ? ` · ${ev.lieuVille as string}` : ''}
                  <span className={`ml-1 ${
                    ev.statut === 'publie' ? 'text-green-600' : 'text-amber-600'
                  }`}>
                    · {ev.statut === 'publie' ? 'Publié' : 'Suspendu'}
                  </span>
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => changeMode({ edit: ev })}
                  className="p-2.5 rounded-lg text-[#6E7175] hover:text-[#035AA6] hover:bg-[#EFF5FA] transition-colors"
                  aria-label={`Modifier ${ev.titre as string}`}
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(ev.id as string | number)}
                  disabled={isPending}
                  className="p-2.5 rounded-lg text-[#6E7175] hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  aria-label={`Supprimer ${ev.titre as string}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire create / edit */}
      {mode !== 'idle' && (
        <div className="rounded-2xl border border-[#035AA6]/20 bg-[#EFF5FA]/20 p-5 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#1D1E21]">
              {mode === 'create' ? 'Nouvel événement' : `Modifier l'événement`}
            </h3>
            <button
              type="button"
              onClick={() => changeMode('idle')}
              className="p-2.5 rounded-lg text-[#6E7175] hover:text-[#1D1E21] hover:bg-[#E9E9EA] transition-colors"
              aria-label="Fermer le formulaire"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="titre" className={labelClass}>Titre de l&apos;événement *</label>
              <input
                id="titre"
                name="titre"
                type="text"
                required
                maxLength={300}
                defaultValue={editingEvenement?.titre as string ?? ''}
                className={inputClass}
                placeholder="Petit-déjeuner networking, Soirée BNI…"
              />
            </div>

            <div>
              <label htmlFor="type" className={labelClass}>Catégorie *</label>
              <select
                id="type"
                name="type"
                required
                defaultValue={(() => {
                  const t = editingEvenement?.type
                  if (typeof t === 'object' && t !== null) return String((t as { id: number }).id)
                  return t ? String(t) : ''
                })()}
                className={inputClass}
              >
                <option value="" disabled>Choisir…</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="descriptionCourte" className={labelClass}>Description courte (2 à 3 lignes)</label>
              <textarea id="descriptionCourte" name="descriptionCourte" maxLength={500} rows={2} defaultValue={editingEvenement?.descriptionCourte as string ?? ''} className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label htmlFor="description" className={labelClass}>Description détaillée</label>
              <textarea
                id="description"
                name="description"
                maxLength={5000}
                rows={3}
                defaultValue={editingEvenement?.description as string ?? ''}
                className={`${inputClass} resize-none`}
              />
            </div>
            <div>
              <label htmlFor="intervenants" className={labelClass}>Intervenant(s)</label>
              <textarea id="intervenants" name="intervenants" maxLength={1000} rows={2} defaultValue={editingEvenement?.intervenants as string ?? ''} className={`${inputClass} resize-none`} />
            </div>

            <ImageUploadField
              label="Visuel / affiche"
              hint="Format paysage recommandé."
              alt={
                (editingEvenement?.titre as string | undefined)
                  ? `Visuel — ${editingEvenement?.titre as string}`
                  : "Visuel de l'événement"
              }
              currentUrl={(() => {
                const img = editingEvenement?.image as Media | null | undefined
                return typeof img === 'object' && img !== null
                  ? (img.sizes?.thumbnail?.url ?? img.url ?? null)
                  : null
              })()}
              onUploaded={({ id }) => {
                setImageId(Number(id))
              }}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="dateDebut" className={labelClass}>Date de début *</label>
                <input
                  id="dateDebut"
                  name="dateDebut"
                  type="datetime-local"
                  required
                  defaultValue={
                    editingEvenement?.dateDebut
                      ? new Date(editingEvenement.dateDebut as string).toISOString().slice(0, 16)
                      : ''
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="dateFin" className={labelClass}>Date de fin</label>
                <input
                  id="dateFin"
                  name="dateFin"
                  type="datetime-local"
                  defaultValue={
                    editingEvenement?.dateFin
                      ? new Date(editingEvenement.dateFin as string).toISOString().slice(0, 16)
                      : ''
                  }
                  className={inputClass}
                />
              </div>
            </div>

            {/* Récurrence — création uniquement : 1 événement distinct créé par date */}
            {mode === 'create' && (
              <fieldset className="space-y-3 pt-1 border-t border-[#E9E9EA]">
                <legend className="text-xs font-semibold text-[#4E5155]">Récurrence</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="recurrence" className={labelClass}>Répétition</label>
                    <select
                      id="recurrence"
                      name="recurrence"
                      value={recurrence}
                      onChange={(e) => setRecurrence(e.target.value)}
                      className={inputClass}
                    >
                      <option value="aucune">Aucune (événement unique)</option>
                      <option value="hebdomadaire">Chaque semaine</option>
                      <option value="quinzaine">Toutes les 2 semaines</option>
                      <option value="mensuelle">Chaque mois</option>
                    </select>
                  </div>
                  {recurrence !== 'aucune' && (
                    <div>
                      <label htmlFor="recurrenceFin" className={labelClass}>Répéter jusqu&apos;au (inclus) *</label>
                      <input
                        id="recurrenceFin"
                        name="recurrenceFin"
                        type="date"
                        required
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
                {recurrence !== 'aucune' && (
                  <p className="text-xs text-[#999A9D]">
                    Un événement distinct sera créé pour chaque date (26 maximum), modifiable ou
                    supprimable individuellement ensuite.
                  </p>
                )}
              </fieldset>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="lieuVille" className={labelClass}>Ville</label>
                <input
                  id="lieuVille"
                  name="lieuVille"
                  type="text"
                  maxLength={100}
                  defaultValue={editingEvenement?.lieuVille as string ?? ''}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="lieuNom" className={labelClass}>Lieu / salle</label>
                <input
                  id="lieuNom"
                  name="lieuNom"
                  type="text"
                  maxLength={200}
                  defaultValue={editingEvenement?.lieuNom as string ?? ''}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="lieuAdresse" className={labelClass}>Adresse</label>
                <input
                  id="lieuAdresse"
                  name="lieuAdresse"
                  type="text"
                  maxLength={300}
                  defaultValue={editingEvenement?.lieuAdresse as string ?? ''}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="lieuCodePostal" className={labelClass}>Code postal</label>
                <input id="lieuCodePostal" name="lieuCodePostal" type="text" maxLength={10} defaultValue={editingEvenement?.lieuCodePostal as string ?? ''} className={inputClass} />
              </div>
              <div>
                <label htmlFor="lieuDepartement" className={labelClass}>Département</label>
                <input id="lieuDepartement" name="lieuDepartement" type="text" maxLength={100} placeholder="Rhône, Paris…" defaultValue={editingEvenement?.lieuDepartement as string ?? ''} className={inputClass} />
              </div>
            </div>

            <div>
              <label htmlFor="lienInscription" className={labelClass}>
                Lien d&apos;inscription externe
              </label>
              <input
                id="lienInscription"
                name="lienInscription"
                type="url"
                maxLength={500}
                placeholder="https://… (site de votre réseau)"
                defaultValue={editingEvenement?.lienInscription as string ?? ''}
                className={inputClass}
              />
              <p className="text-xs text-[#999A9D] mt-1">
                Le bouton &quot;S&apos;inscrire&quot; redirigera vers cette URL.
              </p>
            </div>

            {/* Participation */}
            <fieldset className="space-y-3 pt-1 border-t border-[#E9E9EA]">
              <legend className="text-xs font-semibold text-[#4E5155]">Participation</legend>
              <label className="flex items-center gap-2 text-sm text-[#1D1E21]">
                <input type="checkbox" name="gratuit" defaultChecked={editingEvenement ? editingEvenement.gratuit !== false : true} className="rounded border-[#DFE0E1]" />
                Événement gratuit
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tarif" className={labelClass}>Tarif (si payant)</label>
                  <input id="tarif" name="tarif" type="text" maxLength={100} placeholder="ex : 25 €" defaultValue={editingEvenement?.tarif as string ?? ''} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="nombrePlaces" className={labelClass}>Nombre de places</label>
                  <input id="nombrePlaces" name="nombrePlaces" type="number" min={0} defaultValue={(editingEvenement?.nombrePlaces as number | undefined) ?? ''} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="dateLimiteInscription" className={labelClass}>Date limite d&apos;inscription</label>
                  <input id="dateLimiteInscription" name="dateLimiteInscription" type="datetime-local" defaultValue={editingEvenement?.dateLimiteInscription ? new Date(editingEvenement.dateLimiteInscription as string).toISOString().slice(0, 16) : ''} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="niveauPublic" className={labelClass}>Niveau</label>
                  <select id="niveauPublic" name="niveauPublic" defaultValue={editingEvenement?.niveauPublic as string ?? ''} className={inputClass}>
                    <option value="">—</option>
                    <option value="debutant">Débutant</option>
                    <option value="confirme">Confirmé</option>
                    <option value="tous">Tous</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="publicConcerne" className={labelClass}>Public concerné</label>
                <input id="publicConcerne" name="publicConcerne" type="text" maxLength={300} placeholder="dirigeants, indépendants…" defaultValue={editingEvenement?.publicConcerne as string ?? ''} className={inputClass} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([['ouvertATous', 'Ouvert à tous ?'], ['reserveMembres', 'Réservé aux membres ?'], ['participationInvite', 'Invités possibles ?']] as const).map(([name, label]) => (
                  <div key={name}>
                    <label htmlFor={name} className={labelClass}>{label}</label>
                    <select id={name} name={name} defaultValue={(editingEvenement?.[name] as string | undefined) ?? ''} className={inputClass}>
                      <option value="">—</option>
                      <option value="oui">Oui</option>
                      <option value="non">Non</option>
                    </select>
                  </div>
                ))}
              </div>
            </fieldset>

            {/* Contact & infos pratiques */}
            <fieldset className="space-y-3 pt-1 border-t border-[#E9E9EA]">
              <legend className="text-xs font-semibold text-[#4E5155]">Contact & infos pratiques</legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="contactNom" className={labelClass}>Contact — nom</label>
                  <input id="contactNom" name="contactNom" type="text" maxLength={200} defaultValue={editingEvenement?.contactNom as string ?? ''} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="contactEmail" className={labelClass}>Contact — email</label>
                  <input id="contactEmail" name="contactEmail" type="email" maxLength={254} defaultValue={editingEvenement?.contactEmail as string ?? ''} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="contactTelephone" className={labelClass}>Contact — téléphone</label>
                  <input id="contactTelephone" name="contactTelephone" type="tel" maxLength={30} defaultValue={editingEvenement?.contactTelephone as string ?? ''} className={inputClass} />
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-[#1D1E21]">
                  <input type="checkbox" name="parking" defaultChecked={editingEvenement?.parking === true} className="rounded border-[#DFE0E1]" />
                  Parking disponible
                </label>
                <label className="flex items-center gap-2 text-sm text-[#1D1E21]">
                  <input type="checkbox" name="accesPmr" defaultChecked={editingEvenement?.accesPmr === true} className="rounded border-[#DFE0E1]" />
                  Accès PMR
                </label>
              </div>
              <div>
                <label htmlFor="infosPratiques" className={labelClass}>Informations complémentaires</label>
                <textarea id="infosPratiques" name="infosPratiques" maxLength={1000} rows={2} defaultValue={editingEvenement?.infosPratiques as string ?? ''} className={`${inputClass} resize-none`} />
              </div>
            </fieldset>

            {errorMsg && (
              <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="p-2.5 rounded-xl bg-[#035AA6] text-white font-semibold text-sm hover:bg-[#02467F] disabled:opacity-60 transition-colors"
              >
                {isPending ? 'Enregistrement…' : mode === 'create' ? 'Publier l\'événement' : 'Enregistrer les modifications'}
              </button>
              <button
                type="button"
                onClick={() => changeMode('idle')}
                className="p-2.5 rounded-xl border border-[#DFE0E1] text-sm text-[#4E5155] hover:bg-[#E9E9EA] transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bouton afficher le formulaire (si la liste est non-vide et pas en mode form) */}
      {mode === 'idle' && localEvenements.length > 0 && (
        <button
          type="button"
          onClick={() => changeMode('create')}
          className="text-xs text-[#035AA6] hover:text-[#02467F] font-medium transition-colors mt-1"
        >
          + Ajouter un événement
        </button>
      )}
    </div>
  )
}

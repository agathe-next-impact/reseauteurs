'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, Users } from 'lucide-react'
import type { Evenement, Fournisseur, TypesEvenement, CategoriesActivite, Media } from '@/payload-types'
import type { CategoryOption } from '@/lib/categories'
import { stripEmojis } from '@/lib/sanitize'
import { todayParisDateString, yesterdayParisDateString } from '@/lib/dates'
import PhotosManager from './PhotosManager'

const STATUT_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  'publie': { label: 'Publie', color: '#065f46', bg: '#d1fae5' },
  'archive': { label: 'Archive', color: '#6b7280', bg: '#f3f4f6' },
}

// Doit rester aligne avec les constantes serveur dans collections/Événements.ts
const DESCRIPTION_COURTE_CHAR_LIMIT = 400
const DESCRIPTION_COURTE_WORD_LIMIT = 80

function countEventWords(text: string): number {
  const matches = text.match(/\p{L}+(?:[''\-]\p{L}+)*/gu)
  return matches ? matches.length : 0
}

interface FournisseurOption {
  id: number
  raisonSociale: string
  ville: string
}

interface EvenementsManagerProps {
  fournisseurId: number
  fournisseurs: FournisseurOption[]
  initialEvenements: Evenement[]
  typesEvenement: CategoryOption[]
  categoriesActivite: CategoryOption[]
  isOrganisateur?: boolean
  organisateurExterneId?: number
}

type FormData = {
  titre: string
  type: string
  dateDebut: string
  dateFin: string
  lieuNom: string
  lieuAdresse: string
  lieuCodePostal: string
  lieuVille: string
  descriptionCourte: string
  lienInscription: string
  emailContact: string
  fournisseur: string
  fournisseursAssocies: number[]
  activites: number[]
}

const emptyForm: FormData = {
  titre: '',
  type: '',
  dateDebut: '',
  dateFin: '',
  lieuNom: '',
  lieuAdresse: '',
  lieuCodePostal: '',
  lieuVille: '',
  descriptionCourte: '',
  lienInscription: '',
  emailContact: '',
  fournisseur: '',
  fournisseursAssocies: [],
  activites: [],
}

function eventToForm(ev: Evenement): FormData {
  const typeRaw = ev.type
  const typeId = typeof typeRaw === 'object' && typeRaw !== null ? String((typeRaw as TypesEvenement).id) : String(typeRaw)
  const fournRaw = ev.fournisseur
  const fournId =
    typeof fournRaw === 'object' && fournRaw !== null
      ? String((fournRaw as { id: number }).id)
      : fournRaw != null
        ? String(fournRaw)
        : ''
  const associesRaw = (ev as Evenement & { fournisseursAssocies?: Array<number | { id: number }> }).fournisseursAssocies ?? []
  const associesIds = associesRaw.map((f) => (typeof f === 'object' && f !== null ? f.id : (f as number)))
  const activitesRaw = (ev as Evenement & { activites: Array<number | CategoriesActivite> }).activites ?? []
  const activitesIds = activitesRaw.map((a) => (typeof a === 'object' && a !== null ? (a as CategoriesActivite).id : (a as number)))
  return {
    titre: ev.titre,
    type: typeId,
    dateDebut: ev.dateDebut ? ev.dateDebut.slice(0, 10) : '',
    dateFin: ev.dateFin ? ev.dateFin.slice(0, 10) : '',
    lieuNom: ev.lieuNom ?? '',
    lieuAdresse: ev.lieuAdresse ?? '',
    lieuCodePostal: ev.lieuCodePostal ?? '',
    lieuVille: ev.lieuVille,
    descriptionCourte: ev.descriptionCourte ?? '',
    lienInscription: ev.lienInscription ?? '',
    emailContact: ev.emailContact ?? '',
    fournisseur: fournId,
    fournisseursAssocies: associesIds,
    activites: activitesIds,
  }
}

export default function EvenementsManager({ fournisseurId, fournisseurs, initialEvenements, typesEvenement, categoriesActivite, isOrganisateur, organisateurExterneId }: EvenementsManagerProps) {
  const isMultiEtab = fournisseurs.length > 1
  const [evenements, setEvenements] = useState<Evenement[]>(initialEvenements)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [formError, setFormError] = useState('')

  const actifs = evenements.filter((e) => {
    if (e.statut === 'archive') return false
    const principalRaw = e.fournisseur as number | { id: number } | null | undefined
    const principalId =
      typeof principalRaw === 'object' && principalRaw !== null
        ? principalRaw.id
        : typeof principalRaw === 'number'
          ? principalRaw
          : null
    const orgExtRaw = (e as Evenement & { organisateurExterne?: number | { id: number } | null }).organisateurExterne
    const orgExtId =
      typeof orgExtRaw === 'object' && orgExtRaw !== null
        ? orgExtRaw.id
        : typeof orgExtRaw === 'number'
          ? orgExtRaw
          : null
    return isOrganisateur ? orgExtId === organisateurExterneId : principalId === fournisseurId
  }).length

  function openCreate() {
    setEditingId(null)
    setForm({
      ...emptyForm,
      type: typesEvenement[0]?.id ? String(typesEvenement[0].id) : '',
      fournisseur: String(fournisseurId),
    })
    setShowForm(true)
    setFormError('')
  }

  function toggleAssocie(id: number) {
    setForm((prev) => {
      const exists = prev.fournisseursAssocies.includes(id)
      return {
        ...prev,
        fournisseursAssocies: exists
          ? prev.fournisseursAssocies.filter((x) => x !== id)
          : [...prev.fournisseursAssocies, id],
      }
    })
  }

  function toggleActivite(id: number) {
    setForm((prev) => {
      const exists = prev.activites.includes(id)
      return {
        ...prev,
        activites: exists ? prev.activites.filter((x) => x !== id) : [...prev.activites, id],
      }
    })
  }

  function openEdit(ev: Evenement) {
    setEditingId(ev.id)
    setForm(eventToForm(ev))
    setShowForm(true)
    setFormError('')
  }

  function cancel() {
    setShowForm(false)
    setEditingId(null)
    setFormError('')
  }

  // Champs texte libre ou les emojis sont interdits. Les selects/dates/relations
  // ne sont pas concernées. Mirror serveur dans Événements.beforeChange.
  const TEXT_FIELDS_NO_EMOJI = new Set<keyof FormData>([
    'titre',
    'lieuNom',
    'lieuAdresse',
    'lieuCodePostal',
    'lieuVille',
    'descriptionCourte',
    'lienInscription',
    'emailContact',
  ])

  function updateField(field: keyof FormData, value: string) {
    const cleaned = TEXT_FIELDS_NO_EMOJI.has(field) ? stripEmojis(value) : value
    setForm((prev) => ({ ...prev, [field]: cleaned }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    // Garde-fou client identique aux limites serveur, pour eviter un aller-retour
    // reseau et afficher un message immediat. Le serveur reste l'autorité.

    // Refus à la création si l'événement est déjà terminé. Comparaison ancree
    // Europe/Paris (TZ métier) pour rester coherente avec l'attribut `min` des
    // <input type="date"> et avec le check serveur. On ne bloqué pas en édition :
    // un événement existant doit pouvoir être corrige même après sa date de fin.
    if (!editingId) {
      const todayParis = todayParisDateString()
      const yesterdayParis = yesterdayParisDateString()

      if (form.dateFin && form.dateFin < todayParis) {
        setFormError('La date de fin de l\'événement est déjà passée — impossible de créer un événement terminé.')
        toast.error('Événement déjà terminé.')
        return
      }
      if (!form.dateFin && form.dateDebut && form.dateDebut < yesterdayParis) {
        setFormError('La date de début de l\'événement est déjà passée — impossible de créer un événement terminé.')
        toast.error('Événement déjà terminé.')
        return
      }
    }

    const desc = form.descriptionCourte
    if (desc.length > DESCRIPTION_COURTE_CHAR_LIMIT) {
      setFormError(
        `La description est limitée a ${DESCRIPTION_COURTE_CHAR_LIMIT} caractères (${desc.length} actuellement).`,
      )
      toast.error('Description trop longue.')
      return
    }
    const wordsCount = countEventWords(desc)
    if (wordsCount > DESCRIPTION_COURTE_WORD_LIMIT) {
      setFormError(
        `La description est limitée a ${DESCRIPTION_COURTE_WORD_LIMIT} mots (${wordsCount} actuellement).`,
      )
      toast.error('Description trop longue.')
      return
    }

    setSaving(true)

    const payload: Record<string, unknown> = {
      titre: form.titre,
      type: Number(form.type),
      dateDebut: form.dateDebut,
      dateFin: form.dateFin || null,
      lieuNom: form.lieuNom || null,
      lieuAdresse: form.lieuAdresse || null,
      lieuCodePostal: form.lieuCodePostal || null,
      lieuVille: form.lieuVille,
      descriptionCourte: form.descriptionCourte || null,
      lienInscription: form.lienInscription || null,
      emailContact: form.emailContact || null,
      fournisseursAssocies: form.fournisseursAssocies,
      activites: form.activites,
    }

    if (isOrganisateur && organisateurExterneId) {
      payload.organisateurExterne = organisateurExterneId
    } else if (isMultiEtab && form.fournisseur) {
      payload.fournisseur = Number(form.fournisseur)
    }

    try {
      let res: Response
      if (editingId) {
        res = await fetch(`/api/evenements/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        if (isOrganisateur && organisateurExterneId) {
          payload.organisateurExterne = organisateurExterneId
        } else if (!payload.fournisseur) {
          payload.fournisseur = fournisseurId
        }
        payload.statut = 'publie'
        res = await fetch('/api/evenements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        const data = await res.json()
        const doc = data.doc as Evenement
        if (editingId) {
          setEvenements((prev) => prev.map((ev) => (ev.id === editingId ? doc : ev)))
        } else {
          setEvenements((prev) => [...prev, doc])
        }
        setShowForm(false)
        setEditingId(null)
        toast.success(editingId ? 'Événement mis à jour.' : 'Événement créé.')
      } else {
        const err = await res.json()
        setFormError(err.errors?.[0]?.message || err.message || 'Erreur lors de la sauvegarde.')
      }
    } catch {
      toast.error('Erreur de connexion.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Supprimer cet événement ?')) return

    setDeletingId(id)
    try {
      const res = await fetch(`/api/evenements/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setEvenements((prev) => prev.filter((ev) => ev.id !== id))
        toast.success('Événement supprimé.')
      } else {
        toast.error('Erreur lors de la suppression.')
      }
    } catch {
      toast.error('Erreur de connexion.')
    } finally {
      setDeletingId(null)
    }
  }

  const toggleVisibility = useCallback(async (ev: Evenement) => {
    const newVisible = ev.visible === false ? true : false
    setTogglingId(ev.id)
    try {
      const res = await fetch(`/api/evenements/${ev.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: newVisible }),
      })
      if (res.ok) {
        const data = await res.json()
        setEvenements((prev) => prev.map((e) => (e.id === ev.id ? (data.doc as Evenement) : e)))
        toast.success(newVisible ? 'Événement visible sur la carte.' : 'Événement masque de la carte.')
      } else {
        toast.error('Erreur lors de la modification.')
      }
    } catch {
      toast.error('Erreur de connexion.')
    } finally {
      setTogglingId(null)
    }
  }, [])

  const descLength = form.descriptionCourte.length
  const descWords = countEventWords(form.descriptionCourte)
  const descCharOver = descLength > DESCRIPTION_COURTE_CHAR_LIMIT
  const descWordsOver = descWords > DESCRIPTION_COURTE_WORD_LIMIT
  const descOver = descCharOver || descWordsOver

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>{actifs} événement{actifs !== 1 ? 's' : ''} actif{actifs !== 1 ? 's' : ''}</span>
        {!showForm && (
          <button onClick={openCreate} style={btnPrimaryStyle}>
            Créer un événement
          </button>
        )}
      </div>

      {/* Event form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={formStyle}>
          <h4 style={{ margin: '0 0 12px', fontSize: '1rem' }}>
            {editingId ? 'Modifier l\'evenement' : 'Nouvel événement'}
          </h4>

          {formError && (
            <div
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                fontSize: '0.85rem',
                marginBottom: 8,
                background: '#fef2f2',
                color: '#dc2626',
              }}
            >
              {formError}
            </div>
          )}

          {isMultiEtab && (
            <div style={{ marginBottom: 12, padding: 12, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6 }}>
              <label style={labelStyle}>Établissement principal *</label>
              <select
                value={form.fournisseur}
                onChange={(e) => updateField('fournisseur', e.target.value)}
                required
                style={inputStyle}
              >
                {fournisseurs.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.raisonSociale} — {f.ville}
                  </option>
                ))}
              </select>
              <label style={{ ...labelStyle, marginTop: 12 }}>Établissements associes</label>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 6px' }}>
                Selectionnez les autres établissements qui participent à cet événement.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {fournisseurs
                  .filter((f) => String(f.id) !== form.fournisseur)
                  .map((f) => {
                    const checked = form.fournisseursAssocies.includes(f.id)
                    return (
                      <label
                        key={f.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          border: '1px solid #d1d5db',
                          borderRadius: 999,
                          background: checked ? '#dbeafe' : '#fff',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAssocie(f.id)}
                          style={{ margin: 0 }}
                        />
                        {f.raisonSociale} — {f.ville}
                      </label>
                    )
                  })}
              </div>
            </div>
          )}

          <div style={gridStyle}>
            <Field label="Titre *" value={form.titre} onChange={(v) => updateField('titre', v)} required />
            <div>
              <label style={labelStyle}>Type *</label>
              <select
                value={form.type}
                onChange={(e) => updateField('type', e.target.value)}
                required
                style={inputStyle}
              >
                {typesEvenement.map((opt) => (
                  <option key={opt.value} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
            <Field
              label="Date de début *"
              type="date"
              value={form.dateDebut}
              onChange={(v) => updateField('dateDebut', v)}
              required
              min={editingId ? undefined : todayParisDateString()}
            />
            <Field
              label="Date de fin"
              type="date"
              value={form.dateFin}
              onChange={(v) => updateField('dateFin', v)}
              min={editingId ? undefined : (form.dateDebut || todayParisDateString())}
            />
          </div>

          <h5 style={{ margin: '16px 0 8px', fontSize: '0.9rem', color: '#374151' }}>Lieu</h5>
          <div style={gridStyle}>
            <Field label="Nom du lieu" value={form.lieuNom} onChange={(v) => updateField('lieuNom', v)} />
            <Field label="Adresse" value={form.lieuAdresse} onChange={(v) => updateField('lieuAdresse', v)} />
            <Field label="Code postal" value={form.lieuCodePostal} onChange={(v) => updateField('lieuCodePostal', v)} />
            <Field label="Ville *" value={form.lieuVille} onChange={(v) => updateField('lieuVille', v)} required />
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Activités concernées</label>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 6px' }}>
              Selectionnez les activités pertinentes pour cet événement.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {categoriesActivite.map((opt) => {
                const checked = form.activites.includes(opt.id)
                return (
                  <label
                    key={opt.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      border: '1px solid #d1d5db',
                      borderRadius: 999,
                      background: checked ? '#dbeafe' : '#fff',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleActivite(opt.id)}
                      style={{ margin: 0 }}
                    />
                    {opt.label}
                  </label>
                )
              })}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Description courte</label>
            <textarea
              value={form.descriptionCourte}
              onChange={(e) => updateField('descriptionCourte', e.target.value)}
              rows={3}
              style={{
                ...inputStyle,
                resize: 'vertical',
                borderColor: descOver ? '#dc2626' : '#d1d5db',
              }}
              aria-invalid={descOver}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                fontSize: '0.8rem',
                marginTop: 2,
              }}
            >
              <span style={{ color: descWordsOver ? '#dc2626' : '#9ca3af' }}>
                {descWords}/{DESCRIPTION_COURTE_WORD_LIMIT} mots
              </span>
              <span style={{ color: descCharOver || descLength > DESCRIPTION_COURTE_CHAR_LIMIT - 20 ? '#dc2626' : '#9ca3af' }}>
                {descLength}/{DESCRIPTION_COURTE_CHAR_LIMIT} caractères
              </span>
            </div>
            {descOver && (
              <p style={{ marginTop: 4, fontSize: '0.8rem', color: '#dc2626' }}>
                {descCharOver
                  ? `Description trop longue (${DESCRIPTION_COURTE_CHAR_LIMIT} caractères maximum).`
                  : `Description trop longue (${DESCRIPTION_COURTE_WORD_LIMIT} mots maximum).`}
              </p>
            )}
          </div>

          <div style={{ ...gridStyle, marginTop: 8 }}>
            <Field label="Lien vers l'événement" type="url" value={form.lienInscription} onChange={(v) => updateField('lienInscription', v)} />
            <Field label="Email de contact" type="email" value={form.emailContact} onChange={(v) => updateField('emailContact', v)} />
          </div>

          {editingId && (() => {
            const ev = evenements.find((e) => e.id === editingId)
            if (!ev) return null
            const participantsRaw = (ev as Evenement & { participantsSignales?: Array<Fournisseur | number> }).participantsSignales ?? []
            const participants = participantsRaw
              .filter((p): p is Fournisseur => typeof p === 'object' && p !== null)
            return (
              <>
              {participants.length > 0 && (
                <div style={{ marginTop: 16, padding: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                  <h5 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={15} />
                    Participants signalés ({participants.length})
                  </h5>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {participants.map((p) => (
                      <span
                        key={p.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          background: '#fff',
                          border: '1px solid #d1d5db',
                          borderRadius: 999,
                          fontSize: '0.8rem',
                          color: '#374151',
                        }}
                      >
                        {p.raisonSociale || `Revendeur #${p.id}`}
                        {p.ville && <span style={{ color: '#9ca3af' }}>— {p.ville}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ marginTop: 16, padding: 16, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                <h5 style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#374151' }}>Photos</h5>
                <PhotosManager
                  collection="evenements"
                  parentId={editingId}
                  altBase={ev.titre}
                  banniere={ev.banniere as Media | null | undefined}
                  logo={ev.logo as Media | null | undefined}
                  illustrations={((ev as Evenement & { illustrations?: Array<{ image: Media; id?: string | null }> }).illustrations ?? []).map((item) => ({
                    image: item.image as Media,
                    id: item.id,
                  }))}
                  plan="infinite"
                  onChange={(doc) => {
                    setEvenements((prev) => prev.map((e) => (e.id === editingId ? (doc as unknown as Evenement) : e)))
                  }}
                />
              </div>
              </>
            )
          })()}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              type="submit"
              disabled={saving || descOver}
              style={{
                ...btnPrimaryStyle,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                opacity: saving || descOver ? 0.6 : 1,
                cursor: saving || descOver ? 'not-allowed' : 'pointer',
              }}
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? 'Enregistrement...' : editingId ? 'Mettre a jour' : 'Créer'}
            </button>
            <button type="button" onClick={cancel} style={btnSecondaryStyle}>
              Annuler
            </button>
          </div>
          {!editingId && (
            <p style={{ marginTop: 8, fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic' }}>
              Les photos (bannière, logo, illustrations) seront editables après la création de l&apos;événement.
            </p>
          )}
        </form>
      )}

      {/* Events list */}
      {evenements.length === 0 && !showForm && (
        <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Aucun événement pour le moment.</p>
      )}

      {evenements.map((ev) => {
        const statut = STATUT_LABELS[ev.statut] ?? STATUT_LABELS['publie']
        // Le fournisseur courant est-il principal ou simplement co-organisateur ?
        // En tant que co-organisateur, l'événement est consultable mais ni
        // editable ni supprimable depuis ce dashboard.
        const principalRaw = ev.fournisseur as number | { id: number } | null | undefined
        const principalId =
          typeof principalRaw === 'object' && principalRaw !== null
            ? principalRaw.id
            : typeof principalRaw === 'number'
              ? principalRaw
              : null
        const orgExtRaw = (ev as Evenement & { organisateurExterne?: number | { id: number } | null }).organisateurExterne
        const orgExtId =
          typeof orgExtRaw === 'object' && orgExtRaw !== null
            ? orgExtRaw.id
            : typeof orgExtRaw === 'number'
              ? orgExtRaw
              : null
        const isOwner = isOrganisateur
          ? orgExtId === organisateurExterneId
          : principalId === fournisseurId
        return (
          <div key={ev.id} style={eventCardStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <strong>{ev.titre}</strong>
                <span style={{ ...badgeStyle, background: statut.bg, color: statut.color }}>
                  {statut.label}
                </span>
                {!isOwner && (
                  <span style={{ ...badgeStyle, background: '#eff6ff', color: '#1e40af' }}>
                    Co-organisateur
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                {new Date(ev.dateDebut).toLocaleDateString('fr-FR')}
                {ev.dateFin && ` — ${new Date(ev.dateFin).toLocaleDateString('fr-FR')}`}
                {' · '}{ev.lieuVille}
              </div>
              {(() => {
                const participants = (ev as Evenement & { participantsSignales?: Array<unknown> }).participantsSignales ?? []
                if (participants.length === 0) return null
                return (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: '0.8rem', color: '#059669' }}>
                    <Users size={13} />
                    {participants.length} participant{participants.length > 1 ? 's' : ''} signale{participants.length > 1 ? 's' : ''}
                  </div>
                )
              })()}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
              {isOwner && ev.statut === 'publie' && (
                <button
                  onClick={() => toggleVisibility(ev)}
                  disabled={togglingId === ev.id}
                  style={{ ...btnSmallStyle, display: 'inline-flex', alignItems: 'center', gap: 4, color: ev.visible === false ? '#9ca3af' : '#065f46', opacity: togglingId === ev.id ? 0.6 : 1 }}
                  title={ev.visible === false ? 'Rendre visible' : 'Masquer'}
                >
                  {togglingId === ev.id ? <Loader2 size={14} className="animate-spin" /> : ev.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
                  {ev.visible === false ? 'Masque' : 'Visible'}
                </button>
              )}
              {isOwner && ev.statut !== 'archive' && (
                <button onClick={() => openEdit(ev)} style={btnSmallStyle}>
                  Modifier
                </button>
              )}
              {isOwner && (
                <button
                  onClick={() => handleDelete(ev.id)}
                  disabled={deletingId === ev.id}
                  style={{ ...btnSmallStyle, color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 4, opacity: deletingId === ev.id ? 0.6 : 1 }}
                >
                  {deletingId === ev.id && <Loader2 size={14} className="animate-spin" />}
                  Supprimer
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  min,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  min?: string
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        min={min}
        style={inputStyle}
      />
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 500,
  color: '#374151',
  marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: '0.9rem',
}

const formStyle: React.CSSProperties = {
  padding: 16,
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  background: '#fafafa',
  marginBottom: 16,
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: 10,
}

const eventCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 12,
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  marginBottom: 8,
  background: '#fff',
}

const badgeStyle: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: '0.75rem',
  fontWeight: 600,
}

const btnPrimaryStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#1e40af',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const btnSecondaryStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#f3f4f6',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: '0.9rem',
  cursor: 'pointer',
}

const btnSmallStyle: React.CSSProperties = {
  padding: '4px 10px',
  background: 'none',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  fontSize: '0.8rem',
  cursor: 'pointer',
  color: '#374151',
}

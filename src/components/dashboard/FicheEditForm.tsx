'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import type { Fournisseur, CategoriesActivite, LabelsRse, Media } from '@/payload-types'
import type { CategoryOption } from '@/lib/categories'
import { UnlockBanner } from '@/components/ui/UnlockBanner'
import { stripEmojis } from '@/lib/sanitize'

// Strip les emojis à la saisie (uncontrolled input : on mute target.value).
// Le serveur (Fournisseurs.beforeChange) re-appliqué la même logique en
// defense-in-depth, mais le faire ici donne un feedback visuel immediat.
function stripEmojiOnInput(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
  const cleaned = stripEmojis(e.currentTarget.value)
  if (cleaned !== e.currentTarget.value) {
    e.currentTarget.value = cleaned
  }
}

interface LabelRSEOption {
  id: number
  label: string
  value: string
  logoUrl: string | null
}

const SOCIAL_PLATFORMS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'X (Twitter)' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'pinterest', label: 'Pinterest' },
] as const

type SocialPlatform = typeof SOCIAL_PLATFORMS[number]['value']

interface SocialLink {
  plateforme: SocialPlatform
  url: string
}

interface JobOffer {
  titre: string
  lien: string
  datePublication: string
}

interface FicheEditFormProps {
  fournisseur: Fournisseur
  plan: 'gratuit' | 'premium' | 'infinite'
  categories: CategoryOption[]
  labelsRSE: LabelRSEOption[]
}

export default function FicheEditForm({ fournisseur, plan, categories, labelsRSE }: FicheEditFormProps) {
  const [saving, setSaving] = useState(false)
  const [wordCount, setWordCount] = useState(
    (fournisseur.description ?? '').trim().split(/\s+/).filter(Boolean).length,
  )

  // 3-tier model: Premium (99 EUR) unlocks address/contact fields,
  // Infinite (219 EUR) additionally unlocks description + photos.
  const isPremiumOrAbove = plan === 'premium' || plan === 'infinite'
  const isInfinite = plan === 'infinite'
  const descriptionWordLimit = isInfinite ? 300 : isPremiumOrAbove ? 100 : 0

  // Extract current activité ID (relationship can be populated object or raw ID)
  const activiteRaw = fournisseur.activitePrincipale
  const currentActiviteId = typeof activiteRaw === 'object' && activiteRaw !== null
    ? (activiteRaw as CategoriesActivite).id
    : (activiteRaw as number)

  const initialSecondaires: number[] = (fournisseur.activitesSecondaires ?? []).map((a) =>
    typeof a === 'object' && a !== null ? (a as CategoriesActivite).id : (a as number),
  )
  const [secondaires, setSecondaires] = useState<number[]>(initialSecondaires)
  const [activitePrincipaleId, setActivitePrincipaleId] = useState<number>(currentActiviteId)

  const initialLabelsRSEIds: number[] = (fournisseur.labelsRSE ?? []).map((l) =>
    typeof l === 'object' && l !== null ? (l as LabelsRse).id : (l as number),
  )
  const [selectedLabelsRSE, setSelectedLabelsRSE] = useState<number[]>(initialLabelsRSEIds)
  const [rseWordCount, setRseWordCount] = useState(
    (fournisseur.descriptionRSE ?? '').trim().split(/\s+/).filter(Boolean).length,
  )

  const initialSocials: SocialLink[] = (fournisseur.reseauxSociaux ?? []).map((s) => ({
    plateforme: s.plateforme,
    url: s.url,
  }))
  const [socials, setSocials] = useState<SocialLink[]>(initialSocials)

  // Offres d'emploi (Infinite). Date stockee en ISO cote Payload ; on tronque a
  // yyyy-mm-dd pour alimenter un <input type="date"> controle.
  const initialOffres: JobOffer[] = (fournisseur.offresEmploi ?? []).map((o) => ({
    titre: o.titre ?? '',
    lien: o.lien ?? '',
    datePublication: o.datePublication ? o.datePublication.slice(0, 10) : '',
  }))
  const [offres, setOffres] = useState<JobOffer[]>(initialOffres)

  function toggleSecondaire(id: number) {
    setSecondaires((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleLabelRSE(id: number) {
    setSelectedLabelsRSE((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // Guard : empeche la soumission si une limite de mots est dépassée.
    // Le serveur rejette déjà (Fournisseurs.beforeChange), mais bloquer ici
    // evite l'aller-retour reseau et donne un retour immediat à l'utilisateur.
    if (isPremiumOrAbove && wordCount > descriptionWordLimit) {
      toast.error(`La description dépassé la limite (${wordCount}/${descriptionWordLimit} mots).`)
      return
    }
    if (isPremiumOrAbove && rseWordCount > 300) {
      toast.error(`La description RSE dépassé la limite (${rseWordCount}/300 mots).`)
      return
    }

    setSaving(true)

    const form = new FormData(e.currentTarget)
    const principaleId = Number(form.get('activitePrincipale'))
    const data: Record<string, unknown> = {
      raisonSociale: form.get('raisonSociale'),
      ville: form.get('ville'),
      activitePrincipale: principaleId,
      activitesSecondaires: secondaires.filter((id) => id !== principaleId),
    }

    if (isPremiumOrAbove) {
      data.adresse = form.get('adresse')
      data.codePostal = form.get('codePostal')
      data.telephone = form.get('telephone')
      data.emailContact = form.get('emailContact')
      data.siteWeb = form.get('siteWeb')
      data.boutiqueEnLigne = form.get('boutiqueEnLigne')
      data.lienDevis = form.get('lienDevis')
      data.reseauxSociaux = socials.filter((s) => s.url.trim())
    }

    if (isPremiumOrAbove) {
      data.description = form.get('description')
      data.labelsRSE = selectedLabelsRSE
      data.descriptionRSE = form.get('descriptionRSE')
    }

    if (isInfinite) {
      data.videoYoutube = form.get('videoYoutube') || ''
      data.offresEmploi = offres
        .filter((o) => o.titre.trim() && o.lien.trim() && o.datePublication)
        .map((o) => ({ titre: o.titre, lien: o.lien, datePublication: o.datePublication }))
    }

    try {
      const res = await fetch(`/api/fournisseurs/${fournisseur.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        toast.success('Fiche mise a jour avec succès.')
      } else {
        const err = await res.json()
        toast.error(err.errors?.[0]?.message || 'Un champ n\'est pas correct.')
      }
    } catch {
      toast.error('Erreur de connexion.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FieldGroup label="Informations générales">
        <FormField label="Raison sociale" name="raisonSociale" defaultValue={fournisseur.raisonSociale} required />
        <FormField label="Ville" name="ville" defaultValue={fournisseur.ville} required />
        <div>
          <label style={labelStyle}>Activité principale</label>
          <select
            name="activitePrincipale"
            defaultValue={currentActiviteId}
            required
            style={inputStyle}
            onChange={(e) => setActivitePrincipaleId(Number(e.target.value))}
          >
            {categories.map((opt) => (
              <option key={opt.value} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Activités secondaires</label>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 6px' }}>
            Selectionnez les autres activités que vous proposez.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {categories
              .filter((opt) => opt.id !== activitePrincipaleId)
              .map((opt) => {
                const checked = secondaires.includes(opt.id)
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
                      onChange={() => toggleSecondaire(opt.id)}
                      style={{ margin: 0 }}
                    />
                    {opt.label}
                  </label>
                )
              })}
          </div>
        </div>
      </FieldGroup>

      <FieldGroup label="Coordonnees" locked={!isPremiumOrAbove} upgradePlan="premium">
        <FormField label="Adresse" name="adresse" defaultValue={fournisseur.adresse ?? ''} disabled={!isPremiumOrAbove} />
        <FormField label="Code postal" name="codePostal" defaultValue={fournisseur.codePostal ?? ''} disabled={!isPremiumOrAbove} />
        <FormField label="Téléphone" name="telephone" defaultValue={fournisseur.telephone ?? ''} disabled={!isPremiumOrAbove} />
        <FormField label="Email de contact" name="emailContact" type="email" defaultValue={fournisseur.emailContact ?? ''} disabled={!isPremiumOrAbove} />
        <FormField label="Site web" name="siteWeb" defaultValue={fournisseur.siteWeb ?? ''} disabled={!isPremiumOrAbove} />
        <FormField label="Boutique en ligne" name="boutiqueEnLigne" defaultValue={fournisseur.boutiqueEnLigne ?? ''} disabled={!isPremiumOrAbove} />
        <FormField label="Lien demande de devis" name="lienDevis" defaultValue={fournisseur.lienDevis ?? ''} disabled={!isPremiumOrAbove} />

        <div>
          <label style={labelStyle}>Reseaux sociaux</label>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 8px' }}>
            Ajoutez les liens vers vos profils (6 max).
          </p>
          {socials.map((social, index) => (
            <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <select
                value={social.plateforme}
                disabled={!isPremiumOrAbove}
                onChange={(e) => {
                  const updated = [...socials]
                  updated[index] = { ...updated[index], plateforme: e.target.value as SocialPlatform }
                  setSocials(updated)
                }}
                style={{ ...inputStyle, width: 160, flexShrink: 0 }}
              >
                {SOCIAL_PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <input
                type="url"
                placeholder="https://..."
                value={social.url}
                disabled={!isPremiumOrAbove}
                onChange={(e) => {
                  const updated = [...socials]
                  updated[index] = { ...updated[index], url: stripEmojis(e.target.value) }
                  setSocials(updated)
                }}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                disabled={!isPremiumOrAbove}
                onClick={() => setSocials(socials.filter((_, i) => i !== index))}
                style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', flexShrink: 0 }}
                title="Supprimer"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {socials.length < 6 && (
            <button
              type="button"
              disabled={!isPremiumOrAbove}
              onClick={() => setSocials([...socials, { plateforme: 'facebook', url: '' }])}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                background: 'none',
                border: '1px dashed #d1d5db',
                borderRadius: 6,
                fontSize: '0.8rem',
                color: '#6b7280',
                cursor: isPremiumOrAbove ? 'pointer' : 'not-allowed',
                opacity: isPremiumOrAbove ? 1 : 0.5,
              }}
            >
              <Plus size={14} />
              Ajouter un reseau social
            </button>
          )}
        </div>
      </FieldGroup>

      <FieldGroup label="Description" locked={!isPremiumOrAbove} upgradePlan="premium">
        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            name="description"
            defaultValue={fournisseur.description ?? ''}
            disabled={!isPremiumOrAbove}
            rows={5}
            style={{ ...inputStyle, resize: 'vertical' }}
            onChange={(e) => {
              stripEmojiOnInput(e)
              setWordCount(e.target.value.trim().split(/\s+/).filter(Boolean).length)
            }}
          />
          {isPremiumOrAbove && (
            <p style={{ fontSize: '0.8rem', color: wordCount > descriptionWordLimit ? '#ef4444' : '#6b7280', marginTop: 4 }}>
              {wordCount}/{descriptionWordLimit} mots
            </p>
          )}
        </div>
      </FieldGroup>

      <FieldGroup label="Engagements RSE" locked={!isPremiumOrAbove} upgradePlan="premium">
        <div>
          <label style={labelStyle}>Labels RSE</label>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 6px' }}>
            Selectionnez les labels RSE que vous détenez.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {labelsRSE.map((opt) => {
              const checked = selectedLabelsRSE.includes(opt.id)
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
                    background: checked ? '#d1fae5' : '#fff',
                    fontSize: '0.8rem',
                    cursor: isPremiumOrAbove ? 'pointer' : 'not-allowed',
                    opacity: isPremiumOrAbove ? 1 : 0.5,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!isPremiumOrAbove}
                    onChange={() => toggleLabelRSE(opt.id)}
                    style={{ margin: 0 }}
                  />
                  {opt.logoUrl && (
                    <img src={opt.logoUrl} alt={opt.label} width={20} height={20} style={{ objectFit: 'contain', borderRadius: 2 }} />
                  )}
                  {opt.label}
                </label>
              )
            })}
          </div>
        </div>
        <div>
          <label style={labelStyle}>Démarche RSE</label>
          <textarea
            name="descriptionRSE"
            defaultValue={fournisseur.descriptionRSE ?? ''}
            disabled={!isPremiumOrAbove}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical' }}
            onChange={(e) => {
              stripEmojiOnInput(e)
              setRseWordCount(e.target.value.trim().split(/\s+/).filter(Boolean).length)
            }}
          />
          {isPremiumOrAbove && (
            <p style={{ fontSize: '0.8rem', color: rseWordCount > 300 ? '#ef4444' : '#6b7280', marginTop: 4 }}>
              {rseWordCount}/300 mots
            </p>
          )}
        </div>
      </FieldGroup>

      <FieldGroup label="Vidéo YouTube" locked={!isInfinite} upgradePlan="infinite">
        <FormField
          label="Lien YouTube"
          name="videoYoutube"
          defaultValue={fournisseur.videoYoutube ?? ''}
          disabled={!isInfinite}
        />
        {isInfinite && (
          <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '-4px 0 0' }}>
            Collez un lien YouTube (ex: https://www.youtube.com/watch?v=xxx ou https://youtu.be/xxx).
          </p>
        )}
      </FieldGroup>

      <FieldGroup label="Offres d'emploi" locked={!isInfinite} upgradePlan="infinite">
        <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 8px' }}>
          Publiez vos offres d&apos;emploi (10 max).
        </p>
        {offres.map((offre, index) => (
          <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10, padding: 10, border: '1px solid #e5e7eb', borderRadius: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Titre du poste"
                value={offre.titre}
                disabled={!isInfinite}
                onChange={(e) => {
                  const updated = [...offres]
                  updated[index] = { ...updated[index], titre: stripEmojis(e.target.value) }
                  setOffres(updated)
                }}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                disabled={!isInfinite}
                onClick={() => setOffres(offres.filter((_, i) => i !== index))}
                style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', flexShrink: 0 }}
                title="Supprimer"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <input
              type="url"
              placeholder="https://... (lien vers l'offre)"
              value={offre.lien}
              disabled={!isInfinite}
              onChange={(e) => {
                const updated = [...offres]
                updated[index] = { ...updated[index], lien: stripEmojis(e.target.value) }
                setOffres(updated)
              }}
              style={inputStyle}
            />
            <input
              type="date"
              value={offre.datePublication}
              disabled={!isInfinite}
              onChange={(e) => {
                const updated = [...offres]
                updated[index] = { ...updated[index], datePublication: e.target.value }
                setOffres(updated)
              }}
              style={inputStyle}
            />
          </div>
        ))}
        {offres.length < 10 && (
          <button
            type="button"
            disabled={!isInfinite}
            onClick={() => setOffres([...offres, { titre: '', lien: '', datePublication: '' }])}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: 'none',
              border: '1px dashed #d1d5db',
              borderRadius: 6,
              fontSize: '0.8rem',
              color: '#6b7280',
              cursor: isInfinite ? 'pointer' : 'not-allowed',
              opacity: isInfinite ? 1 : 0.5,
            }}
          >
            <Plus size={14} />
            Ajouter une offre
          </button>
        )}
      </FieldGroup>

      {(() => {
        const overDescription = isPremiumOrAbove && wordCount > descriptionWordLimit
        const overRSE = isPremiumOrAbove && rseWordCount > 300
        const blocked = overDescription || overRSE
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              type="submit"
              disabled={saving || blocked}
              style={{
                ...btnStyle,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                opacity: blocked ? 0.5 : 1,
                cursor: blocked ? 'not-allowed' : 'pointer',
              }}
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            {blocked && (
              <p style={{ fontSize: '0.8rem', color: '#ef4444', margin: 0 }}>
                {overDescription
                  ? `Description : ${wordCount}/${descriptionWordLimit} mots — reduisez avant d'enregistrer.`
                  : `Description RSE : ${rseWordCount}/300 mots — reduisez avant d'enregistrer.`}
              </p>
            )}
          </div>
        )
      })()}
    </form>
  )
}

function FieldGroup({
  label,
  locked,
  upgradePlan,
  children,
}: {
  label: string
  locked?: boolean
  upgradePlan?: 'premium' | 'infinite'
  children: React.ReactNode
}) {
  return (
    <fieldset style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, margin: 0 }}>
      <legend style={{ fontWeight: 600, fontSize: '0.95rem', padding: '0 8px' }}>{label}</legend>
      {locked && upgradePlan && <UnlockBanner plan={upgradePlan} className="mb-3.5" />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </fieldset>
  )
}

function FormField({
  label,
  name,
  defaultValue,
  type = 'text',
  required,
  disabled,
}: {
  label: string
  name: string
  defaultValue: string
  type?: string
  required?: boolean
  disabled?: boolean
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
        onChange={stripEmojiOnInput}
        style={{ ...inputStyle, opacity: disabled ? 0.5 : 1 }}
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

const btnStyle: React.CSSProperties = {
  padding: '10px 24px',
  background: '#1e40af',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
  alignSelf: 'flex-start',
}

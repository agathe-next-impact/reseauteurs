'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Lock } from 'lucide-react'
import type { OrganisateursEvenement } from '@/payload-types'
import type { CategoryOption } from '@/lib/categories'
import { stripEmojis } from '@/lib/sanitize'

// Strip les emojis à la saisie (uncontrolled input : on mute target.value).
// Le serveur (OrganisateursEvenements.beforeChange) re-appliqué en defense-in-depth.
function stripEmojiOnInput(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
  const cleaned = stripEmojis(e.currentTarget.value)
  if (cleaned !== e.currentTarget.value) {
    e.currentTarget.value = cleaned
  }
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

interface OrganisateurFicheEditFormProps {
  organisateur: OrganisateursEvenement
  plan: 'gratuit' | 'premium' | 'infinite'
  categories: CategoryOption[]
}

export default function OrganisateurFicheEditForm({ organisateur, plan, categories }: OrganisateurFicheEditFormProps) {
  const [saving, setSaving] = useState(false)
  const [wordCount, setWordCount] = useState(
    (organisateur.description ?? '').trim().split(/\s+/).filter(Boolean).length,
  )

  const isInfinite = plan === 'infinite'

  const initialSocials: SocialLink[] = (organisateur.reseauxSociaux ?? []).map((s) => ({
    plateforme: s.plateforme as SocialPlatform,
    url: s.url,
  }))

  const initialActivites: number[] = (organisateur.activites ?? []).map((a) =>
    typeof a === 'object' && a !== null ? (a as { id: number }).id : (a as number),
  )

  const [sociaux, setSociaux] = useState<SocialLink[]>(initialSocials)
  const [selectedActivites, setSelectedActivites] = useState<number[]>(initialActivites)

  function addSocial() {
    if (sociaux.length >= 6) return
    setSociaux([...sociaux, { plateforme: 'facebook', url: '' }])
  }

  function removeSocial(index: number) {
    setSociaux(sociaux.filter((_, i) => i !== index))
  }

  function updateSocial(index: number, field: 'plateforme' | 'url', value: string) {
    const cleanValue = field === 'url' ? stripEmojis(value) : value
    setSociaux(sociaux.map((s, i) => (i === index ? { ...s, [field]: cleanValue } : s)))
  }

  function toggleActivite(id: number) {
    setSelectedActivites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // Guard : empeche la soumission si la description dépassé 500 mots.
    // Le serveur (OrganisateursEvenements.beforeChange) rejette déjà, mais
    // bloquer ici evite l'aller-retour reseau et donne un retour immediat.
    if (wordCount > 500) {
      toast.error(`La description dépassé la limite (${wordCount}/500 mots).`)
      return
    }

    setSaving(true)

    const formData = new FormData(e.currentTarget)
    const data: Record<string, unknown> = {
      nom: formData.get('nom'),
      ville: formData.get('ville'),
      adresse: formData.get('adresse') || null,
      codePostal: formData.get('codePostal') || null,
      telephone: formData.get('telephone') || null,
      emailContact: formData.get('emailContact') || null,
      siteWeb: formData.get('siteWeb') || null,
      description: formData.get('description') || null,
      videoYoutube: formData.get('videoYoutube') || null,
      reseauxSociaux: sociaux.filter((s) => s.url.trim()),
      activites: selectedActivites,
    }

    try {
      const res = await fetch(`/api/organisateurs-evenements/${organisateur.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        toast.success('Fiche mise a jour.')
      } else {
        const err = await res.json()
        toast.error(err.errors?.[0]?.message || 'Erreur lors de la sauvegarde.')
      }
    } catch {
      toast.error('Erreur de connexion.')
    } finally {
      setSaving(false)
    }
  }

  if (!isInfinite) {
    return (
      <div className="text-center py-12">
        <Lock size={40} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-semibold text-text-dark mb-2">Abonnement Infinite requis</h3>
        <p className="text-sm text-text-light mb-4">
          Souscrivez a l&apos;abonnement Infinite (219 EUR/an) pour activer votre fiche organisateur et créer des événements.
        </p>
        <a
          href="/dashboard/abonnement"
          className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors no-underline"
        >
          Voir les abonnements
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Général info */}
      <section>
        <h3 className="text-sm font-semibold text-text-dark mb-4">Informations générales</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="nom" className="block text-sm font-medium text-text-medium mb-1.5">
              Nom de l&apos;organisation *
            </label>
            <input
              id="nom"
              name="nom"
              type="text"
              required
              defaultValue={organisateur.nom}
              onChange={stripEmojiOnInput}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label htmlFor="ville" className="block text-sm font-medium text-text-medium mb-1.5">
              Ville
            </label>
            <input
              id="ville"
              name="ville"
              type="text"
              defaultValue={organisateur.ville ?? ''}
              onChange={stripEmojiOnInput}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors"
            />
          </div>
        </div>

        {/* Activities */}
        {categories.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-text-medium mb-2">Secteurs / activités</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleActivite(cat.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all cursor-pointer ${
                    selectedActivites.includes(cat.id)
                      ? 'border-primary bg-primary-light/30 text-primary'
                      : 'border-gray-200 text-text-light hover:border-gray-300'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: cat.couleur }}
                  />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Contact info */}
      <section>
        <h3 className="text-sm font-semibold text-text-dark mb-4">Coordonnees</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="adresse" className="block text-sm font-medium text-text-medium mb-1.5">Adresse</label>
            <input
              id="adresse"
              name="adresse"
              type="text"
              defaultValue={organisateur.adresse ?? ''}
              onChange={stripEmojiOnInput}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label htmlFor="codePostal" className="block text-sm font-medium text-text-medium mb-1.5">Code postal</label>
            <input
              id="codePostal"
              name="codePostal"
              type="text"
              defaultValue={organisateur.codePostal ?? ''}
              onChange={stripEmojiOnInput}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label htmlFor="telephone" className="block text-sm font-medium text-text-medium mb-1.5">Téléphone</label>
            <input
              id="telephone"
              name="telephone"
              type="text"
              defaultValue={organisateur.telephone ?? ''}
              onChange={stripEmojiOnInput}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label htmlFor="emailContact" className="block text-sm font-medium text-text-medium mb-1.5">Email de contact</label>
            <input
              id="emailContact"
              name="emailContact"
              type="email"
              defaultValue={organisateur.emailContact ?? ''}
              onChange={stripEmojiOnInput}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="siteWeb" className="block text-sm font-medium text-text-medium mb-1.5">Site web</label>
            <input
              id="siteWeb"
              name="siteWeb"
              type="text"
              defaultValue={organisateur.siteWeb ?? ''}
              onChange={stripEmojiOnInput}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors"
              placeholder="https://..."
            />
          </div>
        </div>

        {/* Social links */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-text-medium mb-2">Reseaux sociaux</label>
          <div className="space-y-2">
            {sociaux.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  value={s.plateforme}
                  onChange={(e) => updateSocial(i, 'plateforme', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors"
                >
                  {SOCIAL_PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={s.url}
                  onChange={(e) => updateSocial(i, 'url', e.target.value)}
                  placeholder="https://..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => removeSocial(i)}
                  className="p-2 text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {sociaux.length < 6 && (
              <button
                type="button"
                onClick={addSocial}
                className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-hover font-medium cursor-pointer"
              >
                <Plus size={14} />
                Ajouter un reseau
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Description */}
      <section>
        <h3 className="text-sm font-semibold text-text-dark mb-4">Description</h3>
        <div>
          <textarea
            name="description"
            defaultValue={organisateur.description ?? ''}
            maxLength={2000}
            rows={6}
            onChange={(e) => {
              stripEmojiOnInput(e)
              const count = e.target.value.trim().split(/\s+/).filter(Boolean).length
              setWordCount(count)
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors resize-y"
            placeholder="Decrivez votre organisation et vos activités..."
          />
          <div className="flex justify-between mt-1">
            <p className={`text-sm ${wordCount > 500 ? 'text-red-500' : 'text-text-light'}`}>
              {wordCount} / 500 mots
            </p>
          </div>
        </div>
      </section>

      {/* Vidéo YouTube */}
      <section>
        <h3 className="text-sm font-semibold text-text-dark mb-4">Vidéo YouTube</h3>
        <input
          name="videoYoutube"
          type="text"
          defaultValue={organisateur.videoYoutube ?? ''}
          onChange={stripEmojiOnInput}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-primary transition-colors"
          placeholder="https://www.youtube.com/watch?v=..."
        />
      </section>

      {/* Submit */}
      <div className="flex flex-col items-end gap-1.5 pt-4 border-t border-border-light">
        <button
          type="submit"
          disabled={saving || wordCount > 500}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          Enregistrer
        </button>
        {wordCount > 500 && (
          <p className="text-sm text-red-500">
            Description : {wordCount}/500 mots — reduisez avant d&apos;enregistrer.
          </p>
        )}
      </div>
    </form>
  )
}

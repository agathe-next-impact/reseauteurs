/**
 * ImageUploadField — Upload d'image self-service (photo de profil, logo, visuel).
 *
 * Envoie le fichier sur POST /api/media (auth cookie ; access `create: !!user`,
 * types/taille re-validés côté serveur par la collection Media), puis délègue la
 * persistance au parent via `onUploaded` :
 *   - PATCH de l'entité (photo réseauteur, logo réseau — pattern PartenaireForm), ou
 *   - stockage local de l'id, appliqué à la soumission d'une Server Action (événements).
 * `onUploaded` retourne un message d'erreur (string) pour l'afficher, sinon void.
 */
'use client'

import { useState } from 'react'
import { ImageIcon, Loader2, Upload } from 'lucide-react'

const MAX_SIZE_MB = 4.5
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

export interface UploadedMedia {
  id: number | string
  /** URL d'aperçu (thumbnail si dispo, sinon original) */
  url: string | null
}

interface ImageUploadFieldProps {
  label: string
  /** Texte d'aide (dimensions recommandées…) — le format/poids max est ajouté automatiquement */
  hint?: string
  /** Texte alternatif du média créé (champ requis de la collection media) */
  alt: string
  currentUrl?: string | null
  /** 'round' pour une photo de personne, 'square' pour un logo/visuel */
  shape?: 'square' | 'round'
  onUploaded: (media: UploadedMedia) => Promise<string | void> | string | void
}

export function ImageUploadField({
  label,
  hint,
  alt,
  currentUrl,
  shape = 'square',
  onUploaded,
}: ImageUploadFieldProps) {
  const [url, setUrl] = useState<string | null>(currentUrl ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setError(null)
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Fichier trop lourd (max ${MAX_SIZE_MB} Mo).`)
      return
    }
    if (!ACCEPTED.includes(file.type)) {
      setError('Format non supporté (JPG, PNG ou WebP).')
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('_payload', JSON.stringify({ alt }))
      const res = await fetch('/api/media', { method: 'POST', body: fd, credentials: 'include' })
      if (!res.ok) {
        setError("Erreur lors de l'envoi de l'image.")
        return
      }
      const json = await res.json()
      const media = json.doc ?? json
      const displayUrl: string | null = media.sizes?.thumbnail?.url ?? media.url ?? null
      const persistError = await onUploaded({ id: media.id, url: displayUrl })
      if (typeof persistError === 'string') {
        setError(persistError)
        return
      }
      setUrl(displayUrl)
    } catch {
      setError("Erreur lors de l'envoi de l'image.")
    } finally {
      setBusy(false)
    }
  }

  const previewShape = shape === 'round' ? 'rounded-full' : 'rounded-xl'

  return (
    <div>
      <p className="block text-xs font-medium text-[#52525b] mb-1">{label}</p>
      <div className="flex items-center gap-4">
        <div
          className={`w-16 h-16 ${previewShape} border border-[#e4e4e7] bg-[#faf9f5] flex items-center justify-center overflow-hidden shrink-0`}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={alt} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={20} className="text-[#d4d4d8]" aria-hidden />
          )}
        </div>
        <div className="min-w-0">
          <label
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-[#e4e4e7] cursor-pointer transition-colors ${
              busy ? 'opacity-60 cursor-wait' : 'hover:border-[#2563EB] hover:text-[#2563EB]'
            }`}
          >
            {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Upload size={15} aria-hidden />}
            {url ? 'Remplacer' : 'Ajouter une image'}
            <input
              type="file"
              accept={ACCEPTED.join(',')}
              onChange={handleFile}
              disabled={busy}
              className="hidden"
            />
          </label>
          <p className="text-xs text-[#a1a1aa] mt-1.5">
            {hint ? `${hint} ` : ''}JPG, PNG ou WebP — max {MAX_SIZE_MB} Mo.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700 mt-2">
          {error}
        </p>
      )}
    </div>
  )
}

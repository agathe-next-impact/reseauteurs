'use client'

import { useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Upload, Loader2, ImageIcon } from 'lucide-react'
import type { Media } from '@/payload-types'

export type PhotoSlot = 'banniere' | 'logo' | 'illustration'

interface PhotosManagerProps {
  /** Collection cible : 'fournisseurs' ou 'evenements' */
  collection: 'fournisseurs' | 'evenements'
  /** ID de l'enregistrement parent */
  parentId: number
  /** Texte alt de base */
  altBase: string
  /** Bannière courante */
  banniere?: Media | null
  /** Logo courant */
  logo?: Media | null
  /** Illustrations courantes (max 6) */
  illustrations?: Array<{ image: Media; id?: string | null }>
  /** Plan effectif du fournisseur — contrôle l'affichage bannière/illustrations */
  plan: 'gratuit' | 'premium' | 'infinite'
  /** Callback appelé après chaque succès avec le doc à jour */
  onChange?: (doc: Record<string, unknown>) => void
}

const MAX_ILLUSTRATIONS_BY_PLAN: Record<string, number> = {
  gratuit: 0,
  premium: 1,
  infinite: 6,
}
const MAX_SIZE_MB = 4.5
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function PhotosManager({
  collection,
  parentId,
  altBase,
  banniere: initialBanniere = null,
  logo: initialLogo = null,
  illustrations: initialIllustrations = [],
  plan,
  onChange,
}: PhotosManagerProps) {
  const [bannière, setBanniere] = useState<Media | null>(initialBanniere)
  const [logo, setLogo] = useState<Media | null>(initialLogo)
  const [illustrations, setIllustrations] =
    useState<Array<{ image: Media; id?: string | null }>>(initialIllustrations)
  const maxIllustrations = MAX_ILLUSTRATIONS_BY_PLAN[plan] ?? 0
  const [busy, setBusy] = useState<string | null>(null)

  async function uploadMedia(file: File, alt: string): Promise<Media | null> {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Le fichier dépassé ${MAX_SIZE_MB} Mo.`)
      return null
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Format non supporté. Utilisez JPG, PNG ou WebP.')
      return null
    }
    const formData = new FormData()
    formData.append('file', file)
    formData.append('_payload', JSON.stringify({ alt }))
    const res = await fetch('/api/media', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err?.errors?.[0]?.message || 'Erreur lors de l\'upload.')
      return null
    }
    const json = await res.json()
    return (json.doc ?? json) as Media
  }

  async function patchParent(payload: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const res = await fetch(`/api/${collection}/${parentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err?.errors?.[0]?.message || err?.message || `Erreur ${res.status}`)
      return null
    }
    const data = await res.json()
    onChange?.(data.doc ?? data)
    return data.doc ?? data
  }

  async function handleSlotUpload(slot: 'banniere' | 'logo', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setBusy(slot)
    try {
      const media = await uploadMedia(file, `${altBase} — ${slot}`)
      if (!media) return
      const updated = await patchParent({ [slot]: media.id })
      if (!updated) return
      if (slot === 'banniere') setBanniere(media)
      else setLogo(media)
      toast.success(`${slot === 'banniere' ? 'Bannière' : 'Logo'} mis a jour.`)
    } finally {
      setBusy(null)
    }
  }

  async function handleSlotDelete(slot: 'banniere' | 'logo') {
    if (!window.confirm(`Supprimer ${slot === 'banniere' ? 'la bannière' : 'le logo'} ?`)) return
    setBusy(slot)
    try {
      const updated = await patchParent({ [slot]: null })
      if (!updated) return
      if (slot === 'banniere') setBanniere(null)
      else setLogo(null)
      toast.success('Photo retiree.')
    } finally {
      setBusy(null)
    }
  }

  async function handleIllustrationUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    e.target.value = ''

    const slots = maxIllustrations - illustrations.length
    if (slots <= 0) return
    const batch = files.slice(0, slots)

    setBusy('illustration-add')
    try {
      const uploaded: Media[] = []
      for (const file of batch) {
        const media = await uploadMedia(file, `${altBase} — illustration`)
        if (media) uploaded.push(media)
      }
      if (uploaded.length === 0) return

      const newList = [...illustrations, ...uploaded.map((m) => ({ image: m }))]
      const updated = await patchParent({ illustrations: newList.map((it) => ({ image: it.image.id })) })
      if (!updated) return
      const fresh = ((updated.illustrations ?? []) as Array<{ image: number | Media; id?: string | null }>).map(
        (item) => ({
          image:
            typeof item.image === 'object' && item.image !== null
              ? (item.image as Media)
              : newList.find((g) => g.image.id === item.image)?.image ?? uploaded[0],
          id: item.id,
        }),
      )
      setIllustrations(fresh)
      toast.success(`${uploaded.length} illustration${uploaded.length > 1 ? 's' : ''} ajoutee${uploaded.length > 1 ? 's' : ''}.`)
    } finally {
      setBusy(null)
    }
  }

  async function handleIllustrationDelete(index: number) {
    if (!window.confirm('Supprimer cette illustration ?')) return
    setBusy(`illustration-${index}`)
    try {
      const newList = illustrations.filter((_, i) => i !== index)
      const updated = await patchParent({ illustrations: newList.map((it) => ({ image: it.image.id })) })
      if (!updated) return
      const fresh = ((updated.illustrations ?? []) as Array<{ image: number | Media; id?: string | null }>).map(
        (item) => ({
          image:
            typeof item.image === 'object' && item.image !== null
              ? (item.image as Media)
              : newList.find((g) => g.image.id === item.image)?.image ?? (null as unknown as Media),
          id: item.id,
        }),
      )
      setIllustrations(fresh)
      toast.success('Illustration retiree.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Bannière — Premium+ */}
      {(plan === 'premium' || plan === 'infinite') && (
        <SlotBlock
          label="Bannière"
          helper="Image large affichee en tête de la fiche (recommande 1200×400)."
          media={bannière}
          slot="banniere"
          busy={busy === 'banniere'}
          aspectClass="aspect-[3/1]"
          onUpload={(e) => handleSlotUpload('banniere', e)}
          onDelete={() => handleSlotDelete('banniere')}
        />
      )}

      {/* Logo */}
      <SlotBlock
        label="Logo"
        helper="Logo carre de l'entreprise (recommande 400×400)."
        media={logo}
        slot="logo"
        busy={busy === 'logo'}
        aspectClass="aspect-square max-w-[200px]"
        onUpload={(e) => handleSlotUpload('logo', e)}
        onDelete={() => handleSlotDelete('logo')}
      />

      {/* Illustrations — Premium+ */}
      {(plan === 'premium' || plan === 'infinite') && <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-text-dark">Illustrations</h3>
            <p className="text-sm text-text-light mt-0.5">
              {illustrations.length}/{maxIllustrations} photos
            </p>
          </div>
          {illustrations.length < maxIllustrations && (
            <label
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                busy === 'illustration-add'
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-primary-hover cursor-pointer'
              }`}
            >
              {busy === 'illustration-add' ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Upload size={15} />
                  Ajouter
                </>
              )}
              <input
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                multiple
                onChange={handleIllustrationUpload}
                disabled={busy === 'illustration-add'}
                className="hidden"
              />
            </label>
          )}
        </div>

        {illustrations.length === 0 ? (
          <div className="border-2 border-dashed border-border-light/40 rounded-xl p-8 text-center">
            <ImageIcon size={24} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-text-light">Aucune illustration. JPG, PNG ou WebP — max {MAX_SIZE_MB} Mo</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {illustrations.map((item, i) => {
              const url =
                item.image?.sizes?.thumbnail?.url || item.image?.sizes?.card?.url || item.image?.url
              const isDeleting = busy === `illustration-${i}`
              return (
                <div
                  key={item.id ?? `${item.image?.id}-${i}`}
                  className="relative group rounded-lg overflow-hidden border border-border-light/40"
                >
                  {url ? (
                    <Image
                      src={url}
                      alt={`${altBase} — illustration ${i + 1}`}
                      width={300}
                      height={300}
                      className="w-full aspect-square object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-gray-100" />
                  )}
                  <button
                    type="button"
                    onClick={() => handleIllustrationDelete(i)}
                    disabled={isDeleting}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all disabled:opacity-100"
                    title="Supprimer"
                  >
                    {isDeleting ? <Loader2 size={14} className="animate-spin" /> : null}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>}
    </div>
  )
}

function SlotBlock({
  label,
  helper,
  media,
  busy,
  aspectClass,
  onUpload,
  onDelete,
}: {
  label: string
  helper: string
  media: Media | null
  slot: 'banniere' | 'logo'
  busy: boolean
  aspectClass: string
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDelete: () => void
}) {
  const url = media?.sizes?.card?.url || media?.sizes?.full?.url || media?.url
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-text-dark">{label}</h3>
          <p className="text-sm text-text-light mt-0.5">{helper}</p>
        </div>
        <div className="flex items-center gap-2">
          {media && (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="inline-flex items-center gap-1.5 p-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Retirer
            </button>
          )}
          <label
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              busy
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-primary-hover cursor-pointer'
            }`}
          >
            {busy ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Upload...
              </>
            ) : (
              <>
                <Upload size={15} />
                {media ? 'Remplacer' : 'Ajouter'}
              </>
            )}
            <input
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              onChange={onUpload}
              disabled={busy}
              className="hidden"
            />
          </label>
        </div>
      </div>
      {url ? (
        <div className={`${aspectClass} rounded-lg overflow-hidden border border-border-light/40`}>
          <Image
            src={url}
            alt={label}
            width={1200}
            height={400}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className={`${aspectClass} rounded-lg border-2 border-dashed border-border-light/40 flex items-center justify-center`}>
          <ImageIcon size={24} className="text-gray-300" />
        </div>
      )}
    </div>
  )
}

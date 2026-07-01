'use client'

/**
 * CreerLocalButton — Bouton + formulaire inline pour créer un chapitre local.
 *
 * Gate côté serveur (Server Action) :
 *   - Vérifie peutCreerLocalAsync(userId, payload)
 *   - Refuse si l'utilisateur n'est pas abonné ou si la capacité palier est atteinte
 *   - Retourne un message d'erreur FR explicite avec lien vers le portail si applicable
 *
 * Attend `reseauNationalId` pour pré-remplir la relation parent dans la Server Action.
 */
import { useState, useRef, useActionState } from 'react'
import { Plus, X, Loader2, Network } from 'lucide-react'
import { createLocalReseau } from '@/app/(frontend)/dashboard/locaux/actions'

interface CreerLocalButtonProps {
  reseauNationalId: string | number
  /** Appelé après une création réussie pour rafraîchir la liste */
  onSuccess?: () => void
}

type ActionState =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }

const initialState: ActionState = { status: 'idle' }

export function CreerLocalButton({ reseauNationalId, onSuccess }: CreerLocalButtonProps) {
  const [open, setOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, pending] = useActionState(
    async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
      // Injecter le reseauNationalId dans le formData
      formData.set('reseauNationalId', String(reseauNationalId))
      const result = await createLocalReseau(formData)
      if (result.success) {
        formRef.current?.reset()
        setOpen(false)
        onSuccess?.()
        return { status: 'success', message: 'Chapitre créé avec succès.' }
      }
      return { status: 'error', message: result.error ?? 'Erreur lors de la création.' }
    },
    initialState,
  )

  if (!open) {
    return (
      <div className="flex flex-col items-end gap-1">
        {state.status === 'success' && (
          <p className="text-xs text-green-700 font-medium" role="status">
            {state.message}
          </p>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs bg-[#a855f7] text-white hover:bg-[#9333ea] px-3 py-1.5 rounded-lg font-medium transition-colors"
        >
          <Plus size={13} aria-hidden />
          Nouveau chapitre
        </button>
      </div>
    )
  }

  return (
    <div className="border border-[#a855f7]/30 bg-[#faf9f5] rounded-2xl p-4 mt-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-[#18181b] flex items-center gap-1.5">
          <Network size={14} className="text-[#a855f7]" aria-hidden />
          Nouveau chapitre local
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[#71717a] hover:text-[#18181b] transition-colors"
          aria-label="Fermer le formulaire"
        >
          <X size={16} />
        </button>
      </div>

      {state.status === 'error' && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3" role="alert">
          {state.message}
        </p>
      )}

      <form ref={formRef} action={formAction} className="space-y-3">
        <div>
          <label htmlFor="local-nom" className="block text-xs font-medium text-[#52525b] mb-1">
            Nom du chapitre <span className="text-red-500" aria-hidden>*</span>
          </label>
          <input
            id="local-nom"
            name="nom"
            type="text"
            required
            maxLength={100}
            placeholder="ex. BNI Clermont-Ferrand"
            className="w-full border border-[#e4e4e7] rounded-xl px-3 py-2 text-sm text-[#18181b] placeholder:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#a855f7]/30 focus:border-[#a855f7] bg-white"
            aria-required="true"
          />
        </div>

        <div>
          <label htmlFor="local-ville" className="block text-xs font-medium text-[#52525b] mb-1">
            Ville <span className="text-red-500" aria-hidden>*</span>
          </label>
          <input
            id="local-ville"
            name="ville"
            type="text"
            required
            maxLength={100}
            placeholder="ex. Clermont-Ferrand"
            className="w-full border border-[#e4e4e7] rounded-xl px-3 py-2 text-sm text-[#18181b] placeholder:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#a855f7]/30 focus:border-[#a855f7] bg-white"
            aria-required="true"
          />
        </div>

        <div>
          <label htmlFor="local-description" className="block text-xs font-medium text-[#52525b] mb-1">
            Description <span className="text-[#a1a1aa] font-normal">(optionnel)</span>
          </label>
          <textarea
            id="local-description"
            name="description"
            rows={2}
            maxLength={500}
            placeholder="Présentez ce chapitre en quelques mots…"
            className="w-full border border-[#e4e4e7] rounded-xl px-3 py-2 text-sm text-[#18181b] placeholder:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#a855f7]/30 focus:border-[#a855f7] bg-white resize-none"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-1.5 text-xs bg-[#a855f7] text-white hover:bg-[#9333ea] px-4 py-2 rounded-xl font-semibold transition-colors disabled:opacity-60"
          >
            {pending ? (
              <>
                <Loader2 size={13} className="animate-spin" aria-hidden />
                Création…
              </>
            ) : (
              <>
                <Plus size={13} aria-hidden />
                Créer le chapitre
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
            className="text-xs text-[#71717a] hover:text-[#18181b] font-medium transition-colors disabled:opacity-40"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  )
}

'use client'

/**
 * LocalActions — Modifier / supprimer un groupe local depuis /dashboard/locaux.
 *
 * Îlot client dans une liste rendue côté serveur. Les deux Server Actions
 * revalident `/dashboard/locaux`, donc la liste se rafraîchit d'elle-même après
 * succès — pas de state local à resynchroniser.
 *
 * Autorisation : entièrement côté serveur (`chargerLocalAutorise`).
 *
 * Décision 2026-07-22 : le national modifie ET supprime tous ses groupes affiliés,
 * y compris ceux gérés par un autre compte (réseauteur Plus). `delegue` ne masque
 * donc plus rien — il déclenche un avertissement supplémentaire à la confirmation,
 * car la suppression détruit alors le travail d'un tiers.
 *
 * Suppression en deux temps plutôt qu'un `window.confirm` : dialogue natif non
 * stylable, non lisible par tous les lecteurs d'écran, et bloquant.
 */
import { useActionState, useRef, useState } from 'react'
import { Loader2, Pencil, Trash2, X } from 'lucide-react'
import ChampLieuAutocomplete from '@/components/forms/ChampLieuAutocomplete'
import {
  deleteLocalReseau,
  updateLocalReseau,
  type MutateLocalResult,
} from '@/app/(frontend)/dashboard/locaux/actions'

interface LocalActionsProps {
  local: {
    id: string | number
    nom: string
    ville: string | null
    description: string | null
  }
  /** Groupe confié à un autre compte : avertissement renforcé à la suppression. */
  delegue: boolean
}

type ActionState = { status: 'idle' } | { status: 'error'; message: string }

const initialState: ActionState = { status: 'idle' }

const inputClass =
  'w-full border border-[#DFE0E1] rounded-xl px-3 py-2 text-sm text-[#1D1E21] placeholder:text-[#999A9D] focus:outline-none focus:ring-2 focus:ring-[#3E7CA6]/30 focus:border-[#3E7CA6] bg-white'

export function LocalActions({ local, delegue }: LocalActionsProps) {
  const [mode, setMode] = useState<'idle' | 'edition' | 'confirmation'>('idle')
  const formRef = useRef<HTMLFormElement>(null)

  const [editState, editAction, editPending] = useActionState(
    async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
      formData.set('localId', String(local.id))
      const result: MutateLocalResult = await updateLocalReseau(formData)
      if (result.success) {
        setMode('idle')
        return initialState
      }
      return { status: 'error', message: result.error }
    },
    initialState,
  )

  const [deleteState, deleteAction, deletePending] = useActionState(
    async (_prev: ActionState): Promise<ActionState> => {
      const formData = new FormData()
      formData.set('localId', String(local.id))
      const result: MutateLocalResult = await deleteLocalReseau(formData)
      if (result.success) {
        // La ligne disparaît avec la revalidation — pas de reset d'état à faire.
        return initialState
      }
      setMode('idle')
      return { status: 'error', message: result.error }
    },
    initialState,
  )

  // ── Formulaire de modification ──────────────────────────────────
  if (mode === 'edition') {
    return (
      <div className="w-full border border-[#3E7CA6]/30 bg-[#F2F2F2] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-[#1D1E21] flex items-center gap-1.5">
            <Pencil size={13} className="text-[#3E7CA6]" aria-hidden />
            Modifier « {local.nom} »
          </p>
          <button
            type="button"
            onClick={() => setMode('idle')}
            className="text-[#6E7175] hover:text-[#1D1E21] transition-colors"
            aria-label="Fermer le formulaire de modification"
          >
            <X size={16} />
          </button>
        </div>

        {editState.status === 'error' && (
          <p
            className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3"
            role="alert"
          >
            {editState.message}
          </p>
        )}

        <form ref={formRef} action={editAction} className="space-y-3">
          <div>
            <label
              htmlFor={`local-nom-${local.id}`}
              className="block text-xs font-medium text-[#4E5155] mb-1"
            >
              Nom du groupe <span className="text-red-500" aria-hidden>*</span>
            </label>
            <input
              id={`local-nom-${local.id}`}
              name="nom"
              type="text"
              required
              maxLength={100}
              defaultValue={local.nom}
              className={inputClass}
              aria-required="true"
            />
          </div>

          <div>
            <label
              htmlFor={`local-ville-${local.id}`}
              className="block text-xs font-medium text-[#4E5155] mb-1"
            >
              Ville <span className="text-red-500" aria-hidden>*</span>
            </label>
            <ChampLieuAutocomplete
              mode="ville"
              id={`local-ville-${local.id}`}
              name="ville"
              required
              maxLength={100}
              defaultValue={local.ville ?? ''}
              className={inputClass}
              aria-required="true"
            />
          </div>

          <div>
            <label
              htmlFor={`local-description-${local.id}`}
              className="block text-xs font-medium text-[#4E5155] mb-1"
            >
              Description <span className="text-[#999A9D] font-normal">(optionnel)</span>
            </label>
            <textarea
              id={`local-description-${local.id}`}
              name="description"
              rows={2}
              maxLength={500}
              defaultValue={local.description ?? ''}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={editPending}
              className="flex items-center gap-1.5 text-xs bg-[#3E7CA6] text-white hover:bg-[#2E6389] p-2.5 rounded-xl font-semibold transition-colors disabled:opacity-60"
            >
              {editPending ? (
                <>
                  <Loader2 size={13} className="animate-spin" aria-hidden />
                  Enregistrement…
                </>
              ) : (
                'Enregistrer'
              )}
            </button>
            <button
              type="button"
              onClick={() => setMode('idle')}
              disabled={editPending}
              className="text-xs text-[#6E7175] hover:text-[#1D1E21] font-medium transition-colors disabled:opacity-40"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    )
  }

  // ── Confirmation de suppression ─────────────────────────────────
  if (mode === 'confirmation') {
    return (
      <div className="w-full border border-red-200 bg-red-50 rounded-2xl p-4">
        <p className="text-sm font-semibold text-red-800 mb-1">
          Supprimer « {local.nom} » ?
        </p>
        <p className="text-xs text-red-700 mb-3">
          La fiche publique du groupe sera définitivement retirée. Cette action est irréversible.
        </p>
        {delegue && (
          <p className="text-xs text-red-800 font-medium bg-red-100 border border-red-200 rounded-lg px-3 py-2 mb-3">
            Ce groupe est géré par un autre compte. Sa suppression retirera aussi son
            travail — prévenez-le si possible.
          </p>
        )}
        <form action={deleteAction} className="flex items-center gap-2">
          <button
            type="submit"
            disabled={deletePending}
            className="flex items-center gap-1.5 text-xs bg-red-600 text-white hover:bg-red-700 p-2.5 rounded-xl font-semibold transition-colors disabled:opacity-60"
          >
            {deletePending ? (
              <>
                <Loader2 size={13} className="animate-spin" aria-hidden />
                Suppression…
              </>
            ) : (
              'Oui, supprimer'
            )}
          </button>
          <button
            type="button"
            onClick={() => setMode('idle')}
            disabled={deletePending}
            className="text-xs text-[#6E7175] hover:text-[#1D1E21] font-medium transition-colors disabled:opacity-40"
          >
            Annuler
          </button>
        </form>
      </div>
    )
  }

  // ── Boutons de la ligne ─────────────────────────────────────────
  return (
    <div className="flex flex-col items-end gap-1">
      {(editState.status === 'error' || deleteState.status === 'error') && (
        <p className="text-xs text-red-700 text-right max-w-xs" role="alert">
          {editState.status === 'error' ? editState.message : null}
          {deleteState.status === 'error' ? deleteState.message : null}
        </p>
      )}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setMode('edition')}
          className="text-[#6E7175] hover:text-[#035AA6] transition-colors p-1"
          aria-label={`Modifier le groupe ${local.nom}`}
          title="Modifier"
        >
          <Pencil size={14} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setMode('confirmation')}
          className="text-[#6E7175] hover:text-red-600 transition-colors p-1"
          aria-label={`Supprimer le groupe ${local.nom}`}
          title="Supprimer"
        >
          <Trash2 size={14} aria-hidden />
        </button>
      </div>
    </div>
  )
}

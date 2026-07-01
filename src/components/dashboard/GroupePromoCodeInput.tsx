'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Tag, X } from 'lucide-react'

type GroupeResult = {
  valid: true
  type: 'groupe'
  nom: string
  code: string
  palierActuel: '0' | '5' | '10' | '15'
  palierProjete: '0' | '5' | '10' | '15'
  reductionPct: number
}

type StripeResult = {
  valid: true
  type: 'stripe'
  code: string
  promotionCodeId: string
  reductionPct: number
  reductionLabel: string
  couponName: string | null
}

type ValidationResult = GroupeResult | StripeResult

export interface GroupePromoCodeChange {
  rawCode: string
  /** Code de groupe (GRP-XXXXXX) valide, sinon null */
  validatedGroupeCode: string | null
  /** Code promo Stripe valide, sinon null */
  validatedPromotionCode: string | null
  reductionPct: number
}

interface Props {
  /**
   * Notifie le parent du code valide (groupe ou Stripe) ET de la reduction
   * projetee a chaque changement. `validatedGroupeCode` ET
   * `validatedPromotionCode` sont mutuellement exclusifs : seul l'un des deux
   * est non-null selon le type detecte par /api/groupes/validate-code.
   */
  onChange: (state: GroupePromoCodeChange) => void
  disabled?: boolean
  /**
   * Autorise la saisie d'un code promotionnel Stripe en plus des codes de
   * groupe. Defaut `true`. A passer a `false` dans les contextes ou l'API
   * appelee derriere ne sait pas appliquer un promotion_code Stripe (ex.
   * change-plan via subscriptions.update — n'a pas le support pour
   * l'instant). Un code Stripe valide est alors traite comme invalide.
   */
  allowStripePromo?: boolean
}

/**
 * Champ de saisie unifie : accepte soit un code d'affiliation de groupe
 * (GRP-XXXXXX), soit un code promotionnel Stripe (ex. INFINITE25). La
 * resolution se fait cote serveur via /api/groupes/validate-code qui essaie
 * d'abord la table `groupes` puis fallback sur stripe.promotionCodes.list.
 *
 * Debounce 500ms + AbortController pour eviter les requetes obsoletes.
 */
export default function GroupePromoCodeInput({ onChange, disabled, allowStripePromo = true }: Props) {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle')
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const trimmed = code.trim()
    if (trimmed.length === 0) {
      setStatus('idle')
      setResult(null)
      setErrorMsg(null)
      onChange({
        rawCode: '',
        validatedGroupeCode: null,
        validatedPromotionCode: null,
        reductionPct: 0,
      })
      return
    }

    setStatus('loading')
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/groupes/validate-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: trimmed }),
          signal: controller.signal,
        })
        const data = await res.json()
        if (controller.signal.aborted) return
        if (res.ok && data.valid) {
          const validated = data as ValidationResult
          // Si le caller n'autorise pas les codes Stripe, on rejette un
          // resultat de type stripe pour ne pas afficher un faux succes.
          if (validated.type === 'stripe' && !allowStripePromo) {
            setStatus('invalid')
            setResult(null)
            setErrorMsg('Code invalide dans ce contexte')
            onChange({
              rawCode: trimmed,
              validatedGroupeCode: null,
              validatedPromotionCode: null,
              reductionPct: 0,
            })
            return
          }
          setStatus('valid')
          setResult(validated)
          setErrorMsg(null)
          onChange({
            rawCode: trimmed,
            validatedGroupeCode: validated.type === 'groupe' ? validated.code : null,
            validatedPromotionCode: validated.type === 'stripe' ? validated.code : null,
            reductionPct: validated.reductionPct,
          })
        } else {
          setStatus('invalid')
          setResult(null)
          setErrorMsg(data.error || 'Code invalide')
          onChange({
            rawCode: trimmed,
            validatedGroupeCode: null,
            validatedPromotionCode: null,
            reductionPct: 0,
          })
        }
      } catch (err) {
        if (controller.signal.aborted) return
        if ((err as { name?: string }).name === 'AbortError') return
        setStatus('invalid')
        setErrorMsg('Erreur de connexion')
        onChange({
          rawCode: trimmed,
          validatedGroupeCode: null,
          validatedPromotionCode: null,
          reductionPct: 0,
        })
      }
    }, 500)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [code, onChange, allowStripePromo])

  return (
    <div className="space-y-2">
      <label htmlFor="groupe-promo-code" className="flex items-center gap-1.5 text-sm font-medium text-text-dark">
        <Tag size={14} />
        {allowStripePromo
          ? "Code d'affiliation ou code promo (optionnel)"
          : "Code d'affiliation (optionnel)"}
      </label>
      <div className="relative">
        <input
          id="groupe-promo-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={allowStripePromo ? 64 : 20}
          disabled={disabled}
          placeholder={allowStripePromo ? 'GRP-ABC123 ou code promo' : 'GRP-ABC123'}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:bg-gray-100 disabled:text-text-light"
        />
        <div className="absolute inset-y-0 right-3 flex items-center">
          {status === 'loading' && <Loader2 size={16} className="animate-spin text-text-light" />}
          {status === 'valid' && <Check size={16} className="text-emerald-600" />}
          {status === 'invalid' && <X size={16} className="text-red-500" />}
        </div>
      </div>
      {status === 'valid' && result && result.type === 'groupe' && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
          Groupe <span className="font-semibold">{result.nom}</span> — reduction{' '}
          <span className="font-semibold">-{result.reductionPct}%</span> appliquee a
          votre abonnement Infinite.
        </p>
      )}
      {status === 'valid' && result && result.type === 'stripe' && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
          Code promo <span className="font-semibold">{result.code}</span> —{' '}
          <span className="font-semibold">{result.reductionLabel}</span> applique a
          votre 1ere facture.
        </p>
      )}
      {status === 'invalid' && errorMsg && (
        <p className="text-sm text-red-700">{errorMsg}</p>
      )}
      {status === 'idle' && (
        <p className="text-xs text-text-light">
          {allowStripePromo
            ? "Saisissez un code d'affiliation de groupe (GRP-XXXXXX) ou un code promo pour beneficier d'une reduction des votre 1ere facture."
            : "Si un partenaire vous a envoye un code de groupe, saisissez-le pour beneficier de la reduction mutualisee des votre premiere facture."}
        </p>
      )}
    </div>
  )
}

/**
 * ReseauteurOnboarding — guide de démarrage, première ligne du tableau de bord.
 *
 * Server Component présentationnel : la page calcule l'état réel de chaque étape
 * (profil rempli, réseaux renseignés, participation, statut Plus) et le passe ici.
 * Rien n'est deviné côté client.
 *
 * S'adapte au niveau du compte : pour un réseauteur gratuit, la dernière étape est
 * le passage à Réseauteur Plus ; pour un Plus, elle confirme l'accès et pointe vers
 * la création d'événements. L'appelant décide de masquer le bloc quand tout est fait.
 */
import Link from 'next/link'
import { CheckCircle2, Circle, Sparkles, ArrowRight } from 'lucide-react'

export type OnboardingStep = {
  label: string
  done: boolean
  /** Lien de l'action à mener (absent si l'étape est déjà faite ou informative). */
  href?: string
  /** Précision affichée sous le libellé. */
  hint?: string
  /** Met l'étape en avant (accent or) — réservé au palier Plus à débloquer. */
  accent?: boolean
}

export default function ReseauteurOnboarding({ steps }: { steps: OnboardingStep[] }) {
  const done = steps.filter((s) => s.done).length
  const total = steps.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <section
      aria-labelledby="onboarding-titre"
      className="rsn-card rounded-2xl p-5 sm:p-6 border-l-4 border-l-[#035AA6]"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="rsn-eyebrow mb-1">
            <Sparkles size={13} aria-hidden />
            Bien démarrer
          </p>
          <h2 id="onboarding-titre" className="text-lg font-bold text-[#012A4A]">
            {done < total ? 'Complétez votre espace réseauteur' : 'Votre espace est prêt'}
          </h2>
        </div>
        <span
          className="shrink-0 text-sm font-bold text-[#035AA6] tabular-nums"
          aria-label={`${done} étapes sur ${total} terminées`}
        >
          {done}/{total}
        </span>
      </div>

      {/* Barre de progression */}
      <div
        className="h-1.5 w-full rounded-full bg-[#E9E9EA] overflow-hidden mb-5"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progression de la configuration"
      >
        <div
          className="h-full rounded-full bg-[#035AA6] transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="flex flex-col gap-1">
        {steps.map((step) => {
          const Icon = step.done ? CheckCircle2 : Circle
          const iconColor = step.done
            ? 'text-green-600'
            : step.accent
              ? 'text-[#8A6D0B]'
              : 'text-[#CFD0D2]'

          const contenu = (
            <>
              <Icon size={18} className={`shrink-0 mt-0.5 ${iconColor}`} aria-hidden />
              <span className="flex-1 min-w-0">
                <span
                  className={`block text-sm font-semibold ${
                    step.done ? 'text-[#6E7175]' : 'text-[#012A4A]'
                  }`}
                >
                  {step.label}
                </span>
                {step.hint && !step.done && (
                  <span className="block text-xs text-[#6E7175] mt-0.5">{step.hint}</span>
                )}
              </span>
              {step.href && !step.done && (
                <ArrowRight
                  size={15}
                  className={`shrink-0 mt-0.5 ${step.accent ? 'text-[#8A6D0B]' : 'text-[#035AA6]'}`}
                  aria-hidden
                />
              )}
            </>
          )

          return (
            <li key={step.label}>
              {step.href && !step.done ? (
                <Link
                  href={step.href}
                  className={`flex items-start gap-3 rounded-xl p-2.5 no-underline transition-colors ${
                    step.accent ? 'hover:bg-[#FEFBE6]' : 'hover:bg-[#E9E9EA]'
                  }`}
                >
                  {contenu}
                </Link>
              ) : (
                <div className="flex items-start gap-3 p-2.5">{contenu}</div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

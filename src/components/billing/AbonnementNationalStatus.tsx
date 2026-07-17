/**
 * AbonnementNationalStatus — Composant serveur affichant le statut d'abonnement d'un réseau national.
 *
 * Affiche :
 *   - Palier actuel (starter / growth / enterprise) et capacité (nbLocaux / maxLocaux)
 *   - Date de renouvellement / expiration
 *   - Alerte si capacité atteinte → invitation à monter de palier via le portail Stripe
 *   - Action : PortalButton (si actif) ou CheckoutNationalButton (si inactif)
 *
 * Source de vérité : valeurs issues de la DB (posées par les webhooks Stripe).
 * JAMAIS deduit du client (invariant ADR-0011/0012).
 *
 * Props : données national déjà chargées par le dashboard parent (NationalDashboard).
 */
import { CheckCircle, AlertCircle, Clock, Network, CreditCard, TrendingUp } from 'lucide-react'
import { PALIERS_CONFIG, maxLocaux } from '@/lib/reseau-hierarchie'
import { CheckoutPartenaireButton, PortalButton } from '@/app/(frontend)/dashboard/(organisateur)/reseau/CheckoutButtons'

interface AbonnementNationalStatusProps {
  national: Record<string, unknown>
  /** Nombre de locaux actuellement créés sous ce national. */
  nbLocaux: number
}

export function AbonnementNationalStatus({ national, nbLocaux }: AbonnementNationalStatusProps) {
  const estPartenaire = Boolean(national.partenaire)
  const palier = (national.palier as string | null | undefined) ?? null
  const expireAt = national.partenaireExpireAt as string | null | undefined

  const palierConfig = palier ? PALIERS_CONFIG[palier] : null
  const palierLabel = palierConfig?.label ?? (palier ? palier : 'Aucun')
  const maxLocauxPalier = maxLocaux(palier)
  // Palier « fiche » (0 groupe) : pas de jauge ni d'alerte capacité (0 >= 0 sinon)
  const palierFicheSeule = maxLocauxPalier === 0
  const capaciteAtteinte = estPartenaire && !palierFicheSeule && nbLocaux >= maxLocauxPalier
  const ficheSuspendue = (national.statut as string | undefined) !== 'publiee'

  const partenaireExpireDisplay = expireAt
    ? new Date(expireAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  if (estPartenaire) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5 space-y-3">
        {/* Statut actif */}
        <div className="flex items-start gap-3">
          <CheckCircle size={20} className="text-green-600 shrink-0 mt-0.5" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-800 mb-1">Abonnement réseau actif</p>
            <p className="text-xs text-green-700">
              {palierFicheSeule
                ? 'Fiche réseau publiée · Fiche enrichie · Logo page d’accueil.'
                : 'Fiche réseau publiée · Création de groupes locaux · Publication d’événements · Logo page d’accueil.'}
            </p>
          </div>
          <PortalButton className="shrink-0 text-xs text-green-700 border border-green-300 bg-white hover:bg-green-50 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-60">
            Gérer l&apos;abonnement
          </PortalButton>
        </div>

        {/* Palier + capacité */}
        <div className="bg-white/70 rounded-xl p-3 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-green-700">
            <CreditCard size={12} aria-hidden />
            <span className="font-medium">Palier :</span>
            <span>{palierLabel}</span>
          </div>
          {palierFicheSeule ? (
            <div className="flex items-center gap-1.5 text-green-700">
              <Network size={12} aria-hidden />
              <span>Palier fiche — montez de palier pour créer des groupes locaux.</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-green-700">
              <Network size={12} aria-hidden />
              <span className="font-medium">Groupes locaux :</span>
              <span
                className={capaciteAtteinte ? 'text-amber-700 font-semibold' : ''}
                aria-label={`${nbLocaux} groupes sur ${maxLocauxPalier} autorisés`}
              >
                {nbLocaux} / {maxLocauxPalier === 999 ? '∞' : maxLocauxPalier}
              </span>
            </div>
          )}
          {partenaireExpireDisplay && (
            <div className="flex items-center gap-1.5 text-green-600">
              <Clock size={12} aria-hidden />
              <span>Renouvellement le {partenaireExpireDisplay}</span>
            </div>
          )}
        </div>

        {/* Alerte capacité atteinte → upgrade palier */}
        {capaciteAtteinte && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <TrendingUp size={15} className="text-amber-600 shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-800 mb-0.5">
                Capacité atteinte — {nbLocaux} groupe{nbLocaux > 1 ? 's' : ''} sur {maxLocauxPalier === 999 ? '∞' : maxLocauxPalier}
              </p>
              <p className="text-xs text-amber-700">
                Votre palier actuel ({palier ?? 'starter'}) est plein. Montez de palier pour créer davantage de groupes.
              </p>
              <PortalButton className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-800 border border-amber-300 bg-white hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
                <TrendingUp size={11} aria-hidden />
                Upgrader mon palier
              </PortalButton>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Non abonné
  return (
    <div className="rounded-2xl border border-[#e4e4e7] bg-[#faf9f5] p-5 space-y-3">
      {/* ADR-0014 : sans abonnement, la fiche revendiquée n'est pas visible publiquement */}
      {ficheSuspendue && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs text-amber-800">
            <span className="font-semibold">Votre fiche réseau n&apos;est pas visible publiquement.</span>{' '}
            Souscrivez un abonnement (dès le palier fiche) pour la publier sur l&apos;annuaire et la carte.
          </p>
        </div>
      )}
      <div className="flex items-start gap-3">
        <AlertCircle size={20} className="text-[#71717a] shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#18181b] mb-1">Sans abonnement</p>
          <p className="text-xs text-[#71717a] mb-3">
            Souscrivez un abonnement pour publier votre fiche, créer vos groupes locaux et publier des événements.
          </p>
          {/* Sélecteur de palier */}
          <PalierSelector reseauId={national.id as string | number} />
        </div>
      </div>
    </div>
  )
}

/**
 * Sélecteur de palier d'abonnement national.
 * Composant client rendu dans la section "Non abonné".
 */
function PalierSelector({ reseauId }: { reseauId: string | number }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[#52525b]">Choisissez votre palier :</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {Object.entries(PALIERS_CONFIG).map(([palier, cfg]) => (
          <div key={palier} className="border border-[#e4e4e7] rounded-xl p-3 bg-white">
            <p className="text-xs font-semibold text-[#18181b] mb-0.5">{palier.charAt(0).toUpperCase() + palier.slice(1)}</p>
            <p className="text-[10px] text-[#71717a] mb-2">
              {cfg.maxLocaux === 0
                ? 'Publication de la fiche — sans groupes locaux'
                : cfg.maxLocaux === 999
                  ? 'Fiche publiée + locaux illimités'
                  : `Fiche publiée + jusqu'à ${cfg.maxLocaux} locaux`}
            </p>
            {/* TODO prix réels à afficher ici (fournis par le product owner) */}
            <CheckoutPartenaireButton
              reseauId={reseauId}
              palier={palier}
              className="w-full text-xs bg-[#f5851f] text-white hover:bg-[#e07518] px-2 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-60"
            >
              Choisir
            </CheckoutPartenaireButton>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-[#a1a1aa]">
        {/* TODO : afficher les prix réels ici (STRIPE_PRICE_NATIONAL_STARTER/GROWTH/ENTERPRISE) */}
        Les tarifs vous seront présentés sur la page de paiement Stripe.
      </p>
    </div>
  )
}

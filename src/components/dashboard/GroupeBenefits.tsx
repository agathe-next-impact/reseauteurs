import { Users, Percent, Share2 } from 'lucide-react'

export default function GroupeBenefits() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5">
        <div className="inline-flex w-10 h-10 items-center justify-center rounded-full bg-amber-100 border border-amber-200 mb-3">
          <Users size={20} className="text-amber-600" />
        </div>
        <h3 className="text-sm font-semibold text-text-dark mb-1">
          Renforcez votre réseau
        </h3>
        <p className="text-sm text-text-light">
          Regroupez plusieurs établissements partenaires sous un même groupe pour mutualiser
          votre visibilité et vos avantages.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5">
        <div className="inline-flex w-10 h-10 items-center justify-center rounded-full bg-amber-100 border border-amber-200 mb-3">
          <Percent size={20} className="text-amber-600" />
        </div>
        <h3 className="text-sm font-semibold text-text-dark mb-1">
          Économisez à plusieurs
        </h3>
        <p className="text-sm text-text-light">
          Plus votre groupe grandit, plus chaque membre profite d&apos;un avantage tarifaire
          appliqué automatiquement à son abonnement.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5">
        <div className="inline-flex w-10 h-10 items-center justify-center rounded-full bg-amber-100 border border-amber-200 mb-3">
          <Share2 size={20} className="text-amber-600" />
        </div>
        <h3 className="text-sm font-semibold text-text-dark mb-1">
          Un code, simple à partager
        </h3>
        <p className="text-sm text-text-light">
          Partagez votre code d&apos;affiliation à vos confrères : ils rejoignent votre groupe
          en un clic depuis leur tableau de bord.
        </p>
      </div>
    </div>
  )
}

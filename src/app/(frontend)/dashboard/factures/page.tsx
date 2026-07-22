/**
 * Dashboard — Factures
 *
 * Accessible aux organisateurs (réseau partenaire) et potentiellement aux annonceurs.
 * Récupère les factures via l'API Stripe avec le stripeCustomerId du user.
 * Toujours côté serveur — on ne communique jamais les factures via le client.
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { stripe } from '@/lib/stripe'
import { FileText, Download, ExternalLink, CreditCard } from 'lucide-react'
import Link from 'next/link'
import Reveal from '@/components/home/Reveal'
import type Stripe from 'stripe'

export const metadata = {
  title: 'Mes factures — Tableau de bord | RÉSEAUTEURS',
  robots: { index: false },
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100)
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function FacturesPage() {
  const hdrs = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })

  if (!user) redirect('/login')

  const freshUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
  })

  // Factures accessibles à tout rôle souscripteur ayant un customer Stripe
  // (réseauteur Plus inclus — ADR-0016). L'admin gère via le back-office.
  if (freshUser.role === 'admin') redirect('/admin')

  const stripeCustomerId = (freshUser as unknown as Record<string, unknown>).stripeCustomerId as string | null | undefined

  let invoices: Stripe.Invoice[] = []
  let stripeError: string | null = null

  if (stripeCustomerId) {
    try {
      const response = await stripe.invoices.list({
        customer: stripeCustomerId,
        limit: 50,
        expand: ['data.subscription'],
      })
      invoices = response.data
    } catch (err) {
      console.error('[dashboard/factures] Stripe error:', err)
      stripeError = 'Impossible de charger les factures. Réessayez dans quelques instants.'
    }
  }

  const paidInvoices = invoices.filter((inv) => inv.status === 'paid')
  const openInvoices = invoices.filter((inv) => inv.status === 'open')

  return (
    <div className="rsn-page">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Reveal>
        <div className="flex items-center justify-between mb-2">
          <p className="rsn-eyebrow">Espace connecté</p>
        </div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-extrabold text-[#012A4A] flex items-center gap-2">
            <FileText size={20} aria-hidden />
            Mes factures
          </h1>
          {stripeCustomerId && (
            <form action="/api/stripe/portal" method="POST">
              <button
                type="submit"
                className="text-sm text-[#035AA6] hover:text-[#02467F] font-medium flex items-center gap-1.5 transition-colors"
              >
                Portail Stripe
              </button>
            </form>
          )}
        </div>
      </Reveal>

      {!stripeCustomerId ? (
        <div className="rsn-card rounded-2xl border-dashed p-8 text-center">
          <CreditCard size={32} className="text-[#CFD0D2] mx-auto mb-4" aria-hidden />
          <p className="text-sm font-medium text-[#4E5155] mb-2">Aucun abonnement actif</p>
          <p className="text-sm text-[#6E7175] mb-6">
            Vous n&apos;avez pas encore d&apos;abonnement. Souscrivez pour accéder à vos factures.
          </p>
          <Link
            href="/dashboard/abonnement"
            className="inline-flex items-center gap-2 p-2.5 rounded-xl bg-[#035AA6] text-white font-semibold text-sm hover:bg-[#02467F] transition-colors"
          >
            Gérer mon abonnement →
          </Link>
        </div>
      ) : stripeError ? (
        <div className="bg-red-50 rounded-2xl border border-red-200 p-6 text-center">
          <p className="text-sm text-red-700">{stripeError}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Factures impayées */}
          {openInvoices.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[#1D1E21] mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" aria-hidden />
                En attente de paiement
              </h2>
              <div className="space-y-2">
                {openInvoices.map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} />
                ))}
              </div>
            </div>
          )}

          {/* Factures payées */}
          <div>
            <h2 className="text-sm font-semibold text-[#1D1E21] mb-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" aria-hidden />
              Payées
              {paidInvoices.length > 0 && (
                <span className="text-[#999A9D] font-normal">({paidInvoices.length})</span>
              )}
            </h2>
            {paidInvoices.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#DFE0E1] p-6 text-center">
                <p className="text-sm text-[#6E7175]">Aucune facture payée pour l&apos;instant.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {paidInvoices.map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} />
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-[#999A9D] text-center pt-2">
            Les factures sont générées et hébergées par Stripe.
            Pour toute question, contactez{' '}
            <a href="mailto:contact@reseauteurs.com" className="text-[#035AA6] hover:underline">
              contact@reseauteurs.com
            </a>.
          </p>
        </div>
      )}
      </div>
    </div>
  )
}

function InvoiceRow({ invoice }: { invoice: Stripe.Invoice }) {
  // ADR-0012 §3 : l'événement Premium ponctuel est supprimé — libellé de fallback corrigé.
  // Stripe API 2026 : le lien vers l'abonnement vit sous invoice.parent.subscription_details.
  const fromSubscription = invoice.parent?.subscription_details?.subscription
  const label = (invoice.lines?.data?.[0]?.description as string | null | undefined)
    ?? (fromSubscription ? 'Abonnement réseau partenaire' : 'Abonnement')

  return (
    <div className="rsn-card flex items-center gap-3 p-4 rounded-xl">
      <div className="shrink-0 flex items-center justify-center text-[#6E7175]" aria-hidden>
        <FileText size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1D1E21] truncate">{label}</p>
        <p className="text-xs text-[#6E7175]">
          {invoice.created ? formatDate(invoice.created) : '—'}
          {' · '}
          {invoice.amount_due ? formatAmount(invoice.amount_due, invoice.currency) : '—'}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          invoice.status === 'paid'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {invoice.status === 'paid' ? 'Payée' : 'En attente'}
        </span>
        {invoice.invoice_pdf && (
          <a
            href={invoice.invoice_pdf}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 rounded-lg text-[#6E7175] hover:text-[#035AA6] hover:bg-[#EFF5FA] transition-colors"
            aria-label="Télécharger la facture PDF"
          >
            <Download size={14} />
          </a>
        )}
        {invoice.hosted_invoice_url && (
          <a
            href={invoice.hosted_invoice_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 rounded-lg text-[#6E7175] hover:text-[#035AA6] hover:bg-[#EFF5FA] transition-colors"
            aria-label="Voir la facture en ligne"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  )
}

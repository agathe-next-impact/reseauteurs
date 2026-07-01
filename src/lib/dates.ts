/**
 * Helpers de date ancres sur Europe/Paris (TZ metier marche francais).
 *
 * Le serveur Vercel tourne en UTC, le navigateur en TZ locale du visiteur.
 * Sans ancrage explicite, les bornes "aujourd'hui / hier" derivent : un user
 * en debut de journee Pacifique (= encore hier UTC) verrait son evenement
 * accepte cote client mais refuse cote serveur, et reciproquement.
 *
 * Toutes les comparaisons "evenement deja termine" passent par ces helpers
 * pour que client, serveur et input <type="date"> partagent la meme reference.
 */

const PARIS_DATE_FMT = new Intl.DateTimeFormat('fr-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function shiftDate(yyyymmdd: string, days: number): string {
  const [y, m, d] = yyyymmdd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/** YYYY-MM-DD pour "aujourd'hui Europe/Paris". */
export function todayParisDateString(now: Date = new Date()): string {
  return PARIS_DATE_FMT.format(now)
}

/** YYYY-MM-DD pour "hier Europe/Paris". */
export function yesterdayParisDateString(now: Date = new Date()): string {
  return shiftDate(todayParisDateString(now), -1)
}

/**
 * Convertit une valeur de date Payload (Date | string ISO | null) en
 * YYYY-MM-DD ancre Europe/Paris. Renvoie null si la valeur est absente ou
 * invalide. A utiliser avant comparaison lexicographique avec todayParis /
 * yesterdayParis.
 */
export function toParisDateString(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return PARIS_DATE_FMT.format(d)
}

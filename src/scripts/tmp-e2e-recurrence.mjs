// Test e2e éphémère — création d'un événement récurrent (hebdo × 4) via l'UI réelle.
import { chromium } from '@playwright/test'

const BASE = 'http://localhost:3000'
const TITRE = 'E2E récurrence hebdo — à supprimer'

const browser = await chromium.launch()
const context = await browser.newContext()

// Login via l'API (pose le cookie payload-token dans le contexte)
const login = await context.request.post(`${BASE}/api/users/login`, {
  data: { email: 'demo-organisateur@demo.reseauteurs.fr', password: 'Demo12345!' },
})
if (!login.ok()) {
  console.error('LOGIN FAIL', login.status())
  process.exit(1)
}

const page = await context.newPage()
await page.goto(`${BASE}/dashboard/evenements`, { waitUntil: 'networkidle' })

// Ouvrir le formulaire de création
const addBtn = page.getByRole('button', { name: /Ajouter un événement|Créer le premier événement/ })
await addBtn.first().click()

// Champs minimaux + récurrence hebdomadaire sur 4 semaines
await page.fill('#titre', TITRE)
await page.fill('#dateDebut', '2026-08-04T18:00')
await page.selectOption('#recurrence', 'hebdomadaire')
await page.waitForSelector('#recurrenceFin')
await page.fill('#recurrenceFin', '2026-08-25')
await page.fill('#lieuVille', 'Paris')

await page.getByRole('button', { name: "Publier l'événement" }).click()
// La création recharge la page (window.location.reload) — attendre le rechargement
await page.waitForLoadState('networkidle')
await page.waitForTimeout(2500)
await page.reload({ waitUntil: 'networkidle' })

const count = await page.locator(`text=${TITRE}`).count()
console.log(`OCCURRENCES VISIBLES DANS LE DASHBOARD : ${count}`)

// Une erreur affichée ?
const alert = await page.locator('[role="alert"]').allTextContents()
if (alert.length) console.log('ALERTES :', alert)

await browser.close()
process.exit(count === 4 ? 0 : 1)

import { NextRequest, NextResponse } from 'next/server'

// =====================================================================
// Protection par mot de passe (Basic Auth)
//
// Activee/desactivee via la variable d'environnement SITE_PROTECTION_ENABLED.
// Pour ouvrir le site au public : passer SITE_PROTECTION_ENABLED=false
// dans Vercel > Settings > Environment Variables (Production), puis redeploy.
// =====================================================================

const PROTECTION_ENABLED = process.env.SITE_PROTECTION_ENABLED === 'true'
const AUTH_USER = process.env.SITE_PROTECTION_USER ?? ''
const AUTH_PASS = process.env.SITE_PROTECTION_PASSWORD ?? ''

/** Paths exclus de la protection — ne pas modifier sans raison */
const PUBLIC_PATHS = [
  '/api/',          // Toutes les routes API (webhooks, cron, geo, directions, ical)
  '/admin',         // Back-office Payload CMS (a sa propre auth)
  '/sitemap.xml',   // SEO — accessible aux bots
  '/_next/',        // Assets statiques Next.js
  '/img/',          // Images publiques
  '/leaflet/',      // Assets Leaflet
  '/favicon.ico',   // Favicon
  '/icon.png',       // App icon
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p) || pathname === p)
}

/**
 * Constant-time string comparison. Edge Runtime has no `crypto.timingSafeEqual`,
 * so we implement the check manually — early-return on mismatch would leak bit
 * positions to a timing-attack observer.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

function verifyBasicAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Basic ')) return false

  try {
    const base64 = authHeader.slice(6)
    const decoded = atob(base64)
    const idx = decoded.indexOf(':')
    if (idx < 0) return false
    const user = decoded.slice(0, idx)
    const pass = decoded.slice(idx + 1)
    return safeEqual(user, AUTH_USER) && safeEqual(pass, AUTH_PASS)
  } catch {
    return false
  }
}

/**
 * Decode (sans verifier) le claim `role` d'un JWT Payload. Renvoie `null`
 * si le token est malforme. Edge-safe (atob), pas de dependance.
 * NE PAS utiliser pour de la securite : la signature n'est pas verifiee.
 */
function decodeJwtRole(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // base64url -> base64
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const json = atob(b64 + pad)
    const payload = JSON.parse(json) as { role?: unknown }
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

/** Routes requiring Payload auth (cookie payload-token) */
const AUTH_REQUIRED_PATHS = ['/dashboard']

function requiresAuth(pathname: string): boolean {
  return AUTH_REQUIRED_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

/**
 * Scans automatises de type WordPress (xmlrpc, wp-admin, wp-includes, wp-json).
 * Ces chemins 404 naturellement mais chaque hit traverse le middleware et la
 * render layer Next.js → cout serverless inutile + pollution des logs.
 * On court-circuite en renvoyant 404 directement depuis le middleware, ce qui
 * reste cote Edge et ne deferre pas vers la fonction SSR.
 */
const BOT_SCAN_PATTERNS = [
  /^\/wp-admin(\/|$)/,
  /^\/wp-includes(\/|$)/,
  /^\/wp-content(\/|$)/,
  /^\/xmlrpc\.php/,
  /^\/wp-login\.php/,
  /^\/wp-config\.php/,
  /^\/wp-json(\/|$)/,
  /^\/wordpress(\/|$)/,
  /^\/cms\/wp-/,
  /^\/wp\//,
  /^\/wp2\//,
  /^\/(blog|shop|site|test|new|old|2018|2019|2020|2021|2022|2023|2024|2025|2026)\/wp-/,
]

function isBotScan(pathname: string): boolean {
  return BOT_SCAN_PATTERNS.some((re) => re.test(pathname))
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // --- Short-circuit des bots WordPress ---
  // Doit rester AVANT toute logique d'auth ou de redirect : ces requetes ne
  // contiennent jamais de cookie `payload-token`, ne sont jamais destinees au
  // dashboard, et doivent juste etre 404 le plus vite possible.
  if (isBotScan(pathname)) {
    return new NextResponse(null, { status: 404 })
  }

  // --- Payload auth guard for protected routes ---
  if (requiresAuth(pathname)) {
    const token = request.cookies.get('payload-token')?.value
    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // --- Admin panel gate ---
  // Le JWT n'est pas verifie cryptographiquement ici (Edge Runtime sans lib
  // jwt) : on se contente de decoder le payload pour piloter la redirection.
  // C'est une garde UX, pas une garde de securite : Payload revalide la
  // signature et le role cote serveur sur chaque requete /admin et refusera
  // un token forge avec 401/403. Un attaquant peut bypasser cette redirection
  // mais n'obtiendra jamais d'acces effectif a l'admin.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const token = request.cookies.get('payload-token')?.value
    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    const role = decodeJwtRole(token)
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // --- Basic Auth site protection (staging/preview) ---
  // Protection desactivee → laisser passer
  if (!PROTECTION_ENABLED) return NextResponse.next()

  // Path public → laisser passer
  if (isPublicPath(pathname)) return NextResponse.next()

  // Identifiants non configures → laisser passer (securite : ne pas bloquer le site)
  if (!AUTH_USER || !AUTH_PASS) return NextResponse.next()

  // Verifier Basic Auth
  if (verifyBasicAuth(request)) return NextResponse.next()

  // Non authentifie → popup navigateur
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Site protege", charset="UTF-8"',
    },
  })
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files, Next.js internals, and API routes.
     * API routes are excluded to avoid Edge Runtime interference with
     * multipart uploads (file body corruption on Vercel).
     */
    '/((?!_next/static|_next/image|favicon\\.ico|api/).*)',
  ],
}

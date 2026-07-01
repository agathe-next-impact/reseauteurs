import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod/v4'
import { rateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/client-ip'

const bodySchema = z.object({
  optInMarketing: z.boolean(),
})

/**
 * PATCH /api/account/preferences
 *
 * Allows an authenticated user to update their marketing consent flag.
 * The beforeChange hook on Users persists optInMarketingAt / optOutMarketingAt.
 */
export async function PATCH(request: Request) {
  const hdrs = await headers()
  const ip = getClientIp(hdrs)
  const { success: allowed } = rateLimit(`account-prefs:${ip}`, { limit: 10, windowMs: 60_000 })
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de requetes' }, { status: 429 })
  }

  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: hdrs })
  if (!user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parametres invalides' }, { status: 400 })
  }

  try {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { optInMarketing: parsed.data.optInMarketing },
      overrideAccess: true,
    })
    return NextResponse.json({ optInMarketing: parsed.data.optInMarketing })
  } catch (err) {
    console.error('[account/preferences] error:', err)
    return NextResponse.json({ error: 'Erreur lors de la mise a jour' }, { status: 500 })
  }
}

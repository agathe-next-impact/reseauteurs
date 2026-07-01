import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { verifyUnsubscribeToken } from '@/lib/emails'
import { SITE_URL } from '@/lib/site'
import { rateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/client-ip'

/**
 * GET /api/emails/unsubscribe?token=<hmac-signed>
 *
 * One-click unsubscribe for marketing emails. Verifies the HMAC token,
 * flips optInMarketing to false, and redirects to the confirmation page.
 */
export async function GET(request: Request) {
  const ip = getClientIp(request.headers)
  const { success: allowed } = rateLimit(`unsubscribe:${ip}`, { limit: 20, windowMs: 60_000 })
  if (!allowed) {
    return NextResponse.redirect(`${SITE_URL}/desabonnement/confirme?status=ratelimit`)
  }

  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(`${SITE_URL}/desabonnement/confirme?status=invalid`)
  }

  const userId = verifyUnsubscribeToken(token)
  if (!userId) {
    return NextResponse.redirect(`${SITE_URL}/desabonnement/confirme?status=invalid`)
  }

  try {
    const payload = await getPayload({ config })
    await payload.update({
      collection: 'users',
      id: Number(userId),
      data: { optInMarketing: false },
      overrideAccess: true,
    })
    return NextResponse.redirect(`${SITE_URL}/desabonnement/confirme?status=ok`)
  } catch (err) {
    console.error('[emails/unsubscribe] error:', err)
    return NextResponse.redirect(`${SITE_URL}/desabonnement/confirme?status=error`)
  }
}

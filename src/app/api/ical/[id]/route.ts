import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { generateICS } from '@/lib/ical'
import type { Evenement } from '@/payload-types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const payload = await getPayload({ config })

  let event: Evenement
  try {
    event = await payload.findByID({
      collection: 'evenements',
      id,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return NextResponse.json({ error: 'Evenement introuvable' }, { status: 404 })
  }

  if (event.statut !== 'publie') {
    return NextResponse.json({ error: 'Evenement introuvable' }, { status: 404 })
  }

  const ics = generateICS(event)

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="event-${id}.ics"`,
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}

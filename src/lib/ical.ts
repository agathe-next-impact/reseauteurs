import type { Evenement } from '@/payload-types'

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function formatDateICS(dateStr: string): string {
  const d = new Date(dateStr)
  // If time is midnight UTC, treat as all-day → VALUE=DATE format YYYYMMDD
  const hours = d.getUTCHours()
  const minutes = d.getUTCMinutes()
  if (hours === 0 && minutes === 0) {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return y + m + day
  }
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function isAllDay(dateStr: string): boolean {
  const d = new Date(dateStr)
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

export function generateICS(event: Evenement): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const allDay = isAllDay(event.dateDebut)

  const dtStart = formatDateICS(event.dateDebut)
  const dtEnd = event.dateFin
    ? formatDateICS(event.dateFin)
    : formatDateICS(addDays(event.dateDebut, 1))

  const locationParts = [event.lieuNom, event.lieuVille].filter(Boolean)
  const location = locationParts.join(', ')

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RÉSEAUTEURS//Events//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@panorama-pub.com`,
    `DTSTAMP:${now}`,
  ]

  if (allDay) {
    lines.push(`DTSTART;VALUE=DATE:${dtStart}`)
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`)
  } else {
    lines.push(`DTSTART:${dtStart}`)
    lines.push(`DTEND:${dtEnd}`)
  }

  lines.push(`SUMMARY:${escapeICS(event.titre)}`)

  if (location) {
    lines.push(`LOCATION:${escapeICS(location)}`)
  }

  if (event.descriptionCourte) {
    lines.push(`DESCRIPTION:${escapeICS(event.descriptionCourte)}`)
  }

  if (event.lienInscription) {
    lines.push(`URL:${event.lienInscription}`)
  }

  if (event.emailContact) {
    lines.push(`ORGANIZER:mailto:${event.emailContact}`)
  }

  lines.push('END:VEVENT')
  lines.push('END:VCALENDAR')

  return lines.join('\r\n')
}

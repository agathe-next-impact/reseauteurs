import type { PayloadRequest } from 'payload'

/**
 * Extracts a media ID from a field that could be a number, an object with id, or null.
 */
function extractMediaId(field: unknown): number | null {
  if (typeof field === 'number') return field
  if (typeof field === 'object' && field !== null && 'id' in field) {
    return (field as { id: number }).id
  }
  return null
}

/**
 * Collects all media IDs from banniere, logo, and illustrations fields of a document.
 */
export function collectMediaIds(doc: Record<string, unknown>): number[] {
  const ids: number[] = []

  const banniereId = extractMediaId(doc.banniere)
  if (banniereId) ids.push(banniereId)

  const logoId = extractMediaId(doc.logo)
  if (logoId) ids.push(logoId)

  const illustrations = (doc.illustrations ?? []) as Array<{ image: unknown }>
  for (const item of illustrations) {
    const id = extractMediaId(item.image)
    if (id) ids.push(id)
  }

  return ids
}

/**
 * Deletes media records by IDs (with overrideAccess).
 * Silently ignores errors (media may already be deleted).
 */
async function deleteMediaByIds(req: PayloadRequest, ids: number[]): Promise<void> {
  for (const id of ids) {
    try {
      await req.payload.delete({
        collection: 'media',
        id,
        overrideAccess: true,
      })
    } catch {
      // Media may already be deleted or missing — ignore
    }
  }
}

/**
 * afterChange hook: deletes media that was removed or replaced during an update.
 * Compares previousDoc and doc to find orphaned media IDs.
 */
export async function cleanupOrphanedMediaOnChange({
  doc,
  previousDoc,
  req,
  operation,
}: {
  doc: Record<string, unknown>
  previousDoc?: Record<string, unknown>
  req: PayloadRequest
  operation: string
}) {
  if (operation !== 'update' || !previousDoc) return doc

  const oldIds = new Set(collectMediaIds(previousDoc))
  const newIds = new Set(collectMediaIds(doc))

  const orphaned = [...oldIds].filter((id) => !newIds.has(id))
  if (orphaned.length > 0) {
    await deleteMediaByIds(req, orphaned)
  }

  return doc
}

/**
 * afterDelete hook: deletes all media associated with a deleted document.
 */
export async function cleanupMediaOnDelete({
  doc,
  req,
}: {
  doc: Record<string, unknown>
  req: PayloadRequest
}) {
  const ids = collectMediaIds(doc)
  if (ids.length > 0) {
    await deleteMediaByIds(req, ids)
  }
}

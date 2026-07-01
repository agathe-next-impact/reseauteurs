import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        const fileSize = (data as Record<string, unknown>)?.filesize as number | undefined
        if (fileSize && fileSize > 5_242_880) {
          throw new Error('Le fichier ne doit pas depasser 5 Mo.')
        }
        return data
      },
    ],
    beforeDelete: [
      // Garde-fou contre la suppression d'un media reference ailleurs.
      // Toute collection avec un upload doit etre listee ici, sinon un admin
      // peut casser une image affichee sur une fiche/page publique sans alerte.
      async ({ id, req }) => {
        type CheckTarget = {
          collection: 'fournisseurs' | 'evenements' | 'organisateurs-evenements' | 'labels-rse' | 'testimonials'
          fields: string[]
          arrayPath?: string
        }
        const targets: CheckTarget[] = [
          { collection: 'fournisseurs', fields: ['banniere', 'logo'], arrayPath: 'illustrations.image' },
          { collection: 'evenements', fields: ['banniere', 'logo'], arrayPath: 'illustrations.image' },
          { collection: 'organisateurs-evenements', fields: ['banniere', 'logo'], arrayPath: 'illustrations.image' },
          { collection: 'labels-rse', fields: ['logo'] },
          { collection: 'testimonials', fields: ['logo'] },
        ]

        for (const { collection, fields, arrayPath } of targets) {
          for (const field of fields) {
            const { totalDocs } = await req.payload.find({
              collection,
              where: { [field]: { equals: id } },
              limit: 0,
              overrideAccess: true,
            })
            if (totalDocs > 0) {
              throw new Error(
                `Impossible de supprimer ce media : utilise par ${totalDocs} ${collection}.`,
              )
            }
          }
          if (arrayPath) {
            const { totalDocs } = await req.payload.find({
              collection,
              where: { [arrayPath]: { equals: id } },
              limit: 0,
              overrideAccess: true,
            })
            if (totalDocs > 0) {
              throw new Error(
                `Impossible de supprimer ce media : utilise dans les illustrations de ${totalDocs} ${collection}.`,
              )
            }
          }
        }
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    // En dev (sans token Blob) : stockage local. En prod (token defini) : Vercel Blob.
    disableLocalStorage: !!process.env.BLOB_READ_WRITE_TOKEN,
    imageSizes: [
      { name: 'thumbnail', width: 300, height: undefined, position: 'centre' },
      { name: 'card', width: 600, height: undefined, position: 'centre' },
      { name: 'full', width: 1200, height: undefined, position: 'centre' },
    ],
    adminThumbnail: 'thumbnail',
  },
}

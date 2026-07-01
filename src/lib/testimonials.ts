import { getPayload } from 'payload'
import config from '@payload-config'

export async function getTestimonials() {
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'testimonials',
    where: { isPublished: { equals: true } },
    sort: '-createdAt',
    limit: 12,
    depth: 1,
    select: {
      rating: true,
      quote: true,
      author: true,
      company: true,
      logo: true,
    },
    overrideAccess: true,
  })

  return docs
}

import Image from 'next/image'
import { getTestimonials } from '@/lib/testimonials'
import type { Media as MediaType } from '@/payload-types'

function StarRating({ rating }: { rating: number }) {
  return (
    <div
      className="flex gap-0.5"
      role="img"
      aria-label={`Note : ${rating} sur 5`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`h-4 w-4 ${i < rating ? 'text-yellow-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

export async function TestimonialsGrid() {
  const testimonials = await getTestimonials()

  if (testimonials.length === 0) return null

  const loop = [...testimonials, ...testimonials]

  return (
    <div
      className="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]"
    >
      <div
        className="flex w-max gap-6 animate-marquee group-hover:[animation-play-state:paused]"
      >
        {loop.map((t, idx) => {
          const logo = t.logo as MediaType | null | undefined
          return (
            <div
              key={`${t.id}-${idx}`}
              aria-hidden={idx >= testimonials.length ? true : undefined}
              className="w-80 shrink-0 bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4"
            >
              <StarRating rating={t.rating} />
              <blockquote className="text-text-dark text-sm leading-relaxed flex-1">
                &laquo;&nbsp;{t.quote}&nbsp;&raquo;
              </blockquote>
              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                {logo?.url && (
                  <Image
                    src={logo.url}
                    alt={logo.alt || t.company || ''}
                    width={96}
                    height={96}
                    className="w-24 h-24 object-contain rounded"
                  />
                )}
                <div>
                  <p className="text-sm font-semibold text-text-dark">{t.author}</p>
                  {t.company && (
                    <p className="text-sm text-text-light">{t.company}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

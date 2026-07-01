import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/dashboard/',
          '/api/',
          '/reset-password',
          '/verify',
          '/mot-de-passe-oublie',
          '/desabonnement/',
        ],
      },
      {
        // Autorise explicitement les crawlers IA generatifs — RÉSEAUTEURS veut
        // apparaitre dans les reponses de ChatGPT, Perplexity, Claude & co
        // (plateforme de networking => visibilite generative souhaitee).
        userAgent: ['GPTBot', 'ChatGPT-User', 'PerplexityBot', 'ClaudeBot', 'Claude-Web', 'Google-Extended', 'Applebot-Extended'],
        allow: '/',
        disallow: ['/admin/', '/dashboard/', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}

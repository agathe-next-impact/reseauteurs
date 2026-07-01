'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * After Stripe checkout, the JWT cookie still has the old plan.
 * This component calls /api/users/refresh-token to get a fresh JWT
 * with the updated plan from the database.
 */
function TokenRefreshInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      const sessionId = searchParams.get('session_id')
      if (sessionId) {
        // Logged pour debug : en cas de webhook rate, le support peut retrouver
        // la session Stripe correspondante via ce log cote client.
        console.info('[checkout] success session_id=', sessionId)
      }
      fetch('/api/users/refresh-token', {
        method: 'POST',
        credentials: 'include',
      }).then((res) => {
        if (res.ok) {
          router.replace('/dashboard', { scroll: false })
          router.refresh()
        }
      }).catch(() => {
        // Refresh failed — still remove query param to avoid retry loop
        router.replace('/dashboard', { scroll: false })
      })
    }
  }, [searchParams, router])

  return null
}

export default function TokenRefresh() {
  return (
    <Suspense fallback={null}>
      <TokenRefreshInner />
    </Suspense>
  )
}

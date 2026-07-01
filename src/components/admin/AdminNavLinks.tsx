'use client'

import { useRouter } from 'next/navigation'
import React from 'react'

export default function AdminNavLinks() {
  const router = useRouter()

  async function handleLogout() {
    try {
      await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
      router.push('/login')
    } catch {
      router.push('/login')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 16px', borderTop: '1px solid var(--theme-elevation-150, #e5e7eb)' }}>
      <a
        href="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--theme-text, #374151)',
          textDecoration: 'none',
          background: 'var(--theme-elevation-50, #f9fafb)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--theme-elevation-100, #f3f4f6)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--theme-elevation-50, #f9fafb)')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        Voir le site
      </a>
      <button
        onClick={handleLogout}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: '0.875rem',
          fontWeight: 500,
          color: '#dc2626',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--theme-elevation-100, #f3f4f6)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Déconnexion
      </button>
    </div>
  )
}

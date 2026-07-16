'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { X } from 'lucide-react'

interface SlideOverProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  /** On mobile, show as a bottom sheet (1/3 height) instead of full-screen overlay */
  mobileBottomSheet?: boolean
}

export default function SlideOver({ isOpen, onClose, children, mobileBottomSheet }: SlideOverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const dragStartRef = useRef<number | null>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()

      // Focus trap
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      document.addEventListener('keydown', handleKeyDown)
      // Focus the close button after a short delay (animation)
      setTimeout(() => {
        panelRef.current?.querySelector<HTMLElement>('button')?.focus()
      }, 100)
      return () => document.removeEventListener('keydown', handleKeyDown)
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus()
      previousFocusRef.current = null
    }
  }, [isOpen, handleKeyDown])

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className={`fixed inset-0 z-[999] bg-black/20 transition-opacity duration-200 ${
            mobileBottomSheet ? 'hidden md:block' : ''
          }`}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={isOpen}
        aria-label="Panneau de détail"
        className={[
          'fixed z-[1000] bg-white overflow-y-auto transition-all duration-[280ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
          // Desktop: always side panel
          'md:top-0 md:right-0 md:h-dvh md:w-1/2 md:min-w-[420px] md:max-w-[680px] md:border-l md:border-[#e4e4e7]',
          isOpen ? 'md:translate-x-0' : 'md:translate-x-full',
          // Mobile: bottom sheet or full-screen
          mobileBottomSheet
            ? `left-0 right-0 bottom-0 h-[34dvh] rounded-t-2xl border-t border-[#e4e4e7] ${
                isOpen ? 'translate-y-0' : 'translate-y-full'
              }`
            : `top-0 right-0 h-dvh w-full ${
                isOpen ? 'translate-x-0' : 'translate-x-full'
              }`,
          // Reset mobile transforms on desktop
          mobileBottomSheet ? 'md:translate-y-0 md:rounded-none md:left-auto md:w-1/2 md:h-dvh md:border-l md:border-[#e4e4e7]' : '',
        ].join(' ')}
        style={dragOffset > 0 ? { transform: mobileBottomSheet ? `translateY(${dragOffset}px)` : `translateX(${dragOffset}px)`, transition: 'none' } : undefined}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Fermer"
          className={`absolute top-3 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors cursor-pointer ${
            mobileBottomSheet ? 'hidden md:flex' : ''
          }`}
        >
          <X size={20} />
        </button>

        {/* Drag handle — mobile bottom sheet only (swipeable) */}
        {mobileBottomSheet && (
          <div
            className="md:hidden flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none"
            onTouchStart={(e) => {
              dragStartRef.current = e.touches[0].clientY
            }}
            onTouchMove={(e) => {
              if (dragStartRef.current == null) return
              const dy = e.touches[0].clientY - dragStartRef.current
              if (dy > 0) setDragOffset(dy)
            }}
            onTouchEnd={() => {
              if (dragOffset > 80) {
                onClose()
              }
              setDragOffset(0)
              dragStartRef.current = null
            }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
        )}

        {/* Content */}
        <div
          className={`px-6 pb-6 ${mobileBottomSheet ? 'pt-1 md:pt-4' : 'pt-4'}`}
          {...(!mobileBottomSheet ? {
            onTouchStart: (e: React.TouchEvent) => {
              dragStartRef.current = e.touches[0].clientX
            },
            onTouchMove: (e: React.TouchEvent) => {
              if (dragStartRef.current == null) return
              const dx = e.touches[0].clientX - dragStartRef.current
              if (dx > 0) setDragOffset(dx)
            },
            onTouchEnd: () => {
              if (dragOffset > 100) {
                onClose()
              }
              setDragOffset(0)
              dragStartRef.current = null
            },
          } : {})}
        >
          {children}
        </div>
      </div>
    </>
  )
}
